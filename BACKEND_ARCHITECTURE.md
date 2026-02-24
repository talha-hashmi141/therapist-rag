# NestJS Backend Architecture Guide

This document explains the structure and purpose of every folder and file in the backend. Use this to understand and explain the codebase in interviews.

---

## 🏗️ What is NestJS?

NestJS is a Node.js framework for building scalable server-side applications. It uses:
- **TypeScript** - For type safety
- **Decorators** - Like `@Controller()`, `@Injectable()` to define behavior
- **Modules** - To organize code into cohesive blocks
- **Dependency Injection** - Services are automatically injected where needed

---

## 📁 Project Structure Overview

```
backend/
├── src/                    # Source code
│   ├── main.ts             # Application entry point
│   ├── app.module.ts       # Root module (connects everything)
│   ├── database/           # Database connection module
│   ├── storage/            # File storage module
│   ├── processing/         # AI processing module (transcription, summarization, vectorization, chat)
│   └── sessions/           # Sessions module (API endpoints, business logic)
├── dist/                   # Compiled JavaScript output
├── node_modules/           # Dependencies
├── package.json            # Project dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── nest-cli.json           # NestJS CLI configuration
└── supabase-migration.sql  # Database schema
```

---

## 🎯 Core Concepts

### 1. Modules (`*.module.ts`)
- **What**: Organize related code together
- **Why**: Keeps code modular and maintainable
- **Contains**: Controllers, Services, Imports, Exports

### 2. Controllers (`*.controller.ts`)
- **What**: Handle HTTP requests (GET, POST, DELETE, etc.)
- **Why**: Define API endpoints and route requests to services
- **Decorators**: `@Controller()`, `@Get()`, `@Post()`, `@Delete()`

### 3. Services (`*.service.ts`)
- **What**: Business logic and data operations
- **Why**: Separate logic from HTTP handling (reusable, testable)
- **Decorator**: `@Injectable()` - Makes it injectable into other classes

### 4. DTOs (`dto/*.dto.ts`)
- **What**: Data Transfer Objects - Define shape of request/response data
- **Why**: Type safety and validation

### 5. Entities (`entities/*.entity.ts`)
- **What**: Define database table structures as TypeScript interfaces
- **Why**: Type safety when working with database records

---

## 📂 Detailed File Breakdown

### `/src/main.ts` - Application Entry Point

**Purpose**: Bootstraps and starts the NestJS application

**What it does**:
- Creates the NestJS application instance
- Configures CORS (Cross-Origin Resource Sharing) for frontend access
- Sets global API prefix (`/api`)
- Starts the server on port 4000

**Why here**: Every application needs an entry point. NestJS convention is `main.ts`.

---

### `/src/app.module.ts` - Root Module

**Purpose**: The main module that imports all other modules

**What it does**:
- Imports `ConfigModule` - For environment variables
- Imports `DatabaseModule` - For Supabase connection
- Imports `StorageModule` - For file uploads
- Imports `ProcessingModule` - For AI processing
- Imports `SessionsModule` - For API endpoints

**Why here**: NestJS requires a root module. It acts as the "glue" connecting all features.

---

## 📂 `/src/database/` - Database Module

### `database.module.ts`
**Purpose**: Configures database connection and exports it

**What it does**:
- Imports `ConfigModule` for environment variables
- Provides `SupabaseService` to other modules
- Exports `SupabaseService` so other modules can use it

**Why separate module**: Database logic is shared across the app. Making it a module allows reuse.

---

### `supabase.service.ts`
**Purpose**: Manages the Supabase client connection

**What it does**:
- Creates a Supabase client using URL and API key from environment
- Provides `getClient()` method for other services to access Supabase
- Uses `@Injectable()` so NestJS can inject it anywhere

**Why a service**: Centralizes database connection. Any service needing database access gets this injected.

---

## 📂 `/src/storage/` - Storage Module

### `storage.module.ts`
**Purpose**: Configures file storage functionality

**What it does**:
- Imports `DatabaseModule` (needs Supabase client)
- Provides `StorageService`
- Exports `StorageService` for use in other modules

---

### `storage.service.ts`
**Purpose**: Handles file uploads/downloads to Supabase Storage

**What it does**:
- `uploadFile()` - Uploads audio files to `therapy-audio` bucket
- `downloadFile()` - Downloads files (used during processing)
- `getSignedUrl()` - Generates temporary URLs for file access
- `deleteFile()` - Removes files when session is deleted

**Why separate**: File storage logic is distinct from business logic. Keeps code clean.

---

## 📂 `/src/processing/` - AI Processing Module

This module contains all AI/ML functionality.

### `processing.module.ts`
**Purpose**: Configures AI processing services

**What it does**:
- Imports `StorageModule` (needs to download audio files)
- Provides all processing services
- Exports `ProcessingService`, `VectorizationService`, `ChatService`

---

### `processing.service.ts`
**Purpose**: Orchestrates the AI processing pipeline

**What it does**:
- `processSession()` - Runs the full pipeline:
  1. Downloads audio file
  2. Transcribes with speaker diarization
  3. Generates clinical summary
  4. Creates vector embeddings
- Updates session status at each step
- Handles errors and marks sessions as failed

**Why orchestrator**: Coordinates multiple services. Single responsibility - just orchestration.

---

### `transcription.service.ts`
**Purpose**: Converts audio to text with speaker identification

**What it does**:
- `transcribeWithDiarization()` - Uses OpenAI `gpt-4o-transcribe-diarize`
  - Creates temp file from buffer
  - Calls OpenAI API
  - Parses response into speaker-labeled segments
- `transcribeSimple()` - Basic transcription without speakers

**Why separate**: Transcription is a distinct AI task. Could swap to different provider.

---

### `summarization.service.ts`
**Purpose**: Generates clinical summaries from transcripts

**What it does**:
- `summarize()` - Uses OpenAI `gpt-4o-mini` with clinical prompt
  - Takes transcript text
  - Generates structured clinical summary
  - Returns formatted summary

**Why separate**: Summarization is distinct from transcription. Different model, different purpose.

---

### `vectorization.service.ts`
**Purpose**: Creates vector embeddings for semantic search

**What it does**:
- `vectorize()` - Converts text to embeddings
  - Splits text into overlapping chunks (1000 chars, 200 overlap)
  - Calls OpenAI `text-embedding-3-small`
  - Returns array of text chunks with 1536-dimension vectors
- `embedQuery()` - Creates embedding for a search query

**Why chunking**: Long texts need to be split. Overlap ensures context isn't lost at boundaries.

---

### `chat.service.ts`
**Purpose**: RAG (Retrieval-Augmented Generation) chat system

**What it does**:
- `chat()` - Conversational AI with knowledge base
  1. Embeds user question
  2. Searches for relevant transcript chunks (semantic search)
  3. Builds context from retrieved chunks
  4. Sends to GPT-4o-mini with context
  5. Returns response with source citations
- `getKnowledgeBaseStatus()` - Returns stats about vectorized sessions
- `manualSimilaritySearch()` - Fallback when RPC fails

**Why RAG**: Allows AI to answer questions using actual session data, not just training knowledge.

---

## 📂 `/src/sessions/` - Sessions Module

This module handles API endpoints and business logic for sessions.

### `sessions.module.ts`
**Purpose**: Configures the sessions feature

**What it does**:
- Imports `StorageModule` and `ProcessingModule`
- Provides `SessionsService`
- Registers `SessionsController`
- Exports `SessionsService`

---

### `sessions.controller.ts`
**Purpose**: Defines API endpoints (REST API)

**Endpoints**:
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/sessions/upload` | Upload audio file |
| POST | `/api/sessions/chat` | Chat with AI (RAG) |
| GET | `/api/sessions/chat/status` | Knowledge base status |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/search` | Semantic search |
| GET | `/api/sessions/:id` | Get single session |
| POST | `/api/sessions/:id/chat` | Chat about specific session |
| DELETE | `/api/sessions/:id` | Delete session |

**What it does**:
- Receives HTTP requests
- Validates input (file type, required fields)
- Calls appropriate service methods
- Returns responses

**Why controller**: Separates HTTP handling from business logic. Controllers are thin - just routing.

---

### `sessions.service.ts`
**Purpose**: Business logic for session management

**What it does**:
- `create()` - Creates new session record, uploads file
- `findAll()` - Lists all sessions
- `findOne()` - Gets single session with refreshed URL
- `updateStatus()` - Updates processing status
- `searchByEmbedding()` - Semantic search using pgvector
- `delete()` - Removes session and related data
- `manualSimilaritySearch()` - Fallback search in JavaScript

**Why service**: Contains all business logic. Reusable, testable, independent of HTTP.

---

### `/dto/session-response.dto.ts`
**Purpose**: Defines data structures for API responses

**What it contains**:
- `SessionListItemDto` - Shape of session in list view
- `SessionDetailDto` - Shape of full session details
- `SearchResultDto` - Shape of search results

**Why DTOs**: Type safety. Documents API response shapes. Makes refactoring safer.

---

### `/entities/session.entity.ts`
**Purpose**: Defines the Session database model

**What it contains**:
- `Session` interface - All fields in sessions table
- `SessionStatus` type - Possible status values

**Why entities**: Type safety when working with database records.

---

## 📂 Other Files

### `nest-cli.json`
**Purpose**: NestJS CLI configuration

**What it does**:
- Specifies entry file location
- Configures compiler options
- Defines build output directory

---

### `tsconfig.json`
**Purpose**: TypeScript compiler configuration

**What it does**:
- Enables decorators (essential for NestJS)
- Sets module resolution
- Configures strict type checking

---

### `package.json`
**Purpose**: Project metadata and dependencies

**Key scripts**:
- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start:prod` - Run production build

**Key dependencies**:
- `@nestjs/core` - NestJS framework
- `@nestjs/config` - Environment variables
- `@nestjs/platform-express` - Express HTTP adapter
- `@supabase/supabase-js` - Supabase client
- `openai` - OpenAI API client
- `multer` - File upload handling

---

### `supabase-migration.sql`
**Purpose**: Database schema definition

**Tables created**:
1. `sessions` - Main session records
2. `transcript_segments` - Speaker-labeled transcript parts
3. `session_embeddings` - Vector embeddings for search

**Functions created**:
- `match_session_embeddings()` - pgvector similarity search

---

## 🔄 Data Flow

### 1. Upload Flow
```
Client → Controller (POST /upload)
      → SessionsService.create()
      → StorageService.uploadFile()
      → Database insert
      → ProcessingService.processSession() [async]
```

### 2. Processing Flow
```
ProcessingService.processSession()
├─→ StorageService.downloadFile()
├─→ TranscriptionService.transcribeWithDiarization()
├─→ SummarizationService.summarize()
├─→ VectorizationService.vectorize()
└─→ Database updates at each step
```

### 3. Search Flow
```
Client → Controller (GET /search?q=...)
      → VectorizationService.embedQuery()
      → SessionsService.searchByEmbedding()
      → Supabase RPC (pgvector similarity)
      → Return results
```

### 4. Chat Flow (RAG)
```
Client → Controller (POST /chat)
      → ChatService.chat()
      ├─→ VectorizationService.embedQuery()
      ├─→ Supabase RPC (find relevant chunks)
      ├─→ Build context from chunks
      └─→ OpenAI chat completion with context
```

---

## 🎨 Design Patterns Used

1. **Dependency Injection** - Services injected via constructor
2. **Repository Pattern** - Services abstract database operations
3. **Module Pattern** - Code organized into cohesive modules
4. **Pipeline Pattern** - Processing flows through stages
5. **RAG Pattern** - Retrieval-Augmented Generation for chat
6. **Decorator Pattern** - NestJS decorators for metadata

---

## 🔑 Key Interview Points

1. **Why NestJS?** - TypeScript support, modular architecture, dependency injection, great for enterprise apps

2. **Why separate modules?** - Separation of concerns, reusability, easier testing

3. **Why services vs controllers?** - Controllers handle HTTP, services handle logic. Makes code testable and reusable.

4. **Why Supabase?** - PostgreSQL with pgvector extension, built-in storage, easy setup

5. **Why chunking for embeddings?** - LLMs have token limits. Chunking with overlap preserves context.

6. **Why RAG for chat?** - Allows AI to answer based on actual data, not hallucinate

7. **Why async processing?** - Audio transcription takes time. Don't block the upload response.

---

## 📚 Technologies Used

| Technology | Purpose |
|------------|---------|
| NestJS | Backend framework |
| TypeScript | Type safety |
| Supabase | Database (PostgreSQL) + Storage |
| pgvector | Vector similarity search |
| OpenAI | Transcription, summarization, embeddings, chat |
| Multer | File upload handling |

---

This architecture follows NestJS best practices and is production-ready. Each layer has a single responsibility, making it easy to maintain, test, and scale.
