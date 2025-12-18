-- Fix Chat History and Context Persistence
-- This script ensures the 'messages' and 'sessions' tables exist and have the correct structure and policies.

-- 1. Ensure 'sessions' table exists
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    agent_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure 'messages' table exists
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata JSONB
);

-- 3. Add Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);

-- 4. Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. Fix RLS Policies for Sessions
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.sessions;
CREATE POLICY "Users can manage their own sessions"
ON public.sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service Role Bypass (for server-side operations)
DROP POLICY IF EXISTS "Service role manages sessions" ON public.sessions;
CREATE POLICY "Service role manages sessions"
ON public.sessions
FOR ALL
USING (auth.role() = 'service_role');


-- 6. Fix RLS Policies for Messages
-- Users can read messages from sessions they own
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
CREATE POLICY "Users can read own messages"
ON public.messages
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.sessions
        WHERE sessions.id = messages.session_id
        AND sessions.user_id = auth.uid()
    )
);

-- Users can insert messages to sessions they own
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
CREATE POLICY "Users can insert own messages"
ON public.messages
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.sessions
        WHERE sessions.id = session_id
        AND sessions.user_id = auth.uid()
    )
);

-- Service Role Bypass (for server-side/AI responses)
DROP POLICY IF EXISTS "Service role manages messages" ON public.messages;
CREATE POLICY "Service role manages messages"
ON public.messages
FOR ALL
USING (auth.role() = 'service_role');

-- 7. Grant access to authenticated users
GRANT ALL ON public.sessions TO authenticated;
GRANT ALL ON public.messages TO authenticated;
GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.messages TO service_role;

-- 8. Fix Preferences Table (Ensure it allows reading session_id)
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.preferences;
CREATE POLICY "Users can manage their own preferences"
ON public.preferences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages preferences" ON public.preferences;
CREATE POLICY "Service role manages preferences"
ON public.preferences
FOR ALL
USING (auth.role() = 'service_role');
