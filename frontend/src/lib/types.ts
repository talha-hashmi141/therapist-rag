/**
 * Session processing status
 */
export type SessionStatus =
  | 'pending'
  | 'transcribing'
  | 'summarizing'
  | 'vectorizing'
  | 'completed'
  | 'failed';

/**
 * Transcript segment with speaker identification
 */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

/**
 * Session list item (summary view)
 */
export interface SessionListItem {
  id: string;
  created_at: string;
  audio_filename: string;
  audio_duration_seconds?: number;
  status: SessionStatus;
  is_vectorized: boolean;
  summary?: string;
}

/**
 * Full session details
 */
export interface Session {
  id: string;
  created_at: string;
  updated_at: string;
  audio_filename: string;
  audio_url: string;
  audio_duration_seconds?: number;
  audio_file_size_bytes?: number;
  status: SessionStatus;
  error_message?: string;
  transcript_raw?: string;
  transcript_with_speakers?: TranscriptSegment[];
  summary?: string;
  is_vectorized: boolean;
  vectorized_at?: string;
}

/**
 * Upload response from API
 */
export interface UploadResponse {
  message: string;
  sessionId: string;
  status: SessionStatus;
}

/**
 * Search result item
 */
export interface SearchResult {
  id: string;
  session_id: string;
  chunk_text: string;
  similarity: number;
  session?: {
    audio_filename: string;
    created_at: string;
  };
}

/**
 * Chat message in conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Source citation from RAG retrieval
 */
export interface ChatSource {
  session_id: string;
  chunk_text: string;
  similarity: number;
  session_info?: {
    audio_filename: string;
    created_at: string;
  };
}

/**
 * Knowledge base status
 */
export interface KnowledgeBaseStatus {
  hasVectorizedSessions: boolean;
  totalSessions: number;
  vectorizedSessions: number;
  totalEmbeddings: number;
}

/**
 * Chat response from API
 */
export interface ChatResponse {
  message: string;
  sources: ChatSource[];
  knowledgeBase?: KnowledgeBaseStatus;
}
