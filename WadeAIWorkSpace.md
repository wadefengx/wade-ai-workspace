#Wade AI Workspace Ultimate Implementation Plan

Version: 0.1

## 1. Product positioning

Wade AI Workspace is an AI Native Workspace for team collaboration. It is not a replica of Slack, nor is it just a chatbot; it integrates human discussions, AI collaboration, knowledge documents and reusable memories in the same workspace.

Core closed loop:

```text
Human discussion -> AI understanding and collaboration -> Knowledge extraction/memory precipitation -> Automatically obtain context for subsequent conversations
```

The long-term goal is to form the "AI Brain" of the team: members and agents can not only collaborate in the channel, but also continuously improve the quality of answers based on team knowledge and memory.

## 2. MVP Boundary

### Must be delivered

- User registration, login, session management.
- Workspace creation, member viewing and joining mechanisms.
- Channel creation and message history in the channel.
- Basic real-time chat: sending, receiving and displaying human messages.
- `@AI` triggers Agent responses and supports Markdown and streaming output.
- OpenAI-compatible Provider: Compatible with OpenAI, DeepSeek, and Ollama in the first phase.
- Knowledge base upload and search: `.md`, `.txt`, `.pdf`.
- Three layers of memory: individual, team, and project.
- Default chat agent, and extensible Provider/Engine abstraction.

### Definitely not doing it

- Video/voice chat.
- Complex enterprise-level RBAC, approval flow and workflow orchestration.
- Full Slack protocol compatibility.
- Agent Marketplace。
- Autonomous multi-agent task execution, Planner, and reflection loop.
- Production-grade evaluation platform and CI Quality Gate.

## 3. Technical decisions

### front end

| Category | Choice | Reasons for decision |
| ---------- | ---------------------------------- | ------------------------------------------------------- |
| Framework | Next.js 16 + React 19 + TypeScript | Responsible for front-end workbench and server-side rendering.                            |
| Enterprise Components | Ant Design 6 | Forms, forms, status, configuration pages and background management capabilities are mature.            |
| AI interaction | Ant Design X | For chat experiences such as Conversation, Bubble, Sender, and Prompts. |
| Styles | CSS Variables + CSS Modules | Does not use Tailwind/shadcn; retains controllable visual customization space.        |
| Client State | Zustand | Manage partial UI state, chat drafts, and workbench interaction state.            |
| Server-side data | TanStack Query | Cache, invalidation, request status and mutation management.                  |

### Backend and data

| Category | Choice | Reasons for decision |
| -------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Server side | NestJS | Provides modular BFF/API, authentication, SSE, asynchronous task orchestration and subsequent WebSocket capabilities.    |
| Database | Local MongoDB Community 7 (Docker Compose) | All data and development processes are closed on the local machine first; use replica set, compatible with Prisma transactions.  |
| ORM | Prisma | Unify schema, types, and data access for business collections; does not retain Drizzle option in MVP. |
| Vector retrieval | Local application layer cosine similarity Top-K | MVP has no dependence on cloud services; a clear scale upper limit is exchanged for a locally verifiable RAG closed loop.         |
| File storage | Local file system `data/uploads` | Uploading, retrieval, and deletion are all done locally, without relying on S3 or object storage.                  |
| Real-time capabilities | NestJS SSE streaming AI replies; multi-person messages are subsequently processed using NestJS WebSocket Gateway | Decoupling the AI ​​token stream and collaborative message broadcast while keeping the server implementation centralized.            |

### UI design principles

- The main color is `#024AD8`, the token is unified through Ant Design `ConfigProvider`, and the basic rounded corners are `8px`.
- AntD is responsible for control behavior, data density and accessibility; customize layout, spacing, typography, animation and AI Context atmosphere to avoid the default corporate backend look and feel.
- Target temperament: AI Workspace that is refreshing, compact, and suitable for long-term work; refer to Linear, Notion, and Alma, rather than a direct copy of a marketing station or Slack.
- Do not replace information hierarchy with card stacks. The workbench should prioritize scanning, continuous operations, and context switching.

### Local operation principles

- MVP does not deploy online services and does not rely on MongoDB Atlas, object storage, managed queues or cloud real-time services.
- The entire project can only be launched through Docker Compose; no native installation of Node.js, MongoDB, Ollama or other runtime services is required.
- Compose default arrangements `web`, `api`, `mongodb`, `mongo-init`, `ollama` and `ollama-init`: frontend, NestJS API, database, replica set initialization, local model serving and model pulling all run in containers.
- MongoDB uses a single-node replica set; the database, uploaded files, and Ollama models are all mounted with named volumes, and the data is retained after the container is restarted.
- The development image mounts the source code and enables Web/API hot updates; the document parsing task is performed by the API container, and the uploaded files are written to the shared `uploads` volume.
- Uses Ollama internal to Compose by default; only allows the API to read compatible remote model addresses and keys in `.env` when explicitly configured.
- Local RAG is only suitable for small-scale verification: the number of knowledge chunks is capped, and retrieval uses in-memory cosine similarity calculations. Migrate to MongoDB Atlas Vector Search or a dedicated vector database before going online.

### Docker Compose topology and conventions

```text
browser -> web:3000 -> api:3001 -> mongodb:27017
                         |-> ollama:11434
                         |-> uploads volume

mongo-init: Exit after initializing MongoDB replica set
ollama-init: Exit after pulling chat and embedding models
```

- Unified command: `docker compose up --build`; the first startup will initialize the replica set, execute Prisma `db push`/seed, and pull the configured Ollama model.
- Stop but keep data: `docker compose down`; full reset: `docker compose down -v`. The reset command must be clearly noted in the README that it will delete the local database, uploaded files, and model cache.
- Provides `.env.example`, containing port, MongoDB database name, JWT secret, Ollama model name, upload size limit, and optional remote provider configuration; true `.env` is not submitted.
- All services must define healthcheck. `api` is started only after the MongoDB replica set is available and initialization is complete; `web` is started only after the API health endpoint is available.
- macOS uses the CPU to run Ollama by default; GPU mapping is only an optional Compose override for Linux/NVIDIA and is not a prerequisite for MVP.

## 4. Information architecture and core interface

### Workbench layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Workspace Header: Workspace switching, members, notifications, accounts │
├───────────────┬──────────────────────────────┬───────────────┤
│ Left navigation │ Middle conversation area │ Right AI Context │
│ Workspace │ Current channel message/AI streaming answer │ Current Agent │
│ Channels │ Input box, @AI, references and shortcut tips │ Injected into Memory │
│ Knowledge │ │ Related Knowledge │
│ Memory │ │ Model/Engine Status │
│ Agents        │                                │                 │
│ Settings      │                                │                 │
└───────────────┴──────────────────────────────┴───────────────┘
```

### Page range

1. Authentication page: registration, login, logout and session recovery.
2. Workspace homepage: channel navigation, current channel session and Context panel.
3. Knowledge: upload, index status, document list, reindex, delete.
4. Memory: personal/team/project memory browsing, creation, editing, deletion and activation status.
5. Agents: Default Agent configuration, model provider, capability switch; only one Default Chat Engine is supported in the first phase.
6. Settings: basic information of the workspace, member list and member roles.

## 5. Domain model and data table

All business data must contain `workspaceId`, and any reading or writing on the server side must first be verified for membership.

### Users and Collaboration

```text
users
- id
- name
- email (unique)
- passwordHash / externalAuthId
- avatarUrl
- createdAt
- updatedAt

workspaces
- id
- name
- createdBy
- createdAt
- updatedAt

workspace_members
- id
- workspaceId
- userId
- role: OWNER | MEMBER
- createdAt

channels
- id
- workspaceId
- name
- createdAt
- updatedAt
```

### Message and Agent

```text
messages
- id
- workspaceId
- channelId
- senderType: USER | AGENT
- senderId
- content
- status: PENDING | STREAMING | COMPLETED | FAILED
- replyToMessageId (optional, MVP does not need to do UI)
- createdAt
- updatedAt

agents
- id
- workspaceId
- name
- engineType
- providerConfigRef
- capabilitiesJson
- isDefault
- createdAt
- updatedAt
```

### Knowledge and Memory

```text
knowledge_documents
- id
- workspaceId
- filename
- mimeType
- storageKey
- extractionStatus: PENDING | PROCESSING | READY | FAILED
- extractedContent
- errorMessage
- createdBy
- createdAt
- updatedAt

knowledge_chunks
- id
- documentId
- workspaceId
- content
- chunkIndex
- embedding: Float[]
- createdAt

memories
- id
- workspaceId
- userId (required for PERSONAL, empty for other types)
- type: PERSONAL | TEAM | PROJECT
- content
- sourceMessageId (optional)
- confidence (optional)
- enabled
- createdBy
- createdAt
- updatedAt
```

Recommended normal indexes: `workspace_members(workspaceId, userId)`, `channels(workspaceId)`, `messages(channelId, createdAt)`, `knowledge_chunks(workspaceId, documentId)`.

`knowledge_chunks.embedding` is saved as a floating point array. Prisma is responsible for regular CRUD; `KnowledgeRepository` reads the candidate chunks of the current workspace, calculates cosine similarity in the NestJS process and returns Top-K. This implementation intentionally only serves local MVPs: the number of chunks in a single workspace and the size of a single candidate set must be limited. After connecting to Atlas in the future, this Repository will be replaced with the `$vectorSearch` query with `workspaceId` and `documentId` filter conditions. The caller does not need to change.

## 6. Architecture boundaries and directories

```text
apps/
├── web/ # Next.js front-end
│   └── src/
│ ├── app/ # Routing and page, does not carry business API
│       ├── components/
│       ├── features/
│       ├── theme/antd.ts
│       └── styles/globals.css
└── api/ # NestJS backend
  └── src/
    ├── auth/
    ├── workspace/
    ├── chat/
    ├── knowledge/
    ├── memory/
    ├── agents/
    ├── ai/             # providers、engines、prompts、retrieval
    ├── prisma/ # PrismaService, schema and data access baseline
    ├── repositories/ # Non-Prisma queries such as local vector retrieval
    └── common/         # guard、filter、config、DTO
```

Dependency direction: `web app/components -> web features -> NestJS API -> domain service/repository -> Prisma/MongoDB`. The front end does not directly access the database; NestJS controller does not directly include domain orchestration; Provider and Agent Engine do not rely on front-end page components.

## 7. AI Contract and Contextual Strategy

### Provider Abstraction

```ts
export interface AIProvider {
  chat(input: ChatInput): Promise<ChatResult>
  stream(input: ChatInput): AsyncIterable<ChatStreamEvent>
}
```

Provider is responsible for model invocation, authentication, error normalization and token flow; it is not responsible for workspace permissions, message persistence or RAG assembly.

### Engine Abstraction

```ts
export interface AgentEngine {
  execute(input: AgentExecutionInput): Promise<AgentExecutionResult>
  stream(input: AgentExecutionInput): AsyncIterable<AgentExecutionEvent>
  getCapabilities(): AgentCapability[]
}
```

MVP only implements `DefaultChatEngine`. The Engine is responsible for: reading recent channel messages, retrieving workspace knowledge, selecting available Memory, calling Providers, and providing streaming events to the NestJS SSE Controller.

### Request process

```text
User sends @AI message
-> Verify workspace membership
-> Save user messages
-> Assemble recent chat + available Memory + Top-K Knowledge chunks
-> DefaultChatEngine calls AIProvider.stream
-> NestJS SSE returns token
-> Incremental save/final save Agent message
-> Broadcast completion event
```

###Context control

- Only inject data visible to the current workspace, and Personal Memory is only visible to the user to whom it belongs.
- Memory is filtered by type, activation status and relevance; the first issue can be sorted by rules, and embedding retrieval will be introduced later.
- Knowledge retrieves top-K document chunks using local cosine similarity and preserves traceable document reference metadata in answers.
- Do not put the complete channel history and the entire knowledge base directly into the prompt; the number of messages, token and Top-K upper limits must be set.

## 8. API and Permission Principles

The core API uses workspace as the authorization boundary:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:workspaceId/members

GET    /api/workspaces/:workspaceId/channels
POST   /api/workspaces/:workspaceId/channels
GET    /api/channels/:channelId/messages?cursor=
POST   /api/channels/:channelId/messages
POST   /api/channels/:channelId/ai/stream

GET    /api/workspaces/:workspaceId/knowledge
POST   /api/workspaces/:workspaceId/knowledge
POST   /api/knowledge/:documentId/reindex
DELETE /api/knowledge/:documentId

GET    /api/workspaces/:workspaceId/memories
POST   /api/workspaces/:workspaceId/memories
PATCH  /api/memories/:memoryId
DELETE /api/memories/:memoryId
```

- Authentication is handled by the session/JWT signed and verified by NestJS, and the browser does not save database access credentials or Provider keys.
- Each workspace route first verifies login and then membership; write operations are defined according to the minimum permissions of OWNER/MEMBER.
- Uploading needs to verify MIME, size, and file name, and perform extraction and vectorization asynchronously.
- Provider keys are only kept in server-side environment variables or controlled secrets.

## 9. Phased implementation plan

### Phase 0: Architecture confirmation and engineering baseline

Goal: Freeze key decisions and avoid switching frameworks during business development.

- Initialize monorepo, Next.js 16, React 19, TypeScript, Ant Design 6, Ant Design X and NestJS.
- Provides complete Docker Compose: Web, API, MongoDB Community 7 single-node replica set, Mongo initialization, Ollama, model initialization and persistence volumes.
- Develop Dockerfile for Web/API, mount source code and support hot updates within the container; provide production Dockerfile only for subsequent deployment preparation, not for MVP release.
- Configure Prisma MongoDB Provider, Compose internal connection string, schema push process and seed data.
- Configure shared `uploads` volume; do not use host `data/uploads` as runtime dependency.
- Write the Docker commands for starting, stopping, viewing logs, resetting data, performing Prisma operations and switching Ollama models in the README.
- Build ESLint, formatting, single testing and minimal e2e skeletons.
- Create theme tokens, global styles and application shells.
- Write `docs/architecture.md`, `docs/database.md`, `docs/api-contracts.md`.

Acceptance: After executing `docker compose up --build`, all services are healthy; the browser can access the Web, the Web can call the API, and the API can connect MongoDB and Ollama; Prisma can push the schema to empty MongoDB; the uploaded volume can be read and written; CI can run lint, typecheck, and single testing.

### Phase 1: Identity and Workspace

Goal: Users can enter protected workspaces.

- Registration, login, logout, session recovery.
- Create a workspace, and the creator automatically becomes the OWNER.
- Member model and member list.
- Create default `general` channel, create/select channel.
- Navigation on the left side of the workbench and empty channel status.

Acceptance: Two users can log in; Owner creates workspace; members can only access the joined workspace; users can switch channels.

### Phase 2: Persistent chat and real-time foundation

Goal: The channel becomes a reliable collaboration carrier.

- Message sending, list, cursor paging and time sorting.
- Optimistic update, failure rollback, loading/empty/error state.
- Establish a message broadcast abstraction; the first phase can be verified by refresh/polling, and then real-time service.
- Design `USER`, `AGENT` message rendering and state machine.

Acceptance: Two browser sessions can see messages from the same channel; history is not lost after refreshing; users without permission cannot read messages.

### Phase 3: Default Chat Agent and Streaming Answers

Goal: `@AI` provides stable answers based on the context of the channel.

- Implements `AIProvider`, OpenAI-compatible Provider and `DefaultChatEngine`.
- Implement NestJS SSE endpoint, streaming rendering, cancellation and failure status.
- Only trigger Agent if message contains `@AI`; save user/Agent messages.
- Markdown safe rendering, code blocks, quote/error display.
-Introduced minimum prompt template and token restrictions.

Acceptance: Supports configuration of OpenAI, DeepSeek or Ollama; AI responses are displayed token by token; Agent responses are retained after refresh; Provider exceptions can display understandable failure status.

### Phase 4: Knowledge Base and RAG

Goal: AI can answer questions by referencing data uploaded in the workspace.

- File upload to local directory, in-process parsing tasks and index status.
- Text extraction, chunking, embedding of `.md`, `.txt`, `.pdf` and MongoDB `Float[]` writing.
- Use application layer cosine similarity to perform Top-K retrieval within the current workspace and limit the number of candidate chunks.
- Document list, progress, failure reasons, retry, deletion and re-indexing.
- Perform Top-K retrieval in Engine and inject reference blocks.

Acceptance: You can see `READY` after uploading a supported document; you can ask questions to get answers and sources based on the document; failed documents can be retried; they cannot be retrieved after being deleted.

### Phase 5: Memory closed loop

Goal: Team context can be accumulated and reused in a controlled manner.

- CRUD for three types of memory: Personal, Team, and Project.
- Start with manual user confirmation to avoid MVP automatically writing noisy memory.
- Inject memory by permission and relevance before Agent request.
- Provides Memory source, enable/disable and delete capabilities.

Acceptance: Users can manage three types of memory; Personal Memory is not leaked to other users; it will not be injected after being disabled or deleted; answers can reflect the selected relevant memories.

### Phase 6: Agent configuration and observability

Goal: Reserve a stable boundary for subsequent multi-engine evolution.

- Agent list, default Agent, Provider/model configuration, capability display.
- Record AI request time, token, Provider errors and retrieval hits, and do not record sensitive original keys.
- Build unit and integration tests for Provider, Engine, RAG and Memory.

Acceptance: You can switch providers without changing the chat UI; you can locate the provider, engine or retrieval stage when a request fails.

## 10. Testing and quality thresholds

- Pure functions, Provider adaptation, Engine context assembly, and permission services must have unit tests, and the target line coverage should be no less than 90%.
- Chat, upload, RAG, and Memory permissions each have at least one integration test.
- Key user paths are at least e2e: register/login, create workspace, send message, `@AI` streaming reply, upload document and retrieve.
- Streaming interface tests must cover normal end, cancellation, provider failure and persistence failure.
- Document parsing and embedding must be retryable and observable, and avoid blocking chat on a single failure.
- All Prisma schema changes must have local `db push` operation instructions, compatibility policies, and rollback instructions; local MongoDB initialization scripts and upload directory conventions must be submitted to the warehouse.

## 11. Main risks and pre-decisions

1. Authentication scheme: Determine NestJS Passport + JWT/refresh token, session, or external identity service in Phase 0. The front end is only responsible for token/session usage and is not responsible for authentication business logic.
2. Real-time service: SSE is used for AI token; local multi-window message synchronization can use polling first, and then connect to NestJS WebSocket Gateway.
3. PDF extraction and asynchronous tasks: MVP uses in-process tasks and persists state; long tasks, failed retries, and server restart recovery are the risks of subsequent queuing.
4. Embedding Provider: should be decoupled from the chat model provider; the local Ollama embedding model is preferred, and the remote model is only configured through local environment variables.
5. Local vector retrieval scale: Application layer cosine similarity is not suitable for large-scale chunks; upper limits for documents, chunks, and candidate sets for each workspace must be set.
6. Data isolation: RAG query, Memory injection, and file download must have workspace/member permissions as the first constraint.
7. Data deletion: Document deletion requires cascading deletion of local files, chunks and embeddings; user/workspace deletion strategies should be defined before going online.

## 12. Follow-up roadmap

After the MVP has run stably and real users have generated enough session and document data, proceed to the following directions:

- Agent Runtime: Planner, Tool Calling, task execution, Reflection Loop.
- Multi-Agent: Frontend, Backend, QA, Research and other dedicated agents.
- Engine Adapter：Hermes、Claude Code、OpenClaw、Custom Engine。
- A more complete member invitation, role and enterprise permission system.
- Harness Engineering: golden data set, offline evaluation, LLM Judge, regression benchmark, CI quality gate.
- Agent/Provider Marketplace and plug-in ecosystem.

## 13. First execution sequence

Implementations should not generate the entire amount of code at once. It is recommended to strictly follow the following rhythm:

1. First complete the architecture proposal, dependency selection and data model review of Phase 0.
2. Only one Phase will be implemented after passing the review.
3. After each Phase is completed, run the corresponding testing, migration and acceptance paths.
4. Review real user feedback and error data before entering the next phase.

This plan is the baseline for MVP implementation. Any new module should first explain whether it serves the core closed loop of "human + agent + knowledge + memory"; if it cannot directly serve this closed loop, it will be placed on the subsequent roadmap.
