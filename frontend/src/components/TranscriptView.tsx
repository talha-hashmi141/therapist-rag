'use client';

import type { TranscriptSegment } from '@/lib/types';

interface TranscriptViewProps {
  segments: TranscriptSegment[];
}

// Color mapping for speakers
const SPEAKER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  B: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  C: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  D: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  E: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  Unknown: { bg: 'bg-surface-100', text: 'text-surface-600', border: 'border-surface-200' },
};

function getSpeakerColor(speaker: string) {
  // Extract letter if speaker is like "Speaker A"
  const letter = speaker.replace(/Speaker\s*/i, '').charAt(0).toUpperCase();
  return SPEAKER_COLORS[letter] || SPEAKER_COLORS.Unknown;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TranscriptView({ segments }: TranscriptViewProps) {
  if (!segments || segments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-surface-500">No transcript segments available</p>
      </div>
    );
  }

  // Group consecutive segments by speaker for better readability
  const groupedSegments: { speaker: string; texts: string[]; startTime: number; endTime: number }[] = [];
  
  segments.forEach((segment) => {
    const lastGroup = groupedSegments[groupedSegments.length - 1];
    
    if (lastGroup && lastGroup.speaker === segment.speaker) {
      lastGroup.texts.push(segment.text);
      lastGroup.endTime = segment.end;
    } else {
      groupedSegments.push({
        speaker: segment.speaker,
        texts: [segment.text],
        startTime: segment.start,
        endTime: segment.end,
      });
    }
  });

  return (
    <div className="space-y-4">
      {groupedSegments.map((group, index) => {
        const colors = getSpeakerColor(group.speaker);
        
        return (
          <div
            key={index}
            className={`
              flex gap-4 p-4 rounded-xl border
              ${colors.bg} ${colors.border}
              animate-fade-in
            `}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Speaker info */}
            <div className="flex-shrink-0 w-28">
              <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-medium ${colors.text} bg-white/50`}>
                {group.speaker}
              </span>
              {group.startTime !== undefined && (
                <span className="block mt-1.5 text-xs text-surface-400 font-mono">
                  {formatTime(group.startTime)}
                </span>
              )}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <p className={`text-surface-700 leading-relaxed ${colors.text.replace('text-', 'selection:bg-').replace('-700', '-200')}`}>
                {group.texts.join(' ')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
