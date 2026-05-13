# Memory Calendar — UX + PWA Patch

Replace/add these files:

- package.json
- index.html
- src/App.tsx
- src/styles.css
- src/vite-env.d.ts
- public/favicon.png
- public/apple-touch-icon.png
- public/icon-192.png
- public/icon-512.png
- public/site.webmanifest

What this changes:
- Month photo density: calendar photos crop more neatly inside the square date cells.
- Caption preview: days with captions now show a tiny dot marker; captions remain visible on larger screens.
- Delete/edit UX: removing a picture is staged until Save day; replacing a picture keeps the old one until Save day; Delete day now requires a second tap.
- PWA install: app icon, manifest, Apple touch icon, browser favicon, and an install button/hint.
- Keeps the separate Photo view with larger 4:3 photo cards.
- No Supabase table, RLS, Storage, or environment variable changes.

Build check:
- Tested with npm run build successfully.
