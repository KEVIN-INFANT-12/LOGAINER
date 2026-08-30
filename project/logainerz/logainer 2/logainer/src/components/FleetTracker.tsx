import React, { useState } from 'react';
import { 
  Truck, 
  Thermometer, 
  Gauge, 
  Weight, 
  Phone, 
  AlertTriangle, 
  Navigation, 
  CheckCircle, 
  MapPin,
  Filter,
  Radio,
  Wifi,
  WifiOff,
  Signal,
  BrainCircuit,
  RotateCcw
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { FleetVehicle } from '../types';

export const FleetTracker: React.FC = () => {
  const { vehicles, triggerVehicleSOS, setSelectedVehicle } = useLogistics();
  const { t } = useLanguage();

  const [cargoFilter, setCargoFilter] = useState<string>('ALL');
  const [connectivityFilter, setConnectivityFilter] = useState<string>('ALL');

  const filteredVehicles = vehicles.filter(v => {
    const matchesCargo = cargoFilter === 'ALL' || v.cargo_type === cargoFilter || v.commodity_type === cargoFilter;
    const matchesConn = connectivityFilter === 'ALL' || (v.connectivity_status || 'CONNECTED') === connectivityFilter;
    return matchesCargo && matchesConn;
  });

  const getCargoBadge = (cargoType: string) => {
    const c = cargoType || '';
    if (c.includes('MEDICINE') || c.includes('OXYGEN')) {
      return { label: 'Essential Medicines (Cold-Chain)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
    }
    if (c.includes('FOOD') || c.includes('GRAIN')) {
      return { label: 'Food Grains (PDS)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    }
    if (c.includes('AGRICULTURAL')) {
      return { label: 'Agricultural Produce', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    }
    if (c.includes('CONSTRUCTION') || c.includes('Infrastructure')) {
      return { label: 'Construction Materials', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
    }
    return { label: 'Critical Freight', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
  };

  const getConnectivityBadge = (status?: string) => {
    const s = status || 'CONNECTED';
    if (s === 'CONNECTED') {
      return { label: 'CONNECTED', icon: Wifi, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    }
    if (s === 'LIMITED_CONNECTIVITY') {
      return { label: 'LIMITED CONNECTIVITY', icon: Signal, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
    }
    return { label: 'OFFLINE (CACHED SYNC)', icon: WifiOff, color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <Truck className="w-6 h-6 text-emerald-400" />
              <span>Live Fleet & Real-Time Logistics Command</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              WEBSOCKET GPS STREAM
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time vehicle GPS telemetry, cold-chain temperature monitoring, ConvLSTM mid-trip disruption detection, and connectivity health.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Commodities ({vehicles.length})</option>
              <option value="ESSENTIAL_MEDICINES">Essential Medicines & Vaccines</option>
              <option value="FOOD_GRAINS">Food Grains (PDS)</option>
              <option value="AGRICULTURAL_PRODUCE">Agricultural Produce</option>
              <option value="CONSTRUCTION_MATERIALS">Construction Materials</option>
            </select>
          </div>

          <select
            value={connectivityFilter}
            onChange={(e) => setConnectivityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Connectivity States</option>
            <option value="CONNECTED">Connected (Online)</option>
            <option value="LIMITED_CONNECTIVITY">Limited Connectivity</option>
            <option value="OFFLINE">Offline (Auto-Sync)</option>
          </select>
        </div>
      </div>

      {/* Fleet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredVehicles.map((vehicle) => {
          const badge = getCargoBadge(vehicle.cargo_type);
          const conn = getConnectivityBadge(vehicle.connectivity_status);
          const isEmergency = vehicle.is_sos || vehicle.status === 'EMERGENCY_SOS';
          const midTripRisk = vehicle.mid_trip_risk_score || 0.22;
          const hasDisruptionAlert = Boolean(vehicle.disruption_alert);

          const ConnIcon = conn.icon;

          return (
            <div
              key={vehicle.id}
              className={`p-5 rounded-2xl glass-panel border transition-all hover:scale-[1.01] ${
                isEmergency
                  ? 'border-rose-500/60 shadow-glow-rose bg-rose-950/20'
                  : hasDisruptionAlert
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-white/10">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-white">{vehicle.vehicle_no}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      isEmergency ? 'bg-rose-600 text-white animate-pulse' : 'bg-cyan-500/20 text-cyan-300'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{vehicle.id}</div>
                </div>

                <div className="flex flex-col items-end space-y-1">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold flex items-center space-x-1 border ${conn.color}`}>
                    <ConnIcon className="w-2.5 h-2.5" />
                    <span>{conn.label}</span>
                  </span>
                </div>
              </div>

              {/* Cargo Desc */}
              <div className="mt-3 text-xs font-semibold text-slate-200">
                {vehicle.cargo_desc}
              </div>

              {/* Origin to Destination Route */}
              <div className="my-3 p-2.5 rounded-xl bg-slate-900/70 border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    <span className="font-semibold">{vehicle.origin_name}</span>
                  </div>
                  <span className="text-slate-500">➔</span>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    <span className="font-semibold">{vehicle.destination_name}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Route Progress</span>
                    <span>{vehicle.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${vehicle.progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ConvLSTM Mid-Trip Risk Monitoring */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  <BrainCircuit className="w-3.5 h-3.5 text-purple-400" />
                  <span>ConvLSTM Mid-Trip Risk:</span>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  midTripRisk > 0.66 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                    : midTripRisk > 0.33
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {midTripRisk.toFixed(2)} ({midTripRisk > 0.66 ? 'HIGH' : midTripRisk > 0.33 ? 'MEDIUM' : 'LOW'})
                </span>
              </div>

              {/* Disruption Alert Banner if active */}
              {hasDisruptionAlert && (
                <div className="my-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Mid-Trip Hazard Detected</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{vehicle.disruption_alert?.message}</p>
                </div>
              )}

              {/* Sensor Telemetry Badges */}
              <div className="grid grid-cols-3 gap-2 my-3 font-mono text-xs text-center">
                <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                  <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                    <Gauge className="w-3 h-3 text-cyan-400" />
                    <span>Speed</span>
                  </div>
                  <div className="font-bold text-white mt-0.5">{vehicle.speed_kmh} km/h</div>
                </div>

                {vehicle.temp_celsius !== undefined ? (
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                    <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                      <Thermometer className="w-3 h-3 text-teal-400" />
                      <span>Temp</span>
                    </div>
                    <div className="font-bold text-teal-300 mt-0.5">{vehicle.temp_celsius}°C</div>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                    <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                      <Radio className="w-3 h-3 text-emerald-400" />
                      <span>GPS Fix</span>
                    </div>
                    <div className="font-bold text-emerald-400 mt-0.5">3D Lock</div>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-slate-900/60 border border-white/5">
                  <div className="text-[10px] text-slate-400 flex items-center justify-center space-x-1">
                    <Weight className="w-3 h-3 text-amber-400" />
                    <span>Payload</span>
                  </div>
                  <div className="font-bold text-white mt-0.5">{vehicle.weight_tonnes} T</div>
                </div>
              </div>

              {/* Driver & SOS Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                <div className="text-xs">
                  <div className="font-semibold text-white">{vehicle.driver_name}</div>
                  <div className="text-[10px] text-slate-400">{vehicle.driver_phone}</div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                    isEmergency
                      ? 'bg-rose-600 text-white animate-pulse shadow-glow-rose'
                      : 'bg-slate-800 text-slate-400 border border-white/10'
                  }`}>
                    {isEmergency ? '🚨 SOS ACTIVE' : '🟢 MONITORED'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
