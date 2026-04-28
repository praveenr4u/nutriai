-- ─────────────────────────────────────────────
-- NutriAI Database Schema
-- Run this in Supabase → SQL Editor → New Query
-- ─────────────────────────────────────────────

-- 1. USER PROFILES
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  gender        text,
  goal          text,
  age           int,
  height_unit   text default 'ft',
  height_ft     int  default 5,
  height_in     int  default 7,
  height_cm     int  default 170,
  weight_unit   text default 'lbs',
  weight_lbs    int  default 165,
  weight_kg     int  default 75,
  target_weight_unit text default 'lbs',
  target_weight_lbs  int  default 150,
  target_weight_kg   int  default 68,
  activity_level     text,
  health_concerns    text[] default '{}',
  diet_prefs         text[] default '{}',
  calorie_target     int,
  protein_target     int,
  carbs_target       int,
  fat_target         int,
  water_goal         int  default 8,
  onboarding_done    boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- 2. DAILY FOOD LOGS
create table if not exists food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  log_date   date default current_date,
  meal       text not null,  -- breakfast | lunch | dinner | snacks
  food_name  text not null,
  calories   int  not null,
  protein    numeric(6,1) default 0,
  carbs      numeric(6,1) default 0,
  fat        numeric(6,1) default 0,
  serving    text,
  created_at timestamptz default now()
);

-- 3. DAILY WATER LOGS
create table if not exists water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  log_date   date default current_date,
  cups       int  default 0,
  updated_at timestamptz default now(),
  unique(user_id, log_date)
);

-- ─── Row Level Security (users can only see their own data) ───
alter table profiles  enable row level security;
alter table food_logs enable row level security;
alter table water_logs enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);
create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Food logs policies
create policy "Users can view own food logs"
  on food_logs for select using (auth.uid() = user_id);
create policy "Users can insert own food logs"
  on food_logs for insert with check (auth.uid() = user_id);
create policy "Users can delete own food logs"
  on food_logs for delete using (auth.uid() = user_id);

-- Water logs policies
create policy "Users can view own water logs"
  on water_logs for select using (auth.uid() = user_id);
create policy "Users can upsert own water logs"
  on water_logs for insert with check (auth.uid() = user_id);
create policy "Users can update own water logs"
  on water_logs for update using (auth.uid() = user_id);

-- ─── Auto-update updated_at on profiles ───
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();
