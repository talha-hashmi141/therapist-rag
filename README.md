# Therapist RAG

A therapy session app with RAG (Retrieval-Augmented Generation): upload audio, get transcription, summarization, vector embeddings, and semantic search/chat over session content.

## Stack

- **Backend:** NestJS, TypeScript, Supabase, OpenAI (transcription, summarization, embeddings, chat)
- **Frontend:** Next.js 15, React 19, Tailwind CSS

## Prerequisites

- Node.js >= 20
- [Supabase](https://supabase.com) project
- [OpenAI](https://platform.openai.com) API key

## Setup

### 1. Backend

```bash
cd backend
cp env.example .env
# Edit .env: SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY
npm install
npm run dev
```

Runs at `http://localhost:4000`. API prefix: `/api`.

### 2. Frontend

```bash
cd frontend
cp env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:4000/api if needed
npm install
npm run dev
```

Runs at `http://localhost:3000`.

### 3. Database

Apply the schema in `backend/supabase-migration.sql` in your Supabase SQL editor.

## Project structure

```
├── backend/          # NestJS API (sessions, uploads, processing, chat)
├── frontend/         # Next.js app (sessions list, upload, chat, search)
├── BACKEND_ARCHITECTURE.md   # Backend file-by-file guide
└── therapy-session-architecture (1).md   # Full architecture doc
```

## Scripts

| Location   | Command       | Description        |
|-----------|---------------|--------------------|
| backend   | `npm run dev` | API with watch     |
| backend   | `npm run build` | Production build |
| frontend  | `npm run dev` | Next.js dev server |
| frontend  | `npm run build` | Next.js production build |

## License

MIT
