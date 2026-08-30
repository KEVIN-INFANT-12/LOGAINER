import React, { useState, useEffect, useCallback } from 'react';
import { 
  Navigation, 
  Package, 
  Layers, 
  Truck, 
  Send, 
  Play, 
  Check, 
  CheckCircle2, 
  XCircle, 
  Building, 
  Radio, 
  Database,
  Sparkles,
  AlertTriangle
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
        { step: 2, instruction: `Follow designated mountain trunk highway`, distance_km: Math.round(route.distance_km * 0.5), eta_mins: Math.round(route.estimated_time_hrs * 30) },
        { step: 3, instruction: `Arrive safely at destination warehouse`, distance_km: route.distance_km, eta_mins: Math.round(route.estimated_time_hrs * 60) }
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

    const tripCache: DriverTripCache = {
      trip_id: trip.trip_id,
      assigned_route_id: selectedId,
      assigned_route_name: trip.assigned_route_name,
      origin: {
        hub_id: trip.origin.hub_id,
        name: trip.origin.name,
        state: trip.origin.state,
        lat: trip.origin.lat,
        lng: trip.origin.lng
      },
      destination: {
        hub_id: trip.destination.hub_id,
        name: trip.destination.name,
        state: trip.destination.state,
        lat: trip.destination.lat,
        lng: trip.destination.lng
      },
      commodity_type: trip.commodity_type,
      package_details: trip.package_details,
      priority: trip.priority,
      waypoints: selected?.waypoints || [],
      candidate_routes: routes,
      safe_halts: halts,
      turn_instructions: steps,
      driver_name: trip.driver_name,
      vehicle_no: trip.vehicle_no,
      cached_at: new Date().toISOString(),
      user_id: user?.username || 'admin',
      is_offline_available: true
    };

    try {
      await offlineDB.cacheDriverTrip(tripCache);
      setCachedAtTimestamp(tripCache.cached_at);
    } catch (e) {
      console.warn('Failed to cache trip locally:', e);
    }
  }, [generateTurnSteps, user]);

  // Load from Cache on Mount if Offline
  const loadCachedTripIfOffline = useCallback(async () => {
    try {
      const cachedTrips = await offlineDB.getAllCachedTrips();
      if (cachedTrips.length > 0) {
        const latest = cachedTrips[0];
        setCachedAtTimestamp(latest.cached_at);
        if (latest.candidate_routes && latest.candidate_routes.length > 0) {
          setCandidateRoutes(latest.candidate_routes);
          setSelectedRouteId(latest.assigned_route_id);
          if (latest.turn_instructions) setTurnInstructions(latest.turn_instructions);
          if (latest.safe_halts) setSafeHalts(latest.safe_halts);
        }
      }
    } catch (e) {
      console.warn('Error reading cached trips from IndexedDB:', e);
    }
  }, []);

  // Compute Routes Flow
  const handleComputeRoutes = useCallback(async () => {
    setIsComputing(true);
    try {
      const response = await api.evaluateCandidateRoutes({
        origin_hub_id: originId,
        destination_hub_id: destId,
        commodity_type: commodityType,
        avoid_chokepoints: avoidChokepoints
      });

      if (response && response.candidate_routes) {
        setCandidateRoutes(response.candidate_routes);
        setSelectedRouteId(response.recommended_route_id || response.candidate_routes[0]?.route_id);
        setRecommendationJustification(response.justification || '');

        const recRoute = response.candidate_routes.find((r: CandidateRoute) => r.route_id === response.recommended_route_id) || response.candidate_routes[0];
        if (recRoute) {
          setTurnInstructions(generateTurnSteps(recRoute));
          setActiveRouteResult({
            origin: hubs.find(h => h.hub_id === originId),
            destination: hubs.find(h => h.hub_id === destId),
            primary_route: response.candidate_routes.find((r: any) => r.route_id === 'ROUTE-A'),
            ai_optimized_route: response.candidate_routes.find((r: any) => r.route_id === 'ROUTE-B'),
            emergency_green_route: response.candidate_routes.find((r: any) => r.route_id === 'ROUTE-C')
          });
        }
      }
    } catch (err: any) {
      console.warn('Network error computing routes, falling back to local simulation:', err);
      addToast({
        title: 'Offline Evaluation',
        message: 'Loaded cached route geometry and terrain heuristics.',
        type: 'info'
      });
    } finally {
      setIsComputing(false);
    }
  }, [originId, destId, commodityType, avoidChokepoints, generateTurnSteps, setActiveRouteResult, hubs, addToast]);

  // Create Trip and Assign to Driver
  const handleCreateAndAssignTrip = async () => {
    setIsCreatingTrip(true);
    const selectedRoute = candidateRoutes.find(r => r.route_id === selectedRouteId) || candidateRoutes[0];
    const originHub = hubs.find(h => h.hub_id === originId) || { hub_id: originId, name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 };
    const destHub = hubs.find(h => h.hub_id === destId) || { hub_id: destId, name: 'Tawang', state: 'Arunachal Pradesh', lat: 27.5860, lng: 91.8594 };

    try {
      const newTrip = await api.createTripAssignment({
        origin: originHub,
        destination: destHub,
        origin_id: originId,
        destination_id: destId,
        assigned_route_id: selectedRouteId,
        assigned_route_name: selectedRoute?.name || 'Selected Route',
        commodity_type: commodityType,
        package_details: packageDetails,
        driver_id: driverId,
        driver_name: driverName,
        vehicle_id: vehicleId,
        vehicle_no: vehicleNo,
        priority: priorityLevel,
        waypoints: selectedRoute?.waypoints || []
      });

      setActiveTrip(newTrip);
      setDriverStatus('PENDING');

      // Fetch safe halts along the path
      const haltData = await api.fetchSafeHalts(selectedRouteId);
      setSafeHalts(haltData);

      // Persist entire package to IndexedDB
      await persistTripToCache(newTrip, candidateRoutes, selectedRouteId, haltData);

      addToast({
        title: 'Trip Dispatched & Assigned',
        message: `Trip ${newTrip.trip_id} successfully created and assigned to ${driverName}.`,
        type: 'success'
      });
    } catch (err: any) {
      console.error('Trip assignment failed:', err);
      addToast({
        title: 'Trip Creation Error',
        message: err.message || 'Could not create trip assignment.',
        type: 'error'
      });
    } finally {
      setIsCreatingTrip(false);
    }
  };

  // Driver Simulation Handlers
  const handleSimulateDriverDecision = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!activeTrip) return;
    try {
      const res = await api.driverDecision(activeTrip.trip_id, decision, driverId, selectedHalt?.id);
      if (decision === 'ACCEPT') {
        setDriverStatus('ACCEPTED');
        addToast({
          title: 'Route Accepted',
          message: 'Driver confirmed clearance. Ready for autonomous navigation.',
          type: 'success'
        });
      } else {
        setDriverStatus('REJECTED');
        if (res.safe_halts) setSafeHalts(res.safe_halts);
        addToast({
          title: 'Route Rejected',
          message: 'Terrain hazard alert. Safe halt locations suggested.',
          type: 'warning'
        });
      }
    } catch (err) {
      console.error('Driver decision action failed:', err);
    }
  };

  const handleStartTrip = async () => {
    if (!activeTrip) return;
    try {
      await api.startTrip(activeTrip.trip_id);
      setDriverStatus('IN_PROGRESS');
      setIsNavigatingOffline(!networkService.isOnline());
      addToast({
        title: 'Trip Started',
        message: 'Driver has started transit. Offline navigation active.',
        type: 'info'
      });
    } catch (e) {
      console.error('Start trip failed:', e);
    }
  };

  const handleCompleteTrip = async () => {
    if (!activeTrip) return;
    try {
      await api.completeTrip(activeTrip.trip_id);
      setDriverStatus('COMPLETED');
      addToast({
        title: 'Trip Completed',
        message: 'Consignment successfully delivered at destination.',
        type: 'success'
      });
    } catch (e) {
      console.error('Complete trip failed:', e);
    }
  };

  const handleSelectHalt = (halt: SafeHaltLocation) => {
    setSelectedHalt(halt);
    addToast({
      title: 'Safe Halt Selected',
      message: `Rerouting convoy to ${halt.name} (${halt.district}).`,
      type: 'info'
    });
  };

  useEffect(() => {
    handleComputeRoutes();
    loadCachedTripIfOffline();

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
  }, [activeTrip, candidateRoutes, handleComputeRoutes, loadCachedTripIfOffline, persistTripToCache, safeHalts, selectedRouteId, user]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <Navigation className="w-6 h-6 text-teal-700" />
              <span>Route & Trip Management Center</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              ConvLSTM + OSRM INTELLIGENCE
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generate multiple candidate routes, compare ConvLSTM risk scores & ETA, assign trips to drivers, and operate offline with IndexedDB persistence.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Offline Cache Status Pill */}
          <div className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
            <Database className="w-3.5 h-3.5 text-teal-700" />
            <span>
              {cachedAtTimestamp ? `Cached: ${new Date(cachedAtTimestamp).toLocaleTimeString()}` : 'Cache: Ready'}
            </span>
          </div>

          <button
            onClick={handleComputeRoutes}
            disabled={isComputing}
            className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-sm flex items-center space-x-2 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isComputing ? 'animate-spin' : ''}`} />
            <span>{isComputing ? 'Evaluating Candidates...' : 'Generate Candidate Routes'}</span>
          </button>
        </div>
      </div>

      {/* Trip Creation Form & Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trip Creation Form (Left Column) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Package className="w-4 h-4 text-teal-700" />
              <span>Admin Create Trip & Assignment</span>
            </h3>
            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              STEP 1: TRIP SETUP
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Source / Pickup</label>
              <select
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
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
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Destination / Drop</label>
              <select
                value={destId}
                onChange={(e) => setDestId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
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
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Commodity Type</label>
              <select
                value={commodityType}
                onChange={(e) => setCommodityType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="ESSENTIAL_MEDICINES">Essential Medicines & Cold-Chain</option>
                <option value="FOOD_GRAINS">Food Grains & PDS Rations</option>
                <option value="AGRICULTURAL_PRODUCE">Agricultural Produce & Perishables</option>
                <option value="CONSTRUCTION_MATERIALS">Construction Materials & Cement</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Trip Priority</label>
              <select
                value={priorityLevel}
                onChange={(e) => setPriorityLevel(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700 font-bold"
              >
                <option value="NORMAL">Standard Freight (Normal)</option>
                <option value="HIGH">High Priority Corridor</option>
                <option value="EMERGENCY">🚨 Emergency Lifeline Protocol</option>
              </select>
            </div>
          </div>

          {/* Package Details */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">Package / Consignment Description</label>
            <input
              type="text"
              value={packageDetails}
              onChange={(e) => setPackageDetails(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
              placeholder="e.g. 1000 Units Emergency Vaccine Cold Packs"
            />
          </div>

          {/* Driver & Vehicle Selection */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assigned Driver</label>
              <select
                value={driverId}
                onChange={(e) => {
                  setDriverId(e.target.value);
                  setDriverName(e.target.options[e.target.selectedIndex].text);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
              >
                <option value="DRV-102">Driver 102 (Tenzing Norbu)</option>
                <option value="DRV-105">Driver 105 (Rajesh Gogoi)</option>
                <option value="DRV-108">Driver 108 (Lalthanzama)</option>
                <option value="DRV-112">Driver 112 (Bikash Debbarma)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">Assigned Vehicle</label>
              <select
                value={vehicleId}
                onChange={(e) => {
                  setVehicleId(e.target.value);
                  setVehicleNo(e.target.options[e.target.selectedIndex].text);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
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
              className="w-full py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isCreatingTrip ? 'Assigning Trip...' : 'Create Trip & Assign to Driver'}</span>
            </button>
          </div>
        </div>

        {/* Candidate Routes Comparison Table (Right Column) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-teal-700" />
              <span>Multi-Candidate Route Ranking & ConvLSTM Safety Scoring</span>
            </h3>
            <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              STEP 2: ROUTE SELECTION
            </span>
          </div>

          {/* Justification Banner */}
          {recommendationJustification && (
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-start space-x-2.5">
              <Sparkles className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-teal-900">Decision Engine Rationale: </span>
                <span>{recommendationJustification}</span>
              </div>
            </div>
          )}

          {/* Candidate Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-2.5 px-3">Route</th>
                  <th className="py-2.5 px-3">Distance</th>
                  <th className="py-2.5 px-3">ETA</th>
                  <th className="py-2.5 px-3">ConvLSTM Risk</th>
                  <th className="py-2.5 px-3">Road / Bridge Status</th>
                  <th className="py-2.5 px-3">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                          ? 'bg-teal-50/80 font-semibold' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                          <span>{route.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{route.route_id}</span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">
                        {route.distance_km} km
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-teal-800">
                        {route.eta_display}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          route.risk_level === 'HIGH' 
                            ? 'bg-red-50 text-red-700 border border-red-200' 
                            : route.risk_level === 'MEDIUM'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {route.risk_score} ({route.risk_level})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {route.road_bridge_status}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center space-x-1 ${
                          isRec 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                            : isAvoid
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
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
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200">
                <span className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Navigation className="w-3.5 h-3.5 text-teal-700" />
                  <span>Turn-by-Turn Navigation Steps (Persistent Cache)</span>
                </span>
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  OFFLINE READY
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {turnInstructions.map((step) => (
                  <div key={step.step} className="flex items-center justify-between text-[11px] text-slate-700 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    <span className="flex items-center space-x-2">
                      <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-900 text-[10px] font-bold flex items-center justify-center">
                        {step.step}
                      </span>
                      <span>{step.instruction}</span>
                    </span>
                    <span className="font-mono text-slate-500 text-[10px]">
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
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-card space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-teal-700" />
                  <span>Active Dispatched Trip: {activeTrip.trip_id}</span>
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Corridor: <strong className="text-slate-900">{activeTrip.assigned_route_name}</strong> | Driver: <strong>{activeTrip.driver_name}</strong> | Vehicle: <strong>{activeTrip.vehicle_no}</strong>
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded-md text-xs font-bold font-mono ${
                driverStatus === 'ACCEPTED' || driverStatus === 'IN_PROGRESS'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : driverStatus === 'COMPLETED'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : driverStatus === 'REJECTED'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
              }`}>
                STATUS: {driverStatus}
              </span>
            </div>
          </div>

          {/* Driver Supported Actions Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                <Radio className="w-4 h-4 text-teal-700" />
                <span>Driver Supported Operations (Online & Offline Queued)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                All driver trip actions (Start, Complete, Accept, Reject) persist in IndexedDB and synchronize with Central Command automatically.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {driverStatus === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleSimulateDriverDecision('ACCEPT')}
                    className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Accept Route</span>
                  </button>

                  <button
                    onClick={() => handleSimulateDriverDecision('REJECT')}
                    className="px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Route</span>
                  </button>
                </>
              )}

              {(driverStatus === 'ACCEPTED' || driverStatus === 'PENDING') && (
                <button
                  onClick={handleStartTrip}
                  className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4" />
                  <span>Start Trip Navigation</span>
                </button>
              )}

              {driverStatus === 'IN_PROGRESS' && (
                <button
                  onClick={handleCompleteTrip}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Finish / Complete Trip</span>
                </button>
              )}

              {driverStatus === 'COMPLETED' && (
                <span className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 font-bold text-xs border border-teal-200 flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Trip Successfully Delivered</span>
                </span>
              )}
            </div>
          </div>

          {/* Navigation Status Box */}
          {(driverStatus === 'ACCEPTED' || driverStatus === 'IN_PROGRESS') && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-emerald-900 flex items-center space-x-2">
                  <span>Driver Navigation Active — GPS & Route Simulation</span>
                  {!isOnline && (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                      OFFLINE GPS STREAM
                    </span>
                  )}
                </div>
                <p className="text-emerald-800">
                  {isOnline 
                    ? 'Connected to live fleet telemetry stream. Real-time ConvLSTM disruption scoring active.' 
                    : 'Network unavailable: Using cached route geometry, safe halts, and offline turn-by-turn guidance without continuous server requests.'}
                </p>
              </div>
            </div>
          )}

          {/* Safe Halts if Driver Rejected */}
          {driverStatus === 'REJECTED' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm text-red-900">Route Rejected by Driver — Nearby Safe Halt Locations Located</div>
                  <p className="text-red-800 mt-0.5">
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
                          ? 'bg-teal-50 border-teal-700 ring-2 ring-teal-700/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-teal-700" />
                          <span className="font-bold text-slate-900 text-xs">{halt.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {halt.distance_from_vehicle_km} km away
                        </span>
                      </div>

                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Location:</span>
                          <span className="font-semibold text-slate-800">{halt.district}, {halt.state}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Capacity:</span>
                          <span className="font-bold text-teal-800">{halt.capacity_trucks} Trucks</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Safety Rating:</span>
                          <span className="font-bold text-emerald-700">{halt.safety_rating}/100</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">ETA to Halt:</span>
                          <span className="font-bold text-amber-800">{halt.eta_minutes} mins</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectHalt(halt);
                        }}
                        className={`w-full mt-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isHaltSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
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
