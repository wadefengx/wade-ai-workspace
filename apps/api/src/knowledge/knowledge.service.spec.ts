import { BadRequestException } from "@nestjs/common";
import { ExtractionStatus } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OllamaService } from "../ollama.service";
import { PrismaService } from "../prisma/prisma.service";
import { KNOWLEDGE_CHUNK_OVERLAP, KNOWLEDGE_CHUNK_SIZE, KnowledgeService, splitIntoChunks } from "./knowledge.service";

describe("KnowledgeService", () => {
  const prisma = {
    knowledgeDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    knowledgeChunk: {
      create: jest.fn(),
      deleteMany: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    },
    $transaction: jest.fn()
  };
  const ollamaService = {
    embed: jest.fn()
  };
  let originalUploadDir: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalUploadDir = process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_DIR;
  });

  afterEach(() => {
    if (originalUploadDir === undefined) {
      delete process.env.UPLOAD_DIR;
      return;
    }

    process.env.UPLOAD_DIR = originalUploadDir;
  });

  it("rejects unsupported uploads before writing anything", async () => {
    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await expect(service.uploadDocument("workspace-1", "user-1", {
      originalname: "notes.exe",
      mimetype: "application/octet-stream",
      size: 128,
      buffer: Buffer.from("bad")
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.knowledgeDocument.create).not.toHaveBeenCalled();
  });

  it("splits extracted content into overlapping chunks", () => {
    const content = "a".repeat(KNOWLEDGE_CHUNK_SIZE + (KNOWLEDGE_CHUNK_SIZE - KNOWLEDGE_CHUNK_OVERLAP) + 10);

    expect(splitIntoChunks(content)).toEqual([
      "a".repeat(KNOWLEDGE_CHUNK_SIZE),
      "a".repeat(KNOWLEDGE_CHUNK_SIZE),
      "a".repeat(KNOWLEDGE_CHUNK_OVERLAP + 10)
    ]);
  });

  it("marks the document failed when embedding fails", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "knowledge-service-"));
    const storageKey = "workspace-1/doc.txt";

    process.env.UPLOAD_DIR = uploadDir;
    await mkdir(join(uploadDir, "workspace-1"), { recursive: true });
    await writeFile(join(uploadDir, storageKey), "hello world");
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: "document-1",
      workspaceId: "workspace-1",
      mimeType: "text/plain",
      storageKey
    });
    prisma.knowledgeDocument.update.mockResolvedValue(undefined);
    prisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 });
    ollamaService.embed.mockRejectedValue(new Error("embed failed"));

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await service.processDocument("document-1");

    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(1, {
      where: { id: "document-1" },
      data: {
        extractionStatus: ExtractionStatus.PROCESSING,
        extractedContent: null,
        errorMessage: null
      }
    });
    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(2, {
      where: { id: "document-1" },
      data: {
        extractionStatus: ExtractionStatus.FAILED,
        extractedContent: null,
        errorMessage: "embed failed"
      }
    });
  });

  it("deletes chunks, the document, and the stored file together", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "knowledge-delete-"));
    const storageKey = "workspace-1/doc.txt";
    const filePath = join(uploadDir, storageKey);
    const tx = {
      knowledgeChunk: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      knowledgeDocument: {
        delete: jest.fn().mockResolvedValue(undefined)
      }
    };

    process.env.UPLOAD_DIR = uploadDir;
    await mkdir(join(uploadDir, "workspace-1"), { recursive: true });
    await writeFile(filePath, "hello world");
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: "document-1",
      workspaceId: "workspace-1",
      storageKey
    });
    prisma.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1"
    });
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: OllamaService,
        useValue: ollamaService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await expect(service.deleteDocument("document-1", "user-1")).resolves.toEqual({
      id: "document-1"
    });
    expect(tx.knowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "document-1"
      }
    });
    expect(tx.knowledgeDocument.delete).toHaveBeenCalledWith({
      where: {
        id: "document-1"
      }
    });
    await expect(access(filePath)).rejects.toBeTruthy();
  });
});
