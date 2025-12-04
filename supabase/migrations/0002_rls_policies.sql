-- Row Level Security (RLS) Policies for Supabase
-- 
-- These policies allow:
-- 1. Users to read/write their own preferences
-- 2. API routes (using service role) to create users and manage data
-- 3. Public read access where needed

-- Enable RLS on all tables
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.preferences enable row level security;
alter table public.notifications enable row level security;

-- Users table policies
-- Allow service role (admin) to do everything
create policy "Service role can manage users"
  on public.users
  for all
  using (auth.role() = 'service_role');

-- Allow users to read their own user record (by wallet_address)
-- Note: This requires authentication, which we'll handle via API routes for now
-- For now, we'll rely on service role for all operations

-- Sessions table policies
create policy "Service role can manage sessions"
  on public.sessions
  for all
  using (auth.role() = 'service_role');

-- Messages table policies
create policy "Service role can manage messages"
  on public.messages
  for all
  using (auth.role() = 'service_role');

-- Preferences table policies
create policy "Service role can manage preferences"
  on public.preferences
  for all
  using (auth.role() = 'service_role');

-- Allow anon users to read/write preferences (for now, until we implement proper auth)
-- This is a temporary policy - in production, you'd want proper user authentication
create policy "Allow anon read/write preferences"
  on public.preferences
  for all
  using (true)
  with check (true);

-- Allow anon users to read users table (needed for lookups)
create policy "Allow anon read users"
  on public.users
  for select
  using (true);

-- Allow anon users to insert users (needed for user creation via API)
-- Note: The API route uses service role, but this allows fallback
create policy "Allow anon insert users"
  on public.users
  for insert
  with check (true);

-- Notifications table policies
create policy "Service role can manage notifications"
  on public.notifications
  for all
  using (auth.role() = 'service_role');

-- Allow anon users to read notifications (needed for user lookups)
create policy "Allow anon read notifications"
  on public.notifications
  for select
  using (true);

-- Allow anon users to update notifications (mark as read)
create policy "Allow anon update notifications"
  on public.notifications
  for update
  using (true)
  with check (true);

