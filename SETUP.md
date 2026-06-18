# Setup guide

## 1 — Install dependencies

```bash
npm install
```

## 2 — Create your accounts (all free tiers work)

| Service | URL | What it's for |
|---|---|---|
| Clerk | clerk.com | Google OAuth, email sign-in, session management |
| Supabase | supabase.com | Postgres database + file storage |
| Upstash | upstash.com | Redis — rate limiting + MusicBrainz cache |
| Vercel | vercel.com | Deployment |

## 3 — Clerk setup

1. Create a new application in the Clerk dashboard
2. Enable **Google** as a social provider (OAuth scopes stay at default — email + profile only)
3. Enable **Email magic links** as a sign-in method
4. Go to **Webhooks** → Add endpoint:
   - URL: `https://yourdomain.com/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copy the **Signing Secret** → becomes `CLERK_WEBHOOK_SECRET`

## 4 — Supabase setup

1. Create a new project
2. Go to **SQL Editor** and run the full contents of `supabase/schema.sql`
3. Go to **Storage** → Create a bucket named `avatars`
   - Set to **Private** (the API routes control access)
4. Copy your project URL and keys from **Project Settings → API**

## 5 — Upstash setup

1. Create a Redis database at upstash.com
2. Copy the REST URL and token from the console

## 6 — Environment variables

```bash
cp .env.example .env.local
# Fill in all values — see .env.example for which are safe to expose
```

## 7 — Run locally

```bash
npm run dev
```

## 8 — First moderator

After your first sign-in, add yourself as a moderator directly in Supabase SQL editor:

```sql
insert into public.moderators (clerk_id)
values ('user_your_clerk_id_here');
```

Your Clerk user ID appears in the Clerk dashboard under Users.

## File structure

```
app/
  api/
    webhooks/clerk/route.ts     ← Clerk events (user created/deleted)
    music/search/route.ts       ← MusicBrainz proxy (cached)
    profile/
      route.ts                  ← GET + PATCH own profile
      albums/route.ts           ← GET + PUT + DELETE album slots
      contributions/route.ts    ← GET + POST + DELETE contributions
      avatar/route.ts           ← POST avatar upload (goes to pending)
    admin/
      avatar/approve/route.ts   ← Moderator approve/reject avatars
lib/
  supabase.ts                   ← Anon client + admin client
  musicbrainz.ts                ← Rate-limited MusicBrainz fetcher
  ratelimit.ts                  ← Per-user API + upload rate limiters
  env.ts                        ← Startup env validation
supabase/
  schema.sql                    ← Full DB schema with RLS policies
types/
  database.ts                   ← TypeScript types matching the schema
middleware.ts                   ← Clerk auth + CSRF origin check
next.config.ts                  ← CSP headers, image domains
```
