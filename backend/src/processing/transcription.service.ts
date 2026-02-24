import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
 * Result of transcription with speaker diarization
 */
export interface TranscriptionResult {
  fullText: string;
  segments: TranscriptSegment[];
  duration?: number;
}

/**
 * TranscriptionService - Handles audio transcription with speaker diarization
 *
 * Uses OpenAI's gpt-4o-transcribe-diarize model for:
 * - Automatic speech recognition
 * - Speaker identification/diarization
 * - Timestamp generation
 *
 * Note: For transcription without diarization, use gpt-4o-mini-transcribe
 * which is recommended by OpenAI for best results (as of Dec 2025).
 */
@Injectable()
export class TranscriptionService {
  private openai: OpenAI;
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Transcribe audio with speaker diarization
   *
   * @param audioBuffer - Raw audio file buffer
   * @param filename - Original filename (used for temp file extension)
   * @returns Transcription result with speaker-labeled segments
   */
  async transcribeWithDiarization(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<TranscriptionResult> {
    // OpenAI SDK requires a file path or readable stream
    // Write buffer to temp file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}-${filename}`);

    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      this.logger.log(`Temp file created: ${tempFilePath}`);

      // Use gpt-4o-transcribe-diarize for speaker identification
      // Note: chunking_strategy is REQUIRED for audio longer than 30 seconds
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.openai.audio.transcriptions.create as any)({
        file: fs.createReadStream(tempFilePath),
        model: 'gpt-4o-transcribe-diarize',
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
      });

      // Parse diarized response - SDK v6.x returns typed response
      const segments: TranscriptSegment[] = [];
      let fullText = '';

      // Type assertion for diarized response format
      const diarizedResponse = response as unknown as {
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
        // Fallback if no segments returned
        fullText = diarizedResponse.text || '';
      }

      this.logger.log(
        `Transcription complete: ${segments.length} segments, duration: ${diarizedResponse.duration || 'unknown'}s`,
      );

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
        this.logger.log(`Temp file cleaned up: ${tempFilePath}`);
      }
    }
  }

  /**
   * Simple transcription without speaker diarization
   * Uses gpt-4o-mini-transcribe for faster/cheaper transcription
   *
   * @param audioBuffer - Raw audio file buffer
   * @param filename - Original filename
   * @returns Transcription result (no speaker segments)
   */
  async transcribeSimple(
    audioBuffer: Buffer,
    filename: string,
  ): Promise<TranscriptionResult> {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}-${filename}`);

    try {
      fs.writeFileSync(tempFilePath, audioBuffer);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.openai.audio.transcriptions.create as any)({
        file: fs.createReadStream(tempFilePath),
        model: 'gpt-4o-mini-transcribe',
        response_format: 'json',
      });

      return {
        fullText: (response as unknown as { text: string }).text,
        segments: [],
      };
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }
}
