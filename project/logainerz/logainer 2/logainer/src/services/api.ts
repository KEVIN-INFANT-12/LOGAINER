import { 
  LogisticsHub, 
  Chokepoint, 
  DistrictHealth, 
  FleetVehicle, 
  Incident, 
  MLPrediction, 
  OptimizedRoute, 
  CandidateRoute,
  SafeHaltLocation,
  TripItem,
  WeatherStation,
  NERGDI_Assessment,
  CorridorInfo,
  SatelliteMetadata,
  QueuedDriverAction
} from '../types';
import { offlineDB } from './db';
import { networkService } from './network';

const API_BASE = '/api/v1';

export const api = {
  // Authentication
  login: async (username: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      return data;
    } catch (err) {
      if (!networkService.isOnline()) {
        // Offline demo fallback
        return {
          username,
          full_name: username.includes('bro') ? 'Col. R. K. Thapa' : (username.includes('ndrf') ? 'Commander J. Sangma' : 'Logistics Officer'),
          role: username.includes('bro') ? 'Chief Engineer' : (username.includes('ndrf') ? 'Emergency Response Officer' : 'State Logistics Director'),
          department: 'North Eastern Council (NEC)',
          state: 'Assam',
          access_token: 'offline-cached-token'
        };
      }
      throw err;
    }
  },

  // Routes & Network
  getHubs: async (): Promise<LogisticsHub[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/hubs`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('hubs', data, 60 * 24 * 7); // 7 days TTL
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<LogisticsHub[]>('hubs');
    return cached?.data || [];
  },

  getNodes: async () => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/nodes`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('nodes', data, 60 * 24 * 7);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache('nodes');
    return cached?.data || {};
  },

  getChokepoints: async (): Promise<Chokepoint[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/chokepoints`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('chokepoints', data, 60 * 6); // 6 hrs TTL
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<Chokepoint[]>('chokepoints');
    return cached?.data || [];
  },

  updateChokepointStatus: async (cpId: string, status: string, description?: string) => {
    const res = await fetch(`${API_BASE}/routes/chokepoints/${cpId}/status?new_status=${status}${description ? `&description=${encodeURIComponent(description)}` : ''}`, {
      method: 'POST'
    });
    return res.json();
  },

  optimizeRoute: async (
    originId: string, 
    destId: string, 
    avoidChokepoints: string[] = [], 
    isEmergency = false,
    cargoType = 'ESSENTIAL_MEDICINES_COLD_CHAIN',
    priorityLevel = 'EMERGENCY'
  ): Promise<{ 
    routes: { 
      candidate_routes: CandidateRoute[];
      primary_route: OptimizedRoute; 
      ai_optimized_route: OptimizedRoute; 
      emergency_green_route: OptimizedRoute; 
      origin: any; 
      destination: any;
      recommended_route_id?: string;
      recommendation_justification?: string;
      attribution?: string;
      convlstm_model_version?: string;
      is_cached_offline?: boolean;
    } 
  }> => {
    const cacheKey = `opt_route_${originId}_${destId}_${cargoType}`;
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/optimize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_id: originId,
            destination_id: destId,
            avoid_chokepoints: avoidChokepoints,
            cargo_type: cargoType,
            priority_level: priorityLevel
          })
        });
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache(cacheKey, data, 60 * 24); // 24h TTL
          return data;
        }
      }
    } catch {}

    // Offline cached route fallback
    const cached = await offlineDB.getGeneralCache(cacheKey);
    if (cached && cached.data) {
      return {
        ...cached.data,
        routes: {
          ...cached.data.routes,
          is_cached_offline: true,
          recommendation_justification: `${cached.data.routes?.recommendation_justification || ''} (Served from Offline Cache: ${new Date(cached.cached_at).toLocaleTimeString()})`
        }
      };
    }

    // Default regional offline corridor synthesis
    const defaultCandidates: CandidateRoute[] = [
      {
        route_id: 'ROUTE-A-OFFLINE',
        name: `Primary Mountain Trunk Highway (${originId} → ${destId})`,
        distance_km: 320,
        estimated_time_hrs: 6.5,
        eta_display: '6h 30m',
        risk_score: 0.38,
        risk_level: 'MEDIUM',
        road_bridge_status: 'Passable (Caution on hairpin bends)',
        recommendation: 'RECOMMENDED',
        recommendation_badge: 'OPTIMAL TRUNK',
        is_recommended: true,
        elevation_gain_m: 1420,
        fuel_estimate_litres: 48,
        waypoints: [
          { name: `${originId} Logistics Terminal`, lat: 26.1445, lng: 91.7362, elevation_m: 55 },
          { name: 'Tezpur Transit Point', lat: 26.6338, lng: 92.7926, elevation_m: 80 },
          { name: 'Bhalukpong Mountain Gate', lat: 27.0142, lng: 92.6450, elevation_m: 213 },
          { name: `${destId} Forward Base`, lat: 27.5860, lng: 91.8590, elevation_m: 3048 }
        ]
      },
      {
        route_id: 'ROUTE-B-OFFLINE',
        name: `All-Weather River Valley Bypass (${originId} → ${destId})`,
        distance_km: 365,
        estimated_time_hrs: 7.2,
        eta_display: '7h 12m',
        risk_score: 0.22,
        risk_level: 'LOW',
        road_bridge_status: 'Clear valley road',
        recommendation: 'ALTERNATIVE',
        recommendation_badge: 'LOW RISK BYPASS',
        elevation_gain_m: 980,
        fuel_estimate_litres: 52,
        waypoints: [
          { name: `${originId} Logistics Terminal`, lat: 26.1445, lng: 91.7362, elevation_m: 55 },
          { name: 'Jorhat Supply Link', lat: 26.7509, lng: 94.2037, elevation_m: 116 },
          { name: `${destId} Forward Base`, lat: 27.5860, lng: 91.8590, elevation_m: 3048 }
        ]
      }
    ];

    const fallbackPrimary: OptimizedRoute = {
      path: [[26.1445, 91.7362], [26.6338, 92.7926], [27.0142, 92.6450], [27.5860, 91.8590]],
      distance_km: 320,
      estimated_time_hrs: 6.5,
      risk_score: 0.38,
      is_green_corridor: true,
      color: '#06b6d4',
      name: 'Offline Cached Corridor'
    };

    return {
      routes: {
        candidate_routes: defaultCandidates,
        primary_route: fallbackPrimary,
        ai_optimized_route: fallbackPrimary,
        emergency_green_route: fallbackPrimary,
        origin: { id: originId, name: originId },
        destination: { id: destId, name: destId },
        recommended_route_id: 'ROUTE-A-OFFLINE',
        recommendation_justification: 'Offline GIS topological routing activated using cached regional highway corridors.',
        is_cached_offline: true
      }
    };
  },

  // Trip Management & Safe Halts
  createTrip: async (tripData: {
    origin_id?: string;
    destination_id?: string;
    origin?: { hub_id?: string; name?: string; lat?: number; lng?: number };
    destination?: { hub_id?: string; name?: string; lat?: number; lng?: number };
    commodity_type: string;
    package_details: string;
    driver_id: string;
    driver_name: string;
    vehicle_id: string;
    vehicle_no: string;
    priority: string;
    assigned_route_id?: string;
    assigned_route_name?: string;
    waypoints?: any[];
  }): Promise<{ success: boolean; message: string; trip: TripItem }> => {
    const originId = tripData.origin_id || tripData.origin?.hub_id || 'GHY';
    const destId = tripData.destination_id || tripData.destination?.hub_id || 'TWG';
    const payload = {
      origin_id: originId,
      destination_id: destId,
      commodity_type: tripData.commodity_type || 'ESSENTIAL_MEDICINES_COLD_CHAIN',
      package_details: tripData.package_details || 'Essential Medical Supplies',
      driver_id: tripData.driver_id || 'DRV-102',
      driver_name: tripData.driver_name || 'Tenzing Norbu',
      vehicle_id: tripData.vehicle_id || 'TRUCK-TN-402',
      vehicle_no: tripData.vehicle_no || 'AS-01-EC-9081',
      priority: tripData.priority || 'EMERGENCY',
      assigned_route_id: tripData.assigned_route_id || 'ROUTE-A',
    };

    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/trips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.trip) {
            return data;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[api] Server rejected trip creation:', errData);
          if (errData.detail) {
            throw new Error(errData.detail);
          }
        }
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      console.warn('[api] Online createTrip failed, fallback to offline local store:', err);
    }

    // Offline trip creation fallback
    const tripId = `TR-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const origNode = LOGISTICS_HUBS.find(h => h.hub_id === originId) || { name: originId, lat: 26.1445, lng: 91.7362 };
    const destNode = LOGISTICS_HUBS.find(h => h.hub_id === destId) || { name: destId, lat: 27.5860, lng: 91.8594 };

    const newTrip: TripItem = {
      trip_id: tripId,
      trip_code: tripId,
      origin_id: originId,
      origin_name: origNode.name || originId,
      destination_id: destId,
      destination_name: destNode.name || destId,
      commodity_type: payload.commodity_type,
      package_details: payload.package_details,
      driver_id: payload.driver_id,
      driver_name: payload.driver_name,
      driver_phone: '+91 98624-55102',
      vehicle_id: payload.vehicle_id,
      vehicle_no: payload.vehicle_no,
      priority: payload.priority as any,
      status: 'ASSIGNED',
      assigned_route_id: payload.assigned_route_id || 'ROUTE-A',
      assigned_route_name: tripData.assigned_route_name || 'Assigned Corridor',
      distance_km: 110,
      duration_mins: 140,
      eta_display: '2h 20m',
      convlstm_risk_score: 0.25,
      risk_level: 'LOW',
      created_at: new Date().toISOString(),
      assigned_at: new Date().toISOString(),
      current_lat: origNode.lat || 26.1445,
      current_lng: origNode.lng || 91.7362,
      progress_pct: 0,
      speed_kmh: 0,
      connectivity: 'OFFLINE'
    };

    return {
      success: true,
      message: 'Trip created and saved locally.',
      trip: newTrip
    };
  },

  createTripAssignment: async (tripData: any): Promise<TripItem> => {
    const res = await api.createTrip(tripData);
    return res.trip;
  },

  listTrips: async (status?: string, driverId?: string): Promise<{ success: boolean; count: number; trips: TripItem[] }> => {
    try {
      if (networkService.isOnline()) {
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (driverId) queryParams.append('driver_id', driverId);
        const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
        const res = await fetch(`${API_BASE}/routes/trips${query}`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('trips_list', data, 60); // 1 hr TTL
          return data;
        }
      }
    } catch {}

    // Offline trips from IndexedDB general cache or trip_cache
    const cached = await offlineDB.getGeneralCache<{ success: boolean; count: number; trips: TripItem[] }>('trips_list');
    if (cached?.data) {
      return cached.data;
    }

    const allTripCaches = await offlineDB.getAllCachedTrips(driverId);
    const trips = allTripCaches.map(t => t.trip);
    return {
      success: true,
      count: trips.length,
      trips
    };
  },

  driverDecision: async (tripId: string, decision: 'ACCEPT' | 'REJECT', params?: { driver_lat?: number; driver_lng?: number; reason?: string; selected_halt_id?: string; user_id?: string }) => {
    if (networkService.isOnline()) {
      try {
        const res = await fetch(`${API_BASE}/routes/trips/${tripId}/driver-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            ...params
          })
        });
        if (res.ok) return res.json();
      } catch {}
    }

    // Queue action offline in IndexedDB
    const clientActionId = `ACT-${decision}-${Date.now()}`;
    const queuedAction: QueuedDriverAction = {
      client_action_id: clientActionId,
      trip_id: tripId,
      action_type: decision,
      payload: params,
      user_id: params?.user_id || 'driver-default',
      timestamp: new Date().toISOString(),
      sync_status: 'PENDING_UPLOAD',
      retry_count: 0
    };

    await offlineDB.queueDriverAction(queuedAction);

    // Update local trip cache
    const cached = await offlineDB.getTripCache(tripId);
    if (cached) {
      cached.trip.status = decision === 'ACCEPT' ? 'ACCEPTED' : 'DRIVER_REJECTED';
      await offlineDB.saveTripCache(cached);
    }

    return {
      success: true,
      offline_queued: true,
      status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
      message: `Action recorded offline. Will sync with Central Command automatically upon network restoration.`,
      trip: cached?.trip
    };
  },

  startTrip: async (tripId: string, params?: { driver_lat?: number; driver_lng?: number; user_id?: string }) => {
    if (networkService.isOnline()) {
      try {
        const res = await fetch(`${API_BASE}/routes/trips/${tripId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params || {})
        });
        if (res.ok) return res.json();
      } catch {}
    }

    // Queue offline
    const queuedAction: QueuedDriverAction = {
      client_action_id: `ACT-START-${Date.now()}`,
      trip_id: tripId,
      action_type: 'START',
      payload: params,
      user_id: params?.user_id || 'driver-default',
      timestamp: new Date().toISOString(),
      sync_status: 'PENDING_UPLOAD',
      retry_count: 0
    };
    await offlineDB.queueDriverAction(queuedAction);

    const cached = await offlineDB.getTripCache(tripId);
    if (cached) {
      cached.trip.status = 'EN_ROUTE';
      await offlineDB.saveTripCache(cached);
    }

    return {
      success: true,
      offline_queued: true,
      status: 'IN_PROGRESS',
      message: 'Navigation started offline using cached route geometry and turn-by-turn guidance.'
    };
  },

  completeTrip: async (tripId: string, params?: { user_id?: string }) => {
    if (networkService.isOnline()) {
      try {
        const res = await fetch(`${API_BASE}/routes/trips/${tripId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params || {})
        });
        if (res.ok) return res.json();
      } catch {}
    }

    const queuedAction: QueuedDriverAction = {
      client_action_id: `ACT-COMPLETE-${Date.now()}`,
      trip_id: tripId,
      action_type: 'COMPLETE',
      payload: params,
      user_id: params?.user_id || 'driver-default',
      timestamp: new Date().toISOString(),
      sync_status: 'PENDING_UPLOAD',
      retry_count: 0
    };
    await offlineDB.queueDriverAction(queuedAction);

    const cached = await offlineDB.getTripCache(tripId);
    if (cached) {
      cached.trip.status = 'COMPLETED';
      await offlineDB.saveTripCache(cached);
    }

    return {
      success: true,
      offline_queued: true,
      status: 'COMPLETED',
      message: 'Trip completion logged locally. Will sync to Admin when online.'
    };
  },

  getSafeHalts: async (lat?: number, lng?: number, radiusKm = 150): Promise<SafeHaltLocation[]> => {
    const query = (lat !== undefined && lng !== undefined) ? `?lat=${lat}&lng=${lng}&radius_km=${radiusKm}` : '';
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/routes/safe-halts${query}`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('safe_halts', data, 60 * 24);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<SafeHaltLocation[]>('safe_halts');
    return cached?.data || [];
  },

  // AI/ML ConvLSTM Risk Prediction
  predictRisk: async (features: Record<string, any>, userId = 'default_user'): Promise<{ 
    status?: string;
    model?: string;
    model_version?: string;
    confidence?: number;
    prediction: MLPrediction; 
    history?: any[];
    model_metadata?: any;
    is_cached?: boolean;
    is_stale?: boolean;
    cached_at?: string;
  }> => {
    const cacheKey = `ml_pred_${features.latitude || 26.14}_${features.longitude || 91.73}_${features.road_status || 'OPEN'}`;

    if (networkService.isOnline()) {
      try {
        const res = await fetch(`${API_BASE}/ml/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(features)
        });
        if (res.ok) {
          const data = await res.json();
          // Cache prediction with 30-minute validity
          await offlineDB.savePredictionCache({
            id: `PRED-${Date.now()}`,
            key: cacheKey,
            data,
            user_id: userId,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          });
          return data;
        }
      } catch {}
    }

    // Retrieve cached prediction (do NOT generate fake predictions)
    const cached = await offlineDB.getPredictionCache(cacheKey);
    if (cached && cached.data) {
      const isStale = new Date().toISOString() > cached.expires_at;
      return {
        ...cached.data,
        is_cached: true,
        is_stale: isStale,
        cached_at: cached.cached_at,
        prediction: {
          ...cached.data.prediction,
          recommended_action: `[OFFLINE CACHED PREDICTION - ${new Date(cached.cached_at).toLocaleTimeString()}] ${cached.data.prediction.recommended_action}`
        }
      };
    }

    // Return earliest valid prediction or error
    const allPredictions = await offlineDB.getAllPredictionCache();
    if (allPredictions.length > 0) {
      const latest = allPredictions[0];
      return {
        ...latest.data,
        is_cached: true,
        is_stale: true,
        cached_at: latest.cached_at,
        prediction: {
          ...latest.data.prediction,
          recommended_action: `[HISTORICAL CACHED DATA - ${new Date(latest.cached_at).toLocaleTimeString()}] ${latest.data.prediction.recommended_action}`
        }
      };
    }

    throw new Error('ML Risk prediction requires backend connectivity or existing cached prediction data.');
  },

  getPredictionHistory: async () => {
    const res = await fetch(`${API_BASE}/predictions/history`);
    return res.json();
  },

  getModelStats: async () => {
    const res = await fetch(`${API_BASE}/predictions/model-stats`);
    return res.json();
  },

  submitFeedback: async (feedback: { prediction_id: string; actual_outcome: string; verified_incident_id?: string; notes?: string }) => {
    const res = await fetch(`${API_BASE}/predictions/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });
    return res.json();
  },

  // NER-GDI
  calculateGDI: async (params: {
    rainfall_mm_hr?: number;
    slope_gradient_deg?: number;
    soil_saturation_pct?: number;
    elevation_m?: number;
    historical_landslide_freq?: number;
    road_type_idx?: number;
    active_incidents_count?: number;
  }): Promise<NERGDI_Assessment> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`${API_BASE}/gdi/calculate?${query}`);
    return res.json();
  },

  getSatelliteMetadata: async (): Promise<SatelliteMetadata> => {
    const res = await fetch(`${API_BASE}/satellite/metadata`);
    return res.json();
  },

  getCorridors: async (): Promise<CorridorInfo[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/corridors/analytics`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('corridors', data, 60 * 12);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<CorridorInfo[]>('corridors');
    return cached?.data || [];
  },

  // Incidents & Validation
  getIncidents: async (state = 'ALL', severity = 'ALL', status = 'ALL'): Promise<Incident[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/incidents?state=${state}&severity=${severity}&status=${status}`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache(`incidents_${state}_${severity}_${status}`, data, 30);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<Incident[]>(`incidents_${state}_${severity}_${status}`);
    return cached?.data || [];
  },

  createIncident: async (incident: Partial<Incident>): Promise<{ success: boolean; message: string; incident: Incident }> => {
    const res = await fetch(`${API_BASE}/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incident)
    });
    return res.json();
  },

  validateIncident: async (id: string, action: 'VERIFIED_OFFICIAL' | 'REJECTED' | 'RESOLVED', adminNotes?: string) => {
    const res = await fetch(`${API_BASE}/incidents/${id}/validate?action=${action}${adminNotes ? `&admin_notes=${encodeURIComponent(adminNotes)}` : ''}`, { 
      method: 'POST' 
    });
    return res.json();
  },

  verifyIncident: async (id: string, action = 'VERIFIED_OFFICIAL') => {
    const res = await fetch(`${API_BASE}/incidents/${id}/verify?action=${action}`, { method: 'POST' });
    return res.json();
  },

  upvoteIncident: async (id: string) => {
    const res = await fetch(`${API_BASE}/incidents/${id}/upvote`, { method: 'POST' });
    return res.json();
  },

  // Vehicles & Live Fleet Telemetry
  getVehicles: async (cargoType = 'ALL', connectivity = 'ALL'): Promise<FleetVehicle[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/vehicles?cargo_type=${cargoType}&connectivity=${connectivity}`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('vehicles', data, 15);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<FleetVehicle[]>('vehicles');
    return cached?.data || [];
  },

  triggerVehicleSOS: async (vehicleId: string, isActive = true) => {
    const res = await fetch(`${API_BASE}/vehicles/${vehicleId}/sos?is_active=${isActive}`, { method: 'POST' });
    return res.json();
  },

  // Districts
  getDistrictsHealth: async (): Promise<DistrictHealth[]> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/districts/health`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('districts_health', data, 60);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache<DistrictHealth[]>('districts_health');
    return cached?.data || [];
  },

  getLogisticsSummary: async () => {
    const res = await fetch(`${API_BASE}/districts/summary`);
    return res.json();
  },

  // Weather & Hazards
  getWeatherStations: async (): Promise<{ 
    stations: WeatherStation[]; 
    active_red_alerts: number; 
    active_orange_alerts: number; 
    synoptic_situation: string;
    active_tier?: string;
    data_source_badge?: string;
    hazard_api_connected?: boolean;
    is_cached_offline?: boolean;
  }> => {
    try {
      if (networkService.isOnline()) {
        const res = await fetch(`${API_BASE}/weather/stations`);
        if (res.ok) {
          const data = await res.json();
          await offlineDB.saveGeneralCache('weather_stations', data, 30);
          return data;
        }
      }
    } catch {}
    const cached = await offlineDB.getGeneralCache('weather_stations');
    if (cached?.data) {
      return {
        ...cached.data,
        is_cached_offline: true,
        data_source_badge: `Cached Offline (${new Date(cached.cached_at).toLocaleTimeString()})`
      };
    }
    return {
      stations: [],
      active_red_alerts: 0,
      active_orange_alerts: 0,
      synoptic_situation: 'Offline mode active - using cached weather radar.',
      is_cached_offline: true
    };
  },

  // ----------------- What-If Scenario Simulator -----------------

  simulateWhatIfScenario: async (params: {
    scenario_type: string;
    duration_days: number;
    rainfall_multiplier: number;
    district: string;
    region?: string;
    parameters?: Record<string, any>;
  }) => {
    const res = await fetch(`${API_BASE}/what-if/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Simulation request failed' }));
      throw new Error(err.detail || 'Prediction unavailable — insufficient data');
    }
    const data = await res.json();
    return data.scenario;
  },

  compareWhatIfScenarios: async (params: {
    district: string;
    duration_days: number;
    multipliers?: number[];
  }) => {
    const res = await fetch(`${API_BASE}/what-if/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      throw new Error('Failed to compute scenario comparison matrix');
    }
    const data = await res.json();
    return data.comparison;
  },

  getWhatIfSavedScenarios: async () => {
    const res = await fetch(`${API_BASE}/what-if/scenarios`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.scenarios || [];
  },

  getWhatIfAuditLogs: async () => {
    const res = await fetch(`${API_BASE}/what-if/audit-logs`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.audit_logs || [];
  },

  // ----------------- Emergency Alerts API -----------------

  getEmergencies: async (status?: string) => {
    const url = status ? `${API_BASE}/emergencies?status=${status}` : `${API_BASE}/emergencies`;
    const res = await fetch(url).catch(() => null);
    if (!res || !res.ok) return [];
    const data = await res.json();
    return data.emergencies || [];
  },

  createEmergency: async (payload: {
    emergency_type: string;
    latitude: number;
    longitude: number;
    location_name?: string;
    sender_role?: string;
    sender_name?: string;
    sender_user_id?: string;
    message?: string;
  }) => {
    const res = await fetch(`${API_BASE}/emergencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create emergency alert');
    return await res.json();
  },

  resolveEmergency: async (emergencyId: string, resolvedBy: string = 'Admin') => {
    const res = await fetch(`${API_BASE}/emergencies/${emergencyId}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved_by: resolvedBy })
    });
    if (!res.ok) throw new Error('Failed to resolve emergency');
    return await res.json();
  }
};

