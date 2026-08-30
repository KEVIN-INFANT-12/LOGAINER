import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DisasterMarker } from '../types';
import type { SafeHalt, RouteOption } from '../lib/routing';
import type { RouteHazard } from '../lib/mlPrediction';

// Fix Leaflet default icon paths for bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Icon factories ─────────────────────────────────────────────────────────

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:18px;height:18px;background:#006a61;border-radius:50%;
      border:3px solid #fff;box-shadow:0 2px 8px rgba(0,106,97,.5);
      position:relative;
    "><div style="
      position:absolute;inset:-6px;border-radius:50%;
      background:rgba(0,106,97,.15);animation:mapPulse 2s ease-out infinite;
    "></div></div>`,
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function createVehicleIcon(heading: number = 0): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      position: relative;
      transform: rotate(${Math.round(heading)}deg);
      transition: transform 0.15s ease-out;
    ">
      <div style="
        position: absolute; inset: -4px;
        background: rgba(0, 106, 97, 0.25);
        border-radius: 50%;
        animation: mapPulse 1.6s ease-out infinite;
      "></div>
      <div style="
        width: 32px; height: 32px;
        background: #006a61;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        color: #ffffff;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
      </div>
      <!-- Heading Arrow Indicator -->
      <div style="
        position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 7px solid #006a61;
      "></div>
    </div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function createIncidentIcon(variant: 'danger' | 'warning' | 'advisory', label: string): L.DivIcon {
  const colors = { danger: '#ba1a1a', warning: '#ea580c', advisory: '#d97706' };
  const symbols = { danger: '!', warning: '!', advisory: '▲' };
  return L.divIcon({
    html: `<div title="${label}" style="
      width:30px;height:30px;background:${colors[variant]};border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);border:2px solid #fff;
      box-shadow:0 3px 8px rgba(0,0,0,.25);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:13px;
    ">${symbols[variant]}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

function createSafeHaltIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;background:#006a61;border-radius:6px;
      border:2px solid #fff;box-shadow:0 2px 8px rgba(0,106,97,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:12px;font-weight:700;
    ">P</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createPickupIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;background:#006a61;border-radius:50%;
      border:3px solid #fff;box-shadow:0 3px 10px rgba(0,106,97,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:12px;font-weight:800;
    ">A</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createDestIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;background:#ba1a1a;border-radius:50%;
      border:3px solid #fff;box-shadow:0 3px 10px rgba(186,26,26,.4);
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:12px;font-weight:800;
    ">B</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createHazardIcon(hazard: RouteHazard): L.DivIcon {
  const isCritical = hazard.warning_level === 'CRITICAL' || hazard.risk_level === 'HIGH';
  const bg = isCritical ? '#ba1a1a' : '#ea580c';
  const iconSymbol = hazard.hazard_type === 'Landslide' ? '⛰️'
    : hazard.hazard_type === 'Flood' ? '🌊'
    : hazard.hazard_type === 'Heavy Rain' ? '🌧️'
    : hazard.hazard_type === 'Severe Weather' ? '🌪️'
    : '⚠️';

  return L.divIcon({
    html: `<div style="
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      position: relative;
    ">
      <div style="
        width: 32px; height: 32px;
        background: ${bg};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 3px 10px rgba(0,0,0,0.35);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        animation: ${isCritical ? 'mapPulse 1.4s ease-out infinite' : 'none'};
      ">${iconSymbol}</div>
      <div style="
        background: rgba(0,0,0,0.75); color: #ffffff;
        font-size: 10px; font-weight: 700; padding: 1px 5px;
        border-radius: 4px; margin-top: 2px; white-space: nowrap;
      ">${hazard.distance_ahead_km}km</div>
    </div>`,
    className: '',
    iconSize: [34, 48],
    iconAnchor: [17, 32],
  });
}

// ── Severity → radius in metres ───────────────────────────────────────────
const SEVERITY_RADIUS: Record<string, number> = {
  high: 1500,
  medium: 800,
  low: 400,
};

const SEVERITY_COLOR: Record<string, string> = {
  high: '#ba1a1a',
  medium: '#ea580c',
  low: '#d97706',
};

// ── Route colours per option ──────────────────────────────────────────────
const ROUTE_COLORS = ['#006a61', '#2563eb', '#7c3aed'];

// ── Public API ────────────────────────────────────────────────────────────
export interface MapViewRef {
  centerOnUser: () => void;
  centerOnVehicle: (lat?: number, lng?: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitRouteBounds: () => void;
}

export interface MapViewProps {
  height?: string;
  /** Real GPS from device */
  userLat?: number | null;
  userLng?: number | null;
  /** GPS accuracy in metres (for accuracy circle) */
  userAccuracy?: number | null;
  /** Simulated vehicle coordinates */
  vehicleLat?: number | null;
  vehicleLng?: number | null;
  vehicleHeading?: number;
  isSimulating?: boolean;
  autoFollowVehicle?: boolean;
  onUserPan?: () => void;
  /** ML predicted route hazards */
  predictedHazards?: RouteHazard[];
  onHazardClick?: (h: RouteHazard) => void;
  /** Disaster / incident markers */
  incidents?: DisasterMarker[];
  /** Trip pickup coords */
  pickupLat?: number | null;
  pickupLng?: number | null;
  /** Trip destination coords */
  destLat?: number | null;
  destLng?: number | null;
  /** Already-calculated route options (with real road geometry) */
  routes?: RouteOption[];
  /** Index of the currently-selected route in `routes` */
  selectedRouteIndex?: number;
  /** Legacy: draw straight-line fallback when no `routes` provided */
  showRoute?: boolean;
  /** Safe halt markers */
  safeHalts?: SafeHalt[];
  /** Whether the map controls (drag, scroll-zoom, etc.) are active */
  interactive?: boolean;
  /** Callback when user taps an incident marker */
  onMarker?: (m: DisasterMarker) => void;
  /** Callback when user taps a safe halt marker */
  onHalt?: (h: SafeHalt) => void;
}

// Default centre: Guwahati, Assam
const DEFAULT_LAT = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '26.1445');
const DEFAULT_LNG = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG || '91.7362');
const DEFAULT_ZOOM = parseInt(import.meta.env.VITE_MAP_DEFAULT_ZOOM || '12');

// ── Component ─────────────────────────────────────────────────────────────
const MapView = forwardRef<MapViewRef, MapViewProps>((
  {
    height = '300px',
    userLat,
    userLng,
    userAccuracy,
    vehicleLat,
    vehicleLng,
    vehicleHeading = 0,
    isSimulating = false,
    autoFollowVehicle = true,
    onUserPan,
    predictedHazards = [],
    onHazardClick,
    incidents = [],
    pickupLat,
    pickupLng,
    destLat,
    destLng,
    routes = [],
    selectedRouteIndex = 0,
    showRoute = false,
    safeHalts = [],
    interactive = true,
    onMarker,
    onHalt,
  },
  ref
) => {
  const containerRef    = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<L.Map | null>(null);
  const userMarkerRef   = useRef<L.Marker | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircRef = useRef<L.Circle | null>(null);
  const incidentLayerRef  = useRef<L.LayerGroup | null>(null);
  const predictedHazardsLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef     = useRef<L.LayerGroup | null>(null);
  const pickupMarkerRef   = useRef<L.Marker | null>(null);
  const destMarkerRef     = useRef<L.Marker | null>(null);
  const haltLayerRef      = useRef<L.LayerGroup | null>(null);
  const hasFirstCentred   = useRef(false);

  // ── Imperative API ───────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    centerOnUser: () => {
      const map = mapRef.current;
      if (!map) return;
      const lat = userLat ?? DEFAULT_LAT;
      const lng = userLng ?? DEFAULT_LNG;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    },
    centerOnVehicle: (vLat, vLng) => {
      const map = mapRef.current;
      if (!map) return;
      const lat = vLat ?? vehicleLat ?? userLat ?? DEFAULT_LAT;
      const lng = vLng ?? vehicleLng ?? userLng ?? DEFAULT_LNG;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
    },
    zoomIn:  () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    fitRouteBounds: () => {
      const map = mapRef.current;
      if (!map) return;
      const points: L.LatLngExpression[] = [];
      if (pickupLat && pickupLng) points.push([pickupLat, pickupLng]);
      if (destLat && destLng) points.push([destLat, destLng]);
      if (points.length >= 2) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      }
    },
  }));

  // ── Initialise map (once) ─────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = isSimulating && vehicleLat ? vehicleLat : (userLat ?? DEFAULT_LAT);
    const initialLng = isSimulating && vehicleLng ? vehicleLng : (userLng ?? DEFAULT_LNG);

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      scrollWheelZoom: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Initialise layer groups
    incidentLayerRef.current         = L.layerGroup().addTo(map);
    predictedHazardsLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current            = L.layerGroup().addTo(map);
    haltLayerRef.current             = L.layerGroup().addTo(map);

    // Track user drag/pan
    map.on('dragstart', () => {
      if (onUserPan) onUserPan();
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      hasFirstCentred.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── User location marker + accuracy circle ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const lat = userLat ?? DEFAULT_LAT;
    const lng = userLng ?? DEFAULT_LNG;
    const hasRealGPS = !!(userLat && userLng);

    if (isSimulating) {
      // In simulation mode, hide real GPS marker or keep it muted
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (accuracyCircRef.current) {
        accuracyCircRef.current.remove();
        accuracyCircRef.current = null;
      }
      return;
    }

    // Create or move user marker
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker([lat, lng], {
        icon: createUserIcon(),
        zIndexOffset: 1000,
      }).addTo(map).bindTooltip('Your GPS Location', { direction: 'top', offset: [0, -12] });
    } else {
      userMarkerRef.current.setLatLng([lat, lng]);
    }

    // Accuracy circle
    if (hasRealGPS && userAccuracy && userAccuracy > 0) {
      if (!accuracyCircRef.current) {
        accuracyCircRef.current = L.circle([lat, lng], {
          radius: userAccuracy,
          color: '#006a61',
          fillColor: '#006a61',
          fillOpacity: 0.08,
          weight: 1,
          dashArray: '4 4',
        }).addTo(map);
      } else {
        accuracyCircRef.current.setLatLng([lat, lng]);
        accuracyCircRef.current.setRadius(userAccuracy);
      }
    } else if (!hasRealGPS && accuracyCircRef.current) {
      accuracyCircRef.current.remove();
      accuracyCircRef.current = null;
    }

    // Only auto-centre once on first GPS fix when not simulating
    if (hasRealGPS && !hasFirstCentred.current && !isSimulating) {
      hasFirstCentred.current = true;
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
    }
  }, [userLat, userLng, userAccuracy, isSimulating]);

  // ── Simulated Vehicle Marker ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isSimulating && vehicleLat && vehicleLng) {
      const vPos: [number, number] = [vehicleLat, vehicleLng];
      const icon = createVehicleIcon(vehicleHeading);

      if (!vehicleMarkerRef.current) {
        vehicleMarkerRef.current = L.marker(vPos, {
          icon,
          zIndexOffset: 2000,
        }).addTo(map).bindTooltip('Driver Vehicle', { direction: 'top', offset: [0, -16] });
      } else {
        vehicleMarkerRef.current.setLatLng(vPos);
        vehicleMarkerRef.current.setIcon(icon);
      }

      // Auto-follow vehicle if enabled
      if (autoFollowVehicle) {
        map.panTo(vPos, { animate: true, duration: 0.2 });
      }
    } else if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.remove();
      vehicleMarkerRef.current = null;
    }
  }, [vehicleLat, vehicleLng, vehicleHeading, isSimulating, autoFollowVehicle]);

  // ── Incident markers + disaster area circles ──────────────────────────
  useEffect(() => {
    const layer = incidentLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    incidents.forEach((inc) => {
      if (!inc.lat || !inc.lng) return;
      const lat = inc.lat;
      const lng = inc.lng;

      // Severity-based area circle
      const radius = SEVERITY_RADIUS[inc.severity] ?? 500;
      const color  = SEVERITY_COLOR[inc.severity] ?? '#d97706';
      L.circle([lat, lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.10,
        weight: 1.5,
        dashArray: '5 4',
      }).addTo(layer);

      // Marker on top of circle
      const marker = L.marker([lat, lng], { icon: createIncidentIcon(inc.variant, inc.label) })
        .addTo(layer)
        .bindPopup(
          `<div style="min-width:160px">
            <strong style="font-size:13px">${inc.label}</strong>
            <hr style="margin:4px 0;border-color:#eee"/>
            <div style="font-size:11px;line-height:1.6">
              <b>Severity:</b> ${inc.severity}<br/>
              <b>Location:</b> ${inc.detail || 'Unknown'}<br/>
              <b>Distance:</b> ${inc.distance}<br/>
              <b>Reported:</b> ${inc.timeReported}<br/>
              ${inc.action ? `<b>Action:</b> ${inc.action}` : ''}
            </div>
          </div>`,
          { maxWidth: 220 }
        );

      if (onMarker) marker.on('click', () => onMarker(inc));
    });
  }, [incidents, onMarker]);

  // ── ML Predicted Route Hazards Layer ──────────────────────────────────
  useEffect(() => {
    const layer = predictedHazardsLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    predictedHazards.forEach((hazard) => {
      if (!hazard.latitude || !hazard.longitude) return;
      const lat = hazard.latitude;
      const lng = hazard.longitude;

      const isCritical = hazard.warning_level === 'CRITICAL' || hazard.risk_level === 'HIGH';
      const radius = isCritical ? 1200 : 700;
      const color = isCritical ? '#ba1a1a' : '#ea580c';

      // Area Circle with pulse effect styling
      L.circle([lat, lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: isCritical ? 0.18 : 0.12,
        weight: isCritical ? 2.5 : 1.5,
        dashArray: isCritical ? undefined : '6 4',
      }).addTo(layer);

      // Marker Icon
      const marker = L.marker([lat, lng], {
        icon: createHazardIcon(hazard),
        zIndexOffset: 1500,
      })
        .addTo(layer)
        .bindPopup(
          `<div style="min-width:180px; font-family: inherit;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <strong style="font-size:13px; color:${color};">⚠️ ${hazard.hazard_type} Risk</strong>
              <span style="font-size:10px; font-weight:700; background:${isCritical ? '#fee2e2' : '#ffedd5'}; color:${color}; padding:2px 6px; border-radius:4px;">
                ${hazard.risk_level}
              </span>
            </div>
            <div style="font-size:11px; color:#4b5563; margin-bottom:4px;">${hazard.location_name}</div>
            <hr style="margin:4px 0; border-color:#eee"/>
            <div style="font-size:11px; line-height:1.5;">
              <b>Distance Ahead:</b> ${hazard.distance_ahead_km} km<br/>
              <b>Warning:</b> ${hazard.warning_message}<br/>
              <div style="margin-top:4px; padding:4px 6px; background:#f3f4f6; border-radius:4px; font-size:10.5px; color:#374151;">
                <b>Advice:</b> ${hazard.recommended_action}
              </div>
            </div>
          </div>`,
          { maxWidth: 240 }
        );

      if (onHazardClick) {
        marker.on('click', () => onHazardClick(hazard));
      }
    });
  }, [predictedHazards, onHazardClick]);

  // ── Safe halt markers ─────────────────────────────────────────────────
  useEffect(() => {
    const layer = haltLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    safeHalts.forEach((h) => {
      if (!h.lat || !h.lng) return;
      const marker = L.marker([h.lat, h.lng], { icon: createSafeHaltIcon() })
        .addTo(layer)
        .bindPopup(
          `<div style="min-width:160px">
            <strong style="font-size:13px">${h.name}</strong>
            <hr style="margin:4px 0;border-color:#eee"/>
            <div style="font-size:11px;line-height:1.6">
              <b>Type:</b> ${h.type.replace(/_/g, ' ')}<br/>
              <b>Distance:</b> ${h.distanceKm} km<br/>
              <b>Risk:</b> ${h.riskLevel}<br/>
              ${h.amenities.length ? `<b>Amenities:</b> ${h.amenities.join(', ')}<br/>` : ''}
              ${h.address ? `<b>Address:</b> ${h.address}` : ''}
            </div>
          </div>`,
          { maxWidth: 220 }
        );
      if (onHalt) marker.on('click', () => onHalt(h));
    });
  }, [safeHalts, onHalt]);

  // ── Pickup / Destination markers ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Pickup
    if (pickupLat && pickupLng) {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([pickupLat, pickupLng], { icon: createPickupIcon() })
          .addTo(map)
          .bindTooltip('Pickup Point', { permanent: true, direction: 'top', offset: [0, -14] });
      } else {
        pickupMarkerRef.current.setLatLng([pickupLat, pickupLng]);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    // Destination
    if (destLat && destLng) {
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([destLat, destLng], { icon: createDestIcon() })
          .addTo(map)
          .bindTooltip('Destination', { permanent: true, direction: 'top', offset: [0, -14] });
      } else {
        destMarkerRef.current.setLatLng([destLat, destLng]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
  }, [pickupLat, pickupLng, destLat, destLng]);

  // ── Route lines ────────────────────────────────────────────────────────
  useEffect(() => {
    const map   = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const hasCoords = pickupLat && pickupLng && destLat && destLng;

    if (routes.length > 0 && hasCoords) {
      // Draw each route — selected one is thicker / highlighted
      const allBounds: L.LatLngExpression[] = [];

      routes.forEach((route, idx) => {
        const isSelected = idx === selectedRouteIndex;
        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

        let latlngs: L.LatLngExpression[];
        if (route.geometry && route.geometry.length > 1) {
          latlngs = route.geometry.map(([lng, lat]) => [lat, lng] as L.LatLngExpression);
        } else {
          latlngs = [[pickupLat!, pickupLng!], [destLat!, destLng!]];
        }

        latlngs.forEach((ll) => allBounds.push(ll));

        // Draw shadow casing for selected route for visual pop
        if (isSelected) {
          L.polyline(latlngs, {
            color: '#ffffff',
            weight: 8,
            opacity: 0.9,
          }).addTo(layer);
        }

        L.polyline(latlngs, {
          color,
          weight: isSelected ? 5 : 3.5,
          opacity: isSelected ? 0.95 : 0.4,
          dashArray: isSelected ? undefined : '8 6',
        }).addTo(layer).bindTooltip(
          `${route.label} — ${route.distanceKm} km · ${route.durationMins} min · Safety ${route.safetyScore}/100`,
          { sticky: true }
        );
      });

      if (allBounds.length > 0 && !isSimulating) {
        map.fitBounds(L.latLngBounds(allBounds), { padding: [40, 40] });
      }
    } else if ((showRoute || hasCoords) && hasCoords) {
      // Fallback
      const points: L.LatLngExpression[] = [
        [pickupLat!, pickupLng!],
        [destLat!, destLng!],
      ];
      L.polyline(points, { color: '#006a61', weight: 4, opacity: 0.8 }).addTo(layer);
      if (!isSimulating) {
        map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      }
    }
  }, [routes, selectedRouteIndex, showRoute, pickupLat, pickupLng, destLat, destLng, isSimulating]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', position: 'relative', zIndex: 1 }}
    />
  );
});

MapView.displayName = 'MapView';
export default MapView;
