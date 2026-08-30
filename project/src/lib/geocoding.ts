// ============================================================
// Geocoding via Nominatim (OpenStreetMap) — No API key required
// ============================================================

export interface GeocodingResult {
  displayName: string;
  shortName: string;
  city?: string;
  state?: string;
  country?: string;
}

let lastCall = 0;
const MIN_INTERVAL = 1200; // Nominatim rate limit: 1 req/sec

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodingResult> {
  // Enforce rate limiting
  const now = Date.now();
  if (now - lastCall < MIN_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL - (now - lastCall)));
  }
  lastCall = Date.now();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'SmartLogisticsApp/2.0',
        },
      }
    );
    if (!res.ok) throw new Error('Nominatim error');
    const data = await res.json();
    const addr = data.address || {};

    const city =
      addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
    const state = addr.state || addr.state_district || '';
    const country = addr.country || '';

    const shortName = [city, state].filter(Boolean).join(', ') || data.display_name?.split(',')[0] || `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

    return {
      displayName: data.display_name || shortName,
      shortName,
      city,
      state,
      country,
    };
  } catch {
    return {
      displayName: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
      shortName: `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`,
    };
  }
}
