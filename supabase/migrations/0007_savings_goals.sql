-- Savings Goals table
-- Stores user savings goals with lock periods and yield calculations

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_id text not null,
  goal_name text not null,
  goal_category text not null default 'custom',
  target_amount numeric(20, 2) not null,
  current_amount numeric(20, 2) not null default 0,
  contribution_amount numeric(20, 2),
  contribution_frequency text check (contribution_frequency in ('daily', 'weekly', 'monthly', 'one-time')),
  lock_period integer not null, -- days
  penalty_rate numeric(5, 2) not null,
  bonus_apy numeric(5, 2) not null,
  status text not null default 'active' check (status in ('active', 'matured', 'broken')),
  maturity_date timestamptz not null,
  last_contribution_at timestamptz,
  next_contribution_at timestamptz,
  auto_deduct boolean not null default false,
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Savings Transactions table
-- Tracks all transactions for savings goals
create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'penalty', 'maturity')),
  amount numeric(20, 2) not null,
  balance_after numeric(20, 2) not null,
  timestamp timestamptz not null default timezone('utc', now())
);

-- Indexes for performance
create index if not exists savings_goals_user_id_idx on public.savings_goals(user_id);
create index if not exists savings_goals_status_idx on public.savings_goals(status);
create index if not exists savings_goals_maturity_date_idx on public.savings_goals(maturity_date);
create index if not exists savings_goals_next_contribution_idx on public.savings_goals(next_contribution_at);
create index if not exists savings_transactions_goal_id_idx on public.savings_transactions(goal_id);
create index if not exists savings_transactions_timestamp_idx on public.savings_transactions(timestamp desc);

-- Trigger to keep savings_goals.updated_at current
create or replace function public.touch_savings_goals_updated_at()
returns trigger as $
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$ language plpgsql;

drop trigger if exists savings_goals_set_updated_at on public.savings_goals;
create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute procedure public.touch_savings_goals_updated_at();