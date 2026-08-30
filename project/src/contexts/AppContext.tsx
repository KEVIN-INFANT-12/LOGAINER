import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentPosition, watchPosition, clearWatch, geolocationErrorMessage } from '../lib/location';
import type { LangCode } from '../lib/i18n';
import { cancelSpeech } from '../lib/speech';
import { trips as demoTripsData, disasterMarkers as demoMarkersData } from '../types';
import type { Role, CitizenSubmission } from '../types';
import { checkProximityToHazards, haversineDistance } from '../lib/routing';
import {
  fetchDriverTrips,
  acceptTripBackend,
  startTripBackend,
  completeTripBackend,
  updateTripLocationBackend,
  type BackendTrip,
} from '../lib/api';

// ============================================================
// Types
// ============================================================

export interface UserProfile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  email: string;
  avatar_url: string | null;
  language_code: LangCode;
  dob?: string;
  address?: string;
  emergency_contact?: string;
  assigned_region?: string;
  department?: string;
  designation?: string;
  employee_id?: string;
  bio?: string;
  rating: number;
  trip_count: number;
  report_count: number;
  on_time_pct: number;
  profile_completion: number;
}

export interface LocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  timestamp: number | null;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  error: string | null;
  isLive: boolean;
}

export interface AppNotification {
  id: string;
  category: 'trip' | 'navigation' | 'disaster' | 'emergency' | 'report' | 'system';
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'critical';
  read: boolean;
  created_at: string;
}

export interface AppTrip {
  id: string;
  trip_code: string;
  product: string;
  quantity: string;
  pickup_location: string;
  drop_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  drop_lat: number | null;
  drop_lng: number | null;
  distance_km: number | null;
  duration_mins: number | null;
  capacity: string | null;
  priority: 'normal' | 'priority' | 'urgent';
  status: string;
  driver_id: string | null;
  instructions: string | null;
  road_condition: string | null;
  accepted_at: string | null;
}

export interface AppIncident {
  id: string;
  incident_code: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  description: string | null;
  reporter_id: string | null;
  status: string;
  created_at: string;
}

export interface VehicleData {
  vehicle_type?: string;
  registration?: string;
  model?: string;
  capacity_tons?: number;
  weight_kg?: number;
  fuel_type?: string;
  vehicle_photo_url?: string;
}

// Offline queue entry
interface OfflineQueueEntry {
  id: string;
  type: 'incident' | 'emergency' | 'citizen_submission';
  payload: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// Context shape
// ============================================================

interface AppContextValue {
  // Auth
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  authLoading: boolean;
  login: (email: string, password: string, role: Role) => Promise<{ error: string | null }>;
  register: (email: string, password: string, role: Role, name: string, phone?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
  uploadAvatar: (file: File) => Promise<{ url: string | null; error: string | null }>;

  // Language
  language: LangCode;
  setLanguage: (lang: LangCode) => void;
  voiceGender: 'female' | 'male';
  setVoiceGender: (g: 'female' | 'male') => void;
  speechSpeed: 'slow' | 'normal' | 'fast';
  setSpeechSpeed: (s: 'slow' | 'normal' | 'fast') => void;

  // Location
  location: LocationState;
  requestLocation: () => Promise<void>;
  setLiveTracking: (on: boolean) => void;

  // Notifications
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (n: Omit<AppNotification, 'id' | 'created_at' | 'read'>) => void;

  // Trips
  trips: AppTrip[];
  tripsLoading: boolean;
  activeTrip: AppTrip | null;
  refreshTrips: () => Promise<void>;
  acceptTrip: (tripId: string) => Promise<{ success: boolean; error: string | null }>;
  startTrip: (tripId: string) => Promise<{ success: boolean; error: string | null }>;
  updateTripLocation: (tripId: string, lat: number, lng: number, speed?: number, progress?: number) => void;
  updateTripStatus: (tripId: string, status: string) => Promise<{ error: string | null }>;
  finishTrip: (tripId: string) => Promise<{ error: string | null }>;

  // Incidents
  incidents: AppIncident[];
  incidentsLoading: boolean;
  refreshIncidents: () => Promise<void>;
  submitIncident: (data: Partial<AppIncident>, mediaFiles?: File[]) => Promise<{ id: string | null; code: string | null; error: string | null }>;

  // Emergency
  submitEmergency: (type: string) => Promise<{ error: string | null; locationName: string }>;

  // Security PIN (officers)
  verifyPin: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<{ error: string | null }>;
  pinSet: boolean;

  // Vehicle (drivers)
  saveVehicle: (data: VehicleData) => Promise<{ error: string | null }>;
  vehicleData: VehicleData | null;
  hasRequiredVehicle: boolean;

  // Citizen submissions
  citizenSubmissions: CitizenSubmission[];
  citizenSubmissionsLoading: boolean;
  refreshCitizenSubmissions: () => Promise<void>;
  submitCitizenMedia: (
    files: File[],
    description: string,
    incidentType?: string,
  ) => Promise<{ id: string | null; code: string | null; error: string | null }>;

  // Proximity alerts (for drivers)
  nearbyHazards: AppIncident[];
  alertedHazardIds: Set<string>;
  dismissHazardAlert: (id: string) => void;

  // Offline queue
  offlineQueue: OfflineQueueEntry[];

  // Supabase status
  isConfigured: boolean;
}

// ============================================================
// Demo defaults
// ============================================================

const DEMO_NOTIFICATIONS: AppNotification[] = [
  { id: 'N1', category: 'emergency', title: 'LANDSLIDE WARNING', body: 'Landslide reported 8 km ahead on your route. Consider alternative route.', priority: 'critical', read: false, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 'N2', category: 'disaster', title: 'Flood Advisory · Sector 4', body: 'Minor flooding on Valley Pass access road. Reduce speed in low-lying areas.', priority: 'high', read: false, created_at: new Date(Date.now() - 900000).toISOString() },
  { id: 'N3', category: 'trip', title: 'Trip TR-2036 Assigned', body: 'Medical supplies convoy ready for dispatch from Depot Alpha.', priority: 'normal', read: true, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'N4', category: 'navigation', title: 'Route Recalculated', body: 'Faster route available via Jorabat bypass. Saves 12 minutes.', priority: 'normal', read: true, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'N5', category: 'system', title: 'App Update Available', body: 'Version 2.0 includes real GPS tracking and voice navigation.', priority: 'normal', read: true, created_at: new Date(Date.now() - 18000000).toISOString() },
];

const OFFLINE_QUEUE_KEY = 'smartlog_offline_queue';

function loadOfflineQueue(): OfflineQueueEntry[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveOfflineQueue(queue: OfflineQueueEntry[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

// ============================================================
// Context
// ============================================================

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [language, setLanguageState] = useState<LangCode>('en');
  const [voiceGender, setVoiceGenderState] = useState<'female' | 'male'>('female');
  const [speechSpeed, setSpeechSpeedState] = useState<'slow' | 'normal' | 'fast'>('normal');

  const [location, setLocation] = useState<LocationState>({
    lat: null, lng: null, accuracy: null, timestamp: null,
    status: 'idle', error: null, isLive: false,
  });
  const watchIdRef = useRef(-1);

  const [notifications, setNotifications] = useState<AppNotification[]>(DEMO_NOTIFICATIONS);
  const [trips, setTrips] = useState<AppTrip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [incidents, setIncidents] = useState<AppIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [pinSet, setPinSet] = useState(false);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [citizenSubmissions, setCitizenSubmissions] = useState<CitizenSubmission[]>([]);
  const [citizenSubmissionsLoading, setCitizenSubmissionsLoading] = useState(false);
  const [nearbyHazards, setNearbyHazards] = useState<AppIncident[]>([]);
  const [alertedHazardIds, setAlertedHazardIds] = useState<Set<string>>(new Set());
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueEntry[]>(loadOfflineQueue());

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeTrip = trips.find((t) => ['accepted', 'going_to_pickup', 'arrived_at_pickup', 'package_loaded', 'in_transit', 'arrived_at_destination', 'in_progress', 'en_route'].includes(t.status?.toLowerCase())) || null;
  const hasRequiredVehicle = !!(vehicleData?.vehicle_type && vehicleData?.registration && vehicleData?.capacity_tons);

  // ============================================================
  // Auth initialization
  // ============================================================
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else { setProfile(null); setAuthLoading(false); }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setProfile(data as UserProfile);
      if (data.language_code) setLanguageState(data.language_code as LangCode);
    }
    if (data?.role === 'officer') {
      const { data: pinData } = await supabase.from('user_pins').select('id').eq('user_id', userId).single();
      setPinSet(!!pinData);
    }
    if (data?.role === 'driver') {
      const { data: vData } = await supabase.from('vehicles').select('*').eq('driver_id', userId).single();
      if (vData) setVehicleData(vData as VehicleData);
    }
    setAuthLoading(false);
  }

  // ============================================================
  // Auth actions
  // ============================================================
  const login = useCallback(async (email: string, password: string, _role: Role): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      const demoProfile: UserProfile = {
        id: 'demo-' + _role,
        role: _role,
        full_name: _role === 'driver' ? 'Rajesh Kumar' : _role === 'officer' ? 'Aarav Mehta' : 'Priya Sharma',
        phone: '+91 98765 43210',
        email,
        avatar_url: null,
        language_code: 'en',
        rating: 4.9,
        trip_count: _role === 'driver' ? 124 : 0,
        report_count: _role === 'officer' ? 28 : 0,
        on_time_pct: 98,
        profile_completion: 85,
        employee_id: _role === 'officer' ? 'FO-10842' : undefined,
        department: _role === 'officer' ? 'Disaster Management' : undefined,
      };
      setProfile(demoProfile);
      setUser({ id: 'demo-' + _role, email } as User);
      return { error: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    // Validate role matches
    if (data.user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
      if (prof && prof.role !== _role) {
        await supabase.auth.signOut();
        return { error: `This account is registered as a ${prof.role}. Please select the correct role.` };
      }
    }
    return { error: null };
  }, []);

  const register = useCallback(async (
    email: string, password: string, role: Role, name: string, phone?: string,
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) return { error: 'Supabase not configured. Cannot register in demo mode.' };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { role, full_name: name } },
    });
    if (error) return { error: error.message };
    // Update phone if provided
    if (data.user && phone) {
      await supabase.from('profiles').update({ phone }).eq('id', data.user.id);
    }
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    cancelSpeech();
    if (watchIdRef.current >= 0) clearWatch(watchIdRef.current);
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null); setSession(null); setProfile(null);
    setLocation({ lat: null, lng: null, accuracy: null, timestamp: null, status: 'idle', error: null, isLive: false });
    setTrips([]); setNotifications(DEMO_NOTIFICATIONS);
    setCitizenSubmissions([]);
    setNearbyHazards([]);
    setAlertedHazardIds(new Set());
    setVehicleData(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>): Promise<{ error: string | null }> => {
    if (!profile) return { error: 'Not logged in' };
    const newProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };
    setProfile(newProfile);
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    if (error) return { error: error.message };
    return { error: null };
  }, [profile]);

  const uploadAvatar = useCallback(async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!profile) return { url: null, error: 'Not logged in' };
    if (!isSupabaseConfigured) {
      const url = URL.createObjectURL(file);
      setProfile((p) => p ? { ...p, avatar_url: url } : p);
      return { url, error: null };
    }
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = data.publicUrl + '?t=' + Date.now();
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    setProfile((p) => p ? { ...p, avatar_url: url } : p);
    return { url, error: null };
  }, [profile]);

  // ============================================================
  // Vehicle
  // ============================================================
  const saveVehicle = useCallback(async (data: VehicleData): Promise<{ error: string | null }> => {
    setVehicleData(data);
    if (!profile || !isSupabaseConfigured) return { error: null };
    const { error } = await supabase.from('vehicles').upsert({
      driver_id: profile.id,
      ...data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'driver_id' });
    if (error) return { error: error.message };
    return { error: null };
  }, [profile]);

  // ============================================================
  // Language
  // ============================================================
  const setLanguage = useCallback((lang: LangCode) => {
    cancelSpeech();
    setLanguageState(lang);
    localStorage.setItem('smartlog_lang', lang);
    if (profile && isSupabaseConfigured) {
      supabase.from('profiles').update({ language_code: lang }).eq('id', profile.id);
    }
  }, [profile]);

  const setVoiceGender = useCallback((g: 'female' | 'male') => {
    setVoiceGenderState(g);
    localStorage.setItem('smartlog_voice_gender', g);
  }, []);

  const setSpeechSpeed = useCallback((s: 'slow' | 'normal' | 'fast') => {
    setSpeechSpeedState(s);
    localStorage.setItem('smartlog_speech_speed', s);
  }, []);

  useEffect(() => {
    const lang = localStorage.getItem('smartlog_lang') as LangCode | null;
    if (lang) setLanguageState(lang);
    const gender = localStorage.getItem('smartlog_voice_gender') as 'female' | 'male' | null;
    if (gender) setVoiceGenderState(gender);
    const speed = localStorage.getItem('smartlog_speech_speed') as 'slow' | 'normal' | 'fast' | null;
    if (speed) setSpeechSpeedState(speed);
  }, []);

  // ============================================================
  // Location
  // ============================================================
  const requestLocation = useCallback(async () => {
    setLocation((l) => ({ ...l, status: 'requesting', error: null }));
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      setLocation((l) => ({ ...l, lat, lng, accuracy, timestamp: pos.timestamp, status: 'granted', error: null }));
      if (user && isSupabaseConfigured && profile?.role === 'driver') {
        await supabase.from('driver_locations').insert({ driver_id: user.id, lat, lng, accuracy, is_live: false });
      }
    } catch (err) {
      const msg = (err as GeolocationPositionError).code
        ? geolocationErrorMessage(err as GeolocationPositionError)
        : 'Location unavailable';
      setLocation((l) => ({ ...l, status: (err as GeolocationPositionError).code === 1 ? 'denied' : 'unavailable', error: msg }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  const setLiveTracking = useCallback((on: boolean) => {
    setLocation((l) => ({ ...l, isLive: on }));
    if (!on) {
      if (watchIdRef.current >= 0) { clearWatch(watchIdRef.current); watchIdRef.current = -1; }
      return;
    }
    if (watchIdRef.current >= 0) return;
    watchIdRef.current = watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setLocation((l) => ({ ...l, lat, lng, accuracy, timestamp: pos.timestamp, status: 'granted', error: null }));
        if (user && isSupabaseConfigured && profile?.role === 'driver') {
          await supabase.from('driver_locations').insert({ driver_id: user.id, lat, lng, accuracy, is_live: true });
        }
      },
      (err) => {
        setLocation((l) => ({ ...l, status: 'denied', error: geolocationErrorMessage(err) }));
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile]);

  useEffect(() => {
    return () => { if (watchIdRef.current >= 0) clearWatch(watchIdRef.current); };
  }, []);

  // ============================================================
  // Proximity alert engine (drivers)
  // ============================================================
  useEffect(() => {
    if (!location.lat || !location.lng || profile?.role !== 'driver') return;
    const nearby = checkProximityToHazards(location.lat, location.lng, incidents);
    setNearbyHazards(nearby);
  }, [location.lat, location.lng, incidents, profile?.role]);

  const dismissHazardAlert = useCallback((id: string) => {
    setAlertedHazardIds((prev) => new Set([...prev, id]));
  }, []);

  // ============================================================
  // Offline queue
  // ============================================================
  const addToOfflineQueue = useCallback((entry: Omit<OfflineQueueEntry, 'id' | 'timestamp'>) => {
    const newEntry: OfflineQueueEntry = {
      ...entry,
      id: 'offline-' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    setOfflineQueue((q) => {
      const updated = [...q, newEntry];
      saveOfflineQueue(updated);
      return updated;
    });
  }, []);

  // Retry offline queue when back online
  useEffect(() => {
    const processQueue = async () => {
      if (!navigator.onLine || !isSupabaseConfigured || offlineQueue.length === 0) return;
      const processed: string[] = [];
      for (const entry of offlineQueue) {
        try {
          if (entry.type === 'emergency') {
            await supabase.from('emergencies').insert(entry.payload);
            processed.push(entry.id);
          } else if (entry.type === 'incident') {
            await supabase.from('incidents').insert(entry.payload);
            processed.push(entry.id);
          } else if (entry.type === 'citizen_submission') {
            await supabase.from('citizen_submissions').insert(entry.payload);
            processed.push(entry.id);
          }
        } catch { /* keep in queue */ }
      }
      if (processed.length > 0) {
        setOfflineQueue((q) => {
          const updated = q.filter((e) => !processed.includes(e.id));
          saveOfflineQueue(updated);
          return updated;
        });
      }
    };
    window.addEventListener('online', processQueue);
    return () => window.removeEventListener('online', processQueue);
  }, [offlineQueue]);

  // ============================================================
  // Notifications
  // ============================================================
  const markRead = useCallback(async (id: string) => {
    setNotifications((ns) => ns.map((n) => n.id === id ? { ...n, read: true } : n));
    if (isSupabaseConfigured && user) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    }
  }, [user]);

  const markAllRead = useCallback(async () => {
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    if (isSupabaseConfigured && user) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    }
  }, [user]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'created_at' | 'read'>) => {
    const newN: AppNotification = { ...n, id: 'local-' + Date.now(), created_at: new Date().toISOString(), read: false };
    setNotifications((ns) => [newN, ...ns]);
  }, []);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data && data.length > 0) setNotifications(data as AppNotification[]);
      });

    const sub = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((ns) => [payload.new as AppNotification, ...ns]);
        })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user]);

  // ============================================================
  // Trips
  // ============================================================
  const refreshTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const driverId = user?.id || 'DRV-102';
      const backendTrips = await fetchDriverTrips(driverId);
      if (backendTrips && backendTrips.length > 0) {
        const mappedTrips: AppTrip[] = backendTrips.map((b) => {
          let st = (b.status || 'available').toLowerCase();
          if (st === 'assigned') st = 'available';
          if (st === 'en_route') st = 'in_transit';

          const origName = b.origin_name || 'Guwahati Hub';
          const destName = b.destination_name || 'Shillong Hub';

          // Lat/Lng mapping
          const pLat = b.current_lat || (origName.includes('Guwahati') ? 26.1445 : origName.includes('Tezpur') ? 26.6338 : 26.1445);
          const pLng = b.current_lng || (origName.includes('Guwahati') ? 91.7362 : origName.includes('Tezpur') ? 92.8000 : 91.7362);
          const dLat = destName.includes('Shillong') ? 25.5788 : destName.includes('Tezpur') ? 26.6338 : destName.includes('Tawang') ? 27.5861 : destName.includes('Nagaon') ? 26.3450 : 25.5788;
          const dLng = destName.includes('Shillong') ? 91.8933 : destName.includes('Tezpur') ? 92.8000 : destName.includes('Tawang') ? 91.8594 : destName.includes('Nagaon') ? 92.6840 : 91.8933;

          let prio: 'urgent' | 'priority' | 'normal' = 'normal';
          const rawPrio = (b.priority || '').toLowerCase();
          if (rawPrio === 'emergency' || rawPrio === 'urgent') prio = 'urgent';
          else if (rawPrio === 'priority' || rawPrio === 'high') prio = 'priority';

          return {
            id: b.trip_id,
            trip_code: b.trip_code || b.trip_id,
            product: b.commodity_type || b.package_details || 'Essential Supplies',
            quantity: b.package_details || '1 Load',
            pickup_location: origName,
            drop_location: destName,
            pickup_lat: pLat,
            pickup_lng: pLng,
            drop_lat: dLat,
            drop_lng: dLng,
            distance_km: b.distance_km || 98.0,
            duration_mins: b.duration_mins || 140,
            capacity: '4.5 Tons',
            priority: prio,
            status: st,
            driver_id: b.driver_id || null,
            instructions: b.instructions || null,
            road_condition: b.road_condition || null,
            accepted_at: b.accepted_at || null,
          };
        });
        setTrips(mappedTrips);
        setTripsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('[AppContext] Failed to load from backend, fallback to demo/supabase:', err);
    }

    if (!isSupabaseConfigured) {
      setTrips(demoTripsData.map((t) => ({
        id: t.id,
        trip_code: t.id,
        product: t.product,
        quantity: t.quantity,
        pickup_location: t.pickup,
        drop_location: t.drop,
        pickup_lat: t.pickup_lat ?? 26.1445,
        pickup_lng: t.pickup_lng ?? 91.7362,
        drop_lat: t.drop_lat ?? 25.5788,
        drop_lng: t.drop_lng ?? 91.8933,
        distance_km: parseFloat(t.distance),
        duration_mins: 0,
        capacity: t.capacity,
        priority: t.priority,
        status: 'available',
        driver_id: null,
        instructions: t.instructions || null,
        road_condition: t.roadCondition || null,
        accepted_at: null,
      })));
      setTripsLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .or(`status.eq.available,driver_id.eq.${user?.id}`)
      .order('created_at', { ascending: false });
    if (!error && data) setTrips(data as AppTrip[]);
    setTripsLoading(false);
  }, [user]);

  useEffect(() => {
    refreshTrips();
    const interval = setInterval(() => {
      refreshTrips();
    }, 4000);
    return () => clearInterval(interval);
  }, [refreshTrips]);

  const acceptTrip = useCallback(async (tripId: string): Promise<{ success: boolean; error: string | null }> => {
    const driverId = user?.id || (profile?.role === 'driver' ? profile.id : 'DRV-102');
    
    // Call backend API
    const res = await acceptTripBackend(tripId, driverId, location.lat || undefined, location.lng || undefined);
    if (res.success) {
      setTrips((ts) => ts.map((t) => (t.id === tripId || t.trip_code === tripId) ? { ...t, status: 'accepted', driver_id: driverId, accepted_at: new Date().toISOString() } : t));
      addNotification({ category: 'trip', title: 'Trip Accepted', body: `You have accepted Trip #${tripId}.`, priority: 'normal' });
      await refreshTrips();
      return { success: true, error: null };
    }

    if (isSupabaseConfigured && user) {
      const { data, error } = await supabase.rpc('accept_trip', { trip_id: tripId, driver_uuid: user.id });
      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: 'Trip was already accepted by another driver.' };
      await refreshTrips();
      addNotification({ category: 'trip', title: 'Trip Accepted', body: `You have accepted a new trip.`, priority: 'normal' });
      return { success: true, error: null };
    }

    setTrips((ts) => ts.map((t) => (t.id === tripId || t.trip_code === tripId) ? { ...t, status: 'accepted', driver_id: driverId, accepted_at: new Date().toISOString() } : t));
    addNotification({ category: 'trip', title: 'Trip Accepted', body: `You have accepted Trip #${tripId}.`, priority: 'normal' });
    return { success: true, error: null };
  }, [user, profile, location, addNotification, refreshTrips]);

  const updateTripStatus = useCallback(async (tripId: string, status: string): Promise<{ error: string | null }> => {
    setTrips((ts) => ts.map((t) => t.id === tripId ? { ...t, status } : t));
    if (!isSupabaseConfigured) return { error: null };
    const { error } = await supabase.from('trips').update({ status, updated_at: new Date().toISOString() }).eq('id', tripId);
    if (error) return { error: error.message };
    return { error: null };
  }, []);

  const startTrip = useCallback(async (tripId: string): Promise<{ success: boolean; error: string | null }> => {
    const driverId = user?.id || (profile?.role === 'driver' ? profile.id : 'DRV-102');
    const res = await startTripBackend(tripId, driverId, location.lat || undefined, location.lng || undefined);
    setTrips((ts) => ts.map((t) => (t.id === tripId || t.trip_code === tripId) ? { ...t, status: 'in_transit' } : t));
    return { success: res.success, error: res.error || null };
  }, [user, profile, location]);

  const updateTripLocation = useCallback((tripId: string, lat: number, lng: number, speed = 40, progress = 0) => {
    updateTripLocationBackend(tripId, lat, lng, speed, progress);
  }, []);

  const finishTrip = useCallback(async (tripId: string): Promise<{ error: string | null }> => {
    const driverId = user?.id || (profile?.role === 'driver' ? profile.id : 'DRV-102');
    
    // Call backend API
    const res = await completeTripBackend(tripId, driverId);
    
    // Optimistic / local state update
    setTrips((ts) => ts.map((t) => (t.id === tripId || t.trip_code === tripId) ? { ...t, status: 'completed' } : t));
    addNotification({
      category: 'trip',
      title: 'Trip Completed',
      body: `Trip #${tripId} has been successfully completed.`,
      priority: 'normal',
    });

    if (isSupabaseConfigured && user) {
      await supabase
        .from('trips')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);
    }

    await refreshTrips();
    return { error: res.error || null };
  }, [user, profile, addNotification, refreshTrips]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    const sub = supabase.channel('trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => { refreshTrips(); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user, refreshTrips]);

  // ============================================================
  // Incidents
  // ============================================================
  const refreshIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    if (!isSupabaseConfigured) {
      setIncidents(demoMarkersData.map((m, i) => ({
        id: m.id,
        incident_code: 'INC-' + (48291 - i),
        type: m.type,
        severity: m.severity,
        lat: m.lat ?? null,
        lng: m.lng ?? null,
        location_name: m.detail,
        description: m.action,
        reporter_id: null,
        status: 'verified',
        created_at: new Date().toISOString(),
      })));
      setIncidentsLoading(false);
      return;
    }
    const { data } = await supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(50);
    if (data) setIncidents(data as AppIncident[]);
    setIncidentsLoading(false);
  }, []);

  useEffect(() => { refreshIncidents(); }, [refreshIncidents]);

  const submitIncident = useCallback(async (
    data: Partial<AppIncident>,
    mediaFiles?: File[],
  ): Promise<{ id: string | null; code: string | null; error: string | null }> => {
    const incidentCode = 'INC-' + Math.floor(10000 + Math.random() * 90000);
    const payload = {
      ...data,
      incident_code: incidentCode,
      reporter_id: user?.id,
      lat: data.lat ?? location.lat,
      lng: data.lng ?? location.lng,
    };

    if (!isSupabaseConfigured) {
      if (!navigator.onLine) {
        addToOfflineQueue({ type: 'incident', payload });
        addNotification({ category: 'report', title: 'Report Queued', body: 'No connection. Report will be submitted when online.', priority: 'normal' });
        return { id: null, code: incidentCode, error: null };
      }
      const newInc: AppIncident = {
        id: 'local-' + Date.now(),
        incident_code: incidentCode,
        type: data.type || 'Other',
        severity: data.severity || 'medium',
        lat: data.lat ?? location.lat,
        lng: data.lng ?? location.lng,
        location_name: data.location_name || null,
        description: data.description || null,
        reporter_id: user?.id || null,
        status: 'submitted',
        created_at: new Date().toISOString(),
      };
      setIncidents((is) => [newInc, ...is]);
      addNotification({ category: 'report', title: `Report ${incidentCode} Submitted`, body: 'Your incident report is under review.', priority: 'normal' });
      return { id: newInc.id, code: incidentCode, error: null };
    }

    if (!navigator.onLine) {
      addToOfflineQueue({ type: 'incident', payload });
      addNotification({ category: 'report', title: 'Report Queued', body: 'You are offline. Report will be submitted automatically when connection is restored.', priority: 'high' });
      return { id: null, code: incidentCode, error: null };
    }

    const { data: inserted, error } = await supabase.from('incidents').insert(payload).select().single();
    if (error) return { id: null, code: null, error: error.message };

    if (mediaFiles && mediaFiles.length > 0 && inserted) {
      for (const file of mediaFiles) {
        const ext = file.name.split('.').pop();
        const path = `${inserted.id}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('incident-media').upload(path, file);
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('incident-media').getPublicUrl(path);
          await supabase.from('incident_media').insert({
            incident_id: inserted.id,
            url: urlData.publicUrl,
            type: file.type.startsWith('video') ? 'video' : 'photo',
            file_name: file.name,
            file_size: file.size,
            uploaded_by: user?.id,
          });
        }
      }
    }

    addNotification({ category: 'report', title: `Report ${incidentCode} Submitted`, body: 'Your incident report is under review by the operations desk.', priority: 'normal' });
    await refreshIncidents();
    return { id: inserted.id, code: incidentCode, error: null };
  }, [user, location, addNotification, refreshIncidents, addToOfflineQueue]);

  // Dynamic route re-evaluation: new incident → notify driver if on active trip
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sub = supabase.channel('incidents')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'incidents' }, (payload) => {
        const inc = payload.new as AppIncident;
        setIncidents((is) => [inc, ...is]);
        addNotification({ category: 'disaster', title: `New Incident: ${inc.type}`, body: inc.description || 'New incident reported.', priority: 'high' });
        // If driver has active trip and incident has coords, proximity check
        if (profile?.role === 'driver' && location.lat && location.lng && inc.lat && inc.lng) {
          const dist = haversineDistance(location.lat, location.lng, inc.lat, inc.lng);
          if (dist <= 20) {
            addNotification({
              category: 'disaster',
              title: `⚠ Route Warning: ${inc.type}`,
              body: `A new ${inc.type} has been reported ${dist.toFixed(1)} km from your location. Your route may be affected.`,
              priority: 'critical',
            });
          }
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [addNotification, profile?.role, location.lat, location.lng]);

  // ============================================================
  // Emergency
  // ============================================================
  const submitEmergency = useCallback(async (type: string): Promise<{ error: string | null; locationName: string }> => {
    let locationName = 'Your current location';
    const lat = location.lat;
    const lng = location.lng;

    if (lat && lng) {
      try {
        const { reverseGeocode } = await import('../lib/geocoding');
        const geo = await reverseGeocode(lat, lng);
        locationName = geo.shortName;
      } catch { /* fallback */ }
    }

    const payload = {
      type,
      lat,
      lng,
      location_name: locationName,
      reported_by: user?.id,
      reporter_role: profile?.role,
      reporter_name: profile?.full_name,
    };

    if (!isSupabaseConfigured) {
      addNotification({ category: 'emergency', title: `Emergency: ${type}`, body: `${type} reported at ${locationName}. Operations desk notified.`, priority: 'critical' });
      return { error: null, locationName };
    }

    if (!navigator.onLine) {
      addToOfflineQueue({ type: 'emergency', payload });
      addNotification({ category: 'emergency', title: `Emergency Queued: ${type}`, body: 'No connection. Emergency will be transmitted when online.', priority: 'critical' });
      return { error: null, locationName };
    }

    const { error } = await supabase.from('emergencies').insert(payload);
    if (error) return { error: error.message, locationName };

    addNotification({ category: 'emergency', title: `Emergency: ${type}`, body: `${type} reported at ${locationName}. Operations desk notified.`, priority: 'critical' });
    return { error: null, locationName };
  }, [location, user, profile, addNotification, addToOfflineQueue]);

  // ============================================================
  // Citizen submissions
  // ============================================================
  const refreshCitizenSubmissions = useCallback(async () => {
    if (!user || profile?.role !== 'citizen') return;
    setCitizenSubmissionsLoading(true);
    if (!isSupabaseConfigured) {
      setCitizenSubmissions([]);
      setCitizenSubmissionsLoading(false);
      return;
    }
    const { data } = await supabase
      .from('citizen_submissions')
      .select('*')
      .eq('citizen_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setCitizenSubmissions(data as CitizenSubmission[]);
    setCitizenSubmissionsLoading(false);
  }, [user, profile]);

  useEffect(() => {
    if (profile?.role === 'citizen') refreshCitizenSubmissions();
  }, [profile, refreshCitizenSubmissions]);

  const submitCitizenMedia = useCallback(async (
    files: File[],
    description: string,
    incidentType?: string,
  ): Promise<{ id: string | null; code: string | null; error: string | null }> => {
    if (!user) return { id: null, code: null, error: 'Not logged in' };

    const submissionCode = 'SUB-' + Math.floor(10000 + Math.random() * 90000);
    const lat = location.lat;
    const lng = location.lng;

    let locationName: string | null = null;
    if (lat && lng) {
      try {
        const { reverseGeocode } = await import('../lib/geocoding');
        const geo = await reverseGeocode(lat, lng);
        locationName = geo.shortName;
      } catch { /* fallback */ }
    }

    const payload = {
      submission_code: submissionCode,
      citizen_id: user.id,
      description: description || null,
      lat,
      lng,
      location_name: locationName,
      incident_type: incidentType || null,
    };

    if (!isSupabaseConfigured) {
      const localSub: CitizenSubmission = {
        id: 'local-' + Date.now(),
        submission_code: submissionCode,
        citizen_id: user.id,
        description: description || null,
        lat,
        lng,
        location_name: locationName,
        incident_type: incidentType || null,
        status: 'submitted',
        created_at: new Date().toISOString(),
      };
      setCitizenSubmissions((s) => [localSub, ...s]);
      addNotification({ category: 'report', title: 'Evidence Submitted', body: `Submission ${submissionCode} received. Thank you for your report.`, priority: 'normal' });
      return { id: localSub.id, code: submissionCode, error: null };
    }

    if (!navigator.onLine) {
      addToOfflineQueue({ type: 'citizen_submission', payload });
      addNotification({ category: 'report', title: 'Submission Queued', body: 'No connection. Your evidence will be submitted when online.', priority: 'high' });
      return { id: null, code: submissionCode, error: null };
    }

    const { data: inserted, error } = await supabase
      .from('citizen_submissions')
      .insert(payload)
      .select()
      .single();

    if (error) return { id: null, code: null, error: error.message };

    // Upload media files
    for (const file of files) {
      // Validate file
      const maxSize = parseFloat(import.meta.env.VITE_MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
      if (file.size > maxSize) continue;
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) continue;

      const ext = file.name.split('.').pop();
      const path = `${user.id}/${inserted.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('citizen-media').upload(path, file);
      if (!uploadErr && uploadData) {
        const { data: urlData } = supabase.storage.from('citizen-media').getPublicUrl(path);
        await supabase.from('citizen_submission_media').insert({
          submission_id: inserted.id,
          url: urlData.publicUrl,
          type: file.type.startsWith('video') ? 'video' : 'photo',
          file_name: file.name,
          file_size: file.size,
          uploaded_by: user.id,
        });
      }
    }

    addNotification({ category: 'report', title: 'Evidence Submitted', body: `Submission ${submissionCode} received. Thank you for helping keep communities safe.`, priority: 'normal' });
    await refreshCitizenSubmissions();
    return { id: inserted.id, code: submissionCode, error: null };
  }, [user, location, addNotification, refreshCitizenSubmissions, addToOfflineQueue]);

  // ============================================================
  // PIN
  // ============================================================
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!user) return false;
    if (!isSupabaseConfigured) return pin === '1234';
    const { data } = await supabase.rpc('verify_officer_pin', { p_user_id: user.id, p_pin: pin });
    return !!data;
  }, [user]);

  const setPin = useCallback(async (pin: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) { setPinSet(true); return { error: null }; }
    const { error } = await supabase.rpc('set_officer_pin', { p_pin: pin });
    if (!error) setPinSet(true);
    return { error: error?.message || null };
  }, []);

  // ============================================================
  // Context value
  // ============================================================
  const value: AppContextValue = {
    user, session, profile, authLoading,
    login, register, logout, updateProfile, uploadAvatar,
    language, setLanguage, voiceGender, setVoiceGender, speechSpeed, setSpeechSpeed,
    location, requestLocation, setLiveTracking,
    notifications, unreadCount, markRead, markAllRead, addNotification,
    trips, tripsLoading, activeTrip, refreshTrips, acceptTrip, startTrip, updateTripLocation, updateTripStatus, finishTrip,
    incidents, incidentsLoading, refreshIncidents, submitIncident,
    submitEmergency,
    verifyPin, setPin, pinSet,
    saveVehicle, vehicleData, hasRequiredVehicle,
    citizenSubmissions, citizenSubmissionsLoading, refreshCitizenSubmissions, submitCitizenMedia,
    nearbyHazards, alertedHazardIds, dismissHazardAlert,
    offlineQueue,
    isConfigured: isSupabaseConfigured,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
