<!-- cSpell:ignore CogniFlow pgvector NestJS BullMQ -->
# CogniFlow

A document question-answering agent. You upload text documents, they are embedded in the background and stored in PostgreSQL with pgvector, and a chat model decides through tool calling when to search them before it answers.

Built with NestJS 11, Next.js 16 (React 19), PostgreSQL + pgvector, Redis + BullMQ and the Vercel AI SDK v6 with OpenAI models.

> **Status:** a learning project, not production software. See [Known limitations](#known-limitations).

---

## How it works

```text
Next.js web app (port 3001)
        │  upload / chat / flags / metrics
        ▼
NestJS API (port 3000) ──► OpenAI (embeddings, chat)
   │            │
   ▼            ▼
PostgreSQL    Redis
+ pgvector    BullMQ queue "documents"
```

**Upload.** `POST /documents` stores the document with status `PENDING` and queues a job that carries only the document ID. A BullMQ worker loads the content, embeds it with `text-embedding-3-small` (1536 dimensions) and marks the document `READY`, or `FAILED` with the reason.

**Retries.** The queue owns retries: 3 attempts with exponential backoff (5 s, then 10 s). Errors that retrying cannot fix fail on the first attempt: a missing or rejected API key, an account without credits (OpenAI's `insufficient_quota`, which arrives as a 429 like a rate limit), or an input that is too long. Embedding failures are never hidden; an earlier version stored a random vector instead, and the migration that added `status` cleared those placeholder vectors.

**Chat.** `POST /documents/chat` streams the answer as chunked plain text. The model (`gpt-4o`, or `gpt-3.5-turbo` when the `use_gpt4o` flag is off) can call one tool, `search_knowledge_base`, defined with a Zod schema. The tool embeds the query and returns up to 3 documents whose cosine similarity is above 0.5, each cut to its first 500 characters. The agent can take up to 3 steps, so it can read the search results and then answer.

**Errors in chat.** If the model or provider fails before any answer text, the API returns `502` with a short message; the details go to the server log. If it fails midway, the API drops the connection so the client cannot mistake a partial answer for a complete one. The web app shows the error and keeps any partial text, marked as incomplete.

**Web app.** One page with the chat, a document panel (upload, status, failure reason, delete), a flags panel and a metrics panel. Model output is rendered as text, never as HTML; only `**bold**` is turned into markup.

---

## Run it locally

Requirements: Node.js 20+, Docker, and an OpenAI API key with credits. Without a working key, uploads end up `FAILED` and chat returns `502`; there is no offline mode.

```bash
git clone git@github.com:Paige668/CogniFlow.git
cd CogniFlow
npm install

# PostgreSQL with pgvector (5432) and Redis (6379)
docker compose up -d
```

Create `apps/api/.env`:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=cogniflow
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cogniflow?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
OPENAI_API_KEY=sk-...
PORT=3000
```

Apply the migrations and start both apps:

```bash
cd apps/api && npx prisma migrate deploy && cd ../..
npm run dev
```

Open `http://localhost:3001`. The web app calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).

---

## API

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/documents` | Upload a file (`multipart/form-data`, field `file`). Returns the document with `status: "PENDING"`. |
| `GET` | `/documents` | List documents, newest first, with `status` and `error`. |
| `GET` | `/documents/:id` | Get one document. |
| `DELETE` | `/documents/:id` | Delete a document and its embedding. |
| `POST` | `/documents/chat` | Body `{ "messages": [{ "role": "user", "content": "..." }] }`. Streams the answer as `text/plain`, or returns `502 { "message": ... }`. |
| `GET` | `/flags` | List runtime flags. |
| `POST` | `/flags/:name` | Toggle a flag. |
| `GET` | `/metrics` | In-memory request counts, average duration per endpoint, chat requests and error count. |

Example:

```bash
curl -F "file=@notes.md" http://localhost:3000/documents

curl -N http://localhost:3000/documents/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What do my notes say about deadlines?"}]}'
```

### Runtime flags

| Flag | Default | Effect |
| --- | --- | --- |
| `use_gpt4o` | on | `gpt-4o` when on, `gpt-3.5-turbo` when off |
| `rag_enabled` | on | Gives the model the search tool; off means plain chat |
| `streaming_enabled` | on | Listed, but not used by the code yet |

Flags and metrics live in process memory: they reset on restart and are not shared between instances.

---

## Tests

```bash
cd apps/api && npx jest
```

- `documents.processor.spec.ts` (8 tests): the worker's retry and failure rules, including fail-fast on a rejected key, a missing key, an input that is too long and an account without credits.
- `documents.controller.spec.ts` (5 tests): the chat endpoint's success path, a `502` before any text, a dropped connection on a mid-answer failure, and an empty answer.

The repository also has shell scripts (`test-upload.sh`, `test-chat.sh`) for manual checks against a running API.

---

## Deployment files

`apps/api/Dockerfile` and `apps/web/Dockerfile` build the two apps. `k8s/` holds Kubernetes manifests for PostgreSQL, Redis, the API and the web app; they expect locally built images named `cogniflow-api:latest` and `cogniflow-web:latest`. `docker-compose.yml` runs only PostgreSQL and Redis.

---

## Known limitations

- **No users or access control.** Every search ranks every stored document. For any multi-user use, the filter on what the current user may read has to run before the similarity search, not after it.
- **One vector per document.** Documents are not split into chunks, and the tool returns only the first 500 characters of each match, so long documents are poorly searchable.
- **Text files only.** PDF and Word uploads are accepted but their text is not extracted; a placeholder sentence is stored and embedded instead.
- **Citations are not enforced.** The system prompt asks the model to name the documents it used; nothing checks that it does.
- **No request validation.** `ValidationPipe` is not registered, so the chat DTO is not validated and a client can send a `system` message.
- **`/flags` has no authentication.** Anyone who can reach the API can switch the model or turn search off.
- **Background job gaps.** The document is saved before its job is queued, so if queuing fails it stays `PENDING`. A job that stalls because the worker crashed also leaves it `PENDING`. A `FAILED` document has to be deleted and uploaded again.
- **No evaluation.** There is no test set measuring answer or retrieval quality yet.

## Project structure

```text
apps/
  api/                 NestJS API
    prisma/            schema and migrations
    src/documents/     upload, worker, agent, chat endpoint
    src/embedding.service.ts
    src/feature-flags.*  src/metrics.*  src/logging.interceptor.ts
  web/                 Next.js app (app/page.tsx)
packages/              shared ESLint, TypeScript and UI config
k8s/                   Kubernetes manifests
docker-compose.yml     PostgreSQL + Redis for development
```
