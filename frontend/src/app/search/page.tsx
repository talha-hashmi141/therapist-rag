'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { SessionListItem } from '@/lib/types';
import { SessionCard } from '@/components/SessionCard';
import { Spinner } from '@/components/Spinner';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      // Search for matching chunks
      const searchResults = await api.searchSessions(query, 20);
      
      // Get unique session IDs
      const uniqueSessionIds = [...new Set(searchResults.map(r => r.session_id))];
      
      // Fetch all sessions and filter to only those that matched
      const allSessions = await api.getSessions();
      const matchedSessions = allSessions.filter(s => uniqueSessionIds.includes(s.id));
      
      // Sort by the order they appeared in search results (most relevant first)
      matchedSessions.sort((a, b) => {
        const indexA = uniqueSessionIds.indexOf(a.id);
        const indexB = uniqueSessionIds.indexOf(b.id);
        return indexA - indexB;
      });
      
      setResults(matchedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-3xl font-bold text-surface-900 mb-2">Search Sessions</h1>
        <p className="text-surface-500">
          Find therapy sessions by content using semantic search
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8 animate-slide-up opacity-0" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., anxiety, coping strategies, family issues..."
            className="input pr-32 text-lg py-4"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 btn-primary disabled:opacity-50"
          >
            {loading ? <Spinner size="sm" className="border-white border-t-transparent" /> : 'Search'}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <div className="animate-fade-in">
          {results.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-surface-800 mb-1">No sessions found</h3>
              <p className="text-surface-500">
                Try a different search term or make sure you have processed sessions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-surface-500 mb-4">
                Found {results.length} matching {results.length === 1 ? 'session' : 'sessions'}
              </p>
              
              {results.map((session, index) => (
                <SessionCard key={session.id} session={session} index={index} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && !loading && (
        <div className="text-center py-12 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-surface-800 mb-2">Search your sessions</h3>
          <p className="text-surface-500 max-w-md mx-auto">
            Use natural language to find sessions that discuss specific topics, emotions, or issues.
          </p>
        </div>
      )}
    </div>
  );
}
