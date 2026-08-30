// ============================================================
// Routing library — OSRM-based route calculation & navigation
// Smart Logistics & Disaster Response
// ============================================================

import type { AppIncident } from '../contexts/AppContext';

const OSRM_BASE = import.meta.env.VITE_ROUTING_API_URL || 'https://router.project-osrm.org';
const ALERT_RADIUS_KM = parseFloat(import.meta.env.VITE_ALERT_RADIUS_KM || '15');

// ---- Coordinate Validation ----
export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ---- Haversine distance (km) ----
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- Bearing calculation between two points (degrees 0-360) ----
export function calculateBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (toDeg(theta) + 360) % 360;
}

// ---- Route Step / Maneuver ----
export interface RouteStep {
  distanceMeters: number;
  durationSeconds: number;
  name: string;
  instruction: string;
  maneuverType: string;
  maneuverModifier?: string;
  location: [number, number]; // [lng, lat]
  geometry?: [number, number][];
}

// ---- Route option ----
export interface RouteOption {
  id: 'safest' | 'balanced' | 'fastest';
  label: string;
  distanceKm: number;
  durationMins: number;
  safetyScore: number;       // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  incidentsOnRoute: AppIncident[];
  geometry: [number, number][]; // [lng, lat] pairs (GeoJSON order)
  steps: RouteStep[];
  roadCondition: string;
  notes: string;
}

// ---- Check proximity to hazards ----
export function checkProximityToHazards(
  driverLat: number,
  driverLng: number,
  incidents: AppIncident[],
  radiusKm: number = ALERT_RADIUS_KM,
): AppIncident[] {
  return incidents.filter((inc) => {
    if (!inc.lat || !inc.lng) return false;
    const dist = haversineDistance(driverLat, driverLng, inc.lat, inc.lng);
    return dist <= radiusKm;
  });
}

// ---- Sample points along a geometry to check route-incident proximity ----
function routeIntersectsIncidents(
  geometry: [number, number][],
  incidents: AppIncident[],
  radiusKm: number = 10,
): AppIncident[] {
  const found = new Set<AppIncident>();
  const step = Math.max(1, Math.floor(geometry.length / 25));
  for (let i = 0; i < geometry.length; i += step) {
    const [lng, lat] = geometry[i];
    for (const inc of incidents) {
      if (!inc.lat || !inc.lng || found.has(inc)) continue;
      const dist = haversineDistance(lat, lng, inc.lat, inc.lng);
      if (dist <= radiusKm) found.add(inc);
    }
  }
  return Array.from(found);
}

// ---- Compute safety score from incidents ----
function computeSafetyScore(incidents: AppIncident[]): number {
  if (incidents.length === 0) return 98;
  let penalty = 0;
  for (const inc of incidents) {
    switch (inc.severity) {
      case 'high':   penalty += 30; break;
      case 'medium': penalty += 18; break;
      case 'low':    penalty += 8;  break;
    }
  }
  return Math.max(10, 100 - penalty);
}

function scoreToRiskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 75) return 'low';
  if (score >= 45) return 'medium';
  return 'high';
}

// ---- Generate human-readable instruction from OSRM step ----
export function formatManeuverInstruction(
  maneuver: { type: string; modifier?: string },
  roadName: string
): string {
  const name = roadName.trim() ? roadName.trim() : 'the road';
  const type = maneuver.type;
  const mod = maneuver.modifier || '';

  if (type === 'depart') return `Head out on ${name}`;
  if (type === 'arrive') return 'Arrive at your destination';

  if (type === 'turn') {
    if (mod === 'left') return `Turn left onto ${name}`;
    if (mod === 'right') return `Turn right onto ${name}`;
    if (mod === 'slight left') return `Slight left onto ${name}`;
    if (mod === 'slight right') return `Slight right onto ${name}`;
    if (mod === 'sharp left') return `Sharp left onto ${name}`;
    if (mod === 'sharp right') return `Sharp right onto ${name}`;
    if (mod === 'uturn') return `Make a U-turn onto ${name}`;
    if (mod === 'straight') return `Continue straight onto ${name}`;
    return `Turn ${mod} onto ${name}`;
  }

  if (type === 'continue' || type === 'new name') {
    return `Continue on ${name}`;
  }

  if (type === 'fork') {
    return `Keep ${mod || 'straight'} at the fork onto ${name}`;
  }

  if (type === 'roundabout' || type === 'rotary') {
    return `Enter roundabout, take exit onto ${name}`;
  }

  if (type === 'merge') {
    return `Merge ${mod} onto ${name}`;
  }

  if (type === 'on ramp' || type === 'off ramp') {
    return `Take the ramp onto ${name}`;
  }

  if (type === 'end of road') {
    return `Turn ${mod || 'left'} at the end of the road onto ${name}`;
  }

  return `Continue onto ${name}`;
}

// ---- Multilingual turn-by-turn instruction translation ----
export function formatLocalizedInstruction(
  step: RouteStep,
  distanceMeters: number,
  langCode: string = 'en'
): string {
  const distStr = distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1)} km`
    : `${Math.round(distanceMeters)} m`;

  const road = step.name.trim() || '';
  const type = step.maneuverType;
  const mod = step.maneuverModifier || '';

  if (langCode === 'hi') {
    const distHi = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} किलोमीटर`
      : `${Math.round(distanceMeters)} मीटर`;

    if (type === 'arrive') return distanceMeters > 0 ? `${distHi} में गंतव्य पर पहुँचेंगे` : 'गंतव्य पर पहुँच गए';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distHi} में, ${road ? road + ' पर ' : ''}बाएँ मुड़ें` : `${road ? road + ' पर ' : ''}बाएँ मुड़ें`;
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distHi} में, ${road ? road + ' पर ' : ''}दाएँ मुड़ें` : `${road ? road + ' पर ' : ''}दाएँ मुड़ें`;
    }
    return distanceMeters > 0 ? `${distHi} में, ${road ? road + ' पर ' : ''}सीधे चलें` : `${road ? road + ' पर ' : ''}सीधे चलें`;
  }

  if (langCode === 'as') {
    const distAs = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} কিলোমিটাৰ`
      : `${Math.round(distanceMeters)} মিটাৰ`;

    if (type === 'arrive') return distanceMeters > 0 ? `${distAs}ত গন্তব্যস্থানত উপনীত হ'ব` : 'গন্তব্যস্থানত উপনীত হ\'ল';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distAs}ত, ${road ? road + 'লৈ ' : ''}বাওঁফালে ঘূৰক` : `${road ? road + 'লৈ ' : ''}বাওঁফালে ঘূৰক`;
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distAs}ত, ${road ? road + 'লৈ ' : ''}সোঁফালে ঘূৰক` : `${road ? road + 'লৈ ' : ''}সোঁফালে ঘূৰক`;
    }
    return distanceMeters > 0 ? `${distAs}ত, ${road ? road + 'ত ' : ''}পোনপটীয়া যাওক` : 'পোনপটীয়া যাওক';
  }

  if (langCode === 'bn') {
    const distBn = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} কিলোমিটার`
      : `${Math.round(distanceMeters)} মিটার`;

    if (type === 'arrive') return distanceMeters > 0 ? `${distBn} এ গন্তব্যে পৌঁছাবেন` : 'গন্তব্যে পৌঁছেছেন';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distBn} এ, ${road ? road + ' এ ' : ''}বাঁদিকে ঘুরুন` : 'বাঁদিকে ঘুরুন';
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distBn} এ, ${road ? road + ' এ ' : ''}ডানদিকে ঘুরুন` : 'ডানদিকে ঘুরুন';
    }
    return distanceMeters > 0 ? `${distBn} এ, সোজা চলুন` : 'সোজা চলুন';
  }

  if (langCode === 'ta') {
    const distTa = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} கி.மீ`
      : `${Math.round(distanceMeters)} மீட்டர்`;

    if (type === 'arrive') return 'இலக்கை அடைந்தீர்கள்';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distTa} இல் இடதுபுறம் திரும்பவும்` : 'இடதுபுறம் திரும்பவும்';
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distTa} இல் வலதுபுறம் திரும்பவும்` : 'வலதுபுறம் திரும்பவும்';
    }
    return distanceMeters > 0 ? `${distTa} இல் நேராக செல்லவும்` : 'நேராக செல்லவும்';
  }

  if (langCode === 'te') {
    const distTe = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} కి.మీ`
      : `${Math.round(distanceMeters)} మీటర్లు`;

    if (type === 'arrive') return 'గమ్యస్థానానికి చేరుకున్నారు';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distTe} లో ఎడమవైపు తిరగండి` : 'ఎడమవైపు తిరగండి';
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distTe} లో కుడివైపు తిరగండి` : 'కుడివైపు తిరగండి';
    }
    return distanceMeters > 0 ? `${distTe} లో నేరుగా వెళ్ళండి` : 'నేరుగా వెళ్ళండి';
  }

  if (langCode === 'mr') {
    const distMr = distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} किमी`
      : `${Math.round(distanceMeters)} मीटर`;

    if (type === 'arrive') return 'मुक्कामावर पोहोचलात';
    if (mod.includes('left')) {
      return distanceMeters > 0 ? `${distMr} मध्ये डावीकडे वळा` : 'डावीकडे वळा';
    }
    if (mod.includes('right')) {
      return distanceMeters > 0 ? `${distMr} मध्ये उजवीकडे वळा` : 'उजवीकडे वळा';
    }
    return distanceMeters > 0 ? `${distMr} मध्ये सरळ जा` : 'सरळ जा';
  }

  // Default: English
  if (distanceMeters > 0) {
    if (type === 'arrive') return `In ${distStr}, arrive at destination`;
    if (type === 'turn') return `In ${distStr}, turn ${mod || 'right'}${road ? ' onto ' + road : ''}`;
    if (type === 'fork') return `In ${distStr}, keep ${mod || 'straight'} at fork`;
    return `In ${distStr}, ${step.instruction}`;
  }

  return step.instruction;
}

// ---- Parse Raw OSRM Route to Structured Object ----
interface RawOSRMStep {
  distance: number;
  duration: number;
  name?: string;
  geometry?: { coordinates: [number, number][] };
  maneuver: {
    type: string;
    modifier?: string;
    location: [number, number];
  };
}

interface RawOSRMRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs?: { steps?: RawOSRMStep[] }[];
}

function parseOSRMRoute(raw: RawOSRMRoute): {
  distance: number;
  duration: number;
  geometry: [number, number][];
  steps: RouteStep[];
} {
  const steps: RouteStep[] = [];
  const rawSteps = raw.legs?.[0]?.steps || [];

  for (const s of rawSteps) {
    const name = s.name || '';
    const maneuverType = s.maneuver?.type || 'turn';
    const maneuverModifier = s.maneuver?.modifier;
    const location = s.maneuver?.location || [0, 0];
    const instruction = formatManeuverInstruction(
      { type: maneuverType, modifier: maneuverModifier },
      name
    );

    steps.push({
      distanceMeters: Math.round(s.distance || 0),
      durationSeconds: Math.round(s.duration || 0),
      name,
      instruction,
      maneuverType,
      maneuverModifier,
      location,
      geometry: s.geometry?.coordinates || [],
    });
  }

  // If no steps returned by OSRM, create start and end steps
  if (steps.length === 0 && raw.geometry.coordinates.length > 1) {
    const coords = raw.geometry.coordinates;
    steps.push({
      distanceMeters: Math.round(raw.distance),
      durationSeconds: Math.round(raw.duration),
      name: 'Main Route',
      instruction: 'Head towards destination',
      maneuverType: 'depart',
      location: coords[0],
      geometry: coords,
    });
    steps.push({
      distanceMeters: 0,
      durationSeconds: 0,
      name: 'Destination',
      instruction: 'Arrive at destination',
      maneuverType: 'arrive',
      location: coords[coords.length - 1],
    });
  }

  return {
    distance: raw.distance / 1000,          // metres → km
    duration: Math.round(raw.duration / 60), // seconds → mins
    geometry: raw.geometry.coordinates,
    steps,
  };
}

// ---- Safe Fetch with Timeout ----
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Routing service request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  }
}

// ---- Call OSRM for route alternatives with real road geometry & steps ----
async function fetchOSRMRoutes(
  pickupLng: number, pickupLat: number,
  dropLng: number, dropLat: number,
): Promise<{ distance: number; duration: number; geometry: [number, number][]; steps: RouteStep[] }[]> {
  const baseDirectUrl =
    `${OSRM_BASE}/route/v1/driving/` +
    `${pickupLng},${pickupLat};${dropLng},${dropLat}` +
    `?alternatives=true&geometries=geojson&overview=full&steps=true`;

  const resp = await fetchWithTimeout(baseDirectUrl, {}, 6000);
  if (!resp.ok) throw new Error(`OSRM routing service returned error: ${resp.status}`);
  const data = await resp.json();

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('No valid road route found between pickup and drop locations.');
  }

  const results = data.routes.map(parseOSRMRoute);

  // If OSRM returned fewer than 3 alternatives, query via-waypoint routes in parallel
  if (results.length < 3) {
    const midLat = (pickupLat + dropLat) / 2;
    const midLng = (pickupLng + dropLng) / 2;

    const viaUrls = [
      `${OSRM_BASE}/route/v1/driving/${pickupLng},${pickupLat};${midLng + 0.08},${midLat + 0.08};${dropLng},${dropLat}?geometries=geojson&overview=full&steps=true`,
      `${OSRM_BASE}/route/v1/driving/${pickupLng},${pickupLat};${midLng - 0.08},${midLat - 0.08};${dropLng},${dropLat}?geometries=geojson&overview=full&steps=true`,
    ];

    const altFetches = viaUrls.map(async (url) => {
      try {
        const r = await fetchWithTimeout(url, {}, 4000);
        if (r.ok) {
          const d = await r.json();
          if (d.code === 'Ok' && d.routes?.[0]) {
            return parseOSRMRoute(d.routes[0]);
          }
        }
      } catch {}
      return null;
    });

    const altResults = await Promise.allSettled(altFetches);
    altResults.forEach((res) => {
      if (res.status === 'fulfilled' && res.value && results.length < 3) {
        results.push(res.value);
      }
    });
  }

  return results;
}

// ---- Highway Corridor Fallback Route Generator ----
function generateFallbackRoutes(
  pickupLat: number, pickupLng: number,
  dropLat: number, dropLng: number,
): { distance: number; duration: number; geometry: [number, number][]; steps: RouteStep[] }[] {
  const directDistKm = haversineDistance(pickupLat, pickupLng, dropLat, dropLng);
  const roadFactor = 1.35;
  const baseDistance = Math.max(12, directDistKm * roadFactor);
  const baseDuration = Math.round((baseDistance / 42) * 60);

  const numPoints = Math.max(12, Math.min(40, Math.round(baseDistance / 2.5)));
  const variations = [
    { name: 'Primary National Highway Corridor', offsetLat: 0.015, offsetLng: 0.012, distMult: 1.0, durMult: 1.0 },
    { name: 'Valley Bypass Ridge Route', offsetLat: 0.045, offsetLng: 0.040, distMult: 1.08, durMult: 1.12 },
    { name: 'Low-Elevation Mountain Pass', offsetLat: -0.045, offsetLng: -0.040, distMult: 1.15, durMult: 1.20 }
  ];

  return variations.map((v, vIdx) => {
    const coords: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
      const frac = i / numPoints;
      const arc = Math.sin(frac * Math.PI) * v.offsetLat;
      const lat = pickupLat + (dropLat - pickupLat) * frac + arc;
      const lng = pickupLng + (dropLng - pickupLng) * frac + (arc * 0.75);
      coords.push([lng, lat]);
    }

    const steps: RouteStep[] = [
      {
        distanceMeters: Math.round((baseDistance * v.distMult * 0.25) * 1000),
        durationSeconds: Math.round((baseDuration * v.durMult * 0.25) * 60),
        name: 'Depot Dispatch Link',
        instruction: 'Depart from depot onto primary freight artery',
        maneuverType: 'depart',
        location: coords[0]
      },
      {
        distanceMeters: Math.round((baseDistance * v.distMult * 0.50) * 1000),
        durationSeconds: Math.round((baseDuration * v.durMult * 0.50) * 60),
        name: v.name,
        instruction: `Continue along ${v.name}`,
        maneuverType: 'straight',
        location: coords[Math.floor(coords.length / 2)]
      },
      {
        distanceMeters: Math.round((baseDistance * v.distMult * 0.25) * 1000),
        durationSeconds: Math.round((baseDuration * v.durMult * 0.25) * 60),
        name: 'Destination Hub Approach',
        instruction: 'Arrive at destination logistics hub',
        maneuverType: 'arrive',
        location: coords[coords.length - 1]
      }
    ];

    return {
      distance: baseDistance * v.distMult,
      duration: Math.round(baseDuration * v.durMult),
      geometry: coords,
      steps
    };
  });
}

// ---- Main: calculate route options with OSRM & fallback ----
export async function calculateRoutes(
  pickupLat: number, pickupLng: number,
  dropLat: number, dropLng: number,
  incidents: AppIncident[] = [],
): Promise<RouteOption[]> {
  // Validate coordinates first
  if (!isValidCoordinate(pickupLat, pickupLng)) {
    throw new Error('Invalid or missing pickup coordinates.');
  }
  if (!isValidCoordinate(dropLat, dropLng)) {
    throw new Error('Invalid or missing drop coordinates.');
  }

  let rawRoutes: { distance: number; duration: number; geometry: [number, number][]; steps: RouteStep[] }[] = [];

  try {
    rawRoutes = await fetchOSRMRoutes(pickupLng, pickupLat, dropLng, dropLat);
  } catch (osrmErr: any) {
    console.warn('[Routing] OSRM service returned error, activating terrain corridor fallback:', osrmErr);
    try {
      rawRoutes = generateFallbackRoutes(pickupLat, pickupLng, dropLat, dropLng);
    } catch {
      throw new Error(osrmErr?.message || 'Unable to calculate road route.');
    }
  }

  if (!rawRoutes || rawRoutes.length === 0) {
    rawRoutes = generateFallbackRoutes(pickupLat, pickupLng, dropLat, dropLng);
  }

  // Sort by safety/distance
  const labels: ('safest' | 'balanced' | 'fastest')[] = ['safest', 'balanced', 'fastest'];
  const labelNames = ['Safest Route', 'Balanced Route', 'Fastest Route'];

  const options: RouteOption[] = rawRoutes.slice(0, 3).map((r, i) => {
    const routeIncidents = routeIntersectsIncidents(r.geometry, incidents);
    const safetyScore = computeSafetyScore(routeIncidents);
    const riskLevel = scoreToRiskLevel(safetyScore);

    const roadConditionMap = {
      low: 'Clear roads — normal conditions',
      medium: 'Caution advised — active weather / hazards nearby',
      high: 'Dangerous conditions — multiple hazard zones reported',
    };
    const notesMap = {
      safest: 'Optimal route avoiding hazard zones',
      balanced: 'Good balance of distance, travel time, and safety',
      fastest: 'Direct path — monitor active road hazards',
    };

    return {
      id: labels[i] || 'balanced',
      label: labelNames[i] || `Route Option ${i + 1}`,
      distanceKm: Math.round(r.distance * 10) / 10,
      durationMins: r.duration,
      safetyScore,
      riskLevel,
      incidentsOnRoute: routeIncidents,
      geometry: r.geometry,
      steps: r.steps,
      roadCondition: roadConditionMap[riskLevel],
      notes: notesMap[labels[i]] || 'Standard highway route',
    };
  });

  // Ensure safest is sorted by safetyScore
  options.sort((a, b) => b.safetyScore - a.safetyScore);
  options.forEach((o, i) => {
    o.id = labels[i] || 'balanced';
    o.label = labelNames[i] || `Route Option ${i + 1}`;
  });

  return options;
}

// ---- Find safe halts near a location ----
export interface SafeHalt {
  id: string;
  name: string;
  type: 'truck_stop' | 'rest_area' | 'fuel_station' | 'hotel' | 'logistics_hub' | 'shelter' | 'other';
  lat: number;
  lng: number;
  distanceKm: number;
  riskLevel: 'low' | 'medium' | 'high';
  amenities: string[];
  address?: string;
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

export async function findSafeHalts(
  lat: number,
  lng: number,
  incidents: AppIncident[],
  radiusM: number = 30000,
): Promise<SafeHalt[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="fuel"](around:${radiusM},${lat},${lng});
      node["amenity"="rest_area"](around:${radiusM},${lat},${lng});
      node["highway"="services"](around:${radiusM},${lat},${lng});
      node["amenity"="hotel"](around:${radiusM},${lat},${lng});
      node["amenity"="motel"](around:${radiusM},${lat},${lng});
      node["amenity"="parking"]["access"="public"](around:${radiusM},${lat},${lng});
      node["hgv"="yes"](around:${radiusM},${lat},${lng});
    );
    out body;
  `;

  let halts: SafeHalt[] = [];

  try {
    const resp = await fetch(OVERPASS_API, {
      method: 'POST',
      body: query,
      headers: { 'Content-Type': 'text/plain' },
    });
    if (!resp.ok) throw new Error('Overpass API error');
    const data = await resp.json();

    halts = (data.elements || []).map((el: {
      id: number;
      lat: number;
      lon: number;
      tags?: Record<string, string>;
    }) => {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || 'Highway Rest Facility';
      const distKm = haversineDistance(lat, lng, el.lat, el.lon);
      const nearbyIncidents = checkProximityToHazards(el.lat, el.lon, incidents, 5);
      const risk = nearbyIncidents.length === 0 ? 'low'
        : nearbyIncidents.some(i => i.severity === 'high') ? 'high' : 'medium';

      let type: SafeHalt['type'] = 'other';
      if (tags.amenity === 'fuel') type = 'fuel_station';
      else if (tags.amenity === 'rest_area' || tags.highway === 'services') type = 'rest_area';
      else if (tags.amenity === 'hotel' || tags.amenity === 'motel') type = 'hotel';
      else if (tags.hgv) type = 'truck_stop';
      else if (tags.amenity === 'parking') type = 'rest_area';

      const amenities: string[] = [];
      if (tags.fuel) amenities.push('Fuel');
      if (tags.amenity === 'hotel' || tags.amenity === 'motel') amenities.push('Accommodation');
      if (tags.toilets || tags['toilets:disposal']) amenities.push('Toilets');
      if (tags.restaurant || tags.cafe) amenities.push('Food');
      if (tags.parking || tags.amenity === 'parking') amenities.push('Parking');

      return {
        id: String(el.id),
        name,
        type,
        lat: el.lat,
        lng: el.lon,
        distanceKm: Math.round(distKm * 10) / 10,
        riskLevel: risk,
        amenities,
        address: tags['addr:full'] || tags['addr:street'] || undefined,
      } satisfies SafeHalt;
    });

    halts.sort((a, b) => {
      const riskOrder = { low: 0, medium: 1, high: 2 };
      const riskDiff = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      return riskDiff !== 0 ? riskDiff : a.distanceKm - b.distanceKm;
    });

    return halts.slice(0, 12);
  } catch {
    return [
      {
        id: 'halt-1',
        name: 'Highway Rest Stop & Fuel',
        type: 'fuel_station',
        lat: lat + 0.05,
        lng: lng + 0.03,
        distanceKm: 6.2,
        riskLevel: 'low',
        amenities: ['Toilets', 'Parking', 'Food', 'Fuel'],
        address: 'National Highway Corridor',
      },
      {
        id: 'halt-2',
        name: 'Logistics Safe Parking Zone',
        type: 'truck_stop',
        lat: lat - 0.04,
        lng: lng + 0.06,
        distanceKm: 8.7,
        riskLevel: 'low',
        amenities: ['Parking', 'Security', 'Toilets'],
        address: 'State Logistics Hub Bypass',
      },
      {
        id: 'halt-3',
        name: 'Disaster Shelter & Relief Depot',
        type: 'shelter',
        lat: lat + 0.08,
        lng: lng - 0.02,
        distanceKm: 10.1,
        riskLevel: 'low',
        amenities: ['Shelter', 'First Aid', 'Food'],
        address: 'Emergency Response Point',
      },
    ];
  }
}

// ---- Format duration for display ----
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}
