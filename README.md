# Memory Calendar

A simple Supabase-backed photo calendar.

Core idea: each calendar day can hold one photo and one optional caption.

## What is included

- React + Vite + TypeScript
- Supabase Auth
- Supabase Postgres table: `calendar_entries`
- Supabase Storage bucket: `calendar-photos`
- Row Level Security policies
- Monthly calendar view
- Upload/change/remove photo per day
- Optional caption per day
- Previous/next month navigation
- Mobile-friendly UI

## Setup

### 1. Create a Supabase project

Create a new project at Supabase.

### 2. Run the SQL

Open Supabase > SQL Editor and run:

```sql
supabase/schema.sql
```

This creates:

- `calendar_entries` table
- RLS policies
- private `calendar-photos` storage bucket
- storage object policies

### 3. Add environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Find these in Supabase > Project Settings > API.

### 4. Install and run

```bash
npm install
npm run dev
```

### 5. Deploy to Vercel

Add the same environment variables in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## Important notes

- The app stores one entry per user per date.
- The bucket is private.
- Photos are accessed by temporary signed URLs.
- Users can only read/write their own calendar entries and photos.
