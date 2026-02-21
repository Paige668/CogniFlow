<!-- cSpell:ignore CogniFlow pgvector NestJS BullMQ -->
# CogniFlow ⚡

## An AI-Powered Knowledge Agent with RAG (Retrieval-Augmented Generation)

CogniFlow is a production-ready AI knowledge management system that allows you to upload documents and chat with them using advanced AI. Built with a modern tech stack featuring NestJS, Next.js, PostgreSQL with pgvector, and OpenAI GPT-4.

![CogniFlow Architecture](https://img.shields.io/badge/Stack-NestJS%20%7C%20Next.js%20%7C%20PostgreSQL%20%7C%20Redis-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

### Core Functionality

- 🤖 **AI-Powered Chat** - Intelligent conversations powered by OpenAI GPT-4o/GPT-3.5-turbo
- 📄 **Document Upload & Management** - Upload, view, and delete documents via beautiful web interface
  - Drag & drop file upload
  - Support for `.txt`, `.md`, `.pdf`, `.doc`, `.docx`
  - Real-time document list updates
  - File metadata display (name, date, size)
- 🔍 **Vector Search** - Semantic similarity search using PostgreSQL pgvector extension
- ⚡ **Real-time Streaming** - Stream AI responses chunk-by-chunk for better UX
- 🎯 **RAG Architecture** - Retrieval-Augmented Generation for accurate, context-aware responses

### Developer Features

- 🚩 **Feature Flags** - Toggle features like GPT-4o vs GPT-3.5 or enable/disable RAG without restarting
- 📊 **Observability** - Built-in metrics for request counting and response time monitoring
- 🔄 **Background Processing** - BullMQ queue system for async document vectorization
- 🧪 **Mock Mode** - Test the entire system without OpenAI API key (uses random vectors)
- 🎨 **Modern UI** - Beautiful, responsive Next.js interface with dark theme
- 🔐 **Type Safety** - Full TypeScript coverage across frontend and backend

---

## 🏗️ Architecture

```text
┌─────────────────┐
│   Next.js Web   │ ← User Interface (Port 3001)
│   (Frontend)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   NestJS API    │ ← Backend API (Port 3000)
│   + AI Agent    │
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    ↓         ↓          ↓
┌────────┐ ┌──────┐ ┌────────┐
│PostgreSQL│ │Redis │ │OpenAI │
│+pgvector│ │BullMQ│ │  API  │
└─────────┘ └──────┘ └────────┘
```

### Tech Stack

**Frontend:**

- Next.js 16 with App Router
- React 19
- TypeScript
- Server-Sent Events for streaming

**Backend:**

- NestJS - Modern Node.js framework
- Prisma - Type-safe ORM
- BullMQ - Background job processing
- AI SDK - Vercel AI SDK for streaming

**Infrastructure:**

- PostgreSQL with pgvector extension
- Redis for queue management
- Docker & Docker Compose
- Turborepo monorepo

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18
- **Docker** & Docker Compose
- **npm** or **yarn** or **pnpm**

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/cogniflow.git
cd cogniflow
```

### 2. Start Infrastructure Services

Start PostgreSQL and Redis using Docker Compose:

```bash
docker-compose up -d
```

This starts:

- PostgreSQL with pgvector (Port 5432)
- Redis (Port 6379)

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Environment Variables

Copy the example environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` and configure:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cogniflow?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (Optional - see Mock Mode below)
OPENAI_API_KEY=your_openai_api_key_here

# App
PORT=3000
```

### 5. Run Database Migrations

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

### 6. Start Development Servers

```bash
npm run dev
```

This starts:

- **API Backend:** `http://localhost:3000`
- **Web Frontend:** `http://localhost:3001`

---

## 🎭 Mock Mode vs Real AI Mode

### 🆓 Mock Mode (Default - No API Key Required)

**CogniFlow works out of the box without an OpenAI API key!**

When you don't have an OpenAI API key configured, the system automatically enters Mock Mode. You can still:

✅ Test the entire architecture  
✅ Upload and manage documents  
✅ Use the beautiful UI  
✅ View metrics and feature flags  
✅ See streaming responses (simulated)

**Mock responses include:**

```text

[MOCK MODE] OpenAI API quota exceeded.

The CogniFlow RAG architecture is fully operational:
✅ NestJS API on port 3000
✅ BullMQ document processing queue
✅ PostgreSQL + pgvector similarity search
✅ Agent tool definition
✅ Streaming infrastructure

Add OpenAI API credits to enable real AI responses.
```

### 🤖 Real AI Mode (Requires OpenAI API Key)

**To test the app with real AI capabilities:**

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com/api-keys)
2. Add it to your environment file:

   ```bash
   # Edit apps/api/.env
   OPENAI_API_KEY=sk-proj-your-actual-key-here

   ```

3. Restart the development server:

   ```bash
   # Stop the server (Ctrl+C) and restart
   npm run dev
   ```

**Pricing (Pay-as-you-go):**

- GPT-3.5-turbo: ~$0.0005 per 1K tokens (very cheap)
- GPT-4o: ~$0.005 per 1K tokens
- Minimum deposit: $5 USD (enough for extensive testing)

---

## 📖 Usage Guide

### 📄 Document Upload & Management

CogniFlow provides a user-friendly web interface for uploading and managing your knowledge base documents.

#### Supported File Formats

- ✅ **Plain Text** (`.txt`)
- ✅ **Markdown** (`.md`)
- ✅ **PDF** (`.pdf`) - Binary file placeholder (text extraction coming soon)
- ✅ **Word Documents** (`.doc`, `.docx`) - Binary file placeholder

#### Upload via Web Interface

1. **Open the Web App**
   - Navigate to `http://localhost:3001`
   - Click the **📄 Documents** button in the header

2. **Upload Documents**
   - Click the upload area or drag & drop files
   - Supported formats: `.txt`, `.md`, `.pdf`, `.doc`, `.docx`
   - Maximum file size: No hard limit (depends on your system)

3. **View Uploaded Documents**
   - Documents appear in the list immediately after upload
   - Each document shows:
     - 📄 File name
     - 📅 Upload date
     - 📏 Content size (character count)
   - Documents are sorted by upload time (newest first)

4. **Delete Documents**
   - Click the 🗑️ button next to any document
   - Deletion is immediate and permanent

#### Upload via API

**Using cURL:**

```bash
# Upload a text file
curl -X POST http://localhost:3000/documents \
  -F "file=@/path/to/document.txt"

# Upload a PDF
curl -X POST http://localhost:3000/documents \
  -F "file=@/path/to/document.pdf"
```

**Response:**

```json
{
  "id": "cmlvlrfmp00019db92l170w7d",
  "content": "[Binary file: document.pdf] - Content extraction not implemented yet. File size: 1236319 bytes.",
  "metadata": {
    "size": 1236319,
    "mimeType": "application/pdf",
    "originalName": "document.pdf"
  },
  "createdAt": "2026-02-21T00:50:42.530Z",
  "updatedAt": "2026-02-21T00:50:42.530Z"
}
```

#### Background Processing

After uploading, documents are automatically processed:

1. **Text Extraction** - Content is extracted from the file
2. **Vectorization** - Text is converted to embeddings using OpenAI's `text-embedding-3-small` model
3. **Storage** - Vector embeddings are stored in PostgreSQL with pgvector
4. **Indexing** - Documents become searchable for RAG queries

**Note:** In Mock Mode (no OpenAI API key), documents are vectorized using random embeddings for testing purposes.

### 💬 Chat with Your Documents

Once documents are uploaded, you can ask questions about them:

1. **Open the Chat Interface**
   - The chat is on the main page at `http://localhost:3001`
   - Type your question in the input field at the bottom

2. **Ask Questions**
   - Example: "What are the main topics in the documents?"
   - Example: "Summarize the content about [specific topic]"
   - Example: "Find information about [keyword]"

3. **AI Response Process**
   - Your question is vectorized
   - Similar documents are retrieved from the knowledge base
   - GPT generates a response based on retrieved content
   - Answer is streamed back in real-time

4. **Citation & Sources**
   - The AI will cite document names when possible
   - Responses indicate if information comes from your documents or general knowledge

---

## 📚 API Documentation

### Base URL

`http://localhost:3000`

### Endpoints

#### 📤 Upload Document

Upload a document to the knowledge base. The document will be processed in the background and vectorized for semantic search.

```bash
POST /documents
Content-Type: multipart/form-data
```

**Request:**

```bash
curl -X POST http://localhost:3000/documents \
  -F "file=@document.pdf"
```

**Response:** `201 Created`

```json
{
  "id": "cmlvlrfmp00019db92l170w7d",
  "content": "[Binary file: document.pdf] - Content extraction not implemented yet. File size: 1236319 bytes.",
  "metadata": {
    "size": 1236319,
    "mimeType": "application/pdf",
    "originalName": "document.pdf"
  },
  "createdAt": "2026-02-21T00:50:42.530Z",
  "updatedAt": "2026-02-21T00:50:42.530Z"
}
```

**Supported File Types:**

- Text files: `.txt`, `.md`, `.json`
- Binary files: `.pdf`, `.doc`, `.docx` (placeholder text until parser is implemented)

---

#### 📋 List Documents

Get all uploaded documents sorted by creation date (newest first).

```bash
GET /documents
```

**Response:** `200 OK`

```json
[
  {
    "id": "cmlvlrfmp00019db92l170w7d",
    "content": "Document content...",
    "metadata": {
      "size": 1024,
      "mimeType": "text/plain",
      "originalName": "example.txt"
    },
    "createdAt": "2026-02-21T00:50:42.530Z",
    "updatedAt": "2026-02-21T00:50:42.530Z"
  }
]
```

---

#### 🔍 Get Document by ID

Retrieve a specific document by its ID.

```bash
GET /documents/:id
```

**Example:**

```bash
curl http://localhost:3000/documents/cmlvlrfmp00019db92l170w7d
```

**Response:** `200 OK` (same structure as upload response)

---

#### 🗑️ Delete Document

Delete a document and its embeddings from the knowledge base.

```bash
DELETE /documents/:id
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/documents/cmlvlrfmp00019db92l170w7d
```

**Response:** `200 OK`

```json
{
  "id": "cmlvlrfmp00019db92l170w7d",
  "content": "...",
  "metadata": { ... },
  "createdAt": "2026-02-21T00:50:42.530Z",
  "updatedAt": "2026-02-21T00:50:42.530Z"
}
```

---

#### 💬 Chat with Documents

Send a chat message and receive a streamed AI response. The AI will automatically search the knowledge base for relevant information.

```bash
POST /documents/chat
Content-Type: application/json
```

**Request:**

```bash
curl -X POST http://localhost:3000/documents/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "user", "content": "What is in the documents?" }
    ]
  }'
```

**Response:** `200 OK` (Server-Sent Events stream)

```text
Content-Type: text/plain; charset=utf-8
Transfer-Encoding: chunked

Based on the documents in the knowledge base...
[streaming response continues]
```

**Multi-turn Conversation:**

```json
{
  "messages": [
    { "role": "user", "content": "What topics are covered?" },
    { "role": "assistant", "content": "The documents cover..." },
    { "role": "user", "content": "Tell me more about the first topic" }
  ]
}
```

---

#### 📊 Get Metrics

Retrieve system metrics and performance statistics.

```bash
GET /metrics
```

**Response:** `200 OK`

```json
{
  "requests": {
    "/documents": 45,
    "/documents/chat": 12,
    "/flags": 3
  },
  "avgResponseTime": {
    "/documents": 125.5,
    "/documents/chat": 2341.2
  },
  "totalRequests": 60,
  "uptime": 3600
}
```

---

#### 🚩 Manage Feature Flags

Get all feature flags:

```bash
GET /flags
```

**Response:** `200 OK`

```json
[
  {
    "name": "use_gpt4o",
    "enabled": false,
    "description": "Use GPT-4o instead of GPT-3.5-turbo"
  },
  {
    "name": "rag_enabled",
    "enabled": true,
    "description": "Enable RAG (Retrieval-Augmented Generation)"
  }
]
```

Toggle a feature flag:

```bash
POST /flags/:flagName
```

**Example:**

```bash
curl -X POST http://localhost:3000/flags/use_gpt4o
```

**Response:** `200 OK`

```json
{
  "name": "use_gpt4o",
  "enabled": true,
  "description": "Use GPT-4o instead of GPT-3.5-turbo"
}
```

---

## 🧪 Testing

### Test Scripts

Test document upload:

```bash
./test-upload.sh
```

Test chat functionality:

```bash
./test-chat.sh
```

### Manual Testing with cURL

```bash
# Upload a document
curl -X POST http://localhost:3000/documents \
  -F "file=@document.pdf" \
  -F 'metadata={"filename":"document.pdf"}'

# Chat with documents
curl -X POST http://localhost:3000/documents/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Summarize the documents"}
    ]
  }'
```

---

## 🚩 Feature Flags

Toggle features at runtime without restarting:

| Flag                | Description                         | Default |
|---------------------|-------------------------------------|---------|
| `use_gpt4o`         | Use GPT-4o instead of GPT-3.5-turbo | `true`  |
| `streaming_enabled` | Enable streaming responses          | `true`  |
| `rag_enabled`       | Enable RAG knowledge base search    | `true`  |

**Toggle via UI:**

1. Open `http://localhost:3001`
2. Click "🚩 Flags" button
3. Toggle any flag ON/OFF

---

## 📊 Monitoring

View real-time metrics:

1. Open `http://localhost:3001`
2. Click "📊 Metrics" button

**Available metrics:**

- System uptime
- Total requests
- Chat requests
- Error count
- Endpoint-level statistics
- Average response times

---

## 🐳 Docker Deployment

### Build and Run with Docker

```bash
# Build images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment

Kubernetes manifests are available in `/k8s`:

```bash
kubectl apply -f k8s/infra.yaml
kubectl apply -f k8s/api.yaml
kubectl apply -f k8s/web.yaml
```

---

## 🛠️ Development

### Project Structure

```text
cogniflow/
├── apps/
│   ├── api/              # NestJS Backend API
│   │   ├── src/
│   │   │   ├── documents/  # Document & Chat logic
│   │   │   ├── prisma.service.ts
│   │   │   ├── feature-flags.service.ts
│   │   │   └── metrics.service.ts
│   │   └── prisma/
│   │       └── schema.prisma
│   └── web/              # Next.js Frontend
│       ├── app/
│       │   ├── page.tsx    # Main chat interface
│       │   └── globals.css
│       └── public/
├── packages/
│   ├── ui/               # Shared UI components
│   ├── eslint-config/    # Shared ESLint config
│   └── typescript-config/ # Shared TS config
├── docker-compose.yml    # Dev infrastructure
└── turbo.json           # Turborepo config
```

### Adding New Features

1. **Backend (NestJS):**

   ```bash
   cd apps/api
   nest g controller feature
   nest g service feature
   ```

2. **Frontend (Next.js):**

   ```bash
   cd apps/web
   # Edit app/page.tsx or create new components
   ```

### Database Migrations

```bash
cd apps/api

# Create migration
npx prisma migrate dev --name feature_name

# Apply migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Kill processes on ports 3000 and 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Database Connection Issues

```bash
# Restart Docker containers
docker-compose restart

# Check container status
docker-compose ps
```

### Fresh Start

```bash
# Stop all services
docker-compose down

# Remove volumes (⚠️ deletes data)
docker-compose down -v

# Restart
docker-compose up -d
npm run dev
```

---

## 📝 Environment Variables

### API (`apps/api/.env`)

| Variable            | Description                     | Required | Default       |
|---------------------|---------------------------------|----------|---------------|
| `DATABASE_URL`      | PostgreSQL connection string    | Yes      | -             |
| `POSTGRES_USER`     | PostgreSQL username             | Yes      | `postgres`    |
| `POSTGRES_PASSWORD` | PostgreSQL password             | Yes      | `postgres`    |
| `POSTGRES_DB`       | PostgreSQL database name        | Yes      | `cogniflow`   |
| `REDIS_HOST`        | Redis host                      | Yes      | `localhost`   |
| `REDIS_PORT`        | Redis port                      | Yes      | `6379`        |
| `OPENAI_API_KEY`    | OpenAI API key                  | No*      | -             |
| `PORT`              | API server port                 | No       | `3000`        |

*Optional - app works in Mock Mode without it

### Web (`apps/web/.env.local`)

| Variable              | Description     | Required | Default                 |
|-----------------------|-----------------|----------|-------------------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | No       | `http://localhost:3000` |

---

⚡ **CogniFlow** - AI-Powered Knowledge Management System
