import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ExtractionStatus, Prisma } from "@prisma/client";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { PDFParse } from "pdf-parse";
import { OllamaService } from "../ollama.service";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateKnowledgeDocumentDto } from "./dto/update-knowledge-document.dto";

export const KNOWLEDGE_CHUNK_SIZE = 1_000;
export const KNOWLEDGE_CHUNK_OVERLAP = 100;

const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;
const DEFAULT_UPLOAD_DIR = "/app/uploads";
const INVALID_FILENAME_PATTERN = /[<>:"/\\|?*\u0000-\u001F]/;
const SUPPORTED_MIME_TYPES: Record<string, string[]> = {
  ".md": ["text/markdown", "text/plain"],
  ".txt": ["text/plain"],
  ".pdf": ["application/pdf"]
};

const documentSummarySelect = {
  id: true,
  filename: true,
  mimeType: true,
  extractionStatus: true,
  errorMessage: true,
  createdAt: true
} satisfies Prisma.KnowledgeDocumentSelect;

export type UploadedKnowledgeFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollamaService: OllamaService
  ) {}

  async uploadDocument(workspaceId: string, userId: string, file?: UploadedKnowledgeFile) {
    const validFile = this.validateFile(file);
    const filename = validFile.originalname.trim();
    const storageKey = this.buildStorageKey(workspaceId, filename);
    const storagePath = this.resolveStoragePath(storageKey);

    await mkdir(dirname(storagePath), { recursive: true });
    await writeFile(storagePath, validFile.buffer);

    const document = await this.prisma.knowledgeDocument.create({
      data: {
        workspaceId,
        filename,
        mimeType: validFile.mimetype,
        storageKey,
        extractionStatus: ExtractionStatus.PENDING,
        createdBy: userId
      },
      select: documentSummarySelect
    });

    this.scheduleProcessing(document.id);

    return document;
  }

  listDocuments(workspaceId: string) {
    return this.prisma.knowledgeDocument.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: documentSummarySelect
    });
  }

  async updateName(documentId: string, userId: string, dto: UpdateKnowledgeDocumentDto) {
    const document = await this.ensureDocumentAccess(documentId, userId);
    const filename = dto.name.trim();

    if (basename(filename) !== filename || INVALID_FILENAME_PATTERN.test(filename)) {
      throw new BadRequestException("文档名称不合法");
    }

    return this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { filename },
      select: documentSummarySelect
    });
  }

  async reindexDocument(documentId: string, userId: string) {
    const document = await this.ensureDocumentAccess(documentId, userId);
    const updatedDocument = await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        extractionStatus: ExtractionStatus.PENDING,
        extractedContent: null,
        errorMessage: null
      },
      select: documentSummarySelect
    });

    this.scheduleProcessing(document.id);

    return updatedDocument;
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await this.ensureDocumentAccess(documentId, userId);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          documentId: document.id
        }
      });
      await tx.knowledgeDocument.delete({
        where: {
          id: document.id
        }
      });
    });
    await this.deleteStoredFile(document.storageKey);

    return {
      id: document.id
    };
  }

  async processDocument(documentId: string) {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        mimeType: true,
        storageKey: true
      }
    });

    if (!document) {
      return;
    }

    await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        extractionStatus: ExtractionStatus.PROCESSING,
        extractedContent: null,
        errorMessage: null
      }
    });

    try {
      const fileBuffer = await readFile(this.resolveStoragePath(document.storageKey));
      const extractedContent = (await this.extractText(document.mimeType, fileBuffer)).trim();

      if (!extractedContent) {
        throw new Error("文档未提取到有效文本");
      }

      const chunks = splitIntoChunks(extractedContent);
      const chunkRecords = [];

      for (const [chunkIndex, content] of chunks.entries()) {
        const embedding = await this.ollamaService.embed(content);
        chunkRecords.push({
          documentId: document.id,
          workspaceId: document.workspaceId,
          content,
          chunkIndex,
          embedding
        });
      }

      await this.prisma.knowledgeChunk.deleteMany({
        where: {
          documentId: document.id
        }
      });
      await Promise.all(
        chunkRecords.map((chunk) => this.prisma.knowledgeChunk.create({
          data: chunk
        }))
      );
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          extractionStatus: ExtractionStatus.READY,
          extractedContent,
          errorMessage: null
        }
      });
    } catch (error) {
      await this.prisma.knowledgeChunk.deleteMany({
        where: {
          documentId: document.id
        }
      });
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          extractionStatus: ExtractionStatus.FAILED,
          extractedContent: null,
          errorMessage: this.normalizeError(error)
        }
      });
    }
  }

  private validateFile(file?: UploadedKnowledgeFile) {
    if (!file) {
      throw new BadRequestException("请上传文件");
    }

    const filename = file.originalname.trim();
    const extension = extname(filename).toLowerCase();
    const supportedMimeTypes = SUPPORTED_MIME_TYPES[extension];

    if (!filename) {
      throw new BadRequestException("文件名不能为空");
    }

    if (basename(filename) !== filename || INVALID_FILENAME_PATTERN.test(filename)) {
      throw new BadRequestException("文件名不合法");
    }

    if (!supportedMimeTypes || !supportedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException("仅支持上传 .md、.txt、.pdf 文件");
    }

    if (file.size > this.getMaxUploadSizeBytes()) {
      throw new BadRequestException(`文件大小不能超过 ${this.getMaxUploadSizeMb()} MB`);
    }

    return file;
  }

  private async ensureDocumentAccess(documentId: string, userId: string) {
    const document = await this.prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        workspaceId: true,
        storageKey: true
      }
    });

    if (!document) {
      throw new NotFoundException("知识文档不存在");
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: document.workspaceId,
        userId
      },
      select: {
        id: true
      }
    });

    if (!membership) {
      if (await isGlobalAdmin(this.prisma, userId)) {
        return document;
      }

      throw new ForbiddenException("无权访问该工作区");
    }

    return document;
  }

  private async extractText(mimeType: string, buffer: Buffer) {
    if (mimeType === "application/pdf") {
      const parser = new PDFParse({
        data: buffer
      });

      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    return buffer.toString("utf-8");
  }

  private scheduleProcessing(documentId: string) {
    setImmediate(() => {
      void this.processDocument(documentId);
    });
  }

  private buildStorageKey(workspaceId: string, filename: string) {
    return join(workspaceId, `${Date.now()}-${filename}`);
  }

  private resolveStoragePath(storageKey: string) {
    return join(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR, storageKey);
  }

  private getMaxUploadSizeMb() {
    const rawValue = Number(process.env.MAX_UPLOAD_SIZE_MB ?? DEFAULT_MAX_UPLOAD_SIZE_MB);
    return Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_MAX_UPLOAD_SIZE_MB;
  }

  private getMaxUploadSizeBytes() {
    return this.getMaxUploadSizeMb() * 1024 * 1024;
  }

  private async deleteStoredFile(storageKey: string) {
    try {
      await unlink(this.resolveStoragePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private normalizeError(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "知识文档提取失败";
  }
}

export function splitIntoChunks(content: string, chunkSize = KNOWLEDGE_CHUNK_SIZE, overlap = KNOWLEDGE_CHUNK_OVERLAP) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return [];
  }

  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let start = 0; start < normalizedContent.length; start += step) {
    const chunk = normalizedContent.slice(start, start + chunkSize).trim();

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}
