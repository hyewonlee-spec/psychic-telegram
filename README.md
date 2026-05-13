# Memory Calendar — Venues MVP Patch

Replace/add these files:

- package.json
- src/App.tsx
- src/styles.css
- src/vite-env.d.ts
- supabase/002_venues.sql

Before deploying:
1. Open Supabase → SQL Editor.
2. Run the full contents of supabase/002_venues.sql.
3. Push the replacement files to GitHub.
4. Redeploy on Vercel.

What this adds:
- New top-level app navigation: Calendar / Venues.
- Venues page.
- Add venue manually.
- Paste Instagram profile link.
- App extracts the Instagram handle.
- App cleans Instagram URLs by removing tracking parameters.
- App suggests a venue name from the handle.
- Save venue to Supabase.
- Edit venue.
- Delete venue with second-tap confirmation.
- Mark venue as visited.
- 1–5 star rating for visited venues.
- Optional visited date.
- Notes field.
- Filters: Want to go / Visited / All.
- Search by name, handle, and notes.

What this does not add yet:
- Instagram scraping.
- AI scanning.
- Maps/address enrichment.
- Share-to-app from Instagram.

Build check:
- Tested with npm run build successfully.
