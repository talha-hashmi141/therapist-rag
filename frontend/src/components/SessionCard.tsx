'use client';

import Link from 'next/link';
import type { SessionListItem } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface SessionCardProps {
  session: SessionListItem;
  index: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function SessionCard({ session, index }: SessionCardProps) {
  return (
    <Link
      href={`/sessions/${session.id}`}
      className={`
        card block p-6 group
        animate-slide-up opacity-0
      `}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Icon + Content */}
        <div className="flex items-start gap-4 min-w-0">
          {/* Audio icon */}
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center group-hover:from-primary-200 group-hover:to-primary-100 transition-colors">
            <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-surface-900 truncate group-hover:text-primary-700 transition-colors">
              {session.audio_filename}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-surface-500">
              <span>{formatDate(session.created_at)}</span>
              <span className="text-surface-300">•</span>
              <span className="font-mono">{formatDuration(session.audio_duration_seconds)}</span>
            </div>
            
            {/* Summary preview */}
            {session.summary && (
              <p className="mt-3 text-sm text-surface-600 line-clamp-2">
                {session.summary}
              </p>
            )}
          </div>
        </div>

        {/* Right: Status + Arrow */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={session.status} size="sm" />
          
          {/* Vectorized indicator */}
          {session.is_vectorized && (
            <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center" title="Searchable">
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}

          {/* Arrow */}
          <svg 
            className="w-5 h-5 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
