# Memory Calendar — Bottom Nav + Calendar Fit Patch

Replace this file only:

- src/styles.css

What this changes:
- Moves Calendar / Venues navigation to the bottom of the mobile screen.
- Gives the header and month area a bit more vertical breathing room.
- Keeps the calendar card fully visible, including the bottom rounded corners.
- Hides the footer on mobile so it does not create extra scroll space.
- Keeps the mobile calendar page locked to the visible phone height.
- No App.tsx, Supabase, database, venues, auth, or PWA changes.

Note:
The mobile day cells are locked to compact square photo tiles so the full month can fit with the header, month toolbar, view toggle, and bottom nav visible.
