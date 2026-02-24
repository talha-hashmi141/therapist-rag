'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Spinner } from './Spinner';

const ACCEPTED_TYPES = {
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'audio/webm': ['.webm'],
  'audio/mp4': ['.mp4', '.m4a'],
  'audio/x-m4a': ['.m4a'],
};

export function AudioUploader() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const router = useRouter();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      setUploadProgress(`Uploading ${file.name}...`);

      try {
        const response = await api.uploadSession(file);
        setUploadProgress('Processing started! Redirecting...');
        
        // Small delay for UX
        setTimeout(() => {
          router.push(`/sessions/${response.sessionId}`);
        }, 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
      }
    },
    [router]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled: uploading,
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          relative overflow-hidden
          border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${isDragActive && !isDragReject ? 'border-primary-500 bg-primary-50 scale-[1.02]' : 'border-surface-300 hover:border-primary-400'}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${uploading ? 'opacity-70 cursor-not-allowed pointer-events-none' : ''}
        `}
      >
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary-200/30 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-gradient-to-tr from-accent-200/30 to-transparent rounded-full blur-3xl" />
        </div>

        <input {...getInputProps()} />

        {uploading ? (
          <div className="flex flex-col items-center gap-6">
            <Spinner size="lg" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-primary-700">{uploadProgress}</p>
              <p className="text-sm text-surface-500">
                This may take a moment for large files
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6">
            {/* Icon */}
            <div className={`
              w-20 h-20 rounded-2xl flex items-center justify-center
              transition-all duration-300
              ${isDragActive ? 'bg-primary-500 text-white scale-110' : 'bg-surface-100 text-surface-400'}
            `}>
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <p className="text-xl font-semibold text-surface-800">
                {isDragActive ? 'Drop your audio file here' : 'Upload a therapy session'}
              </p>
              <p className="text-surface-500">
                Drag & drop an audio file or{' '}
                <span className="text-primary-600 font-medium">browse</span>
              </p>
            </div>

            {/* Format info */}
            <div className="flex flex-wrap justify-center gap-2">
              {['MP3', 'WAV', 'WebM', 'M4A'].map((format) => (
                <span
                  key={format}
                  className="px-2.5 py-1 bg-surface-100 text-surface-600 text-xs font-medium rounded-lg"
                >
                  {format}
                </span>
              ))}
              <span className="px-2.5 py-1 bg-surface-100 text-surface-600 text-xs font-medium rounded-lg">
                Max 100MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-slide-up">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
