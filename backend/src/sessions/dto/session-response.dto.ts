import { SessionStatus, TranscriptSegment } from '../entities/session.entity';

/**
 * Upload Response DTO
 * Returned after successful audio upload
 *
 * @example
 * {
 *   "message": "Session uploaded and processing started",
 *   "sessionId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "pending"
 * }
 */
export class UploadResponseDto {
  message: string;
  sessionId: string;
  status: SessionStatus;
}

/**
 * Session List Item DTO
 * Used in GET /api/sessions response (simplified view)
 *
 * @example
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "created_at": "2026-01-19T10:30:00Z",
 *   "audio_filename": "session_001.mp3",
 *   "status": "completed",
 *   "is_vectorized": true
 * }
 */
export class SessionListItemDto {
  id: string;
  created_at: string;
  audio_filename: string;
  audio_duration_seconds?: number;
  status: SessionStatus;
  is_vectorized: boolean;
  summary?: string; // First 200 chars for preview
}

/**
 * Session Detail DTO
 * Full session data returned by GET /api/sessions/:id
 *
 * @example
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "created_at": "2026-01-19T10:30:00Z",
 *   "updated_at": "2026-01-19T10:35:00Z",
 *   "audio_filename": "session_001.mp3",
 *   "audio_url": "https://...",
 *   "audio_duration_seconds": 3600,
 *   "status": "completed",
 *   "transcript_raw": "Speaker A: Hello...",
 *   "transcript_with_speakers": [...],
 *   "summary": "This therapy session covered...",
 *   "is_vectorized": true,
 *   "vectorized_at": "2026-01-19T10:35:00Z"
 * }
 */
export class SessionDetailDto {
  id: string;
  created_at: string;
  updated_at: string;

  // Audio info
  audio_filename: string;
  audio_url: string;
  audio_duration_seconds?: number;
  audio_file_size_bytes?: number;

  // Status
  status: SessionStatus;
  error_message?: string;

  // Content
  transcript_raw?: string;
  transcript_with_speakers?: TranscriptSegment[];
  summary?: string;

  // Vectorization
  is_vectorized: boolean;
  vectorized_at?: string;
}

/**
 * Search Result DTO
 * Returned by GET /api/sessions/search
 *
 * @example
 * {
 *   "results": [
 *     {
 *       "id": "...",
 *       "session_id": "...",
 *       "chunk_text": "relevant transcript text...",
 *       "similarity": 0.89,
 *       "session": { "audio_filename": "...", "created_at": "..." }
 *     }
 *   ]
 * }
 */
export class SearchResultDto {
  id: string;
  session_id: string;
  chunk_text: string;
  similarity: number;
  session?: {
    audio_filename: string;
    created_at: string;
  };
}

export class SearchResponseDto {
  query: string;
  results: SearchResultDto[];
  count: number;
}
