-- ============================================================================
-- Group Scheduling Web App - Supabase PostgreSQL Schema & RLS Policies
-- ============================================================================

-- Enable UUID generation and cryptographic hashing extensions
create extension if not exists "pgcrypto";

-- 1. Create custom enum for time slots
do $$ begin
    create type public.time_slot as enum ('morning', 'afternoon', 'evening');
exception
    when duplicate_object then null;
end $$;

-- 2. Create `events` table
create table if not exists public.events (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 120),
    start_date date not null,
    end_date date not null,
    password_hash text not null check (char_length(password_hash) <= 256),
    created_at timestamptz not null default now(),
    constraint valid_date_range check (
        end_date >= start_date
        and (end_date - start_date) <= 90
    )
);

-- 3. Create `participants` table
create table if not exists public.participants (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    user_id text,
    name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 60),
    created_at timestamptz not null default now(),
    unique (event_id, name)
);

-- 4. Create `availabilities` table
create table if not exists public.availabilities (
    id uuid primary key default gen_random_uuid(),
    participant_id uuid not null references public.participants(id) on delete cascade,
    event_id uuid not null references public.events(id) on delete cascade,
    date date not null,
    time_slot public.time_slot not null,
    is_available boolean not null default false,
    updated_at timestamptz not null default now(),
    unique (participant_id, date, time_slot)
);

-- Indexes for fast lookup by event
create index if not exists idx_participants_event_id on public.participants(event_id);
create index if not exists idx_availabilities_event_id on public.availabilities(event_id);
create index if not exists idx_availabilities_participant_id on public.availabilities(participant_id);

-- ============================================================================
-- Row-Level Security (RLS) Policies
-- ============================================================================

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.availabilities enable row level security;

-- Events: Anyone can create an event and read event metadata by UUID
create policy "Allow public select on events"
    on public.events for select
    to anon, authenticated
    using (true);

create policy "Allow public insert on events"
    on public.events for insert
    to anon, authenticated
    with check (
        end_date >= start_date
        and (end_date - start_date) <= 90
    );

create policy "Allow public update on events"
    on public.events for update
    to anon, authenticated
    using (true)
    with check (
        end_date >= start_date
        and (end_date - start_date) <= 90
    );

create policy "Allow public delete on events"
    on public.events for delete
    to anon, authenticated
    using (true);

-- Participants: Anyone with the event link can view and add participants
create policy "Allow public select on participants"
    on public.participants for select
    to anon, authenticated
    using (true);

create policy "Allow public insert on participants"
    on public.participants for insert
    to anon, authenticated
    with check (true);

create policy "Allow public update on participants"
    on public.participants for update
    to anon, authenticated
    using (true)
    with check (true);

create policy "Allow public delete on participants"
    on public.participants for delete
    to anon, authenticated
    using (true);

-- Availabilities: Anyone with the event link can read and upsert availabilities
create policy "Allow public select on availabilities"
    on public.availabilities for select
    to anon, authenticated
    using (true);

create policy "Allow public insert on availabilities"
    on public.availabilities for insert
    to anon, authenticated
    with check (true);

create policy "Allow public update on availabilities"
    on public.availabilities for update
    to anon, authenticated
    using (true)
    with check (true);

create policy "Allow public delete on availabilities"
    on public.availabilities for delete
    to anon, authenticated
    using (true);

