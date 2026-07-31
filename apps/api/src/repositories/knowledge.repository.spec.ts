import { Test } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { KnowledgeRepository, cosineSimilarity } from "./knowledge.repository";

describe("KnowledgeRepository", () => {
  const prisma = {
    knowledgeDocument: {
      findMany: jest.fn()
    },
    knowledgeChunk: {
      findMany: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sorts chunks by cosine similarity and scopes queries to the workspace", async () => {
    prisma.knowledgeDocument.findMany.mockResolvedValue([{
      id: "document-1",
      filename: "guide.md"
    }]);
    prisma.knowledgeChunk.findMany.mockResolvedValue([{
      id: "chunk-1",
      documentId: "document-1",
      content: "exact",
      chunkIndex: 0,
      embedding: [1, 0],
      document: {
        filename: "guide.md"
      }
    }, {
      id: "chunk-2",
      documentId: "document-1",
      content: "close",
      chunkIndex: 1,
      embedding: [0.5, 0.5],
      document: {
        filename: "guide.md"
      }
    }, {
      id: "chunk-3",
      documentId: "document-1",
      content: "far",
      chunkIndex: 2,
      embedding: [-1, 0],
      document: {
        filename: "guide.md"
      }
    }]);

    const module = await Test.createTestingModule({
      providers: [{
        provide: PrismaService,
        useValue: prisma
      }, KnowledgeRepository]
    }).compile();
    const repository = module.get(KnowledgeRepository);

    await expect(repository.searchSimilarChunks("workspace-1", [1, 0], 2)).resolves.toEqual([{
      chunkId: "chunk-1",
      documentId: "document-1",
      filename: "guide.md",
      content: "exact",
      chunkIndex: 0,
      similarity: 1
    }, {
      chunkId: "chunk-2",
      documentId: "document-1",
      filename: "guide.md",
      content: "close",
      chunkIndex: 1,
      similarity: expect.closeTo(Math.SQRT1_2, 12)
    }]);
    expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        extractionStatus: "READY"
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        filename: true
      }
    });
    expect(prisma.knowledgeChunk.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
        documentId: {
          in: ["document-1"]
        },
        document: {
          extractionStatus: "READY"
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
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
  });

  it("returns negative infinity for invalid vectors", () => {
    expect(cosineSimilarity([], [])).toBe(Number.NEGATIVE_INFINITY);
    expect(cosineSimilarity([1, 0], [1])).toBe(Number.NEGATIVE_INFINITY);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(Number.NEGATIVE_INFINITY);
  });
});
