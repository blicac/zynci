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

alter table public.participants add column if not exists user_id text;

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
-- Anti-Abuse & Database Hard Caps (Protects DB from Bot Flooding)
-- ============================================================================

-- 1. Hard cap on total active events (max 200 active polls total, max 20 created per hour)
create or replace function public.enforce_event_rate_and_cap()
returns trigger
language plpgsql
security definer
as $$
declare
    active_count integer;
    recent_hour_count integer;
begin
    -- Automatically purge expired polls first so space is freed
    delete from public.events where end_date < current_date;

    select count(*) into active_count from public.events;
    if active_count >= 200 then
        raise exception 'Maximum number of active polls (200) reached. Please try again later.';
    end if;

    select count(*) into recent_hour_count
    from public.events
    where created_at > (now() - interval '1 hour');

    if recent_hour_count >= 20 then
        raise exception 'Rate limit exceeded: Too many polls created recently. Please wait a bit.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_event_rate_and_cap on public.events;
create trigger trg_enforce_event_rate_and_cap
    before insert on public.events
    for each row
    execute function public.enforce_event_rate_and_cap();

-- 2. Hard cap on participants per poll (max 50 people per poll)
create or replace function public.enforce_participant_cap()
returns trigger
language plpgsql
security definer
as $$
declare
    p_count integer;
begin
    select count(*) into p_count
    from public.participants
    where event_id = new.event_id;

    if p_count >= 50 then
        raise exception 'This poll has reached the maximum of 50 participants.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_participant_cap on public.participants;
create trigger trg_enforce_participant_cap
    before insert on public.participants
    for each row
    execute function public.enforce_participant_cap();

-- 3. Strict date-bounds check on availabilities (prevents inserting dates outside the poll window)
create or replace function public.enforce_availability_date_bounds()
returns trigger
language plpgsql
security definer
as $$
declare
    ev_start date;
    ev_end date;
begin
    select start_date, end_date into ev_start, ev_end
    from public.events
    where id = new.event_id;

    if ev_start is null then
        raise exception 'Event does not exist.';
    end if;

    if new.date < ev_start or new.date > ev_end then
        raise exception 'Availability date must fall within the poll date range.';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_availability_date_bounds on public.availabilities;
create trigger trg_enforce_availability_date_bounds
    before insert or update on public.availabilities
    for each row
    execute function public.enforce_availability_date_bounds();

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

