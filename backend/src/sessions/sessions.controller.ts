import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SessionsService } from './sessions.service';
import { ProcessingService } from '../processing/processing.service';
import { VectorizationService } from '../processing/vectorization.service';
import { ChatService, ChatMessage } from '../processing/chat.service';

/**
 * Chat request body
 */
interface ChatRequestDto {
  message: string;
  history?: ChatMessage[];
  sessionId?: string;
}

/**
 * SessionsController - REST API endpoints for therapy sessions
 *
 * Base URL: /api/sessions
 *
 * Endpoints:
 * - POST   /upload       - Upload audio file and start processing
 * - POST   /chat         - Chat with AI about all sessions (RAG)
 * - GET    /             - List all sessions
 * - GET    /search       - Semantic search across sessions
 * - GET    /:id          - Get single session details
 * - POST   /:id/chat     - Chat with AI about a specific session
 * - DELETE /:id          - Delete a session
 */
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly processingService: ProcessingService,
    private readonly vectorizationService: VectorizationService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * POST /api/sessions/upload
   *
   * Upload an audio file and start background processing.
   * Processing pipeline: transcription → summarization → vectorization
   *
   * @param file - Audio file (multipart/form-data, field name: 'audio')
   *
   * Accepted formats: MP3, WAV, WebM, MP4, M4A
   * Max file size: 100MB
   *
   * @returns {object} Upload confirmation
   * @example Response:
   * {
   *   "message": "Session uploaded and processing started",
   *   "sessionId": "550e8400-e29b-41d4-a716-446655440000",
   *   "status": "pending"
   * }
   *
   * @throws 400 - No audio file provided
   * @throws 400 - Invalid audio file type
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'audio/mpeg',
          'audio/wav',
          'audio/webm',
          'audio/mp4',
          'audio/m4a',
          'audio/x-m4a',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid audio file type'), false);
        }
      },
    }),
  )
  async uploadSession(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No audio file provided', HttpStatus.BAD_REQUEST);
    }

    // Create session record
    const session = await this.sessionsService.create(file);

    // Start processing pipeline (async - don't await)
    this.processingService.processSession(session.id).catch((err) => {
      console.error(`Processing failed for session ${session.id}:`, err);
    });

    return {
      message: 'Session uploaded and processing started',
      sessionId: session.id,
      status: session.status,
    };
  }

  /**
   * POST /api/sessions/chat
   *
   * Conversational RAG - Chat with AI about all therapy sessions.
   * The AI retrieves relevant context from vectorized sessions and generates
   * informed responses with source citations.
   *
   * @param body.message - User's question or message
   * @param body.history - Optional conversation history for multi-turn chat
   *
   * @returns {object} AI response with source citations
   * @example Request:
   * {
   *   "message": "What coping strategies have been discussed?",
   *   "history": [
   *     { "role": "user", "content": "Tell me about anxiety mentions" },
   *     { "role": "assistant", "content": "In the session from..." }
   *   ]
   * }
   *
   * @example Response:
   * {
   *   "message": "Based on the therapy sessions, several coping strategies...",
   *   "sources": [
   *     {
   *       "session_id": "uuid",
   *       "chunk_text": "...we discussed deep breathing...",
   *       "similarity": 0.85,
   *       "session_info": { "audio_filename": "session.mp3", "created_at": "..." }
   *     }
   *   ]
   * }
   */
  @Post('chat')
  async chat(@Body() body: ChatRequestDto) {
    if (!body.message || body.message.trim().length === 0) {
      throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
    }

    // Get knowledge base status
    const kbStatus = await this.chatService.getKnowledgeBaseStatus();
    
    // Chat with the AI
    const response = await this.chatService.chat(
      body.message,
      body.history || [],
      body.sessionId,
    );

    // Include knowledge base status in response for debugging
    return {
      ...response,
      knowledgeBase: kbStatus,
    };
  }

  /**
   * GET /api/sessions/chat/status
   *
   * Get the status of the knowledge base for chat.
   * Useful for checking if there are vectorized sessions available.
   *
   * @returns {object} Knowledge base status
   */
  @Get('chat/status')
  async getChatStatus() {
    return this.chatService.getKnowledgeBaseStatus();
  }

  /**
   * GET /api/sessions
   *
   * List all therapy sessions with summary info for list display.
   * Sessions are ordered by creation date (newest first).
   *
   * @returns {Array} List of sessions
   * @example Response:
   * [
   *   {
   *     "id": "550e8400-e29b-41d4-a716-446655440000",
   *     "created_at": "2026-01-19T12:00:00Z",
   *     "audio_filename": "session-jan-19.mp3",
   *     "audio_duration_seconds": 2700,
   *     "status": "completed",
   *     "is_vectorized": true,
   *     "summary": "Patient discussed anxiety about work... (truncated)"
   *   }
   * ]
   */
  @Get()
  async findAll() {
    return this.sessionsService.findAll();
  }

  /**
   * GET /api/sessions/search?q=<query>
   *
   * Semantic search across all vectorized sessions.
   * Uses vector similarity to find relevant transcript chunks.
   *
   * @param q - Search query string (required)
   * @param threshold - Minimum similarity threshold 0-1 (default: 0.7)
   * @param limit - Maximum results to return (default: 10)
   *
   * @returns {Array} Matching transcript chunks with session info
   * @example Request: GET /api/sessions/search?q=anxiety about work&limit=5
   * @example Response:
   * [
   *   {
   *     "id": "chunk-uuid",
   *     "session_id": "session-uuid",
   *     "chunk_text": "I've been feeling really anxious about work lately...",
   *     "similarity": 0.89,
   *     "session": {
   *       "audio_filename": "session-jan-19.mp3",
   *       "created_at": "2026-01-19T12:00:00Z"
   *     }
   *   }
   * ]
   *
   * @throws 400 - Query parameter 'q' is required
   */
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('threshold') threshold?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException(
        "Query parameter 'q' is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Generate embedding for the search query
    const queryEmbedding = await this.vectorizationService.embedQuery(query);

    // Search using the embedding (low threshold for text-embedding-3-small model)
    return this.sessionsService.searchByEmbedding(
      queryEmbedding,
      threshold ? parseFloat(threshold) : 0.15,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * GET /api/sessions/:id
   *
   * Get full details of a single session including transcript and summary.
   *
   * @param id - Session UUID
   *
   * @returns {object} Full session data
   * @example Response:
   * {
   *   "id": "550e8400-e29b-41d4-a716-446655440000",
   *   "created_at": "2026-01-19T12:00:00Z",
   *   "updated_at": "2026-01-19T12:15:00Z",
   *   "audio_filename": "session-jan-19.mp3",
   *   "audio_url": "https://xxx.supabase.co/storage/v1/object/sign/...",
   *   "audio_duration_seconds": 2700,
   *   "audio_file_size_bytes": 45000000,
   *   "status": "completed",
   *   "transcript_raw": "Full transcript text...",
   *   "transcript_with_speakers": [
   *     { "speaker": "Speaker A", "text": "Hello...", "start": 0, "end": 5 }
   *   ],
   *   "summary": "Clinical summary of the session...",
   *   "is_vectorized": true,
   *   "vectorized_at": "2026-01-19T12:15:00Z"
   * }
   *
   * @throws 404 - Session not found
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return session;
  }

  /**
   * POST /api/sessions/:id/chat
   *
   * Chat with AI about a specific therapy session.
   * Context retrieval is limited to the specified session.
   *
   * @param id - Session UUID
   * @param body.message - User's question about this session
   * @param body.history - Optional conversation history
   *
   * @returns {object} AI response with source citations from this session
   */
  @Post(':id/chat')
  async chatAboutSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ChatRequestDto,
  ) {
    // Verify session exists
    const session = await this.sessionsService.findOne(id);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    if (!body.message || body.message.trim().length === 0) {
      throw new HttpException('Message is required', HttpStatus.BAD_REQUEST);
    }

    return this.chatService.chatAboutSession(
      id,
      body.message,
      body.history || [],
    );
  }

  /**
   * DELETE /api/sessions/:id
   *
   * Delete a session and all related data (transcript, embeddings, audio file).
   *
   * @param id - Session UUID
   *
   * @returns {object} Deletion confirmation
   * @example Response:
   * {
   *   "message": "Session deleted successfully",
   *   "sessionId": "550e8400-e29b-41d4-a716-446655440000"
   * }
   *
   * @throws 404 - Session not found
   */
  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    const session = await this.sessionsService.findOne(id);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    await this.sessionsService.delete(id);

    return {
      message: 'Session deleted successfully',
      sessionId: id,
    };
  }
}
