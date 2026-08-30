import React, { useEffect, useState, useRef } from 'react';
import {
  Layers,
  Truck,
  AlertTriangle,
  MapPin,
  CloudRain,
  Activity,
  X,
  Navigation,
  Thermometer,
  Weight,
  Gauge,
  ShieldAlert
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { FleetVehicle, Chokepoint, Incident, LogisticsHub } from '../types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix standard leaflet icon path issues in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Clean HTML Markers
const createVehicleIcon = (vehicle: FleetVehicle) => {
  const isEmergency = vehicle.is_sos || vehicle.status === 'EMERGENCY_SOS';
  const isColdChain = vehicle.cargo_type === 'ESSENTIAL_MEDICINES_COLD_CHAIN';
  const borderColor = isEmergency ? '#DC2626' : isColdChain ? '#0F766E' : '#15803D';
  const iconColor = isEmergency ? '#DC2626' : isColdChain ? '#0F766E' : '#15803D';

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: #FFFFFF;
        border: 2px solid ${borderColor};
        border-radius: 10px;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
        transform: rotate(${vehicle.heading_deg || 0}deg);
        transition: all 0.5s ease-out;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
        ${isEmergency ? '<div style="position: absolute; top: -3px; right: -3px; width: 8px; height: 8px; border-radius: 50%; background: #DC2626;"></div>' : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
};

const createChokepointIcon = (cp: Chokepoint) => {
  const isCritical = cp.current_status === 'CRITICAL_BLOCKED';
  const color = isCritical ? '#DC2626' : '#D97706';

  return L.divIcon({
    className: 'custom-chokepoint-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: #FFFFFF;
        border: 2px solid ${color};
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.15);
      ">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const createHubIcon = (hub: LogisticsHub) => {
  return L.divIcon({
    className: 'custom-hub-marker',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: #FFFFFF;
        border: 2px solid #0F766E;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F766E" stroke-width="2.5">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const createEmergencyIcon = (emg: any) => {
  return L.divIcon({
    className: 'custom-emergency-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: #DC2626;
        border: 2.5px solid #FFFFFF;
        border-radius: 50%;
        box-shadow: 0 0 18px rgba(220, 38, 38, 0.8), 0 4px 10px rgba(0,0,0,0.3);
      ">
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid #DC2626;
          opacity: 0.6;
        "></div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 12a5 5 0 0 1 5-5v0a5 5 0 0 1 5 5v6H7v-6z"/>
          <path d="M12 2v2"/>
          <path d="M20 12h2"/>
          <path d="M2 12h2"/>
          <path d="M12 20v2"/>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -19]
  });
};

export const GISMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardLayersGroupRef = useRef<L.LayerGroup | null>(null);
  const whatIfLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Map View Mode: CURRENT | WHAT_IF | COMPARE (Section 15)
  const [mapViewMode, setMapViewMode] = useState<'CURRENT' | 'WHAT_IF' | 'COMPARE'>('CURRENT');
  const [whatIfRoads, setWhatIfRoads] = useState<any[]>([]);

  const {
    hubs,
    chokepoints,
    vehicles,
    incidents,
    weatherStations,
    activeEmergencies,
    activeLayers,
    toggleLayer,
    selectedVehicle,
    setSelectedVehicle,
    selectedChokepoint,
    setSelectedChokepoint,
    activeRouteResult,
    isDisasterModeActive,
    resolveEmergency
  } = useLogistics();

  const { t } = useLanguage();
  const [isLayerDrawerOpen, setIsLayerDrawerOpen] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Assam/NER: 26.14° N, 92.5° E
    const map = L.map(mapContainerRef.current, {
      center: [26.1445, 92.7362],
      zoom: 7,
      minZoom: 6,
      maxZoom: 15,
      zoomControl: false
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // High quality OSM Light GIS Basemap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    routesLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardLayersGroupRef.current = L.layerGroup().addTo(map);
    whatIfLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & Layers when state changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerGroupRef.current || !hazardLayersGroupRef.current) return;

    markersLayerGroupRef.current.clearLayers();
    hazardLayersGroupRef.current.clearLayers();

    // 1. Render Logistics Hubs
    if (activeLayers.topography && hubs) {
      hubs.forEach((hub) => {
        const marker = L.marker([hub.lat, hub.lng], { icon: createHubIcon(hub) });
        marker.bindPopup(`
          <div style="padding: 10px; font-size: 12px; line-height: 1.5; color: #0F172A;">
            <div style="font-weight: 700; color: #0F766E; font-size: 13px; margin-bottom: 2px;">${hub.name}</div>
            <div style="color: #475569;">State: ${hub.state}</div>
            <div style="color: #64748B; font-family: monospace;">Capacity: ${hub.capacity_tons.toLocaleString()} Tonnes</div>
            <div style="margin-top: 4px; font-size: 10px; color: #15803D; font-weight: 600; text-transform: uppercase;">${hub.type.replace(/_/g, ' ')}</div>
          </div>
        `);
        markersLayerGroupRef.current?.addLayer(marker);
      });
    }

    // 2. Render Vulnerable Chokepoints
    if (activeLayers.chokepoints && chokepoints) {
      chokepoints.forEach((cp) => {
        const marker = L.marker([cp.lat, cp.lng], { icon: createChokepointIcon(cp) });
        marker.on('click', () => setSelectedChokepoint(cp));
        const isCrit = cp.current_status === 'CRITICAL_BLOCKED';
        marker.bindPopup(`
          <div style="padding: 10px; font-size: 12px; line-height: 1.5; max-width: 240px; color: #0F172A;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 700; color: ${isCrit ? '#DC2626' : '#D97706'}; font-size: 13px;">${cp.name}</span>
              <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${isCrit ? '#FEF2F2' : '#FFFBEB'}; color: ${isCrit ? '#DC2626' : '#D97706'}; border: 1px solid ${isCrit ? '#FECACA' : '#FDE68A'};">${cp.current_status}</span>
            </div>
            <div style="color: #475569; font-size: 11px; margin-bottom: 4px;">${cp.description}</div>
            <div style="color: #64748B; font-family: monospace; font-size: 10px;">Avg Clearance: ${cp.average_clearance_hrs} hrs</div>
            <div style="margin-top: 6px; padding: 4px 6px; background: #F0FDFA; color: #0F766E; border-radius: 4px; font-size: 10px; border: 1px solid #CCFBF1;">
              ⚡ Alternate: ${cp.alternate_bypass}
            </div>
          </div>
        `);
        markersLayerGroupRef.current?.addLayer(marker);
      });
    }

    // 3. Render Live Moving Convoys
    if (activeLayers.liveFleet && vehicles) {
      vehicles.forEach((v) => {
        const marker = L.marker([v.current_lat, v.current_lng], { icon: createVehicleIcon(v) });
        marker.on('click', () => setSelectedVehicle(v));
        marker.bindPopup(`
          <div style="padding: 10px; font-size: 12px; line-height: 1.5; min-width: 220px; color: #0F172A;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 700; font-size: 13px;">${v.vehicle_no}</span>
              <span style="font-size: 9px; font-weight: 700; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: ${v.is_sos ? '#DC2626' : '#F0FDFA'}; color: ${v.is_sos ? '#FFFFFF' : '#0F766E'};">${v.status}</span>
            </div>
            <div style="color: #0F766E; font-weight: 600; font-size: 11px; margin-bottom: 6px;">${v.cargo_desc}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; font-family: monospace; color: #475569;">
              <div>Speed: ${v.speed_kmh} km/h</div>
              <div>Progress: ${v.progress_pct}%</div>
              ${v.temp_celsius !== undefined ? `<div style="color: #0F766E; font-weight: 600;">Temp: ${v.temp_celsius}°C</div>` : ''}
              <div>Driver: ${v.driver_name.split(' ')[0]}</div>
            </div>
            <div style="margin-top: 6px; font-size: 10px; color: #94A3B8; font-style: italic;">${v.origin_name} ➔ ${v.destination_name}</div>
          </div>
        `);
        markersLayerGroupRef.current?.addLayer(marker);
      });
    }

    // 4. Hazard Layers: Landslide Risk Belts & Flood Plains
    if (activeLayers.landslideRisk) {
      const hazardZones = [
        { lat: 25.32, lng: 92.35, radius: 28000, color: '#DC2626', label: 'Sonapur Mudflow Danger Zone' },
        { lat: 25.78, lng: 93.85, radius: 22000, color: '#D97706', label: 'Pagla Pahar Active Rockfall' },
        { lat: 27.50, lng: 92.10, radius: 30000, color: '#0F766E', label: 'Sela Avalanche & Snow Drift' },
        { lat: 26.88, lng: 88.47, radius: 24000, color: '#0284C7', label: 'Teesta River Swelling Area' }
      ];

      hazardZones.forEach((hz) => {
        const circle = L.circle([hz.lat, hz.lng], {
          radius: hz.radius,
          color: hz.color,
          fillColor: hz.color,
          fillOpacity: isDisasterModeActive ? 0.3 : 0.15,
          weight: 2,
          dashArray: '5, 5'
        });
        circle.bindTooltip(hz.label, { permanent: false, direction: 'top' });
        hazardLayersGroupRef.current?.addLayer(circle);
      });
    }

    // 5. Weather Radar Rings
    if (activeLayers.weatherRadar && weatherStations) {
      weatherStations.forEach((ws) => {
        if (ws.rainfall_mm_hr > 20) {
          const rainCircle = L.circle([ws.lat, ws.lng], {
            radius: ws.rainfall_mm_hr * 1200,
            color: ws.rainfall_mm_hr > 40 ? '#DC2626' : '#0284C7',
            fillColor: '#0284C7',
            fillOpacity: 0.18,
            weight: 1.5
          });
          rainCircle.bindTooltip(`${ws.city}: ${ws.rainfall_mm_hr} mm/h (${ws.condition})`, { permanent: false });
          hazardLayersGroupRef.current?.addLayer(rainCircle);
        }
      });
    }

    // 6. Render Real-Time Emergency Alerts from Drivers & Field Officers
    if (activeEmergencies && activeEmergencies.length > 0) {
      activeEmergencies.forEach((emg) => {
        const marker = L.marker([emg.latitude, emg.longitude], { icon: createEmergencyIcon(emg) });
        marker.bindPopup(`
          <div style="padding: 10px; font-size: 12px; line-height: 1.5; min-width: 240px; color: #0F172A;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 800; color: #DC2626; font-size: 13px;">🚨 EMERGENCY ALERT</span>
              <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA;">ACTIVE</span>
            </div>
            <div style="font-size: 12px; margin-bottom: 6px;">
              <div><strong>Reported by:</strong> ${emg.sender_role === 'driver' ? 'Driver' : 'Field Officer'} (${emg.sender_name || emg.sender_user_id})</div>
              <div><strong>Type:</strong> ${emg.emergency_type}</div>
              <div><strong>Location:</strong> ${emg.location_name || `${emg.latitude.toFixed(4)}°N, ${emg.longitude.toFixed(4)}°E`}</div>
              <div><strong>Time:</strong> ${new Date(emg.created_at || emg.timestamp || Date.now()).toLocaleTimeString()}</div>
            </div>
            <p style="font-size: 11px; color: #475569; margin: 0 0 8px; background: #F8F9FA; padding: 6px; border-radius: 4px; border: 1px solid #E2E8F0;">
              ${emg.message || `${emg.emergency_type} incident reported.`}
            </p>
          </div>
        `);
        markersLayerGroupRef.current?.addLayer(marker);
      });
    }

  }, [hubs, chokepoints, vehicles, incidents, weatherStations, activeEmergencies, activeLayers, isDisasterModeActive, setSelectedVehicle, setSelectedChokepoint]);

  // Render Computed Routes on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !routesLayerGroupRef.current) return;
    routesLayerGroupRef.current.clearLayers();

    if (activeRouteResult && activeLayers.corridors) {
      const { primary_route, ai_optimized_route, emergency_green_route } = activeRouteResult;

      // 1. Primary route in ochre dash
      if (primary_route && primary_route.waypoints) {
        const latlngs = primary_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const primaryLine = L.polyline(latlngs, {
          color: '#D97706',
          weight: 4,
          opacity: 0.8,
          dashArray: '6, 6'
        }).addTo(routesLayerGroupRef.current);
        primaryLine.bindTooltip(`Standard Route: ${primary_route.distance_km} km`, { sticky: true });
      }

      // 2. AI Optimized route in Topographic Teal
      if (ai_optimized_route && ai_optimized_route.waypoints) {
        const latlngs = ai_optimized_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const aiLine = L.polyline(latlngs, {
          color: '#0F766E',
          weight: 6,
          opacity: 0.95
        }).addTo(routesLayerGroupRef.current);
        aiLine.bindTooltip(`AI Risk-Mitigated Alternate: ${ai_optimized_route.distance_km} km (-48% Hazard)`, { sticky: true });
      }

      // 3. Emergency Green Corridor in Moss Green
      if (emergency_green_route && isDisasterModeActive && emergency_green_route.waypoints) {
        const latlngs = emergency_green_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const emLine = L.polyline(latlngs, {
          color: '#15803D',
          weight: 6,
          opacity: 0.95
        }).addTo(routesLayerGroupRef.current);
        emLine.bindTooltip(`Green Corridor Priority Route`, { sticky: true });
      }
    }
  }, [activeRouteResult, activeLayers.corridors, isDisasterModeActive]);

  // Render What-If / Compare Scenario Layer on the existing Map (Section 15)
  useEffect(() => {
    if (!mapInstanceRef.current || !whatIfLayerGroupRef.current) return;
    whatIfLayerGroupRef.current.clearLayers();

    if (mapViewMode === 'CURRENT') return;

    // Standard high-risk road network coordinates for What-If scenario overlay
    const scenarioRoads = [
      {
        name: 'NH-6 Sonapur Landslide Corridor',
        highway: 'NH-6',
        latlngs: [[25.5788, 91.8933], [25.4497, 92.2033], [25.1147, 92.3619], [24.8333, 92.7789]],
        current_risk: 0.42,
        scenario_risk: 0.88,
        risk_delta: 0.46,
        current_level: 'MEDIUM',
        scenario_level: 'HIGH',
        predicted_disruption: 'HEAVY_MUD_WASHOUT',
        alternate_bypass: 'Umrangso - Haflong Mountain Green Bypass'
      },
      {
        name: 'NH-13 Sela Alpine Pass Section',
        highway: 'NH-13',
        latlngs: [[27.2645, 92.4222], [27.5042, 92.1039], [27.5860, 91.8594]],
        current_risk: 0.52,
        scenario_risk: 0.92,
        risk_delta: 0.40,
        current_level: 'MEDIUM',
        scenario_level: 'HIGH',
        predicted_disruption: 'BLIZZARD_BLACK_ICE',
        alternate_bypass: 'Sela Tunnel Bypass (Restricted)'
      },
      {
        name: 'NH-29 Pagla Pahar Rockfall Zone',
        highway: 'NH-29',
        latlngs: [[25.9042, 93.7276], [25.7891, 93.8542], [25.6751, 94.1086]],
        current_risk: 0.48,
        scenario_risk: 0.82,
        risk_delta: 0.34,
        current_level: 'MEDIUM',
        scenario_level: 'HIGH',
        predicted_disruption: 'ROCKFALL_DEBRIS',
        alternate_bypass: 'Niuland - Kohima Mountain Track Bypass'
      },
      {
        name: 'NH-10 Sevoke - Teesta Gorge (29th Mile)',
        highway: 'NH-10',
        latlngs: [[26.7271, 88.3953], [26.8854, 88.4721], [27.1764, 88.5312], [27.3389, 88.6065]],
        current_risk: 0.58,
        scenario_risk: 0.95,
        risk_delta: 0.37,
        current_level: 'MEDIUM',
        scenario_level: 'HIGH',
        predicted_disruption: 'RIVER_UNDERCUT_FLOOD',
        alternate_bypass: 'Lava - Algara - Pedong Ridge Route'
      },
      {
        name: 'NH-2 Mao - Senapati Pass',
        highway: 'NH-2',
        latlngs: [[25.6751, 94.1086], [25.2667, 94.0167], [24.8170, 93.9368]],
        current_risk: 0.38,
        scenario_risk: 0.68,
        risk_delta: 0.30,
        current_level: 'MEDIUM',
        scenario_level: 'HIGH',
        predicted_disruption: 'GROUND_SUBSIDENCE',
        alternate_bypass: 'Tadubi - Ukhrul Bypass Corridor'
      }
    ];

    scenarioRoads.forEach((road) => {
      // 1. In COMPARE mode, render baseline dotted line first
      if (mapViewMode === 'COMPARE') {
        const baseLine = L.polyline(road.latlngs as any, {
          color: '#64748B',
          weight: 4,
          opacity: 0.7,
          dashArray: '4, 6'
        }).addTo(whatIfLayerGroupRef.current!);
        baseLine.bindTooltip(`Baseline Risk: ${road.current_risk} (${road.current_level})`, { sticky: true });
      }

      // 2. Scenario Line in High Risk Brick Red or Ochre
      const lineColor = road.scenario_level === 'HIGH' ? '#DC2626' : '#D97706';
      const scenLine = L.polyline(road.latlngs as any, {
        color: lineColor,
        weight: 6,
        opacity: 0.95,
        dashArray: mapViewMode === 'COMPARE' ? '8, 4' : undefined
      }).addTo(whatIfLayerGroupRef.current!);

      scenLine.bindPopup(`
        <div style="padding: 10px; font-size: 12px; line-height: 1.5; min-width: 240px; color: #0F172A;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 700; color: #7C3AED; font-size: 13px;">🔮 What-If Scenario</span>
            <span style="font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA;">PREDICTED HIGH RISK</span>
          </div>
          <div style="font-weight: 700; color: #0F172A; font-size: 12px; margin-bottom: 2px;">${road.name}</div>
          <div style="color: #475569; font-size: 11px; margin-bottom: 6px;">${road.highway} • Hazard: ${road.predicted_disruption}</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px; font-family: monospace; background: #F8F9FA; padding: 6px; border-radius: 6px; margin-bottom: 6px; border: 1px solid #E2E8F0;">
            <div>Baseline: <strong>${road.current_risk} (${road.current_level})</strong></div>
            <div>Scenario: <strong style="color: #DC2626;">${road.scenario_risk} (${road.scenario_level})</strong></div>
            <div style="grid-column: span 2; color: #DC2626;">Risk Increase: <strong>+${road.risk_delta} (Δ)</strong></div>
          </div>
          <div style="font-size: 10px; padding: 4px 6px; background: #F0FDFA; color: #0F766E; border-radius: 4px; border: 1px solid #CCFBF1;">
            ⚡ Recommended Bypass: ${road.alternate_bypass}
          </div>
        </div>
      `);
    });
  }, [mapViewMode]);

  return (
    <div className="relative w-full h-full min-h-[520px] overflow-hidden rounded-xl border border-slate-200/90 shadow-card flex flex-col bg-white">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-10" />

      {/* Top Left GIS Control Pill & Scenario Mode Switcher */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setIsLayerDrawerOpen(!isLayerDrawerOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-200 shadow-floating transition-all"
        >
          <Layers className="w-4 h-4 text-teal-700" />
          <span>GIS Layers</span>
        </button>

        {/* What-If Scenario View Switcher (Section 15) */}
        <div className="flex items-center p-1 rounded-lg bg-white border border-slate-200 shadow-floating text-xs font-semibold">
          <button
            onClick={() => setMapViewMode('CURRENT')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              mapViewMode === 'CURRENT'
                ? 'bg-teal-700 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            CURRENT
          </button>
          <button
            onClick={() => setMapViewMode('WHAT_IF')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
              mapViewMode === 'WHAT_IF'
                ? 'bg-purple-700 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-purple-700'
            }`}
          >
            <span>WHAT-IF</span>
          </button>
          <button
            onClick={() => setMapViewMode('COMPARE')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              mapViewMode === 'COMPARE'
                ? 'bg-purple-900 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            COMPARE
          </button>
        </div>

        {mapViewMode !== 'CURRENT' && (
          <div className="px-2.5 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[11px] font-bold shadow-xs flex items-center space-x-1">
            <span>🔮 Scenario Layer:</span>
            <span className="font-normal text-purple-700">{mapViewMode === 'COMPARE' ? 'Current vs Predicted Future' : 'ConvLSTM Projected Risk'}</span>
          </div>
        )}

        {isDisasterModeActive && (
          <div className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-bold shadow-sm animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>RED ALERT ACTIVE</span>
          </div>
        )}
      </div>

      {/* Real-time Emergency Alert Notification Card (Admin Overlay) */}
      {activeEmergencies && activeEmergencies.length > 0 && (
        <div className="absolute top-16 left-4 z-20 max-w-md w-full p-3 rounded-xl bg-white/95 backdrop-blur-md text-slate-900 shadow-2xl border-2 border-red-500 animate-in fade-in slide-in-from-top-2 flex flex-col gap-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-red-100">
            <div className="flex items-center space-x-2 font-extrabold text-red-600 text-xs tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
              <span>🚨 EMERGENCY ALERT BROADCAST</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-50 text-red-700 font-bold border border-red-200">
              {activeEmergencies.length} Active
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {activeEmergencies.map((emg) => (
              <div key={emg.emergency_id} className="bg-red-50/70 border border-red-200 rounded-lg p-2.5 text-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-900">{emg.emergency_type}</span>
                  <span className="text-[10px] text-slate-500">{new Date(emg.created_at || emg.timestamp || Date.now()).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-700 text-[11px] leading-relaxed">
                  <div><strong>Reported by:</strong> {emg.sender_role === 'driver' ? 'Driver' : 'Field Officer'} ({emg.sender_name || emg.sender_user_id})</div>
                  <div><strong>Location:</strong> {emg.location_name || `${emg.latitude.toFixed(4)}°N, ${emg.longitude.toFixed(4)}°E`}</div>
                </div>
                {emg.message && <p className="text-[11px] text-red-800 italic bg-red-100/50 p-1.5 rounded">{emg.message}</p>}
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => {
                      mapInstanceRef.current?.setView([emg.latitude, emg.longitude], 12);
                    }}
                    className="px-2.5 py-1 rounded bg-teal-700 text-white font-semibold hover:bg-teal-800 text-[11px] transition-all flex items-center space-x-1 shadow-xs"
                  >
                    <span>View Location</span>
                  </button>
                  <button
                    onClick={() => resolveEmergency(emg.emergency_id)}
                    className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 text-[11px] transition-all"
                  >
                    <span>Resolve</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Right Data Tier Indicators */}
      <div className="absolute top-4 right-14 z-20 hidden md:flex items-center space-x-2 text-[10px] font-mono">
        <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-emerald-800 font-medium flex items-center space-x-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          <span>GPS: SIMULATED (400 Fleets)</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-medium flex items-center space-x-1.5 shadow-sm">
          <span>Satellite: CACHED (Sentinel-2)</span>
        </div>
        <div className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-amber-800 font-medium flex items-center space-x-1.5 shadow-sm">
          <span>Weather: SIMULATED MONSOON</span>
        </div>
      </div>

      {/* GIS Layers Dropdown Panel */}
      {isLayerDrawerOpen && (
        <div className="absolute top-16 left-4 z-20 w-64 rounded-xl bg-white border border-slate-200 p-4 shadow-modal animate-in fade-in zoom-in-95 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Map GIS Overlays</span>
            <button onClick={() => setIsLayerDrawerOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
              <span className="flex items-center space-x-2 text-slate-700 font-medium">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live Active Fleets</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.liveFleet}
                onChange={() => toggleLayer('liveFleet')}
                className="rounded accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
              <span className="flex items-center space-x-2 text-slate-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span>Vulnerable Chokepoints</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.chokepoints}
                onChange={() => toggleLayer('chokepoints')}
                className="rounded accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
              <span className="flex items-center space-x-2 text-slate-700 font-medium">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                <span>Landslide Hazard Belts</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.landslideRisk}
                onChange={() => toggleLayer('landslideRisk')}
                className="rounded accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
              <span className="flex items-center space-x-2 text-slate-700 font-medium">
                <CloudRain className="w-3.5 h-3.5 text-sky-600" />
                <span>Weather & Flood Radar</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.weatherRadar}
                onChange={() => toggleLayer('weatherRadar')}
                className="rounded accent-teal-700"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1.5 rounded-md">
              <span className="flex items-center space-x-2 text-slate-700 font-medium">
                <MapPin className="w-3.5 h-3.5 text-teal-700" />
                <span>Logistics Hubs</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.topography}
                onChange={() => toggleLayer('topography')}
                className="rounded accent-teal-700"
              />
            </label>
          </div>
        </div>
      )}

      {/* Vehicle Telemetry Bottom Drawer when a vehicle is clicked */}
      {selectedVehicle && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-2xl mx-auto rounded-xl bg-white p-4 sm:p-5 shadow-modal border border-slate-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-800 border border-teal-200">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-slate-900">{selectedVehicle.vehicle_no}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    selectedVehicle.is_sos ? 'bg-red-600 text-white animate-pulse' : 'bg-teal-50 text-teal-800 border border-teal-200'
                  }`}>
                    {selectedVehicle.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">{selectedVehicle.cargo_desc}</div>
              </div>
            </div>

            <button onClick={() => setSelectedVehicle(null)} className="text-slate-400 hover:text-slate-700 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                <Gauge className="w-3.5 h-3.5 text-teal-700" />
                <span>Speed</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{selectedVehicle.speed_kmh} km/h</div>
            </div>

            {selectedVehicle.temp_celsius !== undefined && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                  <Thermometer className="w-3.5 h-3.5 text-teal-700" />
                  <span>Cold Chain</span>
                </div>
                <div className="text-sm font-bold text-teal-800 mt-1">{selectedVehicle.temp_celsius}°C</div>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                <Weight className="w-3.5 h-3.5 text-amber-700" />
                <span>Cargo Weight</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">{selectedVehicle.weight_tonnes} Tonnes</div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500 flex items-center space-x-1 font-medium">
                <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                <span>Route Progress</span>
              </div>
              <div className="text-sm font-bold text-emerald-700 mt-1">{selectedVehicle.progress_pct}%</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
            <div className="text-[11px] text-slate-600">
              Driver: <span className="font-semibold text-slate-900">{selectedVehicle.driver_name}</span> ({selectedVehicle.driver_phone})
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold transition-all flex items-center space-x-1 ${
                selectedVehicle.is_sos
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}>
                {selectedVehicle.is_sos ? '🚨 SOS PANIC SIGNAL ACTIVE' : '✓ TELEMETRY NORMAL'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Chokepoint Inspector Drawer */}
      {selectedChokepoint && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-xl mx-auto rounded-xl bg-white p-4 shadow-modal border border-slate-200 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedChokepoint.name}</h3>
                <p className="text-[11px] text-slate-500">{selectedChokepoint.affected_corridor} ({selectedChokepoint.state})</p>
              </div>
            </div>
            <button onClick={() => setSelectedChokepoint(null)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="my-2.5 text-xs text-slate-700 space-y-1.5">
            <p>{selectedChokepoint.description}</p>
            <div className="flex items-center space-x-4 text-[11px] font-mono">
              <span className="text-red-700 font-bold">Status: {selectedChokepoint.current_status}</span>
              <span className="text-slate-500">Clearance ETA: ~{selectedChokepoint.average_clearance_hrs} hrs</span>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px]">
              <strong>AI Suggested Bypass:</strong> {selectedChokepoint.alternate_bypass}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
