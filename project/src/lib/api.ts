/**
 * Shared Backend API Client for Mobile / Driver App
 * Connects to the unified FastAPI backend (default: http://localhost:8000/api/v1)
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export interface BackendTrip {
  trip_id: string;
  trip_code?: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  commodity_type: string;
  package_details: string;
  driver_id: string;
  driver_name: string;
  driver_phone?: string;
  vehicle_id: string;
  vehicle_no: string;
  priority: string;
  status: string; // 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DRIVER_REJECTED', 'HALTED'
  assigned_route_id?: string;
  assigned_route_name?: string;
  distance_km?: number;
  duration_mins?: number;
  eta_display?: string;
  convlstm_risk_score?: number;
  risk_level?: string;
  instructions?: string;
  road_condition?: string;
  created_at: string;
  assigned_at?: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  current_lat?: number;
  current_lng?: number;
  progress_pct?: number;
  speed_kmh?: number;
  candidate_routes?: any[];
}

export async function fetchDriverTrips(driverId?: string, status?: string): Promise<BackendTrip[]> {
  try {
    const params = new URLSearchParams();
    if (driverId) params.append('driver_id', driverId);
    if (status) params.append('status', status);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/routes/trips${query}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data.trips || [];
  } catch (err) {
    console.warn('[API Client] fetchDriverTrips failed:', err);
    return [];
  }
}

export async function fetchTripDetails(tripId: string): Promise<BackendTrip | null> {
  try {
    const res = await fetch(`${API_BASE}/routes/trips/${encodeURIComponent(tripId)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.trip || null;
  } catch (err) {
    console.warn('[API Client] fetchTripDetails failed:', err);
    return null;
  }
}

export async function acceptTripBackend(
  tripId: string,
  driverId?: string,
  lat?: number,
  lng?: number
): Promise<{ success: boolean; trip?: BackendTrip; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/routes/trips/${encodeURIComponent(tripId)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: driverId,
        driver_lat: lat,
        driver_lng: lng,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Failed to accept trip' };
    }
    return { success: true, trip: data.trip };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to connect to server' };
  }
}

export async function startTripBackend(
  tripId: string,
  driverId?: string,
  lat?: number,
  lng?: number
): Promise<{ success: boolean; trip?: BackendTrip; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/routes/trips/${encodeURIComponent(tripId)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: driverId,
        driver_lat: lat,
        driver_lng: lng,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Failed to start trip' };
    }
    return { success: true, trip: data.trip };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to connect to server' };
  }
}

export async function completeTripBackend(
  tripId: string,
  driverId?: string
): Promise<{ success: boolean; trip?: BackendTrip; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/routes/trips/${encodeURIComponent(tripId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driver_id: driverId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.detail || 'Failed to complete trip' };
    }
    return { success: true, trip: data.trip };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unable to connect to server' };
  }
}

export async function updateTripLocationBackend(
  tripId: string,
  lat: number,
  lng: number,
  speedKmh = 40.0,
  progressPct = 0
): Promise<void> {
  try {
    await fetch(`${API_BASE}/routes/trips/${encodeURIComponent(tripId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat,
        lng,
        speed_kmh: speedKmh,
        progress_pct: progressPct,
      }),
    });
  } catch {
    // Non-blocking telemetry
  }
}
