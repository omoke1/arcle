-- Notifications table
-- Stores user notifications for transactions, payments, invoices, etc.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('transaction', 'payment', 'invoice', 'remittance', 'subscription', 'system')),
  title text not null,
  message text not null,
  action_url text,
  is_read boolean not null default false,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

-- Indexes for performance
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_user_read_idx on public.notifications(user_id, is_read);
create index if not exists notifications_type_idx on public.notifications(type);

-- Note: RLS policies are defined in 0002_rls_policies.sql

