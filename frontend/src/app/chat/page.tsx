'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ChatMessage, ChatSource, KnowledgeBaseStatus } from '@/lib/types';
import { Spinner } from '@/components/Spinner';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Message extends ChatMessage {
  sources?: ChatSource[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState<number | null>(null);
  const [kbStatus, setKbStatus] = useState<KnowledgeBaseStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch knowledge base status on mount
  useEffect(() => {
    api.getChatStatus()
      .then(setKbStatus)
      .catch(console.error)
      .finally(() => setStatusLoading(false));
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Add user message
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Convert to API format (without sources)
      const history: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await api.chat(userMessage, history);

      // Add assistant response with sources
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.message,
          sources: response.sources,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      // Remove the user message if there was an error
      setMessages(messages);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-surface-200 bg-white/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-surface-900">Session Assistant</h1>
            <p className="text-sm text-surface-500">
              Ask questions about your therapy sessions
            </p>
          </div>
          <Link href="/sessions" className="btn-secondary text-sm">
            View Sessions
          </Link>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Knowledge Base Warning */}
          {!statusLoading && kbStatus && !kbStatus.hasVectorizedSessions && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl animate-fade-in">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-medium text-amber-800">No sessions available for chat</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    {kbStatus.totalSessions === 0 
                      ? 'Upload and process audio files to start chatting about your therapy sessions.'
                      : `You have ${kbStatus.totalSessions} session(s), but none have been fully processed yet. Wait for processing to complete.`
                    }
                  </p>
                  <div className="flex gap-3 mt-3">
                    <Link href="/" className="text-sm font-medium text-amber-700 hover:text-amber-900 underline">
                      Upload Session
                    </Link>
                    <Link href="/sessions" className="text-sm font-medium text-amber-700 hover:text-amber-900 underline">
                      View Sessions
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Knowledge Base Stats */}
          {!statusLoading && kbStatus && kbStatus.hasVectorizedSessions && messages.length === 0 && (
            <div className="text-center text-sm text-surface-500 animate-fade-in">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                {kbStatus.vectorizedSessions} session{kbStatus.vectorizedSessions > 1 ? 's' : ''} available • {kbStatus.totalEmbeddings} searchable chunks
              </span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-surface-800 mb-2">
                Chat with your sessions
              </h2>
              <p className="text-surface-500 max-w-md mx-auto mb-8">
                Ask questions about topics discussed, coping strategies mentioned, 
                emotional patterns, or anything else from your therapy sessions.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'What topics have been discussed most?',
                  'Are there any recurring themes?',
                  'What coping strategies were mentioned?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-xl text-sm transition-colors"
                    disabled={!kbStatus?.hasVectorizedSessions}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 animate-fade-in ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-surface-100 text-surface-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                    </svg>
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-primary-500 text-white rounded-tr-md'
                        : 'bg-surface-100 text-surface-800 rounded-tl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowSources(showSources === index ? null : index)}
                        className="text-xs text-surface-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                        </svg>
                        {message.sources.length} source{message.sources.length > 1 ? 's' : ''}
                        <svg 
                          className={`w-3 h-3 transition-transform ${showSources === index ? 'rotate-180' : ''}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor" 
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showSources === index && (
                        <div className="mt-2 space-y-2 animate-fade-in">
                          {message.sources.map((source, sourceIndex) => (
                            <Link
                              key={sourceIndex}
                              href={`/sessions/${source.session_id}`}
                              className="block p-3 bg-white border border-surface-200 rounded-xl hover:border-primary-300 transition-colors text-left"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {source.session_info && (
                                  <>
                                    <span className="text-xs font-medium text-surface-700">
                                      {source.session_info.audio_filename}
                                    </span>
                                    <span className="text-surface-300">•</span>
                                    <span className="text-xs text-surface-500">
                                      {formatDate(source.session_info.created_at)}
                                    </span>
                                  </>
                                )}
                                <span className="ml-auto px-1.5 py-0.5 bg-primary-100 text-primary-700 text-xs rounded">
                                  {Math.round(source.similarity * 100)}%
                                </span>
                              </div>
                              <p className="text-xs text-surface-600 line-clamp-2">
                                {source.chunk_text}
                              </p>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-4 animate-fade-in">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-4 py-3 bg-surface-100 rounded-2xl rounded-tl-md">
                  <Spinner size="sm" />
                  <span className="text-sm text-surface-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-surface-200 bg-white px-4 sm:px-6 lg:px-8 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your therapy sessions..."
                rows={1}
                className="input resize-none pr-4 py-3 min-h-[48px] max-h-[200px]"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-primary h-12 w-12 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
            >
              {loading ? (
                <Spinner size="sm" className="border-white border-t-transparent" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-surface-400 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  );
}
