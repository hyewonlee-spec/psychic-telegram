const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

type PlaceDetailsRequest = {
  placeId?: string;
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

  const body = (request.body ?? {}) as PlaceDetailsRequest;
  const placeId = body.placeId?.trim();

  if (!placeId) {
    sendJson(response, 400, { error: 'Missing Google place ID.' });
    return;
  }

  const googleResponse = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    method: 'GET',
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask':
        'id,displayName,formattedAddress,googleMapsUri,websiteUri,nationalPhoneNumber,location,rating,userRatingCount,regularOpeningHours,primaryTypeDisplayName',
    },
  });

  const place = await googleResponse.json();

  if (!googleResponse.ok) {
    sendJson(response, googleResponse.status, {
      error: place.error?.message ?? 'Google Place Details failed.',
    });
    return;
  }

  sendJson(response, 200, {
    googlePlaceId: place.id,
    name: place.displayName?.text,
    address: place.formattedAddress,
    googleMapsUrl: place.googleMapsUri,
    websiteUrl: place.websiteUri,
    phone: place.nationalPhoneNumber,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    googleRating: place.rating,
    googleUserRatingsTotal: place.userRatingCount,
    openingHours: place.regularOpeningHours,
    primaryTypeDisplayName: place.primaryTypeDisplayName?.text,
  });
}
