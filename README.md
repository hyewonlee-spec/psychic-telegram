# Memory Calendar — Mobile No-Scroll Calendar Patch

Replace this file only:

- src/styles.css

What this changes:
- Mobile calendar page is locked to the visible phone height.
- Footer is hidden on mobile to remove the empty scroll area.
- Header/nav/month spacing is tightened.
- Calendar card becomes the main flexible area on screen.
- Calendar day tiles use a 3:4 ratio on normal phone heights.
- Shorter phones automatically fall back toward square day tiles to avoid scrolling.
- No App.tsx, Supabase, database, venues, auth, or PWA changes.

Important:
This is a full replacement for src/styles.css from the patch.
