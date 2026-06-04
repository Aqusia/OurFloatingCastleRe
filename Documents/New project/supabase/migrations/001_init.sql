create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  class_name text not null check (class_name in ('warrior', 'assassin', 'mage', 'priest')),
  class_changed_on date not null,
  level integer not null default 1,
  experience integer not null default 0,
  gold integer not null default 0,
  materials integer not null default 0,
  hp integer not null default 0,
  max_hp integer not null default 0,
  spirit_resource integer not null default 0,
  max_spirit integer not null default 0,
  strength integer not null default 0,
  intelligence integer not null default 0,
  spirit integer not null default 0,
  preferred_role text not null default 'balanced' check (preferred_role in ('tank', 'dps', 'healer', 'balanced')),
  blessing text not null,
  title text not null,
  job_image text,
  equipment jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  inventory jsonb not null default '[]'::jsonb,
  status_effects jsonb not null default '[]'::jsonb,
  sub_role_slots jsonb not null default '[]'::jsonb,
  action_queue jsonb not null default '{"items":[],"updatedAt":null}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists battle_records (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  boss_name text not null,
  winner text not null check (winner in ('players', 'boss')),
  duration_ms integer not null,
  total_ticks integer not null,
  created_at timestamptz not null default now()
);

create table if not exists battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references battle_records(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  display_name text not null,
  class_name text not null,
  damage_dealt integer not null default 0,
  healing_done integer not null default 0,
  damage_taken integer not null default 0
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_type text not null check (activity_type in ('training', 'mining', 'rest')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
