'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Session } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { TranscriptView } from '@/components/TranscriptView';
import { PageLoader } from '@/components/Spinner';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number): string {
  if (!seconds) return 'Unknown duration';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary');

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const fetchSession = async () => {
      try {
        const data = await api.getSession(sessionId);
        setSession(data);

        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          if (interval) clearInterval(interval);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
        if (interval) clearInterval(interval);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
    interval = setInterval(fetchSession, 3000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this session? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteSession(sessionId);
      router.push('/sessions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error || !session) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-800 mb-2">{error || 'Session not found'}</h2>
          <Link href="/sessions" className="btn-secondary mt-4">
            Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  const isProcessing = ['pending', 'transcribing', 'summarizing', 'vectorizing'].includes(session.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Back Link */}
      <Link
        href="/sessions"
        className="inline-flex items-center gap-2 text-surface-500 hover:text-surface-700 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Sessions
      </Link>

      {/* Header Card */}
      <div className="card p-6 mb-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900">{session.audio_filename}</h1>
              <p className="text-surface-500 mt-1">{formatDate(session.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={session.status} />
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-ghost text-red-600 hover:bg-red-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-surface-100">
          <div>
            <span className="text-xs text-surface-400 uppercase tracking-wider">Duration</span>
            <p className="font-medium text-surface-900">{formatDuration(session.audio_duration_seconds)}</p>
          </div>
          <div>
            <span className="text-xs text-surface-400 uppercase tracking-wider">File Size</span>
            <p className="font-medium text-surface-900">{formatFileSize(session.audio_file_size_bytes)}</p>
          </div>
          <div>
            <span className="text-xs text-surface-400 uppercase tracking-wider">Vectorized</span>
            <p className="font-medium text-surface-900">
              {session.is_vectorized ? (
                <span className="text-primary-600">Yes ✓</span>
              ) : (
                <span className="text-surface-500">No</span>
              )}
            </p>
          </div>
        </div>

        {/* Error Message */}
        {session.error_message && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <strong className="font-medium">Error:</strong> {session.error_message}
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-6 p-4 bg-primary-50 border border-primary-200 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full" />
              <span className="text-primary-700 font-medium">
                Processing in progress... This page will update automatically.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            activeTab === 'summary'
              ? 'bg-primary-100 text-primary-700'
              : 'text-surface-600 hover:bg-surface-100'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 rounded-xl font-medium transition-colors ${
            activeTab === 'transcript'
              ? 'bg-primary-100 text-primary-700'
              : 'text-surface-600 hover:bg-surface-100'
          }`}
        >
          Transcript
        </button>
      </div>

      {/* Content */}
      <div className="card p-6 animate-fade-in">
        {activeTab === 'summary' ? (
          <div>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Session Summary</h2>
            {session.summary ? (
              <p className="text-surface-700 leading-relaxed whitespace-pre-wrap">
                {session.summary}
              </p>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-surface-500">
                  {isProcessing ? 'Summary will appear after processing completes.' : 'No summary available.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-surface-900 mb-4">Full Transcript</h2>
            {session.transcript_with_speakers && session.transcript_with_speakers.length > 0 ? (
              <TranscriptView segments={session.transcript_with_speakers} />
            ) : session.transcript_raw ? (
              <p className="text-surface-700 whitespace-pre-wrap leading-relaxed">
                {session.transcript_raw}
              </p>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-surface-500">
                  {isProcessing ? 'Transcript will appear after processing completes.' : 'No transcript available.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
