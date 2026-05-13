const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

type SearchVenueRequest = {
  query?: string;
};

type GooglePlaceSearchResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
};

function sendJson(response: any, statusCode: number, data: unknown) {
  response.status(statusCode).json(data);
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    sendJson(response, 500, { error: 'Missing GOOGLE_PLACES_API_KEY environment variable.' });
    return;
  }

  const body = (request.body ?? {}) as SearchVenueRequest;
  const query = body.query?.trim();

  if (!query) {
    sendJson(response, 400, { error: 'Missing venue search query.' });
    return;
  }

  const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.googleMapsUri,places.primaryTypeDisplayName',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: {
          center: {
            latitude: -27.4698,
            longitude: 153.0251,
          },
          radius: 35000,
        },
      },
      maxResultCount: 5,
      languageCode: 'en',
      regionCode: 'AU',
    }),
  });

  const data = await googleResponse.json();

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, {
      error: data.error?.message ?? 'Google Places search failed.',
    });
    return;
  }

  const candidates = (data.places ?? []).map((place: GooglePlaceSearchResult) => ({
    id: place.id,
    displayName: place.displayName?.text ?? 'Unnamed place',
    formattedAddress: place.formattedAddress ?? '',
    googleMapsUri: place.googleMapsUri,
    primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
  })).filter((candidate: { id?: string }) => Boolean(candidate.id));

  sendJson(response, 200, { candidates });
}
