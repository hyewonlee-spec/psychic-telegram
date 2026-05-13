# Memory Calendar — Calendar + Photo View Patch

Replace these files:

- src/App.tsx
- src/styles.css

What this changes:
- Restores the main calendar to a proper square date grid.
- Adds a two-option view toggle:
  - Calendar
  - Photo view
- Photo view shows saved photos for the month in larger 4:3 cards.
- Tap any photo card to edit that day's picture/caption.
- No Supabase database changes.
- No Storage changes.
- No environment variable changes.

Build check:
- Tested with npm run build successfully.
