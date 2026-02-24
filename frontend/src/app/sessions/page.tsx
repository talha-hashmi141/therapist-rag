'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { SessionListItem } from '@/lib/types';
import { SessionCard } from '@/components/SessionCard';
import { PageLoader } from '@/components/Spinner';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Refresh every 10 seconds if there are processing sessions
    const interval = setInterval(() => {
      const hasProcessing = sessions.some((s) =>
        ['pending', 'transcribing', 'summarizing', 'vectorizing'].includes(s.status)
      );
      if (hasProcessing) {
        fetchSessions();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [sessions]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">Sessions</h1>
          <p className="mt-1 text-surface-500">
            {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'} uploaded
          </p>
        </div>
        <Link href="/" className="btn-primary">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Upload New
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-surface-800 mb-2">No sessions yet</h2>
          <p className="text-surface-500 mb-6">Upload your first therapy session to get started.</p>
          <Link href="/" className="btn-primary">
            Upload Session
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <SessionCard key={session.id} session={session} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
