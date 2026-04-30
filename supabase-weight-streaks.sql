-- ─────────────────────────────────────────────
-- NutriAI: Weight Logs + Streaks
-- Run in Supabase → SQL Editor → New Query
-- ─────────────────────────────────────────────

-- 1. WEIGHT LOGS
create table if not exists weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  log_date   date default current_date,
  weight     numeric(5,1) not null,
  unit       text default 'lbs',
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

alter table weight_logs enable row level security;
create policy "Users can manage own weight logs"
  on weight_logs for all using (auth.uid() = user_id);

-- 2. STREAKS
create table if not exists streaks (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  current_streak  int default 0,
  longest_streak  int default 0,
  last_log_date   date,
  total_days      int default 0,
  updated_at    timestamptz default now()
);

alter table streaks enable row level security;
create policy "Users can manage own streaks"
  on streaks for all using (auth.uid() = user_id);
