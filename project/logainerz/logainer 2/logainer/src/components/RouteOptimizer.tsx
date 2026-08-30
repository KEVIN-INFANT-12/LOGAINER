import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Package,
  Layers,
  Activity,
  Truck,
  UserCheck,
  Fuel,
  XCircle,
  Building,
  Radio,
  Send,
  Eye,
  Play,
  Check,
  WifiOff,
  Wifi,
  Database
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { wsClient } from '../services/websocket';
import { api } from '../services/api';
import { offlineDB } from '../services/db';
import { networkService } from '../services/network';
import { CandidateRoute, SafeHaltLocation, TripItem, TurnInstruction, DriverTripCache } from '../types';

export const RouteOptimizer: React.FC = () => {
  const { hubs, chokepoints, setActiveRouteResult, addToast, isOnline } = useLogistics();
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // Route Query State
  const [originId, setOriginId] = useState<string>('GHY');
  const [destId, setDestId] = useState<string>('TWG');
  const [commodityType, setCommodityType] = useState<string>('ESSENTIAL_MEDICINES');
  const [packageDetails, setPackageDetails] = useState<string>('1000 Units Emergency Vaccine Cold Packs');
  const [driverId, setDriverId] = useState<string>('DRV-102');
  const [driverName, setDriverName] = useState<string>('Driver 102 (Tenzing Norbu)');
  const [vehicleId, setVehicleId] = useState<string>('TRUCK-TN-402');
  const [vehicleNo, setVehicleNo] = useState<string>('Truck TN-XX-XXXX');
  const [priorityLevel, setPriorityLevel] = useState<'NORMAL' | 'HIGH' | 'EMERGENCY'>('EMERGENCY');
  const [avoidChokepoints, setAvoidChokepoints] = useState<string[]>(['CP-01', 'CP-02']);
  
  const [isComputing, setIsComputing] = useState<boolean>(false);
  const [candidateRoutes, setCandidateRoutes] = useState<CandidateRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('ROUTE-B');
  const [recommendationJustification, setRecommendationJustification] = useState<string>('');
  
  // Trip & Driver Flow State
  const [activeTrip, setActiveTrip] = useState<TripItem | null>(null);
  const [isCreatingTrip, setIsCreatingTrip] = useState<boolean>(false);
  const [driverStatus, setDriverStatus] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED'>('PENDING');
  const [safeHalts, setSafeHalts] = useState<SafeHaltLocation[]>([]);
  const [selectedHalt, setSelectedHalt] = useState<SafeHaltLocation | null>(null);
  const [turnInstructions, setTurnInstructions] = useState<TurnInstruction[]>([]);
  const [isNavigatingOffline, setIsNavigatingOffline] = useState<boolean>(false);
  const [cachedAtTimestamp, setCachedAtTimestamp] = useState<string | null>(null);

  // Turn-by-turn generator helper from waypoints
  const generateTurnSteps = useCallback((route: CandidateRoute): TurnInstruction[] => {
    if (!route || !route.waypoints || route.waypoints.length === 0) {
      return [
        { step: 1, instruction: `Depart from origin hub`, distance_km: 0, eta_mins: 0 },
        { step: 2, instruction: `Follow designated mountain trunk highway`, distance_km: route.distance_km * 0.5, eta_mins: route.estimated_time_hrs * 30 },
        { step: 3, instruction: `Arrive safely at destination warehouse`, distance_km: route.distance_km, eta_mins: route.estimated_time_hrs * 60 }
      ];
    }

    return route.waypoints.map((wp, idx) => {
      const dist = Math.round((idx / (route.waypoints.length - 1 || 1)) * route.distance_km);
      const eta = Math.round((idx / (route.waypoints.length - 1 || 1)) * route.estimated_time_hrs * 60);
      let text = `Continue past ${wp.name} (${wp.district || 'Corridor'})`;
      if (idx === 0) text = `Depart from ${wp.name}`;
      else if (idx === route.waypoints.length - 1) text = `Arrive at destination: ${wp.name}`;
      else if (idx === 1) text = `Ascend mountain pass via ${wp.name} [Elevation: ${wp.elevation_m}m]`;
      return {
        step: idx + 1,
        instruction: text,
        distance_km: dist,
        eta_mins: eta,
        road_name: wp.name
      };
    });
  }, []);

  // Save Trip to IndexedDB Cache
  const persistTripToCache = useCallback(async (trip: TripItem, routes: CandidateRoute[], selectedId: string, halts: SafeHaltLocation[]) => {
    const selected = routes.find(r => r.route_id === selectedId) || routes[0];
    const steps = selected ? generateTurnSteps(selected) : [];
    setTurnInstructions(steps);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours validity

    const cacheRecord: DriverTripCache = {
      trip,
      candidate_routes: routes,
      selected_route_id: selectedId,
      safe_halts: halts,
      turn_instructions: steps,
      language_code: language,
      disaster_alerts: [],
      cached_at: now,
      expires_at: expiresAt,
      user_id: user?.username || 'driver-default'
    };

    try {
      await offlineDB.saveTripCache(cacheRecord);
      setCachedAtTimestamp(now);
    } catch (e) {
      console.warn('[RouteOptimizer] Could not write trip to IndexedDB:', e);
    }
  }, [generateTurnSteps, language, user]);

  const handleComputeRoutes = async () => {
    if (originId === destId) {
      addToast('WARNING', 'Invalid Destination', 'Origin and Destination logistics hubs cannot be identical.');
      return;
    }

    setIsComputing(true);
    try {
      const res = await api.optimizeRoute(
        originId, 
        destId, 
        avoidChokepoints, 
        priorityLevel === 'EMERGENCY',
        commodityType,
        priorityLevel
      );
      
      const routes = res.routes;
      if (routes && routes.candidate_routes) {
        setCandidateRoutes(routes.candidate_routes);
        const best = routes.candidate_routes.find(r => r.is_recommended) || routes.candidate_routes[0];
        if (best) {
          setSelectedRouteId(best.route_id);
          setTurnInstructions(generateTurnSteps(best));
        }
        setRecommendationJustification(routes.recommendation_justification || '');
        setActiveRouteResult(routes);
        addToast('SUCCESS', 'Candidate Routes Ready', res.routes?.is_cached_offline ? 'Loaded route from persistent offline storage.' : 'ConvLSTM model computed 3 feasible corridors.');
      }
    } catch (e: any) {
      // Offline fallback: try loading from IndexedDB
      const cachedTrips = await offlineDB.getAllCachedTrips(user?.username);
      if (cachedTrips.length > 0) {
        const c = cachedTrips[0];
        setCandidateRoutes(c.candidate_routes);
        setSelectedRouteId(c.selected_route_id);
        setTurnInstructions(c.turn_instructions);
        setActiveTrip(c.trip);
        setCachedAtTimestamp(c.cached_at);
        addToast('INFO', 'Loaded Offline Trip Cache', 'Showing previously cached trip route and turn-by-turn guidance.');
      } else {
        addToast('CRITICAL', 'Computation Error', e.message || 'Failed to compute candidate routes.');
      }
    } finally {
      setIsComputing(false);
    }
  };

  const handleCreateAndAssignTrip = async () => {
    setIsCreatingTrip(true);
    try {
      const res = await api.createTrip({
        origin_id: originId,
        destination_id: destId,
        commodity_type: commodityType,
        package_details: packageDetails,
        driver_id: driverId,
        driver_name: driverName,
        vehicle_id: vehicleId,
        vehicle_no: vehicleNo,
        priority: priorityLevel,
        assigned_route_id: selectedRouteId
      });

      if (res && res.trip) {
        setActiveTrip(res.trip);
        setDriverStatus('PENDING');
        setSafeHalts([]);
        setSelectedHalt(null);
        
        // Persist trip to offline IndexedDB immediately
        await persistTripToCache(res.trip, candidateRoutes, selectedRouteId, []);
        addToast('SUCCESS', 'Trip Created & Cached', `Trip ${res.trip.trip_id} assigned to ${driverName}. Cached for offline navigation.`);
      }
    } catch (e: any) {
      addToast('CRITICAL', 'Trip Creation Failed', e.message || 'Unable to create trip.');
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const handleSimulateDriverDecision = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!activeTrip) return;
    try {
      const res = await api.driverDecision(activeTrip.trip_id, decision, {
        driver_lat: 26.8500,
        driver_lng: 92.6500,
        reason: decision === 'REJECT' ? 'Severe rainfall & active rockfall hazard observed on ascent' : undefined,
        user_id: user?.username || 'driver-default'
      });

      if (decision === 'ACCEPT') {
        setDriverStatus('ACCEPTED');
        const updated = res.trip || { ...activeTrip, status: 'ACCEPTED' as const };
        setActiveTrip(updated);
        await persistTripToCache(updated, candidateRoutes, selectedRouteId, safeHalts);
        addToast('SUCCESS', res.offline_queued ? 'Driver Accepted (Queued Offline)' : 'Driver Accepted Route', 'Navigation started. Live GPS tracking active on Admin Fleet Console.');
      } else {
        setDriverStatus('REJECTED');
        const updated = res.trip || { ...activeTrip, status: 'DRIVER_REJECTED' as const };
        setActiveTrip(updated);
        setSafeHalts(res.safe_halt_locations || []);
        await persistTripToCache(updated, candidateRoutes, selectedRouteId, res.safe_halt_locations || []);
        addToast('WARNING', 'Driver Rejected Suggested Route', 'Displaying nearby certified safe halt locations for driver selection.');
      }
    } catch (e: any) {
      addToast('ERROR', 'Driver Action Failed', e.message || 'Unable to update driver response.');
    }
  };

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    try {
      const res = await api.startTrip(activeTrip.trip_id, {
        driver_lat: 26.1445,
        driver_lng: 91.7362,
        user_id: user?.username || 'driver-default'
      });
      setDriverStatus('IN_PROGRESS');
      setIsNavigatingOffline(true);
      const updated: TripItem = { ...activeTrip, status: 'EN_ROUTE', progress_pct: 10, speed_kmh: 45 };
      setActiveTrip(updated);
      await persistTripToCache(updated, candidateRoutes, selectedRouteId, safeHalts);
      addToast('SUCCESS', res.offline_queued ? 'Trip Started (Queued Offline)' : 'Trip Started', 'Vehicle simulation & offline navigation guidance active.');
    } catch (err: any) {
      addToast('ERROR', 'Failed to start trip', err.message);
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    try {
      const res = await api.completeTrip(activeTrip.trip_id, {
        user_id: user?.username || 'driver-default'
      });
      setDriverStatus('COMPLETED');
      setIsNavigatingOffline(false);
      const updated: TripItem = { ...activeTrip, status: 'COMPLETED', progress_pct: 100, speed_kmh: 0 };
      setActiveTrip(updated);
      await persistTripToCache(updated, candidateRoutes, selectedRouteId, safeHalts);
      addToast('SUCCESS', res.offline_queued ? 'Trip Completed (Queued Offline)' : 'Trip Completed', 'Delivery confirmed. Status synchronized to Central Command.');
    } catch (err: any) {
      addToast('ERROR', 'Failed to complete trip', err.message);
    }
  };

  const handleSelectHalt = (halt: SafeHaltLocation) => {
    setSelectedHalt(halt);
    addToast('INFO', 'Safe Halt Confirmed', `Driver routed to secure halt: ${halt.name} (${halt.district}).`);
  };

  // Initial load and periodic background trip caching (every 30s)
  useEffect(() => {
    handleComputeRoutes();

    // Check if there is an active cached trip in IndexedDB for this user
    offlineDB.getActiveDriverTrip(user?.username || 'driver-default').then(cached => {
      if (cached) {
        setActiveTrip(cached.trip);
        setCandidateRoutes(cached.candidate_routes);
        setSelectedRouteId(cached.selected_route_id);
        setTurnInstructions(cached.turn_instructions);
        setSafeHalts(cached.safe_halts);
        setCachedAtTimestamp(cached.cached_at);
        if (cached.trip.status === 'ACCEPTED' || cached.trip.status === 'EN_ROUTE') {
          setDriverStatus('ACCEPTED');
        } else if (cached.trip.status === 'COMPLETED') {
          setDriverStatus('COMPLETED');
        } else if (cached.trip.status === 'DRIVER_REJECTED') {
          setDriverStatus('REJECTED');
        }
      }
    });

    // Periodic cache refresh interval while online
    const cacheInterval = setInterval(() => {
      if (networkService.isOnline() && activeTrip && candidateRoutes.length > 0) {
        persistTripToCache(activeTrip, candidateRoutes, selectedRouteId, safeHalts);
      }
    }, 30000);

    const unsubscribe = wsClient.subscribe((payload) => {
      if (payload.type === 'TRIP_STATUS_UPDATE' && payload.trip) {
        if (payload.status === 'ACCEPTED' || payload.status === 'IN_PROGRESS' || payload.status === 'COMPLETED') {
          setActiveTrip(payload.trip);
          if (payload.status === 'ACCEPTED') setDriverStatus('ACCEPTED');
          else if (payload.status === 'COMPLETED') setDriverStatus('COMPLETED');
        } else if (payload.status === 'DRIVER_REJECTED') {
          setActiveTrip(payload.trip);
          setDriverStatus('REJECTED');
        }
      }
    });

    return () => {
      clearInterval(cacheInterval);
      unsubscribe();
    };
  }, [activeTrip, candidateRoutes, handleComputeRoutes, persistTripToCache, safeHalts, selectedRouteId, user]);

  const selectedCandidate = candidateRoutes.find(r => r.route_id === selectedRouteId) || candidateRoutes[0];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <Navigation className="w-6 h-6 text-cyan-400" />
              <span>Real-Time Route & Trip Management Center</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
              ConvLSTM + OSRM INTELLIGENCE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generate multiple candidate routes, compare ConvLSTM risk scores & ETA, assign trips to drivers, and operate offline with IndexedDB persistence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Offline Cache Status Pill */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300">
              {cachedAtTimestamp ? `Cached: ${new Date(cachedAtTimestamp).toLocaleTimeString()}` : 'Cache: Ready'}
            </span>
          </div>

          <button
            onClick={handleComputeRoutes}
            disabled={isComputing}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-glow-cyan flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isComputing ? 'animate-spin' : ''}`} />
            <span>{isComputing ? 'Evaluating Candidates...' : 'Generate Candidate Routes'}</span>
          </button>
        </div>
      </div>

      {/* Trip Creation Form & Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trip Creation Form (Left Column) */}
        <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span>Admin Create Trip & Assignment</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              STEP 1: TRIP SETUP
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Source / Pickup</label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="GHY">Guwahati Terminal (Kamrup)</option>
                <option value="TEZ">Tezpur Transit Depot (Sonitpur)</option>
                <option value="SHL">Shillong Hub (Meghalaya)</option>
                <option value="SLG">Siliguri Gateway (West Bengal)</option>
                <option value="JOR">Jorhat Supply Depot (Assam)</option>
                <option value="DMP">Dimapur Railhead (Nagaland)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Destination / Drop</label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="TWG">Tawang Forward Base (Arunachal)</option>
                <option value="AZL">Aizawl Terminal (Mizoram)</option>
                <option value="GTK">Gangtok Central Hub (Sikkim)</option>
                <option value="IMP">Imphal Valley Depot (Manipur)</option>
                <option value="KHM">Kohima Station (Nagaland)</option>
                <option value="SIL">Silchar Barak Hub (Assam)</option>
              </select>
            </div>
          </div>

          {/* Commodity Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Commodity Type</label>
              <select
                value={commodityType}
                onChange={(e) => setCommodityType(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="ESSENTIAL_MEDICINES">Essential Medicines & Cold-Chain</option>
                <option value="FOOD_GRAINS">Food Grains & PDS Rations</option>
                <option value="AGRICULTURAL_PRODUCE">Agricultural Produce & Perishables</option>
                <option value="CONSTRUCTION_MATERIALS">Construction Materials & Cement</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Trip Priority</label>
              <select
                value={priorityLevel}
                onChange={(e) => setPriorityLevel(e.target.value as any)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold"
              >
                <option value="NORMAL" className="text-slate-200">Standard Freight (Normal)</option>
                <option value="HIGH" className="text-amber-400">High Priority Corridor</option>
                <option value="EMERGENCY" className="text-rose-400">🚨 Emergency Lifeline Protocol</option>
              </select>
            </div>
          </div>

          {/* Package Details */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 block mb-1">Package / Consignment Description</label>
            <input
              type="text"
              value={packageDetails}
              onChange={(e) => setPackageDetails(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              placeholder="e.g. 1000 Units Emergency Vaccine Cold Packs"
            />
          </div>

          {/* Driver & Vehicle Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Assigned Driver</label>
              <select
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                  setDriverName(e.target.options[e.target.selectedIndex].text);
                }}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="DRV-102">Driver 102 (Tenzing Norbu)</option>
                <option value="DRV-105">Driver 105 (Rajesh Gogoi)</option>
                <option value="DRV-108">Driver 108 (Lalthanzama)</option>
                <option value="DRV-112">Driver 112 (Bikash Debbarma)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">Assigned Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setVehicleNo(e.target.options[e.target.selectedIndex].text);
                }}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="TRUCK-TN-402">Truck TN-XX-XXXX (All-Weather Heavy)</option>
                <option value="TRUCK-AS-101">Truck AS-01-EC-9081 (Cold-Reefer)</option>
                <option value="TRUCK-ML-204">Truck ML-05-D-4412 (4x4 Mountain Axle)</option>
                <option value="TRUCK-AR-303">Truck AR-02-B-1189 (Emergency Recovery)</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleCreateAndAssignTrip}
              disabled={isCreatingTrip}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isCreatingTrip ? 'Assigning Trip...' : 'Create Trip & Assign to Driver'}</span>
            </button>
          </div>
        </div>

        {/* Candidate Routes Comparison Table (Right Column) */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Multi-Candidate Route Ranking & ConvLSTM Safety Scoring</span>
            </h3>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              STEP 2: ROUTE SELECTION
            </span>
          </div>

          {/* Justification Banner */}
          {recommendationJustification && (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-cyan-500/30 text-xs text-slate-200 flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-cyan-300">Decision Engine Rationale: </span>
                <span>{recommendationJustification}</span>
              </div>
            </div>
          )}

          {/* Candidate Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Distance</th>
                  <th className="py-2.5 px-3">ETA</th>
                  <th className="py-2.5 px-3">ConvLSTM Risk</th>
                  <th className="py-2.5 px-3">Road / Bridge Status</th>
                  <th className="py-2.5 px-3">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {candidateRoutes.map((route) => {
                  const isSelected = route.route_id === selectedRouteId;
                  const isRec = route.recommendation === 'RECOMMENDED';
                  const isAvoid = route.recommendation === 'AVOID';

                  return (
                    <tr 
                      key={route.route_id}
                      onClick={() => {
                        setSelectedRouteId(route.route_id);
                        setTurnInstructions(generateTurnSteps(route));
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-cyan-500/15 border-l-4 border-l-cyan-400' 
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-white flex items-center space-x-1.5">
                          <span>{route.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{route.route_id}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-200">
                        {route.distance_km} km
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                        {route.eta_display}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          route.risk_level === 'HIGH' 
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                            : route.risk_level === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}>
                          {route.risk_score} ({route.risk_level})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-[11px]">
                        {route.road_bridge_status}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center space-x-1 ${
                          isRec 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                            : isAvoid
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}>
                          <span>{route.recommendation_badge}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Turn-by-Turn Navigation & Guidance (Cached Offline) */}
          {turnInstructions.length > 0 && (
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-white/10">
                <span className="font-bold text-cyan-300 flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Turn-by-Turn Navigation Steps (Persistent Cache)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  OFFLINE READY
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {turnInstructions.map((step) => (
                  <div key={step.step} className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-white/5">
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center">
                        {step.step}
                      </span>
                      <span>{step.instruction}</span>
                    </span>
                    <span className="font-mono text-slate-400 text-[10px]">
                      {step.distance_km} km ({step.eta_mins}m)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Driver Decision Flow, Offline Actions & Safe Halt Locations Section */}
      {activeTrip && (
        <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl border border-cyan-500/30 p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-cyan-400" />
                  <span>Active Dispatched Trip: {activeTrip.trip_id}</span>
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Corridor: <strong className="text-cyan-300">{activeTrip.assigned_route_name}</strong> | Driver: <strong>{activeTrip.driver_name}</strong> | Vehicle: <strong>{activeTrip.vehicle_no}</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                driverStatus === 'ACCEPTED' || driverStatus === 'IN_PROGRESS'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : driverStatus === 'COMPLETED'
                  ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                  : driverStatus === 'REJECTED'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
              }`}>
                STATUS: {driverStatus}
              </span>
            </div>
          </div>

          {/* Driver Offline Supported Actions Bar */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-white flex items-center space-x-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Driver Supported Operations (Online & Offline Queued)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All driver trip actions (Start, Complete, Accept, Reject) persist in IndexedDB and synchronize with Central Command automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {driverStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleSimulateDriverDecision('ACCEPT')}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accept Route</span>
                  </button>

                  <button
                    onClick={() => handleSimulateDriverDecision('REJECT')}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-rose-500/20 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Route</span>
                  </button>
                </>
              )}

              {(driverStatus === 'ACCEPTED' || driverStatus === 'PENDING') && (
                <button
                  onClick={handleStartTrip}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Trip Navigation</span>
                </button>
              )}

              {driverStatus === 'IN_PROGRESS' && (
                <button
                  onClick={handleCompleteTrip}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-teal-500/20 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Finish / Complete Trip</span>
                </button>
              )}

              {driverStatus === 'COMPLETED' && (
                <span className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs border border-teal-500/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Trip Successfully Delivered</span>
                </span>
              )}
            </div>
          </div>

          {/* If Driver Accepted / In Progress Navigation */}
          {(driverStatus === 'ACCEPTED' || driverStatus === 'IN_PROGRESS') && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-emerald-300 flex items-center space-x-2">
                  <span>Driver Navigation Active — GPS & Route Simulation</span>
                  {!isOnline && (
                    <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                      OFFLINE GPS STREAM
                    </span>
                  )}
                </div>
                <p className="text-slate-300">
                  {isOnline 
                    ? 'Connected to live fleet telemetry stream. Real-time ConvLSTM disruption scoring active.' 
                    : 'Network unavailable: Using cached route geometry, safe halts, and offline turn-by-turn guidance without continuous server requests.'}
                </p>
              </div>
            </div>
          )}

          {/* If Driver Rejected -> Display Nearby Safe Halt Locations */}
          {driverStatus === 'REJECTED' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-rose-300">Route Rejected by Driver — Nearby Safe Halt Locations Located</div>
                  <p className="text-slate-300 mt-0.5">
                    The driver reported terrain hazards and rejected the suggested path. Nearby certified safe halts have been identified from persistent storage.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {safeHalts.map((halt) => {
                  const isHaltSelected = selectedHalt?.id === halt.id;
                  return (
                    <div 
                      key={halt.id}
                      onClick={() => handleSelectHalt(halt)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isHaltSelected
                          ? 'bg-cyan-500/20 border-cyan-400 ring-2 ring-cyan-400/30'
                          : 'bg-slate-800/80 border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-cyan-400" />
                          <span className="font-bold text-white text-xs">{halt.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          {halt.distance_from_vehicle_km} km away
                        </span>
                      </div>

                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Location:</span>
                          <span className="font-semibold">{halt.district}, {halt.state}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Capacity:</span>
                          <span className="font-mono text-cyan-300">{halt.capacity_trucks} Trucks</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Safety Rating:</span>
                          <span className="font-mono font-bold text-emerald-400">{halt.safety_rating}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">ETA to Halt:</span>
                          <span className="font-mono font-bold text-amber-300">{halt.eta_minutes} mins</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-1">
                        {halt.amenities?.map((amenity, aIdx) => (
                          <span key={aIdx} className="px-1.5 py-0.5 rounded bg-slate-900/60 text-[9px] text-slate-400 font-mono">
                            {amenity}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHalt(halt);
                        }}
                        className={`w-full mt-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isHaltSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        {isHaltSelected ? 'Selected Safe Halt' : 'Direct Driver to This Halt'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
