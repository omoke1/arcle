-- SafeLocks table
-- Stores time-locked funds with progressive penalties

create table if not exists public.safe_locks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_id text not null,
  amount numeric(20, 2) not null,
  currency text not null default 'USDC',
  lock_period integer not null, -- days
  apy numeric(5, 2) not null,
  penalty_rate numeric(5, 2) not null,
  status text not null default 'locked' check (status in ('locked', 'matured', 'broken', 'unlocked', 'cancelled')),
  maturity_date timestamptz not null,
  auto_unlock boolean not null default true,
  early_unlock_allowed boolean not null default false,
  early_unlock_fee_percent numeric(5, 2) default 0,
  transaction_hash text,
  unlocked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for performance
create index if not exists safe_locks_user_id_idx on public.safe_locks(user_id);
create index if not exists safe_locks_status_idx on public.safe_locks(status);
create index if not exists safe_locks_maturity_date_idx on public.safe_locks(maturity_date);

-- Trigger to keep updated_at current
drop trigger if exists safe_locks_set_updated_at on public.safe_locks;
create trigger safe_locks_set_updated_at
before update on public.safe_locks
for each row execute procedure public.touch_savings_goals_updated_at(); 
-- Reusing the same timestamp function as savings_goals if available, 
-- otherwise we should define a generic one or specific one. 
-- Assuming 'touch_savings_goals_updated_at' exists from previous migration (0007), 
-- but safer to use a generic one if it exists or create a specific one.
-- Let's check 0007 again. It defined 'touch_savings_goals_updated_at'. 
-- To be safe and clean, I will define a specific one for safe_locks or reuse if generic.
-- 0007 defined:
-- create or replace function public.touch_savings_goals_updated_at() ...
-- It effectively just sets new.updated_at = now(). It is named specifically for savings_goals but logic is generic.
-- I'll define a specific one for safe_locks to avoid naming confusion.

create or replace function public.touch_safe_locks_updated_at()
returns trigger as $
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$ language plpgsql;

drop trigger if exists safe_locks_set_updated_at on public.safe_locks;
create trigger safe_locks_set_updated_at
before update on public.safe_locks
for each row execute procedure public.touch_safe_locks_updated_at();

-- RLS Policies
alter table public.safe_locks enable row level security;

create policy "Users can view their own safe locks"
  on public.safe_locks for select
  using (auth.uid()::text = user_id::text);

create policy "Users can insert their own safe locks"
  on public.safe_locks for insert
  with check (auth.uid()::text = user_id::text);

create policy "Users can update their own safe locks"
  on public.safe_locks for update
  using (auth.uid()::text = user_id::text);
