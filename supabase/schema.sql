-- ============================================================
-- Editorial Platform — Full Database Schema
-- Run this in the Supabase SQL editor or via CLI migration.
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Helper functions ─────────────────────────────────────────────────────────

-- Returns the Clerk user ID from the current JWT session.
-- Clerk middleware injects the user ID into the 'sub' claim.
create or replace function auth.clerk_user_id() returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$ language sql stable;

-- Returns true if the current user is a moderator.
-- Uses security definer so it can read the moderators table without RLS.
create or replace function public.is_moderator() returns boolean as $$
  select exists (
    select 1 from public.moderators
    where clerk_id = auth.clerk_user_id()
      and active = true
  );
$$ language sql stable security definer;

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- Profiles: one row per registered user.
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  clerk_id        text unique not null,       -- Foreign key to Clerk
  email           text not null,
  display_name    text,
  handle          text unique,                -- @handle for public URLs
  role_label      text,                       -- e.g. "Contributor · Culture & Music"
  bio             text,
  avatar_url      text,                       -- Points to approved Supabase Storage path
  links           jsonb default '[]'::jsonb,  -- [{label, url}, ...]
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Profile albums: up to 5 ranked album picks per user.
create table public.profile_albums (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text not null references public.profiles(clerk_id) on delete cascade,
  rank        smallint not null check (rank between 1 and 5),
  mb_id       text not null,        -- MusicBrainz release ID
  title       text not null,
  artist      text not null,
  year        text,
  cover_url   text,                 -- Cached Cover Art Archive URL
  updated_at  timestamptz not null default now(),
  unique (clerk_id, rank)           -- One album per slot per user
);

-- Contributions: articles, mixes, interviews, features, photo essays.
create table public.contributions (
  id            uuid primary key default gen_random_uuid(),
  author_id     text not null references public.profiles(clerk_id) on delete cascade,
  type          text not null check (type in ('Article','Mix','Interview','Feature','Photo essay')),
  title         text not null,
  url           text,               -- Null = on-site content; non-null = external link
  is_external   boolean not null default false,
  published_at  date,
  approved      boolean not null default false,
  approved_by   text,               -- Moderator clerk_id
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Moderators: users with approval permissions.
create table public.moderators (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text unique not null,
  added_by    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Avatar uploads: tracks pending/approved/rejected avatar submissions.
create table public.avatar_uploads (
  id              uuid primary key default gen_random_uuid(),
  clerk_id        text not null references public.profiles(clerk_id) on delete cascade,
  storage_path    text not null,     -- e.g. pending/user123/avatar.webp
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  flagged_reason  text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Audit log: immutable record of sensitive actions (GDPR deletions, approvals, etc.)
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    text,                  -- Clerk ID of who did it (null = system/webhook)
  target_id   text,                  -- Clerk ID of the affected user
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index on public.profiles (clerk_id);
create index on public.profiles (handle);
create index on public.profile_albums (clerk_id, rank);
create index on public.contributions (author_id);
create index on public.contributions (approved, created_at desc);
create index on public.avatar_uploads (clerk_id, status);
create index on public.audit_log (target_id, created_at desc);

-- ─── Updated-at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger contributions_updated_at
  before update on public.contributions
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.profile_albums enable row level security;
alter table public.contributions  enable row level security;
alter table public.moderators     enable row level security;
alter table public.avatar_uploads enable row level security;
alter table public.audit_log      enable row level security;

-- PROFILES
create policy "Public profiles readable by anyone"
  on public.profiles for select
  using (is_public = true);

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.clerk_user_id() = clerk_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.clerk_user_id() = clerk_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.clerk_user_id() = clerk_id)
  with check (auth.clerk_user_id() = clerk_id);

-- PROFILE ALBUMS
create policy "Albums visible on public profiles"
  on public.profile_albums for select
  using (
    exists (
      select 1 from public.profiles p
      where p.clerk_id = profile_albums.clerk_id
        and p.is_public = true
    )
  );

create policy "Users manage own albums"
  on public.profile_albums for insert
  with check (auth.clerk_user_id() = clerk_id);

create policy "Users update own albums"
  on public.profile_albums for update
  using (auth.clerk_user_id() = clerk_id)
  with check (auth.clerk_user_id() = clerk_id);

create policy "Users delete own albums"
  on public.profile_albums for delete
  using (auth.clerk_user_id() = clerk_id);

-- CONTRIBUTIONS
create policy "Approved contributions are public"
  on public.contributions for select
  using (approved = true);

create policy "Authors can see own contributions"
  on public.contributions for select
  using (auth.clerk_user_id() = author_id);

create policy "Authors can submit contributions"
  on public.contributions for insert
  with check (
    auth.clerk_user_id() = author_id
    and approved = false  -- Authors cannot self-approve
  );

create policy "Authors can edit own draft contributions"
  on public.contributions for update
  using (auth.clerk_user_id() = author_id and approved = false)
  with check (auth.clerk_user_id() = author_id and approved = false);

create policy "Moderators can approve contributions"
  on public.contributions for update
  using (public.is_moderator())
  with check (public.is_moderator());

-- MODERATORS — only readable by other moderators (security through obscurity + RLS)
create policy "Moderators can see the moderators table"
  on public.moderators for select
  using (public.is_moderator());

-- AVATAR UPLOADS
create policy "Users see own avatar uploads"
  on public.avatar_uploads for select
  using (auth.clerk_user_id() = clerk_id);

create policy "Moderators see all avatar uploads"
  on public.avatar_uploads for select
  using (public.is_moderator());

create policy "Users can submit avatar uploads"
  on public.avatar_uploads for insert
  with check (auth.clerk_user_id() = clerk_id);

create policy "Moderators can update upload status"
  on public.avatar_uploads for update
  using (public.is_moderator());

-- AUDIT LOG — append-only via service role only; no user reads
-- (admins query directly via Supabase dashboard or a secured admin route)

-- ─── Grants ───────────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.profile_albums, public.contributions to anon;
grant select, insert, update, delete
  on public.profiles, public.profile_albums, public.contributions, public.avatar_uploads
  to authenticated;
grant all on all tables in schema public to service_role;
