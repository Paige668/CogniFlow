<!-- cSpell:ignore CogniFlow pgvector NestJS BullMQ -->
# CogniFlow

A document question-answering agent. You sign in, upload text documents, they are embedded in the background and stored in PostgreSQL with pgvector, and a chat model decides through tool calling when to search them before it answers. Each user's documents are private: no other account can list, read, delete or search them.

Built with NestJS 11, Next.js 16 (React 19), Clerk for sign-in, PostgreSQL + pgvector, Redis + BullMQ and the Vercel AI SDK v6 with OpenAI models.

> **Status:** a learning project, not production software. Last run end to end on 2026-10-14 with a funded OpenAI key: a Markdown upload reached `READY` in about 1 second, and `gpt-4o` answered questions about it by calling the search tool. The same run showed that retrieval is not reliable yet. A fact that starts just after character 500 of the document was missed, because the search tool returns only the first 500 characters of each match. And because each document has one vector, every search query scored between 0.46 and 0.56 against it, around the fixed 0.5 cut-off: the same question was answered in one run and "not found" in the next, depending on how the model worded its search. See [Known limitations](#known-limitations).
>
> Sign-in and per-user document isolation were added on 2026-11-21. They are covered by unit and HTTP-level tests (see [Tests](#tests)) but have not yet been run end to end against a real Clerk instance with two accounts.

---

## How it works

```text
Next.js web app (port 3001) ◄──► Clerk (sign-in, session tokens)
        │  upload / chat / flags / metrics, each with "Authorization: Bearer <session token>"
        ▼
NestJS API (port 3000) ──► OpenAI (embeddings, chat)
   │   checks the token with Clerk's public key (JWKS)
   │            │
   ▼            ▼
PostgreSQL    Redis
+ pgvector    BullMQ queue "documents"
```

**Sign-in and ownership.** The web app signs users in with Clerk and sends the Clerk session token as a Bearer token on every API call. A global NestJS guard verifies it (`@clerk/backend` `verifyToken`, with the `azp` claim checked against `CLERK_AUTHORIZED_PARTIES`) and puts the user ID on the request; every route needs it except the `GET /` liveness check. Each document row has a `userId`, and every query takes the owner from the verified token, never from the request body: listing filters on it, reading and deleting match `id` and `userId` together and answer `404` for a document that belongs to someone else, so other users' document IDs cannot be probed. The search tool puts the owner filter in the same `WHERE` clause as the similarity cut-off, so it applies before `ORDER BY ... LIMIT 3`: the top results are chosen among the caller's documents only. The user ID is not part of the tool's input, so the model cannot ask for someone else's documents.

**Upload.** `POST /documents` stores the document with status `PENDING` and queues a job that carries only the document ID. A BullMQ worker loads the content, embeds it with `text-embedding-3-small` (1536 dimensions) and marks the document `READY`, or `FAILED` with the reason.

**Retries.** The queue owns retries: 3 attempts with exponential backoff (5 s, then 10 s). Errors that retrying cannot fix fail on the first attempt: a missing or rejected API key, an account without credits (OpenAI's `insufficient_quota`, which arrives as a 429 like a rate limit), or an input that is too long. Embedding failures are never hidden; an earlier version stored a random vector instead, and the migration that added `status` cleared those placeholder vectors.

**Chat.** `POST /documents/chat` streams the answer as chunked plain text. The model (`gpt-4o`, or `gpt-4o-mini` when the `use_gpt4o` flag is off) can call one tool, `search_knowledge_base`, defined with a Zod schema. The tool embeds the query and returns up to 3 documents whose cosine similarity is above 0.5, each cut to its first 500 characters. The agent can take up to 3 steps, so it can read the search results and then answer.

**Request validation.** A global `ValidationPipe` checks request bodies against their DTOs and returns `400` with the reasons. A chat message must have `role` `user` or `assistant` and a string `content`; a `system` message from the client is rejected, because the system prompt is set on the server. Properties that a DTO does not declare are rejected, not silently dropped.

**Errors in chat.** If the model or provider fails before any answer text, the API returns `502` with a short message; the details go to the server log. If it fails midway, the API drops the connection so the client cannot mistake a partial answer for a complete one. The web app shows the error and keeps any partial text, marked as incomplete.

**Web app.** A sign-in screen for signed-out visitors; after sign-in, one page with the chat, a document panel (upload, status, failure reason, delete), a flags panel, a metrics panel and Clerk's user menu. Switching accounts clears the chat and the document list. Model output is rendered as text, never as HTML; only `**bold**` is turned into markup.

---

## Run it locally

Requirements: Node.js 20.9+, Docker, an OpenAI API key with credits, and a Clerk application (free development instance from the [Clerk dashboard](https://dashboard.clerk.com)). Without a working OpenAI key, uploads end up `FAILED` and chat returns `502`; there is no offline mode. Without Clerk keys, the API answers `500` ("Sign-in is not set up on the server").

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
# Clerk: secret key from the dashboard's API keys page. CLERK_JWT_KEY (the PEM public key)
# may be set instead or as well, to verify tokens without a network call to Clerk.
CLERK_SECRET_KEY=sk_test_...
# Origins allowed in the token's azp claim (the web app's URL); comma-separated.
CLERK_AUTHORIZED_PARTIES=http://localhost:3001
```

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Apply the migrations and start both apps:

```bash
cd apps/api && npx prisma migrate deploy && cd ../..
npm run dev
```

Open `http://localhost:3001` and sign in. The web app calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3000`).

The `document_owner` migration gives documents uploaded before sign-in existed the placeholder owner `legacy-unowned`, which no Clerk user ID can match, so nobody can see them. Delete them, or hand one to a user with `UPDATE "documents" SET "userId" = 'user_...' WHERE "userId" = 'legacy-unowned';`.

---

## API

Every route except `GET /` needs `Authorization: Bearer <Clerk session token>`. A missing, expired or forged token gets `401`.

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/` | Liveness check; no sign-in needed. |
| `POST` | `/documents` | Upload a file (`multipart/form-data`, field `file`) as the signed-in user. Returns the document with `status: "PENDING"`. |
| `GET` | `/documents` | List the caller's documents, newest first, with `status` and `error`. |
| `GET` | `/documents/:id` | Get one of the caller's documents; `404` if it does not exist or belongs to someone else. |
| `DELETE` | `/documents/:id` | Delete one of the caller's documents and its embedding; returns `{ "id": ... }`, or `404` as above. |
| `POST` | `/documents/chat` | Body `{ "messages": [{ "role": "user", "content": "..." }] }`. Streams the answer as `text/plain`; the search tool sees only the caller's documents. Returns `400` for an invalid body and `502 { "message": ... }` when the model fails. |
| `GET` | `/flags` | List runtime flags. |
| `POST` | `/flags/:name` | Toggle a flag. |
| `GET` | `/metrics` | In-memory request counts, average duration per endpoint, chat requests and error count. |

Example:

`$TOKEN` is a session token, e.g. from `await window.Clerk.session.getToken()` in the browser console of the signed-in web app (it expires after about a minute).

```bash
curl -H "Authorization: Bearer $TOKEN" -F "file=@notes.md" http://localhost:3000/documents

curl -N http://localhost:3000/documents/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What do my notes say about deadlines?"}]}'
```

### Runtime flags

| Flag | Default | Effect |
| --- | --- | --- |
| `use_gpt4o` | on | `gpt-4o` when on, `gpt-4o-mini` when off |
| `rag_enabled` | on | Gives the model the search tool; off means plain chat |
| `streaming_enabled` | on | Listed, but not used by the code yet |

Flags and metrics live in process memory: they reset on restart and are not shared between instances.

---

## Tests

```bash
cd apps/api && npx jest
```

45 tests:

- `documents.processor.spec.ts` (8 tests): the worker's retry and failure rules, including fail-fast on a rejected key, a missing key, an input that is too long and an account without credits.
- `documents.controller.spec.ts` (23 tests): the chat endpoint's success path, a `502` before any text, a dropped connection on a mid-answer failure, and an empty answer; over HTTP with the real global guard and validation pipe, a `400` for a client `system` message and other malformed chat bodies; a `401` for a missing, malformed or rejected token (without leaking the reason), a `500` when the server has no Clerk key, and the user from the token reaching every documents route.
- `documents.service.spec.ts` (6 tests): uploads are stored under the caller; listing, reading and deleting filter on the owner, and another user's document gives `404` without being deleted.
- `agent.service.spec.ts` (3 tests): the search SQL binds the owner as a parameter (never in the SQL text) and filters on it in the `WHERE` clause, before `ORDER BY ... LIMIT`.
- `clerk-auth.spec.ts` (4 tests): the token verifier fails closed without a key, returns the token's subject and passes the authorized parties to Clerk; the liveness route stays public.
- `app.controller.spec.ts` (1 test).

Removing the owner filter from the search SQL fails 2 tests, and removing it from the list query fails 1 (checked by hand on 2026-11-21).

The repository also has shell scripts (`test-upload.sh`, `test-chat.sh`) for manual checks against a running API.

---

## Deployment files

`apps/api/Dockerfile` and `apps/web/Dockerfile` build the two apps. `k8s/` holds Kubernetes manifests for PostgreSQL, Redis, the API and the web app; they expect locally built images named `cogniflow-api:latest` and `cogniflow-web:latest`. The manifests do not pass the Clerk keys yet. `docker-compose.yml` runs only PostgreSQL and Redis.

---

## Known limitations

- **No roles.** Every signed-in user is equal. `/flags` and `/metrics` only require sign-in, so any signed-in user can switch the model or turn search off, and the metrics count everyone's requests.
- **Isolation tested below the database.** The ownership rules are covered by unit and HTTP tests with a mocked database; the migration and a two-account check against PostgreSQL and real Clerk sessions have not been run yet.
- **One vector per document.** Documents are not split into chunks, and the tool returns only the first 500 characters of each match, so long documents are poorly searchable. The 0.5 similarity cut-off is a fixed guess: with whole-document vectors, relevant and unrelated queries score in the same range.
- **Text files only.** PDF and Word uploads are accepted but their text is not extracted; a placeholder sentence is stored and embedded instead.
- **Citations are not enforced.** The system prompt asks the model to name the documents it used; nothing checks that it does.
- **Background job gaps.** The document is saved before its job is queued, so if queuing fails it stays `PENDING`. A job that stalls because the worker crashed also leaves it `PENDING`. A `FAILED` document has to be deleted and uploaded again.
- **No evaluation.** There is no test set measuring answer or retrieval quality yet.

## Project structure

```text
apps/
  api/                 NestJS API
    prisma/            schema and migrations
    src/auth/          Clerk token verifier, global guard, @Public and @CurrentUserId
    src/documents/     upload, worker, agent, chat endpoint
    src/embedding.service.ts
    src/feature-flags.*  src/metrics.*  src/logging.interceptor.ts
  web/                 Next.js app (app/page.tsx, proxy.ts for Clerk)
packages/              shared ESLint, TypeScript and UI config
k8s/                   Kubernetes manifests
docker-compose.yml     PostgreSQL + Redis for development
```
