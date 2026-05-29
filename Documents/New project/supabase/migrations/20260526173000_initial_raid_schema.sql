create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_length check (char_length(email) between 5 and 320),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 32)
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  class_name text not null default 'warrior',
  class_changed_on date not null default current_date,
  level integer not null default 1,
  experience integer not null default 0,
  gold integer not null default 0,
  materials integer not null default 0,
  strength integer not null default 5,
  intelligence integer not null default 5,
  spirit integer not null default 5,
  loadout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint characters_name_length check (char_length(name) between 1 and 32),
  constraint characters_level_positive check (level >= 1),
  constraint characters_experience_nonnegative check (experience >= 0),
  constraint characters_gold_nonnegative check (gold >= 0),
  constraint characters_materials_nonnegative check (materials >= 0),
  constraint characters_strength_positive check (strength > 0),
  constraint characters_intelligence_positive check (intelligence > 0),
  constraint characters_spirit_positive check (spirit > 0),
  constraint characters_class_name_check check (class_name in ('warrior', 'mage', 'priest')),
  constraint characters_profile_name_unique unique (profile_id, name)
);

create table if not exists public.battle_records (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  created_by_profile_id uuid references public.profiles (id) on delete set null,
  created_by_character_id uuid references public.characters (id) on delete set null,
  boss_name text not null,
  boss_max_hp integer not null,
  boss_remaining_hp integer not null,
  status text not null default 'created',
  winner text,
  player_count integer not null default 0,
  room_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint battle_records_status_check check (status in ('created', 'active', 'ended')),
  constraint battle_records_winner_check check (winner is null or winner in ('players', 'boss')),
  constraint battle_records_boss_max_hp_positive check (boss_max_hp > 0),
  constraint battle_records_boss_remaining_hp_nonnegative check (boss_remaining_hp >= 0),
  constraint battle_records_player_count_nonnegative check (player_count >= 0)
);

create table if not exists public.battle_participants (
  id uuid primary key default gen_random_uuid(),
  battle_record_id uuid not null references public.battle_records (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  character_id uuid references public.characters (id) on delete set null,
  socket_player_id text,
  player_name text not null,
  player_slot smallint,
  is_host boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  final_hp integer,
  max_hp integer not null,
  total_damage_done integer not null default 0,
  total_healing_done integer not null default 0,
  total_damage_taken integer not null default 0,
  result text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint battle_participants_slot_range check (player_slot is null or player_slot between 1 and 4),
  constraint battle_participants_max_hp_positive check (max_hp > 0),
  constraint battle_participants_final_hp_nonnegative check (final_hp is null or final_hp >= 0),
  constraint battle_participants_damage_done_nonnegative check (total_damage_done >= 0),
  constraint battle_participants_healing_done_nonnegative check (total_healing_done >= 0),
  constraint battle_participants_damage_taken_nonnegative check (total_damage_taken >= 0),
  constraint battle_participants_result_check check (result is null or result in ('alive', 'downed', 'escaped')),
  constraint battle_participants_battle_profile_unique unique (battle_record_id, profile_id)
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  battle_record_id uuid references public.battle_records (id) on delete cascade,
  participant_id uuid references public.battle_participants (id) on delete set null,
  room_id text not null,
  activity_type text not null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  actor_character_id uuid references public.characters (id) on delete set null,
  action_key text,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  constraint activity_logs_type_check check (
    activity_type in (
      'room_created',
      'player_joined',
      'player_left',
      'battle_started',
      'battle_tick',
      'battle_ended',
      'system'
    )
  )
);

create index if not exists idx_characters_profile_id on public.characters (profile_id);
create index if not exists idx_battle_records_room_id on public.battle_records (room_id);
create index if not exists idx_battle_records_started_at on public.battle_records (started_at desc);
create index if not exists idx_battle_participants_battle_record_id on public.battle_participants (battle_record_id);
create index if not exists idx_battle_participants_profile_id on public.battle_participants (profile_id);
create index if not exists idx_activity_logs_battle_record_id on public.activity_logs (battle_record_id, occurred_at);
create index if not exists idx_activity_logs_room_id on public.activity_logs (room_id, occurred_at);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists characters_set_updated_at on public.characters;
create trigger characters_set_updated_at
before update on public.characters
for each row
execute function public.set_updated_at();

drop trigger if exists battle_records_set_updated_at on public.battle_records;
create trigger battle_records_set_updated_at
before update on public.battle_records
for each row
execute function public.set_updated_at();

drop trigger if exists battle_participants_set_updated_at on public.battle_participants;
create trigger battle_participants_set_updated_at
before update on public.battle_participants
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.battle_records enable row level security;
alter table public.battle_participants enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "characters_manage_own" on public.characters;
create policy "characters_manage_own"
on public.characters
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "battle_records_select_related" on public.battle_records;
create policy "battle_records_select_related"
on public.battle_records
for select
to authenticated
using (
  created_by_profile_id = auth.uid()
  or exists (
    select 1
    from public.battle_participants bp
    where bp.battle_record_id = battle_records.id
      and bp.profile_id = auth.uid()
  )
);

drop policy if exists "battle_participants_select_related" on public.battle_participants;
create policy "battle_participants_select_related"
on public.battle_participants
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.battle_participants bp
    where bp.battle_record_id = battle_participants.battle_record_id
      and bp.profile_id = auth.uid()
  )
);

drop policy if exists "activity_logs_select_related" on public.activity_logs;
create policy "activity_logs_select_related"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.battle_participants bp
    where bp.battle_record_id = activity_logs.battle_record_id
      and bp.profile_id = auth.uid()
  )
);
