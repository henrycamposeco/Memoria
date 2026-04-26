# Build Prompt: Memoria (TypeScript Memory System)

**Instructions for the AI Architect**:
You are tasked with building **Memoria**, a ground-up, TypeScript-native persistent memory system for AI agents. This system must be distributed as an NPM package and expose itself via the Model Context Protocol (MCP). 

**CORE MANDATE**: The system must be **Zero-Config** (works out of the box with no API keys) and **Super-Token-Efficient** (manages its own context window budget to stay as small as possible).

---

## 1. Key Concepts & Definitions

- **Observation**: A single unit of memory (What/Why/Where/Learned).
- **Session**: A logical group of related observations (e.g., a bug fix session).
- **Distillation**: The process of merging old/noisy observations into high-density, low-token summaries.
- **Hybrid Search**: Combining traditional keyword search (SQLite FTS5) with Semantic search (Vector Embeddings).
- **Zero-Config**: The system must download its own local embedding models on first run and manage its own SQLite file in `~/.memoria/`.

---

## 2. Technical Stack (Non-Negotiable)

- **Language**: TypeScript (Node.js/Bun).
- **MCP Framework**: `@modelcontextprotocol/sdk`.
- **Database**: `better-sqlite3` for metadata + `sqlite-vec` (or a lightweight vector library like `Vectra`) for semantic search.
- **Embeddings**: `transformers.js` (using local ONNX models like `all-MiniLM-L6-v2`). **No OpenAI/External API keys allowed.**
- **Token Tracking**: `js-tiktoken` for accurate context budgeting.

---

## 3. Tool Specifications (MCP Server)

Expose the following tools through the MCP server:

1.  **`mem_store`**:
    - Params: `title`, `content` (structured), `type` (bug, decision, etc.), `project`.
    - Logic: Save to SQLite, automatically generate embeddings locally, and store in the vector index.
2.  **`mem_remember`**:
    - Params: `query`, `project`, `limit`, `max_tokens`.
    - Logic: Perform a Hybrid Search. Rank results by relevance. Truncate/summarize content to fit within the `max_tokens` budget.
3.  **`mem_context`**:
    - Params: `project`.
    - Logic: Return a token-optimized "Snapshot" of recent work and active session summaries.
4.  **`mem_distill`**:
    - Params: `project`.
    - Logic: Merge related observations and old session summaries into a single "Long-Term Knowledge" entry to free up token space.

---

## 4. Implementation Phases

### Phase 1: Core Engine & Storage (Zero-Config)
- Set up a clean TypeScript project with a `StorageProvider` abstraction.
- Implement the SQLite schema for Sessions and Observations.
- Integrate `transformers.js` to download and cache local embedding models automatically.

### Phase 2: Token-Optimized Retrieval
- Implement the Hybrid Search logic (FTS5 + Vector).
- Add token counting using `js-tiktoken`.
- Create a `ContextTrimmer` that smartly prunes search results to stay under a specified token budget.

### Phase 3: MCP & CLI
- Implement the MCP server using the official SDK.
- Create a CLI command `setup` that:
  - Initializes the data directory.
  - Automatically detects and configures MCP clients (Cline, Cursor, etc.).
- Ensure the package is installable via `npx`.

---

## 5. Success Criteria
- The agent can call `mem_remember` and get highly relevant results in <200ms.
- A user can say `npm install @henrycamposeco/memoria` and have a working memory system in seconds.
- Memory retrieval never exceeds a reasonable token budget (e.g., 2000 tokens) regardless of database size.
