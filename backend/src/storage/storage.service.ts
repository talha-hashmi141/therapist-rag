import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../database/supabase.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * StorageService - Handles file uploads/downloads to Supabase Storage
 *
 * Bucket: 'therapy-audio'
 * File path format: sessions/{uuid}.{ext}
 */
@Injectable()
export class StorageService {
  private readonly BUCKET_NAME = 'therapy-audio';
  private readonly logger = new Logger(StorageService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Upload an audio file to Supabase Storage
   *
   * @param buffer - The file buffer to upload
   * @param originalFilename - Original filename (used for extension)
   * @param mimeType - MIME type of the file
   * @returns Object containing the storage path and signed URL
   */
  async uploadFile(
    buffer: Buffer,
    originalFilename: string,
    mimeType: string,
  ): Promise<{ path: string; url: string }> {
    const client = this.supabase.getClient();

    // Generate unique filename preserving extension
    const ext = originalFilename.split('.').pop() || 'mp3';
    const uniqueFilename = `${uuidv4()}.${ext}`;
    const filePath = `sessions/${uniqueFilename}`;

    this.logger.log(`Uploading file: ${filePath}`);

    const { data, error } = await client.storage
      .from(this.BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Generate signed URL valid for 1 hour
    const { data: signedData, error: signedError } = await client.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(filePath, 3600);

    if (signedError) {
      this.logger.error(`Failed to generate signed URL: ${signedError.message}`);
      throw new Error(`Failed to generate signed URL: ${signedError.message}`);
    }

    this.logger.log(`File uploaded successfully: ${filePath}`);

    return {
      path: filePath,
      url: signedData.signedUrl,
    };
  }

  /**
   * Download a file from a URL (used for processing)
   *
   * @param url - The signed URL or public URL to download from
   * @returns Buffer containing the file data
   */
  async downloadFile(url: string): Promise<Buffer> {
    this.logger.log(`Downloading file from URL`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Generate a new signed URL for an existing file
   *
   * @param path - The storage path (e.g., 'sessions/uuid.mp3')
   * @param expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns The new signed URL
   */
  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(this.BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  /**
   * Delete a file from storage
   *
   * @param path - The storage path to delete
   */
  async deleteFile(path: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .storage.from(this.BUCKET_NAME)
      .remove([path]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }
}
