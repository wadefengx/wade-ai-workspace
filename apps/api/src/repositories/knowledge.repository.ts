import { Injectable } from "@nestjs/common";
import { ExtractionStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const MAX_DOCUMENT_CANDIDATES = 50;
const MAX_CHUNK_CANDIDATES = 500;
const DEFAULT_TOP_K = 5;

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  filename: string;
  content: string;
  chunkIndex: number;
  similarity: number;
};

@Injectable()
export class KnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async searchSimilarChunks(workspaceId: string, queryEmbedding: number[], topK = DEFAULT_TOP_K) {
    if (queryEmbedding.length === 0 || topK <= 0) {
      return [];
    }

    const documents = await this.prisma.knowledgeDocument.findMany({
      where: {
        workspaceId,
        extractionStatus: ExtractionStatus.READY
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_DOCUMENT_CANDIDATES,
      select: {
        id: true,
        filename: true
      }
    });

    if (documents.length === 0) {
      return [];
    }

    const documentIds = documents.map((document) => document.id);
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        workspaceId,
        documentId: {
          in: documentIds
        },
        document: {
          extractionStatus: ExtractionStatus.READY
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_CHUNK_CANDIDATES,
      select: {
        id: true,
        documentId: true,
        content: true,
        chunkIndex: true,
        embedding: true,
        document: {
          select: {
            filename: true
          }
        }
      }
    });

    return chunks
      .map((chunk) => ({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        filename: chunk.document.filename,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
      }))
      .filter((chunk) => Number.isFinite(chunk.similarity))
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, topK);
  }
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  return dotProduct / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
