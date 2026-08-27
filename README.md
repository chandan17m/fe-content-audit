# FE Content Audit Pipeline

Prototype app for the Financial Express content audit workflow.

## Stack

- Next.js App Router with TypeScript
- Vercel hosting
- Supabase Auth with Google OAuth
- Supabase Postgres with Row Level Security
- Tiptap WYSIWYG editor
- Next.js route handlers for server-only API calls
- Supabase-backed job/status tables for prototype queueing
- Vercel environment variables for secrets

## Prototype Scope

- Google OAuth domain gate for `indianexpress.com` and `financialexpress.com`
- Admin/user role model
- WYSIWYG input window
- `Clean Junk` button for Step 0
- `Run` button for the full pipeline path
- Estimated run timer
- Final output section with automatic scroll
- Feedback submission staged for admin review
- Live IST date/time on the frontend

The current implementation uses deterministic placeholder logic in API routes. Replace those internals with the paid model/API provider once keys are available.

## Local Commands

```bash
npm run lint
npm run build
npm run start
```

For local testing, `npm run start` is preferred after `npm run build`. On this machine, `next dev` can hit the macOS open-file watcher limit. The build script uses Webpack because it is the verified production path in this local environment.

## Environment Variables

Copy `.env.example` to `.env.local` and fill values when available.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MODEL_PROVIDER_API_KEY=
MASTER_PROMPT=
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=indianexpress.com,financialexpress.com
```

Put the master prompt in `MASTER_PROMPT` as a server-only environment variable in Vercel. Do not prefix it with `NEXT_PUBLIC_`, because that would expose it to the browser.

## Remaining Setup

- Create/connect Supabase project
- Configure Google OAuth credentials
- Add Supabase schema and RLS policies
- Connect model provider API
- Add Vercel project environment variables
- Deploy from GitHub to Vercel
