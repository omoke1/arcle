-- Users table
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  email text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Sessions table
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent_state jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists sessions_user_id_idx on public.sessions(user_id);

-- Messages table
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_session_id_created_at_idx
  on public.messages(session_id, created_at desc);

-- Preferences table
create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  value jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists preferences_user_key_unique
  on public.preferences(user_id, key);

-- Trigger to keep sessions.updated_at current
create or replace function public.touch_session_updated_at()
returns trigger as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute procedure public.touch_session_updated_at();

