-- ============================================================
-- Editorial Platform — Full Database Schema
-- ============================================================

create extension if not exists "uuid-ossp";

-- ─── Tables first (functions reference them, so they go before functions) ─────

create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  clerk_id        text unique not null,
  email           text not null,
  display_name    text,
  handle          text unique,
  role_labels     text[] default '{}',
  bio             text,
  avatar_url      text,
  links           jsonb default '[]'::jsonb,
  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.profile_albums (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text not null references public.profiles(clerk_id) on delete cascade,
  rank        smallint not null check (rank between 1 and 5),
  mb_id       text not null,
  title       text not null,
  artist      text not null,
  year        text,
  cover_url   text,
  updated_at  timestamptz not null default now(),
  unique (clerk_id, rank)
);

create table public.contributions (
  id            uuid primary key default gen_random_uuid(),
  author_id     text not null references public.profiles(clerk_id) on delete cascade,
  type          text not null check (type in ('Article','Mix','Interview','Feature','Photo essay')),
  title         text not null,
  url           text,
  is_external   boolean not null default false,
  published_at  date,
  approved      boolean not null default false,
  approved_by   text,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.moderators (
  id          uuid primary key default gen_random_uuid(),
  clerk_id    text unique not null,
  added_by    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.avatar_uploads (
  id              uuid primary key default gen_random_uuid(),
  clerk_id        text not null references public.profiles(clerk_id) on delete cascade,
  storage_path    text not null,
  status          text not null default 'pending'
                    check (status in ('pending','approved','rejected')),
  flagged_reason  text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  action      text not null,
  actor_id    text,
  target_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Helper functions (after tables exist) ────────────────────────────────────

create or replace function public.clerk_user_id() returns text as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$ language sql stable security definer;

create or replace function public.is_moderator() returns boolean as $$
  select exists (
    select 1 from public.moderators
    where clerk_id = public.clerk_user_id()
      and active = true
  );
$$ language sql stable security definer;

create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ─── Indexes ──────────────────────────────────────────────────────────────────

create index on public.profiles (clerk_id);
create index on public.profiles (handle);
create index on public.profile_albums (clerk_id, rank);
create index on public.contributions (author_id);
create index on public.contributions (approved, created_at desc);
create index on public.avatar_uploads (clerk_id, status);
create index on public.audit_log (target_id, created_at desc);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

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
  on public.profiles for select using (is_public = true);

create policy "Users can read own profile"
  on public.profiles for select using (public.clerk_user_id() = clerk_id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (public.clerk_user_id() = clerk_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (public.clerk_user_id() = clerk_id)
  with check (public.clerk_user_id() = clerk_id);

-- PROFILE ALBUMS
create policy "Albums visible on public profiles"
  on public.profile_albums for select using (
    exists (
      select 1 from public.profiles p
      where p.clerk_id = profile_albums.clerk_id and p.is_public = true
    )
  );

create policy "Users manage own albums"
  on public.profile_albums for insert with check (public.clerk_user_id() = clerk_id);

create policy "Users update own albums"
  on public.profile_albums for update
  using (public.clerk_user_id() = clerk_id)
  with check (public.clerk_user_id() = clerk_id);

create policy "Users delete own albums"
  on public.profile_albums for delete using (public.clerk_user_id() = clerk_id);

-- CONTRIBUTIONS
create policy "Approved contributions are public"
  on public.contributions for select using (approved = true);

create policy "Authors can see own contributions"
  on public.contributions for select using (public.clerk_user_id() = author_id);

create policy "Authors can submit contributions"
  on public.contributions for insert
  with check (public.clerk_user_id() = author_id and approved = false);

create policy "Authors can edit own draft contributions"
  on public.contributions for update
  using (public.clerk_user_id() = author_id and approved = false)
  with check (public.clerk_user_id() = author_id and approved = false);

create policy "Moderators can approve contributions"
  on public.contributions for update
  using (public.is_moderator()) with check (public.is_moderator());

-- MODERATORS
create policy "Moderators can see the moderators table"
  on public.moderators for select using (public.is_moderator());

-- AVATAR UPLOADS
create policy "Users see own avatar uploads"
  on public.avatar_uploads for select using (public.clerk_user_id() = clerk_id);

create policy "Moderators see all avatar uploads"
  on public.avatar_uploads for select using (public.is_moderator());

create policy "Users can submit avatar uploads"
  on public.avatar_uploads for insert with check (public.clerk_user_id() = clerk_id);

create policy "Moderators can update upload status"
  on public.avatar_uploads for update using (public.is_moderator());

-- ─── Grants ───────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.profile_albums, public.contributions to anon;
grant select, insert, update, delete
  on public.profiles, public.profile_albums, public.contributions, public.avatar_uploads
  to authenticated;
grant all on all tables in schema public to service_role;
