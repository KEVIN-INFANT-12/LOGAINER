import React, { useEffect, useState, useRef } from 'react';
import {
  Layers,
  Truck,
  AlertTriangle,
  MapPin,
  CloudRain,
  Compass,
  Eye,
  ShieldAlert,
  Activity,
  X,
  PhoneCall,
  Navigation,
  Thermometer,
  Weight,
  Gauge,
  Maximize2
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

// Custom HTML Markers
const createVehicleIcon = (vehicle: FleetVehicle) => {
  const isEmergency = vehicle.is_sos || vehicle.status === 'EMERGENCY_SOS';
  const isColdChain = vehicle.cargo_type === 'ESSENTIAL_MEDICINES_COLD_CHAIN';
  const color = isEmergency ? '#F43F5E' : isColdChain ? '#06B6D4' : '#10B981';

  return L.divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        background: rgba(17, 24, 39, 0.9);
        border: 2px solid ${color};
        border-radius: 12px;
        box-shadow: 0 0 16px ${color}80;
        transform: rotate(${vehicle.heading_deg || 0}deg);
        transition: all 0.5s ease-out;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/>
          <circle cx="7" cy="18" r="2"/>
        </svg>
        ${isEmergency ? '<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping"></div>' : ''}
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20]
  });
};

const createChokepointIcon = (cp: Chokepoint) => {
  const isCritical = cp.current_status === 'CRITICAL_BLOCKED';
  const color = isCritical ? '#F43F5E' : '#F59E0B';

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
        background: rgba(17, 24, 39, 0.95);
        border: 2px solid ${color};
        border-radius: 50%;
        box-shadow: 0 0 20px ${color};
        ${isCritical ? 'animation: beaconPulse 1.8s infinite;' : ''}
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
        background: rgba(11, 15, 25, 0.9);
        border: 2px solid #06B6D4;
        border-radius: 8px;
        box-shadow: 0 0 12px rgba(6, 182, 212, 0.6);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2.5">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

export const GISMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const routesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hazardLayersGroupRef = useRef<L.LayerGroup | null>(null);

  const {
    hubs,
    chokepoints,
    vehicles,
    incidents,
    weatherStations,
    activeLayers,
    toggleLayer,
    selectedVehicle,
    setSelectedVehicle,
    selectedChokepoint,
    setSelectedChokepoint,
    triggerVehicleSOS,
    activeRouteResult,
    isDisasterModeActive
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

    // High quality Light/White GIS Basemap tiles (100% Watermark-Free)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    routesLayerGroupRef.current = L.layerGroup().addTo(map);
    hazardLayersGroupRef.current = L.layerGroup().addTo(map);

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
          <div class="p-2 space-y-1 text-xs">
            <div class="font-bold text-cyan-400 text-sm">${hub.name}</div>
            <div class="text-slate-300">State: ${hub.state}</div>
            <div class="text-slate-400 font-mono">Capacity: ${hub.capacity_tons.toLocaleString()} Tonnes</div>
            <div class="text-[10px] text-emerald-400 font-semibold uppercase">${hub.type.replace(/_/g, ' ')}</div>
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
        marker.bindPopup(`
          <div class="p-2 space-y-1.5 text-xs max-w-[240px]">
            <div class="flex items-center justify-between">
              <span class="font-bold text-rose-400 text-sm">${cp.name}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${cp.current_status === 'CRITICAL_BLOCKED' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-300'
          }">${cp.current_status}</span>
            </div>
            <div class="text-slate-300 text-[11px]">${cp.description}</div>
            <div class="text-[10px] text-slate-400 font-mono">Avg Clearance: ${cp.average_clearance_hrs} hrs</div>
            <div class="p-1 rounded bg-slate-800/80 text-[10px] text-cyan-300 border border-cyan-500/20">
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
          <div class="p-2 space-y-1.5 text-xs min-w-[220px]">
            <div class="flex items-center justify-between">
              <span class="font-bold text-white">${v.vehicle_no}</span>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${v.is_sos ? 'bg-rose-600 text-white animate-pulse' : 'bg-cyan-500/20 text-cyan-300'
          }">${v.status}</span>
            </div>
            <div class="text-[11px] text-cyan-400 font-medium">${v.cargo_desc}</div>
            <div class="grid grid-cols-2 gap-1 text-[10px] font-mono text-slate-300">
              <div>Speed: ${v.speed_kmh} km/h</div>
              <div>Progress: ${v.progress_pct}%</div>
              ${v.temp_celsius !== undefined ? `<div class="text-teal-300">Temp: ${v.temp_celsius}°C</div>` : ''}
              <div>Driver: ${v.driver_name.split(' ')[0]}</div>
            </div>
            <div class="text-[9px] text-slate-400 italic">${v.origin_name} ➔ ${v.destination_name}</div>
          </div>
        `);
        markersLayerGroupRef.current?.addLayer(marker);
      });
    }

    // 4. Hazard Layers: Landslide Risk Belts & Flood Plains
    if (activeLayers.landslideRisk) {
      // East Khasi Hills, Pagla Pahar, Sela, Mangan high-risk zones
      const hazardZones = [
        { lat: 25.32, lng: 92.35, radius: 28000, color: '#F43F5E', label: 'Sonapur Mudflow Danger Zone' },
        { lat: 25.78, lng: 93.85, radius: 22000, color: '#F59E0B', label: 'Pagla Pahar Active Rockfall' },
        { lat: 27.50, lng: 92.10, radius: 30000, color: '#06B6D4', label: 'Sela Avalanche & Snow Drift' },
        { lat: 26.88, lng: 88.47, radius: 24000, color: '#3B82F6', label: 'Teesta River Swelling Area' }
      ];

      hazardZones.forEach((hz) => {
        const circle = L.circle([hz.lat, hz.lng], {
          radius: hz.radius,
          color: hz.color,
          fillColor: hz.color,
          fillOpacity: isDisasterModeActive ? 0.35 : 0.18,
          weight: 1.5,
          dashArray: '4, 4'
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
            color: ws.rainfall_mm_hr > 40 ? '#F43F5E' : '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.22,
            weight: 1
          });
          rainCircle.bindTooltip(`${ws.city}: ${ws.rainfall_mm_hr} mm/h (${ws.condition})`, { permanent: false });
          hazardLayersGroupRef.current?.addLayer(rainCircle);
        }
      });
    }

  }, [hubs, chokepoints, vehicles, incidents, weatherStations, activeLayers, isDisasterModeActive, setSelectedVehicle, setSelectedChokepoint]);

  // Render Computed Routes on Map
  useEffect(() => {
    if (!mapInstanceRef.current || !routesLayerGroupRef.current) return;
    routesLayerGroupRef.current.clearLayers();

    if (activeRouteResult && activeLayers.corridors) {
      const { primary_route, ai_optimized_route, emergency_green_route } = activeRouteResult;

      // 1. Primary route in amber / red dash
      if (primary_route && primary_route.waypoints) {
        const latlngs = primary_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const primaryLine = L.polyline(latlngs, {
          color: '#F59E0B',
          weight: 4,
          opacity: 0.7,
          dashArray: '6, 6'
        }).addTo(routesLayerGroupRef.current);
        primaryLine.bindTooltip(`Standard Route: ${primary_route.distance_km} km`, { sticky: true });
      }

      // 2. AI Optimized route in Glowing Cyan
      if (ai_optimized_route && ai_optimized_route.waypoints) {
        const latlngs = ai_optimized_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const aiLine = L.polyline(latlngs, {
          color: '#06B6D4',
          weight: 6,
          opacity: 0.95
        }).addTo(routesLayerGroupRef.current);
        aiLine.bindTooltip(`AI Risk-Mitigated Alternate: ${ai_optimized_route.distance_km} km (-48% Hazard)`, { sticky: true });
      }

      // 3. Emergency Green Corridor
      if (emergency_green_route && isDisasterModeActive && emergency_green_route.waypoints) {
        const latlngs = emergency_green_route.waypoints.map((w: any) => [w.lat, w.lng]);
        const emLine = L.polyline(latlngs, {
          color: '#10B981',
          weight: 7,
          opacity: 0.95
        }).addTo(routesLayerGroupRef.current);
        emLine.bindTooltip(`Green Corridor Priority Route`, { sticky: true });
      }
    }
  }, [activeRouteResult, activeLayers.corridors, isDisasterModeActive]);

  return (
    <div className="relative w-full h-full min-h-[500px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl flex flex-col">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full flex-1 z-10" />

      {/* Top Left GIS Control Pill */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-2">
        <button
          onClick={() => setIsLayerDrawerOpen(!isLayerDrawerOpen)}
          className="flex items-center space-x-2 px-3 py-2 rounded-xl glass-panel text-xs font-semibold text-cyan-300 hover:text-white border border-cyan-500/30 shadow-glow-cyan transition-all"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>GIS Layers</span>
        </button>

        {isDisasterModeActive && (
          <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-rose-600/90 text-white text-xs font-bold shadow-glow-rose animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>DISASTER RED ALERT ACTIVE</span>
          </div>
        )}
      </div>

      {/* Top Right Persistent Data Tier Indicators (Demo Reliability & Transparency) */}
      <div className="absolute top-4 right-14 z-20 hidden md:flex items-center space-x-2 text-[10px] font-mono">
        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-emerald-500/30 text-emerald-400 flex items-center space-x-1.5 backdrop-blur-md shadow-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>GPS: SIMULATED (400 Fleets)</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-cyan-300 flex items-center space-x-1.5 backdrop-blur-md shadow-md">
          <span>Satellite: CACHED (06:00 UTC Sentinel-2)</span>
        </div>
        <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 border border-amber-500/30 text-amber-300 flex items-center space-x-1.5 backdrop-blur-md shadow-md">
          <span>Weather: SIMULATED MONSOON</span>
        </div>
      </div>

      {/* GIS Layers Dropdown Panel */}
      {isLayerDrawerOpen && (
        <div className="absolute top-16 left-4 z-20 w-64 rounded-2xl glass-panel-glow p-4 shadow-2xl animate-in fade-in zoom-in-95 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Map GIS Overlays</span>
            <button onClick={() => setIsLayerDrawerOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded">
              <span className="flex items-center space-x-2 text-slate-200">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Active Fleets</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.liveFleet}
                onChange={() => toggleLayer('liveFleet')}
                className="rounded accent-cyan-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded">
              <span className="flex items-center space-x-2 text-slate-200">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Vulnerable Chokepoints</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.chokepoints}
                onChange={() => toggleLayer('chokepoints')}
                className="rounded accent-cyan-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded">
              <span className="flex items-center space-x-2 text-slate-200">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                <span>Landslide Hazard Belts</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.landslideRisk}
                onChange={() => toggleLayer('landslideRisk')}
                className="rounded accent-cyan-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded">
              <span className="flex items-center space-x-2 text-slate-200">
                <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                <span>Weather & Flood Radar</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.weatherRadar}
                onChange={() => toggleLayer('weatherRadar')}
                className="rounded accent-cyan-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1 rounded">
              <span className="flex items-center space-x-2 text-slate-200">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Logistics Hubs</span>
              </span>
              <input
                type="checkbox"
                checked={activeLayers.topography}
                onChange={() => toggleLayer('topography')}
                className="rounded accent-cyan-500"
              />
            </label>
          </div>
        </div>
      )}

      {/* Vehicle Telemetry Bottom Drawer when a vehicle is clicked */}
      {selectedVehicle && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-2xl mx-auto rounded-2xl glass-panel-glow p-4 sm:p-5 shadow-2xl border border-cyan-500/40 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between pb-3 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold text-white">{selectedVehicle.vehicle_no}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${selectedVehicle.is_sos ? 'bg-rose-600 text-white animate-pulse' : 'bg-cyan-500/20 text-cyan-300'
                    }`}>
                    {selectedVehicle.status}
                  </span>
                </div>
                <div className="text-xs text-cyan-300 font-medium">{selectedVehicle.cargo_desc}</div>
              </div>
            </div>

            <button onClick={() => setSelectedVehicle(null)} className="text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
              <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                <span>Speed</span>
              </div>
              <div className="text-sm font-mono font-bold text-white mt-1">{selectedVehicle.speed_kmh} km/h</div>
            </div>

            {selectedVehicle.temp_celsius !== undefined && (
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <Thermometer className="w-3.5 h-3.5 text-teal-400" />
                  <span>Cold Chain</span>
                </div>
                <div className="text-sm font-mono font-bold text-teal-300 mt-1">{selectedVehicle.temp_celsius}°C</div>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
              <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Weight className="w-3.5 h-3.5 text-amber-400" />
                <span>Cargo Weight</span>
              </div>
              <div className="text-sm font-mono font-bold text-white mt-1">{selectedVehicle.weight_tonnes} Tonnes</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
              <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                <span>Route Done</span>
              </div>
              <div className="text-sm font-mono font-bold text-emerald-400 mt-1">{selectedVehicle.progress_pct}%</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
            <div className="text-[11px] text-slate-300">
              Driver: <span className="font-semibold text-white">{selectedVehicle.driver_name}</span> ({selectedVehicle.driver_phone})
            </div>

            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center space-x-1 ${selectedVehicle.is_sos
                ? 'bg-rose-600 text-white animate-pulse shadow-glow-rose'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                {selectedVehicle.is_sos ? '🚨 SOS PANIC SIGNAL ACTIVE' : '✓ TELEMETRY NORMAL'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Chokepoint Inspector Drawer */}
      {selectedChokepoint && (
        <div className="absolute bottom-4 left-4 right-4 z-20 max-w-xl mx-auto rounded-2xl glass-panel-glow p-4 shadow-2xl border border-rose-500/40 animate-in slide-in-from-bottom-5">
          <div className="flex items-start justify-between pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm font-bold text-white">{selectedChokepoint.name}</h3>
                <p className="text-[11px] text-slate-400">{selectedChokepoint.affected_corridor} ({selectedChokepoint.state})</p>
              </div>
            </div>
            <button onClick={() => setSelectedChokepoint(null)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="my-2.5 text-xs text-slate-300 space-y-1.5">
            <p>{selectedChokepoint.description}</p>
            <div className="flex items-center space-x-4 text-[11px] font-mono">
              <span className="text-rose-400 font-bold">Status: {selectedChokepoint.current_status}</span>
              <span className="text-slate-400">Clearance ETA: ~{selectedChokepoint.average_clearance_hrs} hrs</span>
            </div>
            <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-[11px]">
              <strong>AI Suggested Bypass:</strong> {selectedChokepoint.alternate_bypass}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
