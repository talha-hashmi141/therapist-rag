-- ============================================
-- Therapy Session Processing - Supabase Setup
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- ============================================

-- 1. Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Sessions table (main entity)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audio file metadata
    audio_filename VARCHAR(255) NOT NULL,
    audio_url TEXT NOT NULL,
    audio_storage_path TEXT,
    audio_duration_seconds INTEGER,
    audio_file_size_bytes BIGINT,
    
    -- Processing status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'transcribing',
        'summarizing',
        'vectorizing',
        'completed',
        'failed'
    )),
    error_message TEXT,
    
    -- Processed content
    transcript_raw TEXT,                    -- Full transcript text
    transcript_with_speakers JSONB,         -- Speaker-labeled segments
    summary TEXT,                           -- Generated summary
    
    -- Vectorization status
    is_vectorized BOOLEAN DEFAULT FALSE,
    vectorized_at TIMESTAMPTZ
);

-- 3. Transcript segments with speaker labels (normalized)
CREATE TABLE IF NOT EXISTS transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    speaker VARCHAR(50) NOT NULL,           -- e.g., "Speaker A", "Therapist", "Patient"
    text TEXT NOT NULL,
    start_time_seconds DECIMAL(10, 3),
    end_time_seconds DECIMAL(10, 3),
    segment_index INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Vector embeddings for semantic search
CREATE TABLE IF NOT EXISTS session_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    
    chunk_index INTEGER NOT NULL,           -- For chunked transcripts
    chunk_text TEXT NOT NULL,               -- The text that was embedded
    embedding vector(1536) NOT NULL,        -- text-embedding-3-small produces 1536 dimensions
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_session ON transcript_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_embeddings_session ON session_embeddings(session_id);

-- 6. Create HNSW index for vector similarity search (fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_session_embeddings_vector ON session_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- 7. Function for semantic search
CREATE OR REPLACE FUNCTION match_session_embeddings(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    session_id UUID,
    chunk_text TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.id,
        se.session_id,
        se.chunk_text,
        (1 - (se.embedding <=> query_embedding))::FLOAT AS similarity
    FROM session_embeddings se
    WHERE 1 - (se.embedding <=> query_embedding) > match_threshold
    ORDER BY se.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 8. Auto-update updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Storage Bucket Setup (Manual Step)
-- ============================================
-- You need to create a storage bucket manually in Supabase Dashboard:
-- 
-- 1. Go to Storage in your Supabase Dashboard
-- 2. Click "New bucket"
-- 3. Bucket name: therapy-audio
-- 4. Public bucket: OFF (private)
-- 5. File size limit: 104857600 (100MB)
-- 6. Allowed MIME types: audio/mpeg,audio/wav,audio/webm,audio/mp4,audio/m4a,audio/x-m4a
-- ============================================

-- 9. Verify setup (run this to check everything is created)
DO $$
BEGIN
    RAISE NOTICE '=== Therapy Session Database Setup Complete ===';
    RAISE NOTICE 'Tables created: sessions, transcript_segments, session_embeddings';
    RAISE NOTICE 'Vector extension: pgvector enabled';
    RAISE NOTICE 'Semantic search: match_session_embeddings function ready';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Create storage bucket "therapy-audio" in Supabase Dashboard';
    RAISE NOTICE '2. Copy your Supabase URL and Service Role Key to backend/.env';
    RAISE NOTICE '3. Run: cd backend && npm install && npm run dev';
END $$;
