import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  LogisticsHub, 
  Chokepoint, 
  DistrictHealth, 
  FleetVehicle, 
  Incident, 
  WeatherStation, 
  OptimizedRoute,
  OfflineMediaAttachment
} from '../types';
import { api } from '../services/api';
import { wsClient } from '../services/websocket';
import { offlineDB } from '../services/db';
import { networkService } from '../services/network';
import { syncManager } from '../services/syncManager';

export interface ActiveLayers {
  satellite: boolean;
  topography: boolean;
  landslideRisk: boolean;
  floodPlains: boolean;
  liveFleet: boolean;
  chokepoints: boolean;
  weatherRadar: boolean;
  corridors: boolean;
}

export interface ToastAlert {
  id: string;
  type: 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: string;
}

interface LogisticsContextType {
  hubs: LogisticsHub[];
  chokepoints: Chokepoint[];
  vehicles: FleetVehicle[];
  incidents: Incident[];
  districtsHealth: DistrictHealth[];
  weatherStations: WeatherStation[];
  activeLayers: ActiveLayers;
  toggleLayer: (layer: keyof ActiveLayers) => void;
  selectedVehicle: FleetVehicle | null;
  setSelectedVehicle: (vehicle: FleetVehicle | null) => void;
  selectedChokepoint: Chokepoint | null;
  setSelectedChokepoint: (cp: Chokepoint | null) => void;
  selectedIncident: Incident | null;
  setSelectedIncident: (inc: Incident | null) => void;
  isDisasterModeActive: boolean;
  toggleDisasterMode: () => void;
  activeRouteResult: { primary_route: OptimizedRoute; ai_optimized_route: OptimizedRoute; emergency_green_route: OptimizedRoute } | null;
  setActiveRouteResult: (result: any) => void;
  toasts: ToastAlert[];
  addToast: (type: ToastAlert['type'], title: string, message: string) => void;
  removeToast: (id: string) => void;
  isOnline: boolean;
  isOfflineSimulated: boolean;
  toggleOfflineSimulation: () => void;
  pendingOfflineCount: number;
  isSyncing: boolean;
  syncOfflineData: () => Promise<number>;
  reportNewIncident: (incident: Partial<Incident>, mediaAttachments?: { file: File | Blob; name: string; type: 'PHOTO' | 'VIDEO' }[]) => Promise<void>;
  triggerVehicleSOS: (vehicleId: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
}

const LogisticsContext = createContext<LogisticsContextType | undefined>(undefined);

export const LogisticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hubs, setHubs] = useState<LogisticsHub[]>([]);
  const [chokepoints, setChokepoints] = useState<Chokepoint[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [districtsHealth, setDistrictsHealth] = useState<DistrictHealth[]>([]);
  const [weatherStations, setWeatherStations] = useState<WeatherStation[]>([]);
  
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [selectedChokepoint, setSelectedChokepoint] = useState<Chokepoint | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [activeRouteResult, setActiveRouteResult] = useState<any>(null);
  
  const [isDisasterModeActive, setIsDisasterModeActive] = useState(false);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  
  // Real-time Network & Sync State
  const [isOnline, setIsOnline] = useState<boolean>(networkService.isOnline());
  const [isOfflineSimulated, setIsOfflineSimulated] = useState<boolean>(networkService.isSimulatedOffline());
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [activeLayers, setActiveLayers] = useState<ActiveLayers>({
    satellite: false,
    topography: true,
    landslideRisk: true,
    floodPlains: true,
    liveFleet: true,
    chokepoints: true,
    weatherRadar: true,
    corridors: true
  });

  const addToast = useCallback((type: ToastAlert['type'], title: string, message: string) => {
    const newToast: ToastAlert = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setToasts((prev) => [newToast, ...prev.slice(0, 5)]);

    setTimeout(() => {
      removeToast(newToast.id);
    }, 6000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const toggleLayer = (layer: keyof ActiveLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Initial and reactive data load
  const refreshAllData = useCallback(async () => {
    try {
      const [hubsData, chokepointsData, vehiclesData, incidentsData, districtsData, weatherData] = await Promise.allSettled([
        api.getHubs(),
        api.getChokepoints(),
        api.getVehicles(),
        api.getIncidents(),
        api.getDistrictsHealth(),
        api.getWeatherStations()
      ]);

      if (hubsData.status === 'fulfilled') setHubs(hubsData.value);
      if (chokepointsData.status === 'fulfilled') setChokepoints(chokepointsData.value);
      if (vehiclesData.status === 'fulfilled') setVehicles(vehiclesData.value);
      if (incidentsData.status === 'fulfilled') setIncidents(incidentsData.value);
      if (districtsData.status === 'fulfilled') setDistrictsHealth(districtsData.value);
      if (weatherData.status === 'fulfilled') setWeatherStations(weatherData.value.stations);
    } catch (err) {
      console.error('Failed to load logistics data:', err);
    }
  }, []);

  // Update pending counts helper
  const updatePendingCounts = useCallback(async () => {
    const counts = await syncManager.getPendingCounts();
    setPendingOfflineCount(counts.total);
  }, []);

  useEffect(() => {
    refreshAllData();
    updatePendingCounts();

    // 1. Subscribe to dual-layer Network Status
    const unsubscribeNetwork = networkService.subscribe((state) => {
      const online = state.isOnline;
      setIsOnline(online);
      setIsOfflineSimulated(networkService.isSimulatedOffline());

      if (online) {
        // Connected
      } else {
        // Offline
      }
    });

    // 2. Subscribe to Sync Manager progress
    const unsubscribeSync = syncManager.subscribe((syncState) => {
      setIsSyncing(syncState.isSyncing);
      setPendingOfflineCount(syncState.totalPending);
    });

    // 3. WebSocket Telemetry Subscription
    const unsubscribeWS = wsClient.subscribe((payload) => {
      if (payload.type === 'FLEET_GPS_TICK' && payload.vehicles) {
        setVehicles((prev) =>
          prev.map((v) => {
            const update = payload.vehicles.find((u: any) => u.id === v.id);
            if (update) {
              return {
                ...v,
                current_lat: update.lat,
                current_lng: update.lng,
                speed_kmh: update.speed_kmh,
                temp_celsius: update.temp_celsius ?? v.temp_celsius,
                progress_pct: update.progress_pct ?? v.progress_pct,
                is_sos: update.is_sos ?? v.is_sos
              };
            }
            return v;
          })
        );
      } else if (payload.type === 'TRIP_STATUS_UPDATE') {
        const title = payload.status === 'ACCEPTED' ? 'Driver Accepted Trip' :
                      payload.status === 'COMPLETED' ? 'Trip Completed' :
                      payload.status === 'IN_PROGRESS' ? 'Driver En Route' : 'Trip Update';
        const toastType = payload.status === 'COMPLETED' || payload.status === 'ACCEPTED' ? 'SUCCESS' : 'INFO';
        addToast(toastType, title, payload.message || `Trip #${payload.trip_id} updated to ${payload.status}`);
        refreshAllData();
      } else if (payload.type === 'TRIP_ASSIGNED') {
        addToast('INFO', 'Trip Assigned', payload.message || 'New logistics trip created and assigned.');
        refreshAllData();
      }
    });

    return () => {
      unsubscribeNetwork();
      unsubscribeSync();
      unsubscribeWS();
    };
  }, [addToast, refreshAllData, updatePendingCounts]);

  const toggleOfflineSimulation = () => {
    const next = !isOfflineSimulated;
    networkService.setSimulatedOffline(next);
    setIsOfflineSimulated(next);
    setIsOnline(!next);
    if (next) {
      addToast('WARNING', 'Simulated Offline Mode Active', 'Network simulated as disconnected. Zero-connectivity hill test active.');
    } else {
      addToast('SUCCESS', 'Network Connection Restored', 'Reconnected to Logistics Central Command. Auto-sync started.');
      syncOfflineData();
    }
  };

  const syncOfflineData = async (): Promise<number> => {
    setIsSyncing(true);
    const count = await syncManager.triggerSync(undefined, (synced) => {
      if (synced > 0) {
        addToast('SUCCESS', 'Offline Records Synced', `Successfully synchronized ${synced} pending actions & field reports with Central Command.`);
        refreshAllData();
      } else {
        addToast('INFO', 'Synchronized', 'All records are up to date with Central Command.');
      }
    });
    await updatePendingCounts();
    setIsSyncing(false);
    return count;
  };

  const reportNewIncident = async (
    incidentData: Partial<Incident>,
    mediaAttachments?: { file: File | Blob; name: string; type: 'PHOTO' | 'VIDEO' }[]
  ) => {
    const clientReportId = `INC-${Date.now().toString(36).toUpperCase()}`;
    const user_id = incidentData.reporter_name || 'field-officer-default';
    const createdAt = new Date().toISOString();

    // 1. Process and store media Blobs in IndexedDB
    const mediaRecords: OfflineMediaAttachment[] = [];
    if (mediaAttachments && mediaAttachments.length > 0) {
      for (const item of mediaAttachments) {
        const blobKey = `blob_${clientReportId}_${Math.random().toString(36).slice(-6)}`;
        await offlineDB.saveMediaBlob({
          blob_key: blobKey,
          blob: item.file,
          mime_type: item.file.type || 'image/jpeg',
          name: item.name,
          size_bytes: item.file.size,
          created_at: createdAt,
          user_id
        });

        mediaRecords.push({
          id: blobKey,
          name: item.name,
          mime_type: item.file.type || 'image/jpeg',
          size_bytes: item.file.size,
          media_type: item.type,
          blob_key: blobKey
        });
      }
    }

    const newInc: Incident = {
      id: clientReportId,
      title: incidentData.title || 'Road Obstruction',
      category: incidentData.category || 'LANDSLIDE',
      severity: incidentData.severity || 'HIGH',
      state: incidentData.state || 'Assam',
      district: incidentData.district || 'Kamrup',
      lat: incidentData.lat || 26.1445,
      lng: incidentData.lng || 91.7362,
      description: incidentData.description || '',
      reporter_name: incidentData.reporter_name || 'Field Officer',
      reporter_role: incidentData.reporter_role || 'Field Official',
      created_at: createdAt,
      photo_url: incidentData.photo_url || (mediaRecords.length > 0 ? URL.createObjectURL(mediaAttachments![0].file) : 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'),
      passable_by: incidentData.passable_by || 'NONE',
      verification_status: 'PENDING_VERIFICATION',
      upvotes: 1,
      offline_synced: false
    };

    // 2. Persist to native IndexedDB store
    await offlineDB.savePendingReport({
      client_report_id: clientReportId,
      user_id,
      type: newInc.category,
      category: newInc.category,
      severity: newInc.severity,
      title: newInc.title,
      description: newInc.description,
      latitude: newInc.lat,
      longitude: newInc.lng,
      state: newInc.state,
      district: newInc.district,
      reporter_name: newInc.reporter_name,
      reporter_role: newInc.reporter_role,
      passable_by: newInc.passable_by,
      timestamp: createdAt,
      created_at: createdAt,
      media: mediaRecords,
      photo_url: newInc.photo_url,
      sync_status: 'PENDING_UPLOAD',
      retry_count: 0
    });

    // Update UI immediately (optimistic UI)
    setIncidents((prev) => [newInc, ...prev]);
    await updatePendingCounts();

    if (networkService.isOnline()) {
      addToast('INFO', 'Incident Logged', 'Report queued locally. Auto-syncing with server...');
      syncOfflineData();
    } else {
      addToast('WARNING', 'Saved to Persistent Storage', 'Zero network. Incident & media Blobs stored in IndexedDB (PENDING_UPLOAD). Will auto-sync when online.');
    }
  };

  const triggerVehicleSOS = async (vehicleId: string) => {
    try {
      await api.triggerVehicleSOS(vehicleId, true);
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicleId ? { ...v, is_sos: true, status: 'EMERGENCY_SOS' } : v))
      );
      addToast('CRITICAL', 'DRIVER SOS PANIC SIGNAL', `Emergency response alert dispatched for Convoy ${vehicleId}. Nearby NDRF & BRO notified!`);
    } catch {
      setVehicles((prev) =>
        prev.map((v) => (v.id === vehicleId ? { ...v, is_sos: true, status: 'EMERGENCY_SOS' } : v))
      );
      addToast('CRITICAL', 'LOCAL SOS BROADCAST', `SOS activated locally for Convoy ${vehicleId}.`);
    }
  };

  const toggleDisasterMode = () => {
    setIsDisasterModeActive((prev) => {
      const nextState = !prev;
      if (nextState) {
        addToast('CRITICAL', '🚨 MONSOON RED ALERT ACTIVE', 'Severe cloudburst scenario triggered. All active medical trucks rerouted via Green Corridors.');
        setVehicles((vList) =>
          vList.map((v) => ({
            ...v,
            status: v.cargo_type.includes('MEDICINE') || v.cargo_type.includes('OXYGEN') ? 'REROUTED_AI' : 'PILOT_ESCORT',
            risk_advisory: 'RED ALERT: Severe precipitation corridor - AI bypass active'
          }))
        );
      } else {
        addToast('INFO', 'Emergency Alert Deactivated', 'Standard regional logistics parameters restored.');
        refreshAllData();
      }
      return nextState;
    });
  };

  return (
    <LogisticsContext.Provider
      value={{
        hubs,
        chokepoints,
        vehicles,
        incidents,
        districtsHealth,
        weatherStations,
        activeLayers,
        toggleLayer,
        selectedVehicle,
        setSelectedVehicle,
        selectedChokepoint,
        setSelectedChokepoint,
        selectedIncident,
        setSelectedIncident,
        isDisasterModeActive,
        toggleDisasterMode,
        activeRouteResult,
        setActiveRouteResult,
        toasts,
        addToast,
        removeToast,
        isOnline,
        isOfflineSimulated,
        toggleOfflineSimulation,
        pendingOfflineCount,
        isSyncing,
        syncOfflineData,
        reportNewIncident,
        triggerVehicleSOS,
        refreshAllData
      }}
    >
      {children}
    </LogisticsContext.Provider>
  );
};

export const useLogistics = () => {
  const context = useContext(LogisticsContext);
  if (!context) throw new Error('useLogistics must be used within a LogisticsProvider');
  return context;
};
