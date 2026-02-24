import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Embedding chunk with text and vector
 */
export interface EmbeddingChunk {
  text: string;
  embedding: number[];
}

/**
 * VectorizationService - Creates vector embeddings for semantic search
 *
 * Uses OpenAI text-embedding-3-small model which produces 1536-dimension vectors.
 * Text is split into overlapping chunks for better search results.
 *
 * Chunking strategy:
 * - Chunk size: 1000 characters
 * - Overlap: 200 characters
 * - Break at sentence boundaries when possible
 */
@Injectable()
export class VectorizationService {
  private openai: OpenAI;
  private readonly logger = new Logger(VectorizationService.name);

  // Chunking configuration
  private readonly CHUNK_SIZE = 1000; // characters
  private readonly CHUNK_OVERLAP = 200; // characters
  private readonly BATCH_SIZE = 20; // embeddings per API call

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Vectorize text by splitting into chunks and generating embeddings
   *
   * @param text - Full text to vectorize
   * @returns Array of text chunks with their embeddings
   */
  async vectorize(text: string): Promise<EmbeddingChunk[]> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided for vectorization');
      return [];
    }

    // Split text into overlapping chunks
    const chunks = this.splitIntoChunks(text);
    this.logger.log(`Split text into ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return [];
    }

    const results: EmbeddingChunk[] = [];

    // Process chunks in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
      const batch = chunks.slice(i, i + this.BATCH_SIZE);

      try {
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

        this.logger.log(
          `Processed batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(chunks.length / this.BATCH_SIZE)}`,
        );
      } catch (error) {
        this.logger.error(`Batch embedding failed:`, error);
        throw error;
      }
    }

    this.logger.log(`Vectorization complete: ${results.length} embeddings`);
    return results;
  }

  /**
   * Generate embedding for a single search query
   *
   * @param query - Search query text
   * @returns Embedding vector (1536 dimensions)
   */
  async embedQuery(query: string): Promise<number[]> {
    if (!query || query.trim().length === 0) {
      throw new Error('Empty query provided');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query.trim(),
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Query embedding failed:', error);
      throw error;
    }
  }

  /**
   * Split text into overlapping chunks
   * Tries to break at sentence boundaries for cleaner chunks
   *
   * @param text - Full text to split
   * @returns Array of text chunks
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + this.CHUNK_SIZE;

      // Try to break at a sentence boundary
      if (end < text.length) {
        // Look for sentence ending punctuation
        const lastPeriod = text.lastIndexOf('.', end);
        const lastQuestion = text.lastIndexOf('?', end);
        const lastExclaim = text.lastIndexOf('!', end);
        const lastNewline = text.lastIndexOf('\n', end);

        // Find the best break point
        const candidates = [lastPeriod, lastQuestion, lastExclaim, lastNewline]
          .filter((pos) => pos > start + this.CHUNK_SIZE / 2)
          .filter((pos) => pos < end);

        if (candidates.length > 0) {
          end = Math.max(...candidates) + 1;
        }
      }

      const chunk = text.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start position (with overlap)
      start = end - this.CHUNK_OVERLAP;
      if (start < 0) start = 0;
      if (start >= text.length) break;
    }

    return chunks;
  }
}
