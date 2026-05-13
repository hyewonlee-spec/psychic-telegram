# Memory Calendar — Modal Photo View Patch

Replace these files:

- src/App.tsx
- src/styles.css

What this changes:
- The day modal photo preview is now a portrait 3:4 viewer so the image can be viewed more fully.
- The preview uses object-fit: contain, so it does not aggressively crop inside the modal.
- "Change picture" is renamed to "Change".
- "Remove picture" is renamed to "Remove".
- Change and Remove sit on the same row as smaller buttons.
- The visible "Caption" label is removed.
- The caption box remains below the photo action buttons.
- No Supabase, database, storage, auth, or PWA setup changes.

Build check:
- Tested with npm run build successfully.
