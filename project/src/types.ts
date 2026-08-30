export type Role = 'driver' | 'officer' | 'citizen';

export type Screen =
  | 'splash'
  | 'roleSelect'
  | 'driverLogin'
  | 'driverSignup'
  | 'officerLogin'
  | 'officerSignup'
  | 'citizenLogin'
  | 'citizenSignup'
  | 'securityLock'
  | 'profileSetup'
  | 'vehicleInfo'
  | 'locationPermission'
  | 'driverHome'
  | 'driverTrips'
  | 'driverMap'
  | 'driverAlerts'
  | 'driverProfile'
  | 'tripDetails'
  | 'navigation'
  | 'routeSelection'
  | 'noSafeRoute'
  | 'safeHalt'
  | 'officerHome'
  | 'officerMap'
  | 'officerReports'
  | 'officerAlerts'
  | 'officerProfile'
  | 'evidenceUpload'
  | 'incidentReport'
  | 'reportConfirmation'
  | 'citizenHome'
  | 'citizenUpload'
  | 'citizenSubmissions'
  | 'citizenProfile'
  | 'languageSettings';

export type Priority = 'normal' | 'priority' | 'urgent';

export interface Trip {
  id: string;
  product: string;
  quantity: string;
  pickup: string;
  drop: string;
  pickup_lat?: number;
  pickup_lng?: number;
  drop_lat?: number;
  drop_lng?: number;
  distance: string;
  duration: string;
  capacity: string;
  priority: Priority;
  requestTime: string;
  instructions?: string;
  roadCondition?: string;
}

export type IncidentType =
  | 'Landslide'
  | 'Flood'
  | 'Heavy Rain'
  | 'Road Block'
  | 'Road Blockage'
  | 'Accident'
  | 'Severe Weather'
  | 'Road Damage'
  | 'Other';

export type Severity = 'low' | 'medium' | 'high';

export interface DisasterMarker {
  id: string;
  type: IncidentType;
  label: string;
  detail: string;
  severity: Severity;
  timeReported: string;
  distance: string;
  action: string;
  top: string;
  left: string;
  variant: 'danger' | 'warning' | 'advisory';
  lat?: number;
  lng?: number;
}

export interface NotificationItem {
  id: string;
  category: 'trip' | 'navigation' | 'disaster' | 'emergency' | 'report' | 'system';
  title: string;
  body: string;
  time: string;
  priority: 'normal' | 'high' | 'critical';
  read: boolean;
}

export interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  region: 'global' | 'india' | 'ner';
}

export interface CitizenSubmission {
  id: string;
  submission_code: string;
  citizen_id: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  location_name: string | null;
  incident_type: string | null;
  status: 'submitted' | 'under_review' | 'verified' | 'resolved';
  created_at: string;
}

export const trips: Trip[] = [
  {
    id: 'TR-2048',
    product: 'Electronics',
    quantity: '24 Packages',
    pickup: 'Guwahati Distribution Center',
    drop: 'Shillong Warehouse',
    pickup_lat: 26.1445,
    pickup_lng: 91.7362,
    drop_lat: 25.5788,
    drop_lng: 91.8933,
    distance: '98 km',
    duration: '2h 20m',
    capacity: '2.5 Tons',
    priority: 'priority',
    requestTime: '10 min ago',
    instructions: 'Handle with care. Fragile electronic equipment. Use padded loading.',
    roadCondition: 'Wet roads reported on NH-40 beyond Nongpoh. Drive cautiously.',
  },
  {
    id: 'TR-2036',
    product: 'Medical Supplies',
    quantity: '45 Crates',
    pickup: 'Guwahati Medical Hub',
    drop: 'Tezpur Civil Depot',
    pickup_lat: 26.1445,
    pickup_lng: 91.7362,
    drop_lat: 26.6338,
    drop_lng: 92.7926,
    distance: '175 km',
    duration: '3h 40m',
    capacity: '3.0 Tons',
    priority: 'urgent',
    requestTime: '25 min ago',
    instructions: 'Temperature-sensitive cargo. Maintain cold chain. Priority dispatch.',
    roadCondition: 'Clear roads reported on corridor.',
  },
  {
    id: 'TR-2029',
    product: 'Water Purification Units',
    quantity: '12 Units',
    pickup: 'Guwahati Central Depot',
    drop: 'Nongpoh Relief Center',
    pickup_lat: 26.1445,
    pickup_lng: 91.7362,
    drop_lat: 25.9034,
    drop_lng: 91.8762,
    distance: '52 km',
    duration: '1h 15m',
    capacity: '5.0 Tons',
    priority: 'normal',
    requestTime: '1 hr ago',
    instructions: 'Secure units properly. Check valves before departure.',
    roadCondition: 'Minor waterlogging near Nongpoh market access road.',
  },
  {
    id: 'TR-2015',
    product: 'Emergency Relief Kits',
    quantity: '200 Boxes',
    pickup: 'State Relief Warehouse',
    drop: 'Goalpara Sector Camp',
    pickup_lat: 26.1445,
    pickup_lng: 91.7362,
    drop_lat: 26.1751,
    drop_lng: 90.6273,
    distance: '130 km',
    duration: '2h 50m',
    capacity: '4.0 Tons',
    priority: 'priority',
    requestTime: '2 hr ago',
    instructions: 'Relief materials for affected families. Coordinate with local admin on arrival.',
    roadCondition: 'Normal highway conditions on NH-17.',
  },
];

export const disasterMarkers: DisasterMarker[] = [
  {
    id: 'DM-01',
    type: 'Landslide',
    label: 'Landslide',
    detail: 'NH-40 near Nongpoh',
    severity: 'high',
    timeReported: '4 min ago',
    distance: '12 km ahead',
    action: 'Alternative route recommended via Jorabat bypass',
    top: '28%',
    left: '62%',
    variant: 'danger',
    lat: 25.8876,
    lng: 91.9123,
  },
  {
    id: 'DM-02',
    type: 'Flood',
    label: 'Flooded Route',
    detail: 'Sector 4 Valley Pass',
    severity: 'medium',
    timeReported: '18 min ago',
    distance: '8 km ahead',
    action: 'Reduce speed. Avoid low-lying sections.',
    top: '66%',
    left: '24%',
    variant: 'warning',
    lat: 26.0234,
    lng: 91.5678,
  },
  {
    id: 'DM-03',
    type: 'Heavy Rain',
    label: 'Heavy Rain',
    detail: 'Shillong Plateau',
    severity: 'low',
    timeReported: '32 min ago',
    distance: '25 km ahead',
    action: 'Exercise caution. Reduced visibility expected.',
    top: '40%',
    left: '38%',
    variant: 'advisory',
    lat: 25.5788,
    lng: 91.8933,
  },
];

export const notifications: NotificationItem[] = [
  {
    id: 'N1',
    category: 'emergency',
    title: 'LANDSLIDE WARNING',
    body: 'Landslide reported 8 km ahead on your route. Consider alternative route.',
    time: '2 min ago',
    priority: 'critical',
    read: false,
  },
  {
    id: 'N2',
    category: 'disaster',
    title: 'Flood Advisory · Sector 4',
    body: 'Minor flooding on Valley Pass access road. Reduce speed in low-lying areas.',
    time: '15 min ago',
    priority: 'high',
    read: false,
  },
  {
    id: 'N3',
    category: 'trip',
    title: 'Trip TR-2036 Assigned',
    body: 'Medical supplies convoy ready for dispatch from Depot Alpha.',
    time: '1 hr ago',
    priority: 'normal',
    read: true,
  },
  {
    id: 'N4',
    category: 'navigation',
    title: 'Route Recalculated',
    body: 'Faster route available via Jorabat bypass. Saves 12 minutes.',
    time: '2 hr ago',
    priority: 'normal',
    read: true,
  },
  {
    id: 'N5',
    category: 'report',
    title: 'Report INC-48291 Submitted',
    body: 'Your incident report is under review by the operations desk.',
    time: '3 hr ago',
    priority: 'normal',
    read: true,
  },
  {
    id: 'N6',
    category: 'system',
    title: 'App Update Available',
    body: 'Version 2.4 includes improved offline maps and voice navigation.',
    time: '5 hr ago',
    priority: 'normal',
    read: true,
  },
];

export const languages: LanguageItem[] = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'global' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'india' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'india' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'india' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'india' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'india' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', region: 'ner' },
  { code: 'kha', name: 'Khasi', nativeName: 'Khasi', region: 'ner' },
  { code: 'gar', name: 'Garo', nativeName: 'A·chik', region: 'ner' },
  { code: 'miz', name: 'Mizo', nativeName: 'Mizo ṭawng', region: 'ner' },
  { code: 'nag', name: 'Nagamese', nativeName: 'Nagamese', region: 'ner' },
  { code: 'bod', name: 'Bodo', nativeName: 'बड़ो', region: 'ner' },
  { code: 'man', name: 'Manipuri', nativeName: 'মেইতেই লোন্', region: 'ner' },
  { code: 'kok', name: 'Kokborok', nativeName: 'ককবরক', region: 'ner' },
];

export const emergencyTypes: IncidentType[] = [
  'Landslide',
  'Flood',
  'Heavy Rain',
  'Road Block',
  'Accident',
  'Severe Weather',
];

export const incidentCategories: IncidentType[] = [
  'Landslide',
  'Flood',
  'Heavy Rain',
  'Road Damage',
  'Accident',
  'Road Blockage',
  'Severe Weather',
  'Other',
];

export const tripTimeline = [
  { label: 'Trip Accepted', desc: 'Trip confirmed', done: true },
  { label: 'Going to Pickup', desc: 'En route to pickup location', done: true },
  { label: 'Arrived at Pickup', desc: 'Reached pickup location', done: true },
  { label: 'Package Loaded', desc: 'Cargo loaded and verified', done: true },
  { label: 'In Transit', desc: 'Heading to destination', done: true, active: true },
  { label: 'Arrived at Destination', desc: 'Pending arrival', done: false },
  { label: 'Delivered', desc: 'Awaiting delivery confirmation', done: false },
];
