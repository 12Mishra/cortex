# Cortex

Cortex is a document-grounded AI assistant for private PDF knowledge bases. Users sign in with Google, upload PDFs to S3 through presigned URLs, process them asynchronously, and then ask questions against the indexed document. Answers are streamed back to the browser and grounded in retrieved chunks with page-number citations where extraction provides page metadata.

## Problem Statement

Long PDFs are hard to inspect quickly, and generic chat assistants are not reliable when they answer from memory instead of the source document. Cortex narrows the problem to document-owned retrieval augmented generation:

- Store each user's PDFs privately.
- Extract and index document text with page-level metadata.
- Retrieve relevant chunks with semantic and keyword search.
- Generate concise answers only from retrieved context.
- Preserve conversations per user and document.
- Expose enough source detail that important answers can be verified.

## Live Demo And Screenshots

- Local demo: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Public live demo: `https://cortex.abhyudaymishra.in/`

Current architecture sketch:

![Cortex architecture and RAG flow](image.png)

## Features

- Google authentication through NextAuth.
- Authenticated dashboard for per-user document management.
- Multi-PDF drag-and-drop upload flow.
- S3 presigned upload URLs so files go directly from browser to object storage.
- PostgreSQL and Prisma persistence for users, documents, chunks, conversations, and messages.
- `pgvector` storage for 768-dimensional Jina Embeddings v3 vectors.
- BullMQ and Redis-backed asynchronous document processing.
- Server-Sent Events for live file-processing progress.
- Docling layout and table extraction with structure-aware chunks and page citations.
- Extracted pictures stored in S3 and passed to Gemini when their chunks are retrieved.
- Hybrid retrieval using vector similarity and PostgreSQL full-text search.
- Reciprocal Rank Fusion for merging semantic and keyword candidates.
- Streaming chat responses from the API to the Next.js client.
- Basic internal API secret between the web app and Express API.
- Per-user document and conversation filtering on most web-facing routes.

## Architecture

```mermaid
flowchart LR
  Browser[Browser / Next.js UI]
  NextApi[Next.js API routes]
  Auth[Google OAuth / NextAuth]
  S3[(S3 bucket)]
  Db[(Postgres + pgvector)]
  Redis[(Redis)]
  Queue[BullMQ file-queue]
  Worker[File worker]
  Docling[Docling Serve]
  Jina[Jina embeddings]
  Gemini[Gemini generation]
  Express[Express API]

  Browser --> Auth
  Browser --> NextApi
  NextApi --> Db
  NextApi --> S3
  NextApi --> Express
  Express --> Db
  Express --> Queue
  Queue --> Redis
  Worker --> Queue
  Worker --> S3
  Worker --> Docling
  Worker --> Jina
  Worker --> Db
  Worker --> Redis
  Express --> Jina
  Express --> Gemini
  Express --> Browser
```

### Services

- `web/`: Next.js 16 app with dashboard, upload, auth, document APIs, conversation APIs, and chat UI.
- `server/`: Express service for file-processing orchestration, chat retrieval, SSE streaming, and the BullMQ worker entrypoint.
- `docker-compose.yaml`: local Postgres with `pgvector`, Redis, and Docling Serve.
- `S3`: external file storage used by both the web app and worker.
- `Jina`: used for document and query embeddings.
- `Gemini`: used for streamed answer generation and inspection of retrieved pictures.

## Ingestion Flow

```mermaid
sequenceDiagram
  participant User
  participant Web as Next.js app
  participant S3
  participant DB as Postgres/pgvector
  participant API as Express API
  participant Queue as BullMQ/Redis
  participant Worker
  participant Docling
  participant Jina
  participant Gemini

  User->>Web: Select PDF
  Web->>S3: Create presigned PUT URL
  User->>S3: Upload PDF directly
  User->>Web: Confirm upload
  Web->>DB: Create Document(status=uploaded)
  Web->>API: POST /file/process
  API->>Queue: Add process-file-job
  Worker->>S3: Download PDF
  Worker->>Docling: Extract structured chunks and pictures
  Worker->>Jina: Generate text embeddings
  Worker->>DB: Store DocumentChunk rows
  Worker->>DB: Mark Document ready
  Worker-->>Web: Publish progress over Redis/SSE
```

## Retrieval And Answer Flow

```mermaid
sequenceDiagram
  participant User
  participant Web as Next.js app
  participant API as Express API
  participant DB as Postgres/pgvector
  participant Jina
  participant Gemini

  User->>Web: Ask question for documentId
  Web->>DB: Validate document belongs to signed-in user and is ready
  Web->>API: POST /chat with internal secret and user id
  API->>DB: Validate document belongs to user and is ready
  API->>Jina: Embed query
  API->>DB: Vector search + full-text search
  API->>API: Merge results with Reciprocal Rank Fusion
  API->>Gemini: Stream answer with retrieved context
  API-->>Web: Stream answer deltas and citations
  Web-->>User: Render answer and page chips
  API->>DB: Persist user and assistant messages
```

Current retrieval parameters live in `server/src/lib/retrieval.ts`:

- Vector similarity floor: `0.5`
- Vector candidate limit: `10`
- Keyword candidate limit: `10`
- Final context chunks: `6`
- RRF constant: `60`

The worker sends each S3 PDF buffer to Docling Serve's hybrid chunk endpoint. Docling preserves headings, table structure, and page metadata; the worker embeds the returned text chunks with Jina Embeddings v3 (`retrieval.passage`, 768 dimensions). Search queries use the same model with `retrieval.query`. Picture bytes are exported separately to S3 and linked to their chunks. Picture descriptions and image embeddings are not enabled, so image-only content is searchable only through surrounding text until a vision indexing step is added.

Apply migrations after switching embedding providers. The Jina migration marks previously ready documents as failed so their Gemini vectors are not searched against Jina query vectors. Use **Retry** on each affected document to rebuild its index.

## Local Setup

### Prerequisites

- Node.js `>=22.12`
- npm
- Docker Desktop
- AWS S3 bucket and credentials
- Google OAuth client credentials
- Gemini API key
- Jina API key

### 1. Start local infrastructure

```bash
docker compose up -d
```

This starts:

- Postgres with `pgvector` on host port `5433`
- Redis on host port `6379`
- Docling Serve on host port `5001` (the first start downloads its models)

### 2. Install dependencies

```bash
cd web
npm install

cd ../server
npm install
```

### 3. Configure environment variables

Create `web/.env.local` and `server/.env` using the templates below.

### 4. Prepare the database

Run migrations from the `web` package, which also generates the API Prisma client through the `clientApi` generator:

```bash
cd web
npx prisma migrate deploy
npx prisma generate
```

If you are iterating locally and need to create a fresh database from migrations, use:

```bash
npx prisma migrate reset
```

### 5. Run the app

Terminal 1:

```bash
cd web
npm run dev
```

Terminal 2:

```bash
cd server
npm run dev
```

Terminal 3:

```bash
cd server
npm run dev:worker
```

Open `http://localhost:3000`, sign in with Google, upload a PDF, start processing, and open chat once the document status is `Ready`.

## Environment Variables

### `web/.env.local`

```env
DATABASE_URL="postgresql://postgres:root123@localhost:5433/cortex"

GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

AUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

AWS_S3_REGION="us-east-1"
AWS_S3_ACCESS_KEY="your-access-key"
AWS_S3_SECRET_KEY="your-secret-key"
AWS_S3_BUCKET_NAME="your-bucket-name"

EXPRESS_API_URL="http://localhost:3001"
INTERNAL_API_SECRET="shared-local-secret"
```

### `server/.env`

```env
DATABASE_URL="postgresql://postgres:root123@localhost:5433/cortex"

PORT="3001"
ALLOWED_ORIGINS="http://localhost:3000"
INTERNAL_API_SECRET="shared-local-secret"

REDIS_URL="redis://localhost:6379"
DOCLING_SERVE_URL="http://localhost:5001"
# Set DOCLING_SERVE_URL="http://docling:5001" if the worker runs in Docker.

AWS_S3_REGION="us-east-1"
AWS_S3_ACCESS_KEY="your-access-key"
AWS_S3_SECRET_KEY="your-secret-key"
AWS_S3_BUCKET_NAME="your-bucket-name"

GEMINI_API_KEY="your-gemini-api-key"
JINA_API_KEY="your-jina-api-key"

FILE_WORKER_MIN="3"
FILE_WORKER_MAX="10"
FILE_WORKER_SCALE_INTERVAL_MS="5000"
```

