export type Role = 
  | 'Admin / Central Command'
  | 'State Logistics Director' 
  | 'Chief Engineer (BRO)' 
  | 'Emergency Response Officer (NDRF)' 
  | 'District Authority / DLO'
  | 'Logistics Officer';

export type DataTier = 'LIVE' | 'CACHED' | 'SIMULATED';

export interface User {
  username: string;
  full_name: string;
  role: Role;
  department: string;
  state: string;
  access_token?: string;
  district?: string;
  badge_id?: string;
  phone?: string;
  status?: 'ACTIVE' | 'ON_DUTY' | 'STANDBY';
}

export interface LogisticsHub {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  type: string;
  capacity_tons: number;
}

export interface Chokepoint {
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  hazard_type: string;
  current_status: 'OPEN' | 'ADVISORY' | 'WARNING' | 'HIGH_RISK' | 'CRITICAL_BLOCKED';
  description: string;
  affected_corridor: string;
  average_clearance_hrs: number;
  alternate_bypass: string;
}

export interface DistrictHealth {
  district_id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  connectivity_index: number;
  status: 'HEALTHY' | 'WARNING' | 'ADVISORY' | 'CRITICAL_DEFICIT';
  oxygen_days: number;
  medicine_days: number;
  grain_stock_tonnes: number;
  diesel_reserves_days: number;
  active_chokepoints: number;
  vulnerability_score: number;
}

export interface FleetVehicle {
  id: string;
  vehicle_no: string;
  cargo_type: 
    | 'ESSENTIAL_MEDICINES'
    | 'ESSENTIAL_MEDICINES_COLD_CHAIN' 
    | 'MEDICAL_OXYGEN_CYLINDERS' 
    | 'FOOD_GRAINS'
    | 'FOOD_GRAINS_PDS' 
    | 'DISASTER_RELIEF_KITS' 
    | 'PETROLEUM_FUEL' 
    | 'AGRICULTURAL_PRODUCE'
    | 'CONSTRUCTION_MATERIALS';
  commodity_type?: string;
  cargo_desc: string;
  priority_level?: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  current_lat: number;
  current_lng: number;
  speed_kmh: number;
  heading_deg?: number;
  driver_name: string;
  driver_phone: string;
  temp_celsius?: number;
  temp_target_range?: [number, number];
  weight_tonnes: number;
  progress_pct: number;
  status: 'EN_ROUTE' | 'REROUTED_AI' | 'PILOT_ESCORT' | 'EMERGENCY_SOS' | 'DELIVERED' | 'HALTED_INCIDENT' | 'CONGESTION';
  connectivity_status?: 'CONNECTED' | 'LIMITED_CONNECTIVITY' | 'OFFLINE';
  risk_advisory: string;
  is_sos: boolean;
  mid_trip_risk_score?: number;
  mid_trip_risk_level?: string;
  disruption_alert?: {
    alert_id: string;
    severity: string;
    risk_score: number;
    message: string;
    alternative_action: string;
  } | null;
}

export interface Incident {
  id: string;
  title: string;
  category: 'LANDSLIDE' | 'FLASH_FLOOD' | 'BRIDGE_WASHOUT' | 'MUDSLIDE' | 'ROCKFALL' | 'SNOW_BLOCK' | 'TREE_FALL' | 'INFRASTRUCTURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_BLOCKED';
  state: string;
  district: string;
  lat: number;
  lng: number;
  description: string;
  reporter_name: string;
  reporter_role: string;
  created_at: string;
  photo_url?: string;
  passable_by: 'NONE' | '4X4_ONLY' | 'LIGHT_VEHICLES_ONLY' | 'ALL_VEHICLES';
  verification_status: 'PENDING_VERIFICATION' | 'VERIFIED_OFFICIAL' | 'RESOLVED' | 'REJECTED';
  upvotes: number;
  offline_synced?: boolean;
  trust_score_pct?: number;
  trust_level?: 'UNVERIFIED' | 'LOW TRUST' | 'MEDIUM TRUST' | 'HIGH TRUST' | 'OFFICIALLY VERIFIED' | 'REJECTED / INVALID' | 'CLEARED & RESOLVED';
  trust_badge_color?: string;
  trust_explanation?: string;
  trust_factors?: Record<string, number>;
  admin_notes?: string;
}

export interface RouteWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation_m: number;
  district?: string;
  state?: string;
}

export interface CandidateRoute {
  route_id: string;
  name: string;
  route_type: 'PRIMARY' | 'AI_OPTIMIZED' | 'EMERGENCY_CORRIDOR';
  distance_km: number;
  estimated_time_hrs: number;
  eta_display: string;
  convlstm_risk_score: number;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  disruption_probability: number;
  predicted_disruption: string;
  road_bridge_status: string;
  weather_risk: string;
  route_status: 'OPEN' | 'CAUTION' | 'HIGH_RISK' | 'BLOCKED';
  elevation_gain_m: number;
  fuel_estimate_litres: number;
  waypoints: RouteWaypoint[];
  path_nodes: string[];
  recommendation: 'RECOMMENDED' | 'ALTERNATIVE' | 'AVOID';
  recommendation_badge: string;
  is_recommended: boolean;
  composite_penalty?: number;
}

export interface OptimizedRoute extends CandidateRoute {
  label?: string;
  safety_score?: number;
  ner_gdi_score?: number;
  carbon_footprint_kg?: number;
  risk_percentage?: number;
  risk_label?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export interface SafeHaltLocation {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  district: string;
  state: string;
  capacity_trucks: number;
  security_level: string;
  amenities: string[];
  safety_rating: number;
  distance_from_vehicle_km?: number;
  eta_minutes?: number;
}

export interface TripItem {
  trip_id: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  commodity_type: string;
  package_details: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  vehicle_id: string;
  vehicle_no: string;
  priority: 'NORMAL' | 'HIGH' | 'EMERGENCY';
  status: 'ASSIGNED' | 'ACCEPTED' | 'DRIVER_REJECTED' | 'EN_ROUTE' | 'HALTED' | 'COMPLETED';
  assigned_route_id: string;
  assigned_route_name: string;
  distance_km: number;
  eta_display: string;
  convlstm_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
  current_lat: number;
  current_lng: number;
  progress_pct: number;
  speed_kmh: number;
  connectivity?: 'CONNECTED' | 'LIMITED_CONNECTIVITY' | 'OFFLINE';
  candidate_routes?: CandidateRoute[];
  safe_halts_available?: SafeHaltLocation[];
  selected_halt?: SafeHaltLocation;
  rejection_reason?: string;
}

export interface ConvLSTMPrediction {
  prediction_id: string;
  timestamp: string;
  risk_score: number;
  risk_probability: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  disruption_probability: number;
  predicted_disruption: string;
  estimated_delay_mins: number;
  confidence: number;
  model: string;
  model_version: string;
  prediction_horizon_steps: number;
  prediction_horizon_note: string;
  grid_cell: {
    row: number;
    col: number;
    lat: number;
    lng: number;
  };
  recommended_action: string;
  input_features: Record<string, any>;
}

export interface MLPrediction {
  risk_level: 'LOW' | 'MODERATE' | 'MEDIUM' | 'HIGH' | 'CRITICAL_BLOCKED';
  disruption_probability: number;
  estimated_delay_mins: number;
  clearance_eta_hours?: number;
  risk_score?: number;
  risk_probability?: number;
  confidence?: number;
  class_probabilities?: {
    low: number;
    moderate: number;
    high: number;
    critical: number;
  };
  recommended_action: string;
  model?: string;
  model_version?: string;
  prediction_horizon_steps?: number;
  prediction_horizon_note?: string;
  grid_cell?: {
    row: number;
    col: number;
    lat: number;
    lng: number;
  };
}

export interface WeatherStation {
  city: string;
  state: string;
  lat: number;
  lng: number;
  temp_c: number;
  humidity_pct: number;
  rainfall_mm_hr: number;
  condition: string;
  alert: string;
  hazard_type?: string;
  hazard_index?: number;
  tier?: DataTier;
  data_source_badge?: string;
  last_updated?: string;
}

export interface NERGDI_Factor {
  factor_name: string;
  value: string;
  level: 'Low' | 'Medium' | 'High';
  contribution_pct: number;
}

export interface NERGDI_Assessment {
  ner_gdi_score: number;
  category: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_color: string;
  status_description: string;
  factor_breakdown: Record<string, NERGDI_Factor>;
  plain_language_explanation: string;
  is_simulation: boolean;
  attribution: string;
}

export interface CorridorInfo {
  corridor_id: string;
  corridor_name: string;
  length_km: number;
  current_accessibility_status: string;
  corridor_risk_score: number;
  active_disruptions_count: number;
  average_delay_mins: number;
  alternate_bypass_available: boolean;
  bypass_corridor?: string;
  criticality: string;
  state_coverage: string[];
}

export interface SatelliteMetadata {
  service_name: string;
  active_tier: string;
  last_updated_timestamp: string;
  data_source_badge: string;
  resolution_meters: number;
  available_layers: Array<{
    id: string;
    name: string;
    description: string;
    status: string;
    scale_range: string;
  }>;
  integration_point: string;
  disclaimer: string;
}

// --- OFFLINE-FIRST ARCHITECTURE TYPES ---

export type SyncStatus = 'PENDING_UPLOAD' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface CachedItemMetadata {
  cached_at: string;
  expires_at: string;
  is_stale?: boolean;
}

export interface QueuedDriverAction {
  client_action_id: string;
  trip_id: string;
  action_type: 'ACCEPT' | 'REJECT' | 'START' | 'COMPLETE' | 'FINISH' | 'LOCATION_UPDATE';
  payload?: any;
  user_id: string;
  timestamp: string;
  sync_status: SyncStatus;
  retry_count: number;
  last_error?: string;
}

export interface OfflineMediaAttachment {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  media_type: 'PHOTO' | 'VIDEO';
  blob_key: string;
  blob?: Blob;
  preview_url?: string;
}

export interface OfflineIncidentReport {
  client_report_id: string;
  user_id: string;
  type: Incident['category'];
  category: Incident['category'];
  severity: Incident['severity'];
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  state: string;
  district: string;
  reporter_name: string;
  reporter_role: string;
  passable_by: Incident['passable_by'];
  timestamp: string;
  created_at: string;
  media: OfflineMediaAttachment[];
  photo_url?: string;
  video_url?: string;
  sync_status: SyncStatus;
  server_id?: string;
  retry_count: number;
  last_error?: string;
  uploaded_at?: string;
}

export interface TurnInstruction {
  step: number;
  instruction: string;
  distance_km: number;
  eta_mins: number;
  road_name?: string;
  icon?: string;
}

export interface DriverTripCache {
  trip: TripItem;
  candidate_routes: CandidateRoute[];
  selected_route_id: string;
  safe_halts: SafeHaltLocation[];
  turn_instructions: TurnInstruction[];
  language_code: string;
  disaster_alerts: any[];
  weather_snapshot?: any;
  ml_prediction_snapshot?: any;
  cached_at: string;
  expires_at: string;
  user_id: string;
}

export interface CachedPredictionData {
  id: string;
  key: string;
  data: any;
  user_id: string;
  cached_at: string;
  expires_at: string;
}

export interface NetworkHealthState {
  isOnline: boolean;
  isBackendReachable: boolean;
  lastCheckedAt: string;
  latencyMs?: number;
}

