-- Run this once in your Supabase project's SQL editor.

-- The shared family ledger
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  spender text not null,
  method text not null,
  room text,
  category text not null,
  notes text default '',
  amount_cents integer not null default 0,
  tip_cents integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
drop policy if exists "family_all" on public.transactions;
create policy "family_all" on public.transactions for all using (true) with check (true);

-- One row per device that has turned on alerts
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "subs_all" on public.push_subscriptions;
create policy "subs_all" on public.push_subscriptions for all using (true) with check (true);

-- Turn on realtime for the ledger so all phones update live
alter publication supabase_realtime add table public.transactions;
