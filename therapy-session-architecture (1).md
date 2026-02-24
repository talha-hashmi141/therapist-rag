# Therapy Session Processing - Complete Architecture Document

## Overview

This document provides a comprehensive architecture for building a web application where therapists can upload audio files of therapy sessions. The system processes sessions through transcription with speaker identification, generates summaries, creates vector embeddings, and stores everything for future retrieval.

**Tech Stack (Required) - Updated for 2026**
- Frontend: Next.js 15.5+ with App Router + Tailwind CSS 3.4 + React 19
- Backend: NestJS 11.x (Node.js 20+)
- Database: Supabase (PostgreSQL with pgvector) - @supabase/supabase-js v2.90+
- AI Services: OpenAI APIs (SDK v6.x)

**Important Version Notes (January 2026):**
- Node.js 18 is EOL (April 2025) - use Node.js 20+ or 22+
- NestJS 11 is the current stable (released Jan 2025)
- Next.js 16 is available but 15.5+ is stable for production
- OpenAI SDK v6.x is current (breaking change from v5.x in output types)
- OpenAI recommends `gpt-4o-mini-transcribe` over `gpt-4o-transcribe` for best results
- react-dropzone v14.3.8 requires `--legacy-peer-deps` with React 19

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Upload Page    │  │  Sessions List  │  │  Session Detail View        │  │
│  │  (Dropzone)     │  │                 │  │  - Transcript (speakers)    │  │
│  │                 │  │                 │  │  - Summary                  │  │
│  │                 │  │                 │  │  - Vector status            │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
└───────────┼─────────────────────┼──────────────────────────┼────────────────┘
            │                     │                          │
            ▼                     ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Upload Module  │  │  Sessions       │  │  Processing Pipeline        │  │
│  │  POST /upload   │  │  GET /sessions  │  │  1. Transcription           │  │
│  │                 │  │  GET /sessions  │  │  2. Speaker Diarization     │  │
│  │                 │  │      /:id       │  │  3. Summarization           │  │
│  │                 │  │                 │  │  4. Vectorization           │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
└───────────┼─────────────────────┼──────────────────────────┼────────────────┘
            │                     │                          │
            ▼                     ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SERVICES                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  Supabase       │  │  OpenAI API     │  │  OpenAI API                 │  │
│  │  Storage        │  │  Transcription  │  │  Embeddings                 │  │
│  │  (Audio files)  │  │  + Diarization  │  │  text-embedding-3-small     │  │
│  │                 │  │  gpt-4o-        │  │                             │  │
│  │                 │  │  transcribe-    │  │                             │  │
│  │                 │  │  diarize        │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Supabase PostgreSQL + pgvector                    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │    │
│  │  │  sessions    │  │  transcripts │  │  session_embeddings     │    │    │
│  │  │  table       │  │  table       │  │  table (vectors)        │    │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model (Supabase PostgreSQL)

### Database Schema

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Sessions table (main entity)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audio file metadata
    audio_filename VARCHAR(255) NOT NULL,
    audio_url TEXT NOT NULL,
    audio_duration_seconds INTEGER,
    audio_file_size_bytes BIGINT,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'transcribing',
        'summarizing',
        'vectorizing',
        'completed',
        'failed'
    )),
    error_message TEXT,
    
    -- Processed content
    transcript_raw TEXT,                    -- Full transcript text
    transcript_with_speakers JSONB,         -- Speaker-labeled segments
    summary TEXT,                           -- Generated summary
    
    -- Vectorization status
    is_vectorized BOOLEAN DEFAULT FALSE,
    vectorized_at TIMESTAMPTZ
);

-- Transcript segments with speaker labels (normalized)
CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    speaker VARCHAR(50) NOT NULL,           -- e.g., "Speaker A", "Therapist", "Patient"
    text TEXT NOT NULL,
    start_time_seconds DECIMAL(10, 3),
    end_time_seconds DECIMAL(10, 3),
    segment_index INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector embeddings for semantic search
CREATE TABLE session_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    chunk_index INTEGER NOT NULL,           -- For chunked transcripts
    chunk_text TEXT NOT NULL,               -- The text that was embedded
    embedding vector(1536) NOT NULL,        -- text-embedding-3-small produces 1536 dimensions
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_transcript_segments_session ON transcript_segments(session_id);
CREATE INDEX idx_session_embeddings_session ON session_embeddings(session_id);

-- Create HNSW index for vector similarity search
CREATE INDEX idx_session_embeddings_vector ON session_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- Function for semantic search
CREATE OR REPLACE FUNCTION match_session_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.id,
        se.session_id,
        se.chunk_text,
        1 - (se.embedding <=> query_embedding) AS similarity
    FROM session_embeddings se
    WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Supabase Storage Bucket Configuration

```sql
-- Create bucket for audio files (via Supabase Dashboard or API)
-- Bucket name: 'therapy-audio'
-- Public: false (private bucket)
-- File size limit: 100MB
-- Allowed MIME types: audio/mpeg, audio/wav, audio/webm, audio/mp4, audio/m4a

-- RLS Policy for storage (simplified - no auth for this test)
-- In production, you would add proper authentication
```

---

## Backend Architecture (NestJS)

### Project Structure

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   │
│   ├── config/
│   │   └── config.module.ts           # Environment configuration
│   │
│   ├── database/
│   │   └── supabase.service.ts        # Supabase client
│   │
│   ├── sessions/
│   │   ├── sessions.module.ts
│   │   ├── sessions.controller.ts     # REST endpoints
│   │   ├── sessions.service.ts        # Business logic
│   │   ├── dto/
│   │   │   ├── create-session.dto.ts
│   │   │   └── session-response.dto.ts
│   │   └── entities/
│   │       └── session.entity.ts
│   │
│   ├── processing/
│   │   ├── processing.module.ts
│   │   ├── processing.service.ts      # Orchestrates pipeline
│   │   ├── transcription.service.ts   # OpenAI transcription
│   │   ├── summarization.service.ts   # OpenAI summarization
│   │   └── vectorization.service.ts   # OpenAI embeddings
│   │
│   └── storage/
│       ├── storage.module.ts
│       └── storage.service.ts         # Supabase Storage
│
├── .env
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### Key Backend Files

#### 1. `src/main.ts` (NestJS 11)

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ConsoleLogger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // NestJS 11: New JSON logging support
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
      colors: process.env.NODE_ENV !== 'production',
    }),
  });
  
  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  // Global validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // Global prefix
  app.setGlobalPrefix('api');
  
  await app.listen(process.env.PORT || 4000);
}
bootstrap();
```

#### 2. `src/database/supabase.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_SERVICE_KEY'), // Use service key for backend
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
```

#### 3. `src/sessions/sessions.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { ProcessingService } from '../processing/processing.service';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly processingService: ProcessingService,
  ) {}

  // POST /api/sessions/upload - Upload audio and start processing
  @Post('upload')
  @UseInterceptors(FileInterceptor('audio', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'audio/mpeg', 'audio/wav', 'audio/webm',
        'audio/mp4', 'audio/m4a', 'audio/x-m4a',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid audio file type'), false);
      }
    },
  }))
  async uploadSession(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No audio file provided', HttpStatus.BAD_REQUEST);
    }

    // Create session record
    const session = await this.sessionsService.create(file);

    // Start processing pipeline (async - don't await)
    this.processingService.processSession(session.id).catch(console.error);

    return {
      message: 'Session uploaded and processing started',
      sessionId: session.id,
      status: session.status,
    };
  }

  // GET /api/sessions - List all sessions
  @Get()
  async findAll() {
    return this.sessionsService.findAll();
  }

  // GET /api/sessions/:id - Get single session with full details
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return session;
  }
}
```

#### 4. `src/processing/processing.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TranscriptionService } from './transcription.service';
import { SummarizationService } from './summarization.service';
import { VectorizationService } from './vectorization.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(
    private supabase: SupabaseService,
    private transcription: TranscriptionService,
    private summarization: SummarizationService,
    private vectorization: VectorizationService,
    private storage: StorageService,
  ) {}

  async processSession(sessionId: string): Promise<void> {
    const client = this.supabase.getClient();
    
    try {
      // Get session record
      const { data: session, error } = await client
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (error || !session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Step 1: Transcription with speaker diarization
      this.logger.log(`Starting transcription for session ${sessionId}`);
      await this.updateStatus(sessionId, 'transcribing');
      
      const audioBuffer = await this.storage.downloadFile(session.audio_url);
      const transcriptionResult = await this.transcription.transcribeWithDiarization(
        audioBuffer,
        session.audio_filename,
      );
      
      // Save transcript
      await client
        .from('sessions')
        .update({
          transcript_raw: transcriptionResult.fullText,
          transcript_with_speakers: transcriptionResult.segments,
        })
        .eq('id', sessionId);
      
      // Save segments to normalized table
      if (transcriptionResult.segments.length > 0) {
        const segments = transcriptionResult.segments.map((seg, index) => ({
          session_id: sessionId,
          speaker: seg.speaker,
          text: seg.text,
          start_time_seconds: seg.start,
          end_time_seconds: seg.end,
          segment_index: index,
        }));
        
        await client.from('transcript_segments').insert(segments);
      }

      // Step 2: Summarization
      this.logger.log(`Starting summarization for session ${sessionId}`);
      await this.updateStatus(sessionId, 'summarizing');
      
      const summary = await this.summarization.summarize(transcriptionResult.fullText);
      
      await client
        .from('sessions')
        .update({ summary })
        .eq('id', sessionId);

      // Step 3: Vectorization
      this.logger.log(`Starting vectorization for session ${sessionId}`);
      await this.updateStatus(sessionId, 'vectorizing');
      
      const embeddings = await this.vectorization.vectorize(transcriptionResult.fullText);
      
      // Save embeddings
      const embeddingRecords = embeddings.map((emb, index) => ({
        session_id: sessionId,
        chunk_index: index,
        chunk_text: emb.text,
        embedding: emb.embedding,
      }));
      
      await client.from('session_embeddings').insert(embeddingRecords);
      
      // Mark as completed
      await client
        .from('sessions')
        .update({
          status: 'completed',
          is_vectorized: true,
          vectorized_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
      
      this.logger.log(`Processing completed for session ${sessionId}`);
      
    } catch (error) {
      this.logger.error(`Processing failed for session ${sessionId}:`, error);
      await client
        .from('sessions')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', sessionId);
    }
  }

  private async updateStatus(sessionId: string, status: string): Promise<void> {
    await this.supabase.getClient()
      .from('sessions')
      .update({ status })
      .eq('id', sessionId);
  }
}
```

#### 5. `src/processing/transcription.service.ts` (OpenAI SDK v6.x)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface TranscriptionSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

interface TranscriptionResult {
  fullText: string;
  segments: TranscriptionSegment[];
  duration?: number;
}

@Injectable()
export class TranscriptionService {
  private openai: OpenAI;
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async transcribeWithDiarization(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<TranscriptionResult> {
    // Write buffer to temp file (OpenAI SDK needs file path or readable stream)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}-${filename}`);
    
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Use gpt-4o-transcribe-diarize for speaker identification
      // Note: OpenAI recommends gpt-4o-mini-transcribe for general use,
      // but gpt-4o-transcribe-diarize is needed for speaker diarization
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'gpt-4o-transcribe-diarize',
        response_format: 'diarized_json',
        // chunking_strategy is REQUIRED for audio longer than 30 seconds
        chunking_strategy: 'auto',
      });

      // Parse diarized response - SDK v6.x returns typed response
      const segments: TranscriptionSegment[] = [];
      let fullText = '';
      
      // The diarized_json response contains segments with speaker info
      // Type assertion for diarized response format
      const diarizedResponse = response as {
        text?: string;
        segments?: Array<{
          speaker?: string;
          text: string;
          start: number;
          end: number;
        }>;
        duration?: number;
      };

      if (diarizedResponse.segments && diarizedResponse.segments.length > 0) {
        for (const segment of diarizedResponse.segments) {
          segments.push({
            speaker: segment.speaker || 'Unknown',
            text: segment.text,
            start: segment.start,
            end: segment.end,
          });
          fullText += `${segment.speaker || 'Unknown'}: ${segment.text}\n`;
        }
      } else {
        // Fallback if no segments
        fullText = diarizedResponse.text || '';
      }

      return {
        fullText: fullText.trim() || diarizedResponse.text || '',
        segments,
        duration: diarizedResponse.duration,
      };
      
    } catch (error) {
      this.logger.error('Transcription failed:', error);
      throw error;
    } finally {
      // Clean up temp file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
}
```

**Alternative: Using gpt-4o-mini-transcribe (if diarization not critical)**

If you don't need speaker diarization, OpenAI now recommends `gpt-4o-mini-transcribe` for best results:

```typescript
// For non-diarized transcription (faster, cheaper, recommended by OpenAI)
const response = await this.openai.audio.transcriptions.create({
  file: fs.createReadStream(tempFilePath),
  model: 'gpt-4o-mini-transcribe', // Recommended over gpt-4o-transcribe as of Dec 2025
  response_format: 'json',
});
```

#### 6. `src/processing/summarization.service.ts` (OpenAI SDK v6.x)

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class SummarizationService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async summarize(transcript: string): Promise<string> {
    // Note: In SDK v6.x, 'developer' role replaces 'system' for instruction messages
    // However, 'system' still works for gpt-4o-mini
    const systemPrompt = `You are a professional therapy session summarizer. 
Your task is to create a concise, clinical summary of the therapy session transcript.

Guidelines:
- Focus on key themes, concerns, and therapeutic progress
- Note significant emotional moments or breakthroughs
- Identify any action items or homework mentioned
- Maintain patient confidentiality in your language
- Keep the summary between 150-300 words
- Structure: Opening context → Main themes → Key insights → Closing/Next steps`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective for summarization
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Please summarize this therapy session transcript:\n\n${transcript}` 
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent summaries
      max_tokens: 500,
    });

    return response.choices[0].message.content || 'Unable to generate summary';
  }
}
```

#### 7. `src/processing/vectorization.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

interface EmbeddingChunk {
  text: string;
  embedding: number[];
}

@Injectable()
export class VectorizationService {
  private openai: OpenAI;
  
  // Chunk configuration
  private readonly CHUNK_SIZE = 1000; // characters
  private readonly CHUNK_OVERLAP = 200; // characters

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async vectorize(text: string): Promise<EmbeddingChunk[]> {
    // Split text into overlapping chunks
    const chunks = this.splitIntoChunks(text);
    
    const results: EmbeddingChunk[] = [];
    
    // Process chunks in batches to avoid rate limits
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
        encoding_format: 'float',
      });
      
      for (let j = 0; j < response.data.length; j++) {
        results.push({
          text: batch[j],
          embedding: response.data[j].embedding,
        });
      }
    }
    
    return results;
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + this.CHUNK_SIZE;
      
      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        
        if (breakPoint > start + this.CHUNK_SIZE / 2) {
          end = breakPoint + 1;
        }
      }
      
      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      
      start = end - this.CHUNK_OVERLAP;
      if (start < 0) start = 0;
      if (start >= text.length) break;
    }
    
    return chunks;
  }
}
```

#### 8. `src/storage/storage.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly BUCKET_NAME = 'therapy-audio';

  constructor(private supabase: SupabaseService) {}

  async uploadFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<{ path: string; url: string }> {
    const client = this.supabase.getClient();
    
    // Generate unique filename
    const ext = originalFilename.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${ext}`;
    const filePath = `sessions/${uniqueFilename}`;
    
    const { data, error } = await client.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    
    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
    
    // Generate signed URL (valid for 1 hour)
    const { data: signedData, error: signedError } = await client.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(filePath, 3600);
    
    if (signedError) {
      throw new Error(`Failed to generate signed URL: ${signedError.message}`);
    }
    
    return {
      path: filePath,
      url: signedData.signedUrl,
    };
  }

  async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.getClient().storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(path, 3600);
    
    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
    
    return data.signedUrl;
  }
}
```

---

## Frontend Architecture (Next.js)

### Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Home/Upload page
│   │   ├── globals.css
│   │   └── sessions/
│   │       ├── page.tsx                # Sessions list
│   │       └── [id]/
│   │           └── page.tsx            # Session detail
│   │
│   ├── components/
│   │   ├── AudioUploader.tsx           # Dropzone component
│   │   ├── SessionCard.tsx             # Session list item
│   │   ├── SessionDetail.tsx           # Full session view
│   │   ├── TranscriptView.tsx          # Speaker-labeled transcript
│   │   ├── StatusBadge.tsx             # Processing status
│   │   └── ui/                         # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Spinner.tsx
│   │
│   ├── lib/
│   │   ├── api.ts                      # API client
│   │   └── types.ts                    # TypeScript types
│   │
│   └── hooks/
│       ├── useSession.ts
│       └── useSessions.ts
│
├── .env.local
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

### Key Frontend Files

#### 1. `src/lib/types.ts`

```typescript
export type SessionStatus = 
  | 'pending'
  | 'transcribing'
  | 'summarizing'
  | 'vectorizing'
  | 'completed'
  | 'failed';

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  audio_filename: string;
  audio_url: string;
  audio_duration_seconds?: number;
  status: SessionStatus;
  error_message?: string;
  transcript_raw?: string;
  transcript_with_speakers?: TranscriptSegment[];
  summary?: string;
  is_vectorized: boolean;
  vectorized_at?: string;
}

export interface UploadResponse {
  message: string;
  sessionId: string;
  status: SessionStatus;
}
```

#### 2. `src/lib/api.ts`

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const api = {
  async uploadSession(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('audio', file);
    
    const response = await fetch(`${API_BASE}/sessions/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }
    
    return response.json();
  },
  
  async getSessions(): Promise<Session[]> {
    const response = await fetch(`${API_BASE}/sessions`);
    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }
    return response.json();
  },
  
  async getSession(id: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/sessions/${id}`);
    if (!response.ok) {
      throw new Error('Session not found');
    }
    return response.json();
  },
};
```

#### 3. `src/components/AudioUploader.tsx`

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/mp4': ['.mp4', '.m4a'],
};

export function AudioUploader() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const response = await api.uploadSession(file);
      router.push(`/sessions/${response.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: uploading,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-400'}
        `}
      >
        <input {...getInputProps()} />
        
        {uploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
            <p className="text-gray-600">Uploading and processing...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" 
              />
            </svg>
            <div>
              <p className="text-lg font-medium text-gray-700">
                {isDragActive ? 'Drop the audio file here' : 'Drag & drop an audio file'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or click to select (MP3, WAV, WebM, M4A • Max 100MB)
              </p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
```

#### 4. `src/components/TranscriptView.tsx`

```typescript
'use client';

import { TranscriptSegment } from '@/lib/types';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
}

const SPEAKER_COLORS: Record<string, string> = {
  'A': 'bg-blue-100 text-blue-800',
  'B': 'bg-green-100 text-green-800',
  'C': 'bg-purple-100 text-purple-800',
  'D': 'bg-orange-100 text-orange-800',
  'Unknown': 'bg-gray-100 text-gray-800',
};

function getSpeakerColor(speaker: string): string {
  // Extract letter if speaker is like "Speaker A"
  const letter = speaker.replace('Speaker ', '').charAt(0).toUpperCase();
  return SPEAKER_COLORS[letter] || SPEAKER_COLORS['Unknown'];
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TranscriptView({ segments }: TranscriptViewProps) {
  if (!segments || segments.length === 0) {
    return (
      <p className="text-gray-500 italic">No transcript segments available</p>
    );
  }

  return (
    <div className="space-y-4">
      {segments.map((segment, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex-shrink-0 w-24">
            <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${getSpeakerColor(segment.speaker)}`}>
              {segment.speaker}
            </span>
            {segment.start !== undefined && (
              <span className="block text-xs text-gray-400 mt-1">
                {formatTime(segment.start)}
              </span>
            )}
          </div>
          <p className="flex-1 text-gray-700 leading-relaxed">
            {segment.text}
          </p>
        </div>
      ))}
    </div>
  );
}
```

#### 5. `src/components/StatusBadge.tsx`

```typescript
import { SessionStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: SessionStatus;
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-700' },
  transcribing: { label: 'Transcribing...', className: 'bg-blue-100 text-blue-700' },
  summarizing: { label: 'Summarizing...', className: 'bg-purple-100 text-purple-700' },
  vectorizing: { label: 'Vectorizing...', className: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isProcessing = ['transcribing', 'summarizing', 'vectorizing'].includes(status);
  
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
      {isProcessing && (
        <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
      )}
      {config.label}
    </span>
  );
}
```

#### 6. `src/app/sessions/[id]/page.tsx` (Next.js 15+ with async params)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Session } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TranscriptView } from '@/components/TranscriptView';

export default function SessionDetailPage() {
  // Note: In Next.js 15+, params are async in server components
  // For client components, useParams() still works synchronously
  const params = useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionId = params.id as string;

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const fetchSession = async () => {
      try {
        const data = await api.getSession(sessionId);
        setSession(data);
        
        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    
    // Poll every 3 seconds while processing
    interval = setInterval(fetchSession, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error || 'Session not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {session.audio_filename}
          </h1>
          <StatusBadge status={session.status} />
        </div>
        <p className="text-sm text-gray-500">
          Uploaded {new Date(session.created_at).toLocaleString()}
        </p>
      </div>

      {/* Error Message */}
      {session.error_message && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <strong>Error:</strong> {session.error_message}
        </div>
      )}

      {/* Summary Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Summary</h2>
        <div className="bg-white border rounded-lg p-6">
          {session.summary ? (
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {session.summary}
            </p>
          ) : (
            <p className="text-gray-500 italic">
              {session.status === 'completed' 
                ? 'No summary generated' 
                : 'Summary will appear here after processing'}
            </p>
          )}
        </div>
      </section>

      {/* Transcript Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Transcript</h2>
        <div className="bg-white border rounded-lg p-6">
          {session.transcript_with_speakers && session.transcript_with_speakers.length > 0 ? (
            <TranscriptView segments={session.transcript_with_speakers} />
          ) : session.transcript_raw ? (
            <p className="text-gray-700 whitespace-pre-wrap">{session.transcript_raw}</p>
          ) : (
            <p className="text-gray-500 italic">
              {session.status === 'completed' 
                ? 'No transcript available' 
                : 'Transcript will appear here after processing'}
            </p>
          )}
        </div>
      </section>

      {/* Vectorization Status */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Vectorization</h2>
        <div className="bg-white border rounded-lg p-6">
          <div className="flex items-center gap-3">
            {session.is_vectorized ? (
              <>
                <span className="flex h-3 w-3 rounded-full bg-green-500" />
                <span className="text-gray-700">
                  Vectorized on {new Date(session.vectorized_at!).toLocaleString()}
                </span>
              </>
            ) : (
              <>
                <span className="flex h-3 w-3 rounded-full bg-gray-300" />
                <span className="text-gray-500">
                  {session.status === 'completed' 
                    ? 'Not vectorized' 
                    : 'Vectorization pending'}
                </span>
              </>
            )}
          </div>
          {session.is_vectorized && (
            <p className="mt-2 text-sm text-gray-500">
              Session content has been converted to vector embeddings and is ready for semantic search.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
```

---

## Environment Variables

### Backend `.env`

```env
# Server
PORT=4000
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-proj-your-key-here
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## Package Dependencies

### Backend `package.json` (Updated January 2026)

```json
{
  "name": "therapy-session-backend",
  "version": "1.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "dev": "nest start --watch",
    "start:prod": "node dist/main"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.1.0",
    "@nestjs/platform-express": "^11.1.0",
    "@supabase/supabase-js": "^2.90.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "multer": "^1.4.5-lts.1",
    "openai": "^6.16.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "uuid": "^11.0.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.7.0"
  }
}
```

### Frontend `package.json` (Updated January 2026)

```json
{
  "name": "therapy-session-frontend",
  "version": "1.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-dropzone": "^14.3.8"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.0"
  },
  "overrides": {
    "react-dropzone": {
      "react": "$react"
    }
  }
}
```

**Note on react-dropzone with React 19:**
- react-dropzone v14.3.8 has peer dependency on React 18
- Use `overrides` in package.json (npm) or install with `--legacy-peer-deps`
- Alternative: Use native HTML5 drag-drop with custom implementation

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sessions/upload` | Upload audio file, returns session ID |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session details with transcript/summary |

---

## Processing Pipeline Flow

```
1. UPLOAD
   └── Audio file received via POST /api/sessions/upload
   └── File saved to Supabase Storage
   └── Session record created with status 'pending'
   └── Processing triggered asynchronously

2. TRANSCRIPTION (status: 'transcribing')
   └── Download audio from Supabase Storage
   └── Send to OpenAI gpt-4o-transcribe-diarize API
   └── Receive diarized transcript with speaker labels
   └── Save transcript_raw and transcript_with_speakers
   └── Insert segments into transcript_segments table

3. SUMMARIZATION (status: 'summarizing')
   └── Send transcript to OpenAI GPT-4o-mini
   └── Generate clinical summary
   └── Save summary to sessions table

4. VECTORIZATION (status: 'vectorizing')
   └── Split transcript into overlapping chunks
   └── Generate embeddings via text-embedding-3-small
   └── Store embeddings in session_embeddings table
   └── Mark is_vectorized = true

5. COMPLETION (status: 'completed')
   └── All processing complete
   └── Frontend polls and displays results
```

---

## Key Assumptions & Tradeoffs

### Assumptions
1. **No authentication required** - Out of scope per requirements
2. **Single-user scenario** - No concurrent user conflicts
3. **Audio files up to 100MB** - Reasonable for therapy sessions (typically 45-60 min)
4. **OpenAI API availability** - No offline fallback
5. **Supabase free tier sufficient** - For demo/test purposes
6. **Node.js 20+** - Node.js 18 reached EOL April 2025

### Tradeoffs

| Decision | Rationale |
|----------|-----------|
| **Synchronous processing (no job queue)** | Simplicity over scalability; adequate for demo |
| **Polling for status updates** | Simpler than WebSockets; 3-second interval is responsive enough |
| **text-embedding-3-small** | Cost-effective (1536 dims); sufficient quality for semantic search |
| **gpt-4o-mini for summarization** | Cost-effective; fast; good quality for summaries |
| **gpt-4o-transcribe-diarize for transcription** | Only OpenAI model with built-in speaker diarization |
| **Chunk overlap of 200 chars** | Preserves context at boundaries for better search |
| **Store embeddings in Postgres** | Single DB simplicity; pgvector handles scale well |
| **No background job system** | Time constraint; async/await sufficient for demo |
| **NestJS 11 over 10** | Latest stable with improved logging and performance |
| **Next.js 15.5 over 16** | 15.5 is stable; 16 has breaking changes (middleware → proxy) |

### Version Compatibility Notes (2026)

| Package | Version | Notes |
|---------|---------|-------|
| Node.js | 20+ or 22+ | 18 is EOL |
| NestJS | 11.x | New JSON logging, ParseDatePipe, IntrinsicException |
| Next.js | 15.5.x | Stable; 16.x changes middleware to proxy |
| React | 19.x | Async components, improved Suspense |
| OpenAI SDK | 6.x | Breaking: output types changed from v5 |
| Supabase JS | 2.90+ | Node 18 dropped in 2.79.0 |
| react-dropzone | 14.3.8 | Needs --legacy-peer-deps with React 19 |
| TypeScript | 5.7+ | Required for latest type features |

---

## Optional Enhancements (Nice-to-Have)

### 1. Semantic Search Endpoint

```typescript
// Add to sessions.controller.ts
@Get('search')
async search(@Query('q') query: string) {
  // Generate embedding for query
  const queryEmbedding = await this.vectorization.embedQuery(query);
  
  // Search via Supabase RPC
  const { data } = await this.supabase.getClient()
    .rpc('match_session_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 10,
    });
  
  return data;
}
```

### 2. Chunking Strategy for Large Transcripts

The current implementation uses fixed-size chunks with overlap. For production:
- Implement semantic chunking based on paragraph/speaker turns
- Use recursive summarization for very long sessions
- Consider hierarchical embeddings

### 3. Scaling Considerations

For production scale:
- Add Redis/BullMQ for job queuing
- Implement WebSocket for real-time status updates
- Use Supabase Edge Functions for processing
- Add retry logic with exponential backoff
- Implement rate limiting on API endpoints

---

## Quick Start Commands

```bash
# Ensure Node.js 20+ is installed
node --version  # Should be v20.x or v22.x

# Backend
cd backend
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install --legacy-peer-deps  # Required for react-dropzone with React 19
npm run dev

# Access
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

**Troubleshooting:**
- If you see peer dependency warnings with react-dropzone, use `--legacy-peer-deps`
- Ensure OPENAI_API_KEY is set (the key in the PDF expired Jan 12, 2025)
- Node.js 18 is NOT supported (EOL April 2025)

---

## Testing the Application

1. **Upload Test**: Use a sample therapy audio file (MP3/WAV)
2. **Monitor Processing**: Watch the status change from pending → transcribing → summarizing → vectorizing → completed
3. **View Results**: 
   - Transcript with speaker labels
   - Generated summary
   - Vectorization status indicator

---

This architecture document provides Claude Code with everything needed to implement the therapy session processing system. The design prioritizes simplicity and clarity while meeting all core requirements.
