# Memory Calendar — Google Places Venue Enrichment Patch

Replace/add these files:

- package.json
- src/App.tsx
- src/styles.css
- src/vite-env.d.ts
- supabase/003_venue_google_places.sql
- api/search-venue.ts
- api/place-details.ts

Before deploying:
1. In Supabase → SQL Editor, run:
   supabase/003_venue_google_places.sql
2. In Vercel → Project → Settings → Environment Variables, add:
   GOOGLE_PLACES_API_KEY
3. Make sure your Google Cloud project has Places API enabled.
4. Push the replacement files to GitHub.
5. Redeploy on Vercel.

What this adds:
- Find Google details button inside the Venue modal.
- Server-side Google Places Text Search endpoint:
  /api/search-venue
- Server-side Google Place Details endpoint:
  /api/place-details
- User-confirmed candidate selection.
- Saves enriched venue details to Supabase:
  google_place_id
  google_maps_url
  address
  website_url
  phone
  latitude
  longitude
  google_rating
  google_user_ratings_total
  opening_hours
  details_source
  details_updated_at
- Venue cards now show address, Google rating, website link, and Google Maps link when available.

What this does not add:
- Instagram scraping.
- Automatic profile picture extraction.
- Place photo download/storage.

Build check:
- Tested with npm run build successfully.
