import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit
} from "@nestjs/common";
import { ExtractionStatus, Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { PDFParse } from "pdf-parse";
import { EmbeddingService } from "../ai/embedding.service";
import { isGlobalAdmin } from "../common/auth/global-admin";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateKnowledgeDocumentDto } from "./dto/update-knowledge-document.dto";

export const KNOWLEDGE_CHUNK_SIZE = 1_000;
export const KNOWLEDGE_CHUNK_OVERLAP = 150;
export const KNOWLEDGE_SHORT_DOCUMENT_THRESHOLD = 600;

const RECURSIVE_SPLIT_SEPARATORS = ["\n\n", "\n", "。", "！", "？", ".", "!", "?"];

const DEFAULT_MAX_UPLOAD_SIZE_MB = 10;
const PROCESSING_STALE_AFTER_MS = 10 * 60 * 1000;

// ponytail: read directly from env at decorator-eval time (before DI exists) — must match instance getter below.
export function getMaxUploadSizeBytes() {
  const rawValue = Number(process.env.MAX_UPLOAD_SIZE_MB ?? DEFAULT_MAX_UPLOAD_SIZE_MB);
  const mb = Number.isFinite(rawValue) && rawValue > 0 ? rawValue : DEFAULT_MAX_UPLOAD_SIZE_MB;
  return mb * 1024 * 1024;
}
export const MAX_UPLOAD_SIZE_BYTES = getMaxUploadSizeBytes();
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
export class KnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService
  ) {}

  async onModuleInit() {
    await this.requeueStaleProcessingDocuments();
  }

  async requeueStaleProcessingDocuments() {
    const staleBefore = new Date(Date.now() - PROCESSING_STALE_AFTER_MS);
    const staleDocuments = await this.prisma.knowledgeDocument.findMany({
      where: {
        extractionStatus: ExtractionStatus.PROCESSING,
        updatedAt: { lt: staleBefore }
      },
      select: { id: true }
    });
    let requeued = 0;

    for (const document of staleDocuments) {
      const { count } = await this.prisma.knowledgeDocument.updateMany({
        where: {
          id: document.id,
          extractionStatus: ExtractionStatus.PROCESSING,
          updatedAt: { lt: staleBefore }
        },
        data: {
          extractionStatus: ExtractionStatus.PENDING,
          errorMessage: null
        }
      });

      if (count === 1) {
        requeued += 1;
        this.scheduleProcessing(document.id);
      }
    }

    if (requeued > 0) {
      this.logger.warn(`Requeued ${requeued} stale knowledge document(s)`);
    }

    return requeued;
  }

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
    this.logger.log(`Uploaded knowledge document ${document.id} in workspace ${workspaceId}`);

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
      throw new BadRequestException("Invalid document name");
    }

    const updatedDocument = await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: { filename },
      select: documentSummarySelect
    });
    this.logger.log(`Renamed knowledge document ${documentId}`);
    return updatedDocument;
  }

  async reindexDocument(documentId: string, userId: string) {
    const document = await this.ensureDocumentAccess(documentId, userId);
    const updatedDocument = await this.prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        extractionStatus: ExtractionStatus.PENDING,
        errorMessage: null
      },
      select: documentSummarySelect
    });

    this.scheduleProcessing(document.id);
    this.logger.log(`Requeued knowledge document ${documentId}`);

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

    this.logger.log(`Deleted knowledge document ${documentId}`);
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
        errorMessage: null
      }
    });

    try {
      const fileBuffer = await readFile(this.resolveStoragePath(document.storageKey));
      const extractedContent = (await this.extractText(document.mimeType, fileBuffer)).trim();

      if (!extractedContent) {
        throw new Error("No valid text could be extracted from the document");
      }

      const contentHash = createHash("sha256").update(extractedContent).digest("hex");
      const duplicateDocument = await this.prisma.knowledgeDocument.findFirst({
        where: {
          workspaceId: document.workspaceId,
          contentHash,
          extractionStatus: ExtractionStatus.READY,
          id: { not: document.id }
        },
        select: { id: true }
      });

      if (duplicateDocument) {
        await this.prisma.knowledgeDocument.update({
          where: { id: document.id },
          data: {
            extractionStatus: ExtractionStatus.READY,
            extractedContent,
            contentHash,
            errorMessage: null
          }
        });
        return;
      }

      const existingDocument = await this.prisma.knowledgeDocument.findUnique({
        where: { id: document.id },
        select: { contentHash: true }
      });

      if (existingDocument?.contentHash === contentHash) {
        const existingChunkCount = await this.prisma.knowledgeChunk.count({
          where: { documentId: document.id }
        });

        if (existingChunkCount > 0) {
          await this.prisma.knowledgeDocument.update({
            where: { id: document.id },
            data: {
              extractionStatus: ExtractionStatus.READY,
              extractedContent,
              errorMessage: null
            }
          });
          return;
        }
      }

      const chunks = splitIntoChunks(extractedContent);
      const chunkRecords = [];

      for (const [chunkIndex, content] of chunks.entries()) {
        const embedding = await this.embeddingService.embed(content);
        chunkRecords.push({
          documentId: document.id,
          workspaceId: document.workspaceId,
          content,
          chunkIndex,
          embedding: embedding ?? []
        });
      }

      await this.prisma.$transaction([
        this.prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } }),
        ...chunkRecords.map((chunk) => this.prisma.knowledgeChunk.create({ data: chunk }))
      ]);
      await this.prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: {
          extractionStatus: ExtractionStatus.READY,
          extractedContent,
          contentHash,
          errorMessage: null
        }
      });
    } catch (error) {
      this.logger.error(`Knowledge document processing failed for ${documentId}: ${this.normalizeError(error)}`);
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
      throw new BadRequestException("Upload a file");
    }

    const filename = file.originalname.trim();
    const extension = extname(filename).toLowerCase();
    const supportedMimeTypes = SUPPORTED_MIME_TYPES[extension];

    if (!filename) {
      throw new BadRequestException("File name must not be empty");
    }

    if (basename(filename) !== filename || INVALID_FILENAME_PATTERN.test(filename)) {
      throw new BadRequestException("Invalid file name");
    }

    if (!supportedMimeTypes || !supportedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException("Only .md, .txt, and .pdf files are supported");
    }

    if (file.size > this.getMaxUploadSizeBytes()) {
      throw new BadRequestException(`File size must not exceed ${this.getMaxUploadSizeMb()} MB`);
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
      throw new NotFoundException("Knowledge document not found");
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

      throw new ForbiddenException("You do not have access to this workspace");
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
    // ponytail: in-process scheduling has no durable retries beyond startup recovery; use a real queue when volume or availability requires it.
    setImmediate(() => {
      void this.processDocument(documentId);
    });
  }

  private buildStorageKey(workspaceId: string, filename: string) {
    return join(workspaceId, `${randomUUID()}-${filename}`);
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

    return "Knowledge document extraction failed";
  }
}

export function splitIntoChunks(content: string, chunkSize = KNOWLEDGE_CHUNK_SIZE, overlap = KNOWLEDGE_CHUNK_OVERLAP) {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return [];
  }

  if (normalizedContent.length <= KNOWLEDGE_SHORT_DOCUMENT_THRESHOLD) {
    return [normalizedContent];
  }

  const segments = recursiveSplit(normalizedContent, chunkSize, RECURSIVE_SPLIT_SEPARATORS);
  const chunks: string[] = [];
  let current = "";

  for (const segment of segments) {
    if (current && (current.length + segment.length) > chunkSize) {
      chunks.push(current.trim());
      const overlapText = current.slice(Math.max(0, current.length - overlap));
      current = `${overlapText}${segment}`;
    } else {
      current += segment;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function recursiveSplit(text: string, chunkSize: number, separators: string[]): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const [separator, ...remainingSeparators] = separators;

  if (!separator) {
    const segments: string[] = [];

    for (let start = 0; start < text.length; start += chunkSize) {
      segments.push(text.slice(start, start + chunkSize));
    }

    return segments;
  }

  const parts = text.split(separator).filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return recursiveSplit(text, chunkSize, remainingSeparators);
  }

  return parts.flatMap((part, index) => {
    const withSeparator = index < parts.length - 1 ? `${part}${separator}` : part;
    return withSeparator.length > chunkSize
      ? recursiveSplit(withSeparator, chunkSize, remainingSeparators)
      : [withSeparator];
  });
}
