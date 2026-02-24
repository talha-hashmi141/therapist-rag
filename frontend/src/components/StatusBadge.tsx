'use client';

import type { SessionStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: SessionStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<SessionStatus, { label: string; className: string; icon: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-surface-100 text-surface-600 border border-surface-200',
    icon: '○',
  },
  transcribing: {
    label: 'Transcribing',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: '◐',
  },
  summarizing: {
    label: 'Summarizing',
    className: 'bg-purple-50 text-purple-700 border border-purple-200',
    icon: '◐',
  },
  vectorizing: {
    label: 'Vectorizing',
    className: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    icon: '◐',
  },
  completed: {
    label: 'Completed',
    className: 'bg-primary-50 text-primary-700 border border-primary-200',
    icon: '●',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 border border-red-200',
    icon: '✕',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const isProcessing = ['transcribing', 'summarizing', 'vectorizing'].includes(status);

  const sizeClasses = size === 'sm' 
    ? 'text-xs px-2 py-0.5' 
    : 'text-sm px-3 py-1';

  return (
    <span className={`badge ${config.className} ${sizeClasses}`}>
      {isProcessing ? (
        <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <span className="text-xs">{config.icon}</span>
      )}
      {config.label}
    </span>
  );
}
