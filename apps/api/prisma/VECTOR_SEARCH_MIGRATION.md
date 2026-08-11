# pgvector Migration Path

The current Prisma datasource is MongoDB. `KnowledgeChunk.embedding` and `Memory.embedding` are `Float[]`, and current similarity search must remain unchanged until a deliberate database migration to PostgreSQL is approved.

pgvector requires a PostgreSQL deployment and is not a drop-in Prisma/MongoDB change. Plan it as a data migration with a tested rollback, not as a schema-only edit.

## Proposed migration

1. Provision PostgreSQL with `CREATE EXTENSION IF NOT EXISTS vector`.
2. Migrate the Prisma datasource from MongoDB to PostgreSQL, including ObjectId-to-UUID/string identifier decisions, relational data migration, backups, and rollback validation.
3. Choose one embedding dimension per model (for example, `1536`) and regenerate every existing embedding. Mixed dimensions cannot share a vector column or index.
4. During the PostgreSQL migration, model the fields as pgvector columns. Until Prisma has native vector support for the selected version, declare them with `Unsupported("vector(1536)")` and create the columns and indexes in a SQL migration:

   ```sql
   ALTER TABLE "KnowledgeChunk" ADD COLUMN embedding vector(1536);
   ALTER TABLE "Memory" ADD COLUMN embedding vector(1536);

   CREATE INDEX "KnowledgeChunk_embedding_hnsw"
     ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64);

   CREATE INDEX "Memory_embedding_hnsw"
     ON "Memory" USING hnsw (embedding vector_cosine_ops)
     WITH (m = 16, ef_construction = 64);
   ```

5. Backfill vectors in controlled batches, validate dimension/count parity, then switch reads to ANN queries. Keep the existing MongoDB data available until production validation and rollback windows close.

## ANN query shape

Use a parameterized `$queryRaw` query. Serialize the query embedding as a pgvector literal such as `[0.1,0.2,...]`; never interpolate user-controlled SQL identifiers or values.

```ts
const vector = `[${embedding.join(",")}]`;
const matches = await prisma.$queryRaw<
  Array<{ id: string; content: string; distance: number }>
>`SELECT id, content, embedding <=> ${vector}::vector AS distance
  FROM "KnowledgeChunk"
  WHERE "workspaceId" = ${workspaceId}
  ORDER BY embedding <=> ${vector}::vector
  LIMIT ${limit}`;
```

`<=>` uses cosine distance with `vector_cosine_ops`; lower values are closer. Tune `hnsw.ef_search` and benchmark recall/latency against representative workspace-scoped data before selecting production defaults.

## Non-goals

This note does not authorize changing the active MongoDB datasource, Prisma schema, application queries, or embeddings. Those changes require an explicit PostgreSQL migration decision and a separately reviewed implementation plan.
