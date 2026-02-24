/**
 * Session Status Enum
 * Represents the current processing state of a therapy session
 */
export type SessionStatus =
  | 'pending'
  | 'transcribing'
  | 'summarizing'
  | 'vectorizing'
  | 'completed'
  | 'failed';

/**
 * Transcript Segment Interface
 * Represents a single segment of speech with speaker identification
 */
export interface TranscriptSegment {
  speaker: string; // e.g., "Speaker A", "Therapist"
  text: string;
  start: number; // Start time in seconds
  end: number; // End time in seconds
}

/**
 * Session Entity
 * Represents a therapy session record in the database
 */
export interface Session {
  id: string;
  created_at: string;
  updated_at: string;

  // Audio file metadata
  audio_filename: string;
  audio_url: string;
  audio_storage_path: string;
  audio_duration_seconds?: number;
  audio_file_size_bytes?: number;

  // Processing status
  status: SessionStatus;
  error_message?: string;

  // Processed content
  transcript_raw?: string;
  transcript_with_speakers?: TranscriptSegment[];
  summary?: string;

  // Vectorization status
  is_vectorized: boolean;
  vectorized_at?: string;
}

/**
 * Transcript Segment Entity (normalized table)
 */
export interface TranscriptSegmentEntity {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  start_time_seconds: number;
  end_time_seconds: number;
  segment_index: number;
  created_at: string;
}

/**
 * Session Embedding Entity
 * Represents a vectorized chunk of the transcript
 */
export interface SessionEmbedding {
  id: string;
  session_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[];
  created_at: string;
}
