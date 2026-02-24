import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../database/supabase.service';
import { VectorizationService } from './vectorization.service';

/**
 * Message in a chat conversation
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Retrieved context chunk from semantic search
 */
export interface RetrievedChunk {
  session_id: string;
  chunk_text: string;
  similarity: number;
  session_info?: {
    audio_filename: string;
    created_at: string;
  };
}

/**
 * Chat response with sources
 */
export interface ChatResponse {
  message: string;
  sources: RetrievedChunk[];
}

/**
 * ChatService - Conversational RAG for therapy sessions
 *
 * This service provides a chat interface that:
 * 1. Takes user questions about therapy sessions
 * 2. Performs semantic search to find relevant transcript chunks
 * 3. Uses GPT-4o-mini to generate contextual responses
 * 4. Returns the response with source citations
 *
 * The LLM is given a system prompt that instructs it to:
 * - Answer based only on the retrieved context
 * - Cite which session the information comes from
 * - Acknowledge when information isn't available
 */
@Injectable()
export class ChatService {
  private openai: OpenAI;
  private readonly logger = new Logger(ChatService.name);

  // RAG Configuration
  // text-embedding-3-small produces lower cosine similarity scores (0.1-0.4 typical)
  private readonly SIMILARITY_THRESHOLD = 0.15;
  private readonly MAX_CHUNKS = 10; // Max context chunks to retrieve
  private readonly MAX_CONTEXT_LENGTH = 8000; // Max chars for context

  constructor(
    private configService: ConfigService,
    private supabase: SupabaseService,
    private vectorization: VectorizationService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Chat with the therapy session knowledge base
   *
   * @param message - User's question or message
   * @param conversationHistory - Previous messages in the conversation
   * @param sessionId - Optional: limit search to specific session
   * @returns AI response with source citations
   */
  async chat(
    message: string,
    conversationHistory: ChatMessage[] = [],
    sessionId?: string,
  ): Promise<ChatResponse> {
    this.logger.log(`Processing chat message: "${message.substring(0, 50)}..."`);

    // Step 1: Semantic search for relevant context
    const retrievedChunks = await this.retrieveContext(message, sessionId);
    this.logger.log(`Retrieved ${retrievedChunks.length} relevant chunks`);

    // Step 2: Build context string from retrieved chunks
    const contextString = this.buildContextString(retrievedChunks);

    // Step 3: Generate response using LLM with RAG context
    const response = await this.generateResponse(
      message,
      contextString,
      conversationHistory,
    );

    return {
      message: response,
      sources: retrievedChunks,
    };
  }

  /**
   * Retrieve relevant context chunks using semantic search
   */
  private async retrieveContext(
    query: string,
    sessionId?: string,
  ): Promise<RetrievedChunk[]> {
    try {
      // Generate embedding for the query
      this.logger.log(`Generating embedding for query: "${query.substring(0, 50)}..."`);
      const queryEmbedding = await this.vectorization.embedQuery(query);
      this.logger.log(`Embedding generated, dimensions: ${queryEmbedding.length}`);

      // Search for similar chunks
      // Pass embedding as array directly - Supabase JS client handles the conversion
      const rpcQuery: Record<string, unknown> = {
        query_embedding: queryEmbedding,
        match_threshold: this.SIMILARITY_THRESHOLD,
        match_count: this.MAX_CHUNKS,
      };

      this.logger.log(`Calling match_session_embeddings with threshold: ${this.SIMILARITY_THRESHOLD}`);
      
      // If sessionId provided, we'll filter after retrieval
      const { data, error } = await this.supabase.getClient().rpc(
        'match_session_embeddings',
        rpcQuery,
      );

      if (error) {
        this.logger.error(`Semantic search failed: ${error.message}`);
        this.logger.error(`Error details: ${JSON.stringify(error)}`);
        
        // Fallback: fetch all embeddings and compute similarity manually
        this.logger.log('Attempting fallback: manual similarity calculation');
        return this.manualSimilaritySearch(queryEmbedding, sessionId);
      }

      this.logger.log(`RPC returned ${data?.length || 0} results`);

      // If RPC returned no results, try fallback
      if (!data || data.length === 0) {
        this.logger.log('RPC returned 0 results, trying fallback...');
        return this.manualSimilaritySearch(queryEmbedding, sessionId);
      }

      // Filter by session if specified
      let results = data || [];
      if (sessionId) {
        results = results.filter(
          (chunk: { session_id: string }) => chunk.session_id === sessionId,
        );
      }

      // Enrich with session metadata
      const enrichedResults: RetrievedChunk[] = [];
      for (const chunk of results) {
        const { data: session } = await this.supabase
          .getClient()
          .from('sessions')
          .select('audio_filename, created_at')
          .eq('id', chunk.session_id)
          .single();

        enrichedResults.push({
          session_id: chunk.session_id,
          chunk_text: chunk.chunk_text,
          similarity: chunk.similarity,
          session_info: session || undefined,
        });
      }

      return enrichedResults;
    } catch (error) {
      this.logger.error('Context retrieval failed:', error);
      return [];
    }
  }

  /**
   * Build a context string from retrieved chunks
   */
  private buildContextString(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) {
      return 'No relevant information found in the therapy sessions.';
    }

    let context = '';
    let totalLength = 0;

    for (const chunk of chunks) {
      const sessionLabel = chunk.session_info
        ? `[Session: ${chunk.session_info.audio_filename}, Date: ${new Date(chunk.session_info.created_at).toLocaleDateString()}]`
        : `[Session ID: ${chunk.session_id}]`;

      const chunkContext = `${sessionLabel}\n${chunk.chunk_text}\n\n`;

      if (totalLength + chunkContext.length > this.MAX_CONTEXT_LENGTH) {
        break;
      }

      context += chunkContext;
      totalLength += chunkContext.length;
    }

    return context;
  }

  /**
   * Generate response using GPT-4o-mini with RAG context
   */
  private async generateResponse(
    userMessage: string,
    context: string,
    conversationHistory: ChatMessage[],
  ): Promise<string> {
    const systemPrompt = `You are a helpful AI assistant for a therapy practice. You have access to transcripts from therapy sessions and can answer questions about them.

IMPORTANT GUIDELINES:
1. Base your answers ONLY on the provided context from therapy sessions
2. When citing information, mention which session it comes from (filename and date if available)
3. If the context doesn't contain relevant information, say so honestly
4. Be professional and maintain patient confidentiality - speak about sessions in general terms
5. Provide helpful, empathetic responses that could aid in therapeutic review
6. If asked about specific therapeutic techniques or patterns, identify them from the context
7. Do NOT make up information that isn't in the context

RETRIEVED CONTEXT FROM THERAPY SESSIONS:
---
${context}
---

Use this context to answer the user's question. If the context is empty or not relevant, acknowledge that you don't have information about that topic in the available sessions.`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (limit to last 10 messages to stay within context)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    } catch (error) {
      this.logger.error('LLM response generation failed:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Chat within a specific session context
   * Useful for asking questions about a particular therapy session
   */
  async chatAboutSession(
    sessionId: string,
    message: string,
    conversationHistory: ChatMessage[] = [],
  ): Promise<ChatResponse> {
    return this.chat(message, conversationHistory, sessionId);
  }

  /**
   * Fallback: Manual similarity search when RPC fails
   * Fetches all embeddings and computes cosine similarity in JavaScript
   */
  private async manualSimilaritySearch(
    queryEmbedding: number[],
    sessionId?: string,
  ): Promise<RetrievedChunk[]> {
    try {
      // Fetch all embeddings from database
      let query = this.supabase
        .getClient()
        .from('session_embeddings')
        .select('id, session_id, chunk_text, embedding');

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data: embeddings, error } = await query;

      if (error) {
        this.logger.error(`Failed to fetch embeddings: ${error.message}`);
        return [];
      }

      if (!embeddings || embeddings.length === 0) {
        this.logger.log('No embeddings found in database');
        return [];
      }

      this.logger.log(`Fetched ${embeddings.length} embeddings for manual search`);

      // Calculate cosine similarity for each embedding
      const results: Array<{
        id: string;
        session_id: string;
        chunk_text: string;
        similarity: number;
      }> = [];

      for (const emb of embeddings) {
        // Parse embedding if it's a string
        let embVector: number[];
        if (typeof emb.embedding === 'string') {
          embVector = JSON.parse(emb.embedding);
        } else if (Array.isArray(emb.embedding)) {
          embVector = emb.embedding;
        } else {
          this.logger.warn(`Unexpected embedding format for ${emb.id}`);
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embVector);
        
        if (similarity >= this.SIMILARITY_THRESHOLD) {
          results.push({
            id: emb.id,
            session_id: emb.session_id,
            chunk_text: emb.chunk_text,
            similarity,
          });
        }
      }

      // Sort by similarity descending
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, this.MAX_CHUNKS);

      this.logger.log(`Manual search found ${topResults.length} results above threshold`);

      // Enrich with session info
      const enrichedResults: RetrievedChunk[] = [];
      for (const chunk of topResults) {
        const { data: session } = await this.supabase
          .getClient()
          .from('sessions')
          .select('audio_filename, created_at')
          .eq('id', chunk.session_id)
          .single();

        enrichedResults.push({
          session_id: chunk.session_id,
          chunk_text: chunk.chunk_text,
          similarity: chunk.similarity,
          session_info: session || undefined,
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
    if (a.length !== b.length) {
      return 0;
    }

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
   * Get knowledge base status - check if there are vectorized sessions
   * Useful for debugging and providing feedback to users
   */
  async getKnowledgeBaseStatus(): Promise<{
    hasVectorizedSessions: boolean;
    totalSessions: number;
    vectorizedSessions: number;
    totalEmbeddings: number;
  }> {
    try {
      // Count total sessions
      const { count: totalSessions } = await this.supabase
        .getClient()
        .from('sessions')
        .select('*', { count: 'exact', head: true });

      // Count vectorized sessions
      const { count: vectorizedSessions } = await this.supabase
        .getClient()
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_vectorized', true);

      // Count total embeddings
      const { count: totalEmbeddings } = await this.supabase
        .getClient()
        .from('session_embeddings')
        .select('*', { count: 'exact', head: true });

      this.logger.log(
        `Knowledge base status: ${totalSessions} sessions, ${vectorizedSessions} vectorized, ${totalEmbeddings} embeddings`,
      );

      return {
        hasVectorizedSessions: (vectorizedSessions || 0) > 0,
        totalSessions: totalSessions || 0,
        vectorizedSessions: vectorizedSessions || 0,
        totalEmbeddings: totalEmbeddings || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get knowledge base status:', error);
      return {
        hasVectorizedSessions: false,
        totalSessions: 0,
        vectorizedSessions: 0,
        totalEmbeddings: 0,
      };
    }
  }
}
