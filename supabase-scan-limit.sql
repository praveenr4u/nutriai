-- ─────────────────────────────────────────────
-- NutriAI: Scan Usage Tracking
-- Run in Supabase → SQL Editor → New Query
-- ─────────────────────────────────────────────

create table if not exists scan_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  scan_date  date default current_date,
  scan_count int  default 1,
  updated_at timestamptz default now(),
  unique(user_id, scan_date)
);

alter table scan_logs enable row level security;

create policy "Users can view own scan logs"
  on scan_logs for select using (auth.uid() = user_id);
create policy "Users can insert own scan logs"
  on scan_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own scan logs"
  on scan_logs for update using (auth.uid() = user_id);
