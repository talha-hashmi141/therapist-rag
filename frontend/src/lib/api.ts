import type { Session, SessionListItem, UploadResponse, SearchResult, ChatMessage, ChatResponse, KnowledgeBaseStatus } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/**
 * API client for therapy session backend
 */
export const api = {
  /**
   * Upload an audio file and start processing
   * POST /api/sessions/upload
   */
  async uploadSession(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('audio', file);

    const response = await fetch(`${API_BASE}/sessions/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  /**
   * Get all sessions
   * GET /api/sessions
   */
  async getSessions(): Promise<SessionListItem[]> {
    const response = await fetch(`${API_BASE}/sessions`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch sessions');
    }
    
    return response.json();
  },

  /**
   * Get a single session by ID
   * GET /api/sessions/:id
   */
  async getSession(id: string): Promise<Session> {
    const response = await fetch(`${API_BASE}/sessions/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Session not found');
      }
      throw new Error('Failed to fetch session');
    }
    
    return response.json();
  },

  /**
   * Search sessions by semantic query
   * GET /api/sessions/search?q=<query>
   */
  async searchSessions(query: string, limit?: number): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE}/sessions/search?${params}`);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    return response.json();
  },

  /**
   * Delete a session
   * DELETE /api/sessions/:id
   */
  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/sessions/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete session');
    }
  },

  /**
   * Get chat knowledge base status
   * GET /api/sessions/chat/status
   */
  async getChatStatus(): Promise<KnowledgeBaseStatus> {
    const response = await fetch(`${API_BASE}/sessions/chat/status`);
    
    if (!response.ok) {
      throw new Error('Failed to get chat status');
    }
    
    return response.json();
  },

  /**
   * Chat with AI about all therapy sessions (RAG)
   * POST /api/sessions/chat
   */
  async chat(message: string, history?: ChatMessage[]): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/sessions/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Chat failed' }));
      throw new Error(error.message || 'Chat failed');
    }

    return response.json();
  },

  /**
   * Chat with AI about a specific session
   * POST /api/sessions/:id/chat
   */
  async chatAboutSession(
    sessionId: string,
    message: string,
    history?: ChatMessage[],
  ): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Chat failed' }));
      throw new Error(error.message || 'Chat failed');
    }

    return response.json();
  },
};
