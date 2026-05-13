# Memory Calendar — Modal Overlap Cleanup Patch

Replace this file only:

- src/styles.css

What this fixes:
- Removes the earlier overlapping modal CSS rules from the replacement stylesheet.
- Adds one final locked modal layout section.
- Uses more of the phone screen so the modal bottom stays visible.
- Keeps the portrait photo viewer larger.
- Makes the photo fill the container.
- Centres the image with object-position: center center.
- Keeps Change and Remove compact on the same row.
- No App.tsx, Supabase, database, storage, auth, or PWA changes.

Important:
This is a full replacement for src/styles.css, not a small snippet to paste.
