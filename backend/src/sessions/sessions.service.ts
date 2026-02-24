import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { StorageService } from '../storage/storage.service';
import { Session, SessionStatus } from './entities/session.entity';
import {
  SessionListItemDto,
  SessionDetailDto,
  SearchResultDto,
} from './dto/session-response.dto';

/**
 * SessionsService - Business logic for session management
 *
 * Handles CRUD operations for therapy sessions including:
 * - Creating new sessions from uploaded audio
 * - Fetching session lists and details
 * - Semantic search across vectorized sessions
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private supabase: SupabaseService,
    private storage: StorageService,
  ) {}

  /**
   * Create a new session from an uploaded audio file
   *
   * @param file - The uploaded audio file (Multer file object)
   * @returns The created session record
   */
  async create(file: Express.Multer.File): Promise<Session> {
    this.logger.log(`Creating session for file: ${file.originalname}`);

    // Upload file to Supabase Storage
    const { path, url } = await this.storage.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Create session record in database
    const { data, error } = await this.supabase
      .getClient()
      .from('sessions')
      .insert({
        audio_filename: file.originalname,
        audio_url: url,
        audio_storage_path: path,
        audio_file_size_bytes: file.size,
        status: 'pending' as SessionStatus,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw new Error(`Failed to create session: ${error.message}`);
    }

    this.logger.log(`Session created: ${data.id}`);
    return data as Session;
  }

  /**
   * Get all sessions (list view)
   *
   * @returns Array of sessions with summary info for list display
   */
  async findAll(): Promise<SessionListItemDto[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('sessions')
      .select(
        'id, created_at, audio_filename, audio_duration_seconds, status, is_vectorized, summary',
      )
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch sessions: ${error.message}`);
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    // Truncate summary for list preview
    return (data || []).map((session) => ({
      ...session,
      summary: session.summary
        ? session.summary.substring(0, 200) +
          (session.summary.length > 200 ? '...' : '')
        : undefined,
    }));
  }

  /**
   * Get a single session with full details
   *
   * @param id - Session UUID
   * @returns Full session data including transcript and summary
   */
  async findOne(id: string): Promise<SessionDetailDto | null> {
    const client = this.supabase.getClient();

    // Fetch session
    const { data: session, error } = await client
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    // Refresh signed URL if needed (URLs expire after 1 hour)
    let audioUrl = session.audio_url;
    if (session.audio_storage_path) {
      try {
        audioUrl = await this.storage.getSignedUrl(session.audio_storage_path);
      } catch {
        // Use existing URL if refresh fails
        this.logger.warn(`Could not refresh signed URL for session ${id}`);
      }
    }

    return {
      id: session.id,
      created_at: session.created_at,
      updated_at: session.updated_at,
      audio_filename: session.audio_filename,
      audio_url: audioUrl,
      audio_duration_seconds: session.audio_duration_seconds,
      audio_file_size_bytes: session.audio_file_size_bytes,
      status: session.status,
      error_message: session.error_message,
      transcript_raw: session.transcript_raw,
      transcript_with_speakers: session.transcript_with_speakers,
      summary: session.summary,
      is_vectorized: session.is_vectorized,
      vectorized_at: session.vectorized_at,
    };
  }

  /**
   * Update session status
   *
   * @param id - Session UUID
   * @param status - New status
   * @param errorMessage - Optional error message (for failed status)
   */
  async updateStatus(
    id: string,
    status: SessionStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .getClient()
      .from('sessions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update session status: ${error.message}`);
    }
  }

  /**
   * Semantic search across all vectorized sessions
   *
   * @param queryEmbedding - The embedding vector for the search query
   * @param threshold - Minimum similarity threshold (0-1)
   * @param limit - Maximum number of results
   * @returns Array of matching chunks with similarity scores
   */
  async searchByEmbedding(
    queryEmbedding: number[],
    threshold: number = 0.15,
    limit: number = 10,
  ): Promise<SearchResultDto[]> {
    this.logger.log(`Searching with threshold: ${threshold}, limit: ${limit}`);
    
    const { data, error } = await this.supabase.getClient().rpc(
      'match_session_embeddings',
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      },
    );

    if (error) {
      this.logger.error(`Search RPC failed: ${error.message}`);
      // Try fallback: manual similarity search
      return this.manualSimilaritySearch(queryEmbedding, threshold, limit);
    }

    this.logger.log(`RPC returned ${data?.length || 0} results`);

    // If no results, try fallback
    if (!data || data.length === 0) {
      this.logger.log('No results from RPC, trying fallback...');
      return this.manualSimilaritySearch(queryEmbedding, threshold, limit);
    }

    // Enrich results with session info
    const results: SearchResultDto[] = [];
    for (const item of data || []) {
      // Fetch basic session info
      const { data: session } = await this.supabase
        .getClient()
        .from('sessions')
        .select('audio_filename, created_at')
        .eq('id', item.session_id)
        .single();

      results.push({
        id: item.id,
        session_id: item.session_id,
        chunk_text: item.chunk_text,
        similarity: item.similarity,
        session: session || undefined,
      });
    }

    return results;
  }

  /**
   * Fallback: Manual similarity search when RPC fails
   */
  private async manualSimilaritySearch(
    queryEmbedding: number[],
    threshold: number,
    limit: number,
  ): Promise<SearchResultDto[]> {
    try {
      // Fetch all embeddings
      const { data: embeddings, error } = await this.supabase
        .getClient()
        .from('session_embeddings')
        .select('id, session_id, chunk_text, embedding');

      if (error || !embeddings || embeddings.length === 0) {
        this.logger.error('Failed to fetch embeddings for fallback search');
        return [];
      }

      this.logger.log(`Fallback: fetched ${embeddings.length} embeddings`);
      
      // Debug: log first embedding format
      if (embeddings.length > 0) {
        const firstEmb = embeddings[0];
        this.logger.log(`Embedding type: ${typeof firstEmb.embedding}`);
        if (typeof firstEmb.embedding === 'string') {
          this.logger.log(`Embedding string start: ${firstEmb.embedding.substring(0, 50)}`);
        }
      }

      // Calculate cosine similarity
      const results: Array<{
        id: string;
        session_id: string;
        chunk_text: string;
        similarity: number;
      }> = [];

      let debugCount = 0;
      for (const emb of embeddings) {
        let embVector: number[];
        
        if (typeof emb.embedding === 'string') {
          // Handle pgvector format: "[0.1,0.2,...]" or just "0.1,0.2,..."
          let embStr = emb.embedding.trim();
          if (embStr.startsWith('[') && embStr.endsWith(']')) {
            embStr = embStr.slice(1, -1);
          }
          embVector = embStr.split(',').map(Number);
        } else if (Array.isArray(emb.embedding)) {
          embVector = emb.embedding;
        } else {
          this.logger.warn(`Unknown embedding format: ${typeof emb.embedding}`);
          continue;
        }

        // Debug first few
        if (debugCount < 2) {
          this.logger.log(`Embedding ${debugCount}: ${embVector.length} dimensions, first 3: [${embVector.slice(0, 3).join(', ')}]`);
          this.logger.log(`Query embedding: ${queryEmbedding.length} dimensions, first 3: [${queryEmbedding.slice(0, 3).join(', ')}]`);
          debugCount++;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embVector);
        
        // Log all similarity scores for debugging
        if (debugCount <= 3) {
          this.logger.log(`Similarity for chunk ${emb.id.substring(0, 8)}: ${similarity.toFixed(4)}`);
        }
        
        if (similarity >= threshold) {
          results.push({
            id: emb.id,
            session_id: emb.session_id,
            chunk_text: emb.chunk_text,
            similarity,
          });
        }
      }

      // Sort and limit
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, limit);

      this.logger.log(`Fallback found ${topResults.length} results`);

      // Enrich with session info
      const enrichedResults: SearchResultDto[] = [];
      for (const item of topResults) {
        const { data: session } = await this.supabase
          .getClient()
          .from('sessions')
          .select('audio_filename, created_at')
          .eq('id', item.session_id)
          .single();

        enrichedResults.push({
          id: item.id,
          session_id: item.session_id,
          chunk_text: item.chunk_text,
          similarity: item.similarity,
          session: session || undefined,
        });
      }

      return enrichedResults;
    } catch (error) {
      this.logger.error('Manual similarity search failed:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Delete a session and all related data
   *
   * @param id - Session UUID
   */
  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();

    // Get storage path
    const { data: session } = await client
      .from('sessions')
      .select('audio_storage_path')
      .eq('id', id)
      .single();

    // Delete from database (cascade will handle related tables)
    const { error } = await client.from('sessions').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }

    // Delete from storage
    if (session?.audio_storage_path) {
      try {
        await this.storage.deleteFile(session.audio_storage_path);
      } catch {
        this.logger.warn(
          `Could not delete storage file for session ${id}`,
        );
      }
    }
  }
}
