import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * SummarizationService - Generates clinical summaries of therapy sessions
 *
 * Uses OpenAI GPT-4o-mini for cost-effective summarization.
 * The prompt is designed for therapy session context.
 */
@Injectable()
export class SummarizationService {
  private openai: OpenAI;
  private readonly logger = new Logger(SummarizationService.name);

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Generate a clinical summary of a therapy session transcript
   *
   * @param transcript - Full session transcript text
   * @returns Generated summary (150-300 words)
   */
  async summarize(transcript: string): Promise<string> {
    if (!transcript || transcript.trim().length === 0) {
      return 'No transcript available for summarization.';
    }

    const systemPrompt = `You are a professional therapy session summarizer. 
Your task is to create a concise, clinical summary of the therapy session transcript.

Guidelines:
- Focus on key themes, concerns, and therapeutic progress
- Note significant emotional moments or breakthroughs
- Identify any action items or homework mentioned
- Maintain patient confidentiality in your language
- Keep the summary between 150-300 words
- Structure: Opening context → Main themes → Key insights → Closing/Next steps

Important: Be objective and professional. Do not include judgments or personal opinions.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Please summarize this therapy session transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.3, // Lower temperature for consistent summaries
        max_tokens: 500,
      });

      const summary = response.choices[0]?.message?.content;

      if (!summary) {
        this.logger.warn('Empty summary response from OpenAI');
        return 'Unable to generate summary.';
      }

      this.logger.log(
        `Summary generated: ${summary.length} characters`,
      );

      return summary;
    } catch (error) {
      this.logger.error('Summarization failed:', error);
      throw error;
    }
  }

  /**
   * Generate a brief one-line summary for list displays
   *
   * @param transcript - Full session transcript text
   * @returns Brief summary (max 100 characters)
   */
  async summarizeBrief(transcript: string): Promise<string> {
    if (!transcript || transcript.trim().length === 0) {
      return 'No transcript available.';
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Generate a one-sentence summary (max 100 characters) of the therapy session. Focus on the main topic discussed.',
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      return (
        response.choices[0]?.message?.content || 'Unable to generate summary.'
      );
    } catch (error) {
      this.logger.error('Brief summarization failed:', error);
      throw error;
    }
  }
}
