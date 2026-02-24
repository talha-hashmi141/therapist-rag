import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { TranscriptionService } from './transcription.service';
import { SummarizationService } from './summarization.service';
import { VectorizationService } from './vectorization.service';
import { StorageService } from '../storage/storage.service';

/**
 * ProcessingService - Orchestrates the AI processing pipeline
 *
 * Pipeline steps:
 * 1. Transcription with speaker diarization (OpenAI gpt-4o-transcribe-diarize)
 * 2. Summarization (OpenAI GPT-4o-mini)
 * 3. Vectorization (OpenAI text-embedding-3-small)
 *
 * Each step updates the session status in the database.
 * Processing runs asynchronously in the background.
 */
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

  /**
   * Process a therapy session through the full AI pipeline
   *
   * @param sessionId - UUID of the session to process
   */
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
      this.logger.log(`[${sessionId}] Starting transcription...`);
      await this.updateStatus(sessionId, 'transcribing');

      const audioBuffer = await this.storage.downloadFile(session.audio_url);
      const transcriptionResult = await this.transcription.transcribeWithDiarization(
        audioBuffer,
        session.audio_filename,
      );

      // Save transcript to session
      await client
        .from('sessions')
        .update({
          transcript_raw: transcriptionResult.fullText,
          transcript_with_speakers: transcriptionResult.segments,
          audio_duration_seconds: transcriptionResult.duration
            ? Math.round(transcriptionResult.duration)
            : null,
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

      this.logger.log(
        `[${sessionId}] Transcription complete. ${transcriptionResult.segments.length} segments.`,
      );

      // Step 2: Summarization
      this.logger.log(`[${sessionId}] Starting summarization...`);
      await this.updateStatus(sessionId, 'summarizing');

      const summary = await this.summarization.summarize(
        transcriptionResult.fullText,
      );

      await client.from('sessions').update({ summary }).eq('id', sessionId);

      this.logger.log(`[${sessionId}] Summarization complete.`);

      // Step 3: Vectorization
      this.logger.log(`[${sessionId}] Starting vectorization...`);
      await this.updateStatus(sessionId, 'vectorizing');

      const embeddings = await this.vectorization.vectorize(
        transcriptionResult.fullText,
      );

      // Save embeddings to database
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

      this.logger.log(
        `[${sessionId}] Processing complete! ${embeddings.length} embeddings created.`,
      );
    } catch (error) {
      this.logger.error(`[${sessionId}] Processing failed:`, error);

      // Update status to failed with error message
      await client
        .from('sessions')
        .update({
          status: 'failed',
          error_message:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
        .eq('id', sessionId);
    }
  }

  /**
   * Update session processing status
   */
  private async updateStatus(sessionId: string, status: string): Promise<void> {
    await this.supabase
      .getClient()
      .from('sessions')
      .update({ status })
      .eq('id', sessionId);
  }
}
