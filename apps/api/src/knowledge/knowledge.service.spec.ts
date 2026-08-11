import { BadRequestException } from "@nestjs/common";
import { ExtractionStatus } from "@prisma/client";
import { Test } from "@nestjs/testing";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmbeddingService } from "../ai/embedding.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  KNOWLEDGE_SHORT_DOCUMENT_THRESHOLD,
  KnowledgeService,
  splitIntoChunks
} from "./knowledge.service";

describe("KnowledgeService", () => {
  const prisma = {
    knowledgeDocument: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    knowledgeChunk: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    workspaceMember: {
      findFirst: jest.fn()
    },
    $transaction: jest.fn()
  };
  const embeddingService = {
    embed: jest.fn()
  };
  let originalUploadDir: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalUploadDir = process.env.UPLOAD_DIR;
    delete process.env.UPLOAD_DIR;
    prisma.knowledgeDocument.findFirst.mockResolvedValue(null);
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
        provide: EmbeddingService,
        useValue: embeddingService
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

  it("does not split short documents", () => {
    const content = "a".repeat(KNOWLEDGE_SHORT_DOCUMENT_THRESHOLD - 10);

    expect(splitIntoChunks(content)).toEqual([content]);
  });

  it("splits long documents into multiple overlapping chunks", () => {
    const content = Array.from({ length: 20 }, (_, index) => `Repeated filler text for paragraph ${index}.`.repeat(30)).join("\n\n");

    const chunks = splitIntoChunks(content);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toContain(chunks[0]!.slice(0, 20));
  });

  it("degrades gracefully and still marks the document ready when embedding fails", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "knowledge-service-"));
    const storageKey = "workspace-1/doc.txt";

    process.env.UPLOAD_DIR = uploadDir;
    await mkdir(join(uploadDir, "workspace-1"), { recursive: true });
    await writeFile(join(uploadDir, storageKey), "hello world");
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: "document-1",
      workspaceId: "workspace-1",
      mimeType: "text/plain",
      storageKey
    });
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      contentHash: null
    });
    prisma.knowledgeDocument.update.mockResolvedValue(undefined);
    prisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 });
    embeddingService.embed.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: embeddingService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await service.processDocument("document-1");

    expect(prisma.knowledgeDocument.update).toHaveBeenNthCalledWith(1, {
      where: { id: "document-1" },
      data: {
        extractionStatus: ExtractionStatus.PROCESSING,
        errorMessage: null
      }
    });
    expect(prisma.knowledgeDocument.update).toHaveBeenLastCalledWith({
      where: { id: "document-1" },
      data: {
        extractionStatus: ExtractionStatus.READY,
        extractedContent: "hello world",
        contentHash: expect.any(String),
        errorMessage: null
      }
    });
  });

  it("skips reindexing when a document with the same content hash is already ready", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "knowledge-dedup-"));
    const storageKey = "workspace-1/doc.txt";

    process.env.UPLOAD_DIR = uploadDir;
    await mkdir(join(uploadDir, "workspace-1"), { recursive: true });
    await writeFile(join(uploadDir, storageKey), "hello world");
    prisma.knowledgeDocument.findUnique.mockResolvedValueOnce({
      id: "document-2",
      workspaceId: "workspace-1",
      mimeType: "text/plain",
      storageKey
    });
    prisma.knowledgeDocument.update.mockResolvedValue(undefined);
    prisma.knowledgeDocument.findFirst.mockResolvedValue({ id: "document-1" });

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: embeddingService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await service.processDocument("document-2");

    expect(embeddingService.embed).not.toHaveBeenCalled();
    expect(prisma.knowledgeChunk.create).not.toHaveBeenCalled();
    expect(prisma.knowledgeDocument.update).toHaveBeenLastCalledWith({
      where: { id: "document-2" },
      data: {
        extractionStatus: ExtractionStatus.READY,
        extractedContent: "hello world",
        contentHash: expect.any(String),
        errorMessage: null
      }
    });
  });

  it("marks the document failed when text extraction fails", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "knowledge-extract-"));
    const storageKey = "workspace-1/doc.pdf";

    process.env.UPLOAD_DIR = uploadDir;
    await mkdir(join(uploadDir, "workspace-1"), { recursive: true });
    prisma.knowledgeDocument.findUnique.mockResolvedValue({
      id: "document-1",
      workspaceId: "workspace-1",
      mimeType: "application/pdf",
      storageKey
    });
    prisma.knowledgeDocument.update.mockResolvedValue(undefined);
    prisma.knowledgeChunk.deleteMany.mockResolvedValue({ count: 0 });

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, {
        provide: EmbeddingService,
        useValue: embeddingService
      }, KnowledgeService]
    }).compile();
    const service = module.get(KnowledgeService);

    await service.processDocument("document-1");

    expect(prisma.knowledgeDocument.update).toHaveBeenLastCalledWith({
      where: { id: "document-1" },
      data: {
        extractionStatus: ExtractionStatus.FAILED,
        extractedContent: null,
        errorMessage: expect.any(String)
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
        provide: EmbeddingService,
        useValue: embeddingService
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
