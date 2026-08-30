import React, { useState } from 'react';
import { 
  Truck, 
  Thermometer, 
  Gauge, 
  Weight, 
  AlertTriangle, 
  MapPin,
  Filter,
  Radio,
  Wifi,
  WifiOff,
  Signal,
  BrainCircuit
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
      return { label: 'Essential Medicines (Cold-Chain)', color: 'bg-teal-50 text-teal-800 border-teal-200' };
    }
    if (c.includes('FOOD') || c.includes('GRAIN')) {
      return { label: 'Food Grains (PDS)', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (c.includes('AGRICULTURAL')) {
      return { label: 'Agricultural Produce', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    }
    if (c.includes('CONSTRUCTION') || c.includes('Infrastructure')) {
      return { label: 'Construction Materials', color: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
    return { label: 'Critical Freight', color: 'bg-purple-50 text-purple-800 border-purple-200' };
  };

  const getConnectivityBadge = (status?: string) => {
    const s = status || 'CONNECTED';
    if (s === 'CONNECTED') {
      return { label: 'ONLINE', icon: Wifi, color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
    }
    if (s === 'LIMITED_CONNECTIVITY') {
      return { label: 'LIMITED', icon: Signal, color: 'text-amber-800 bg-amber-50 border-amber-200' };
    }
    return { label: 'OFFLINE (SYNC)', icon: WifiOff, color: 'text-red-700 bg-red-50 border-red-200' };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <Truck className="w-6 h-6 text-teal-700" />
              <span>Live Fleet & Real-Time Logistics Command</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              WEBSOCKET GPS STREAM
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time vehicle GPS telemetry, cold-chain temperature monitoring, ConvLSTM mid-trip disruption detection, and connectivity health.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={cargoFilter}
              onChange={(e) => setCargoFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
              className={`p-5 rounded-xl bg-white border shadow-card transition-all ${
                isEmergency
                  ? 'border-red-400 bg-red-50/40 ring-1 ring-red-400'
                  : hasDisruptionAlert
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-slate-200 hover:border-teal-600/40 hover:shadow-card-hover'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{vehicle.vehicle_no}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      isEmergency ? 'bg-red-600 text-white animate-pulse' : 'bg-teal-50 text-teal-800 border border-teal-200'
                    }`}>
                      {vehicle.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">{vehicle.id}</div>
                </div>

                <div className="flex flex-col items-end space-y-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                    {badge.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold flex items-center space-x-1 border ${conn.color}`}>
                    <ConnIcon className="w-2.5 h-2.5" />
                    <span>{conn.label}</span>
                  </span>
                </div>
              </div>

              {/* Cargo Desc */}
              <div className="mt-3 text-xs font-semibold text-slate-800">
                {vehicle.cargo_desc}
              </div>

              {/* Origin to Destination Route */}
              <div className="my-3 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-teal-700" />
                    <span className="font-semibold text-slate-900">{vehicle.origin_name}</span>
                  </div>
                  <span className="text-slate-400">➔</span>
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-emerald-700" />
                    <span className="font-semibold text-slate-900">{vehicle.destination_name}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Route Progress</span>
                    <span className="font-bold text-slate-800">{vehicle.progress_pct}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full transition-all duration-500"
                      style={{ width: `${vehicle.progress_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ConvLSTM Mid-Trip Risk Monitoring */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-1.5 text-slate-600">
                  <BrainCircuit className="w-3.5 h-3.5 text-purple-700" />
                  <span>ConvLSTM Risk:</span>
                </div>
                <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                  midTripRisk > 0.66 
                    ? 'bg-red-50 text-red-700 border-red-200' 
                    : midTripRisk > 0.33
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {midTripRisk.toFixed(2)} ({midTripRisk > 0.66 ? 'HIGH' : midTripRisk > 0.33 ? 'MEDIUM' : 'LOW'})
                </span>
              </div>

              {/* Disruption Alert Banner if active */}
              {hasDisruptionAlert && (
                <div className="my-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Mid-Trip Hazard Detected</span>
                  </div>
                  <p className="text-[11px] text-amber-800">{vehicle.disruption_alert?.message}</p>
                </div>
              )}

              {/* Sensor Telemetry Badges */}
              <div className="grid grid-cols-3 gap-2 my-3 font-mono text-xs text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1 font-medium">
                    <Gauge className="w-3 h-3 text-teal-700" />
                    <span>Speed</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">{vehicle.speed_kmh} km/h</div>
                </div>

                {vehicle.temp_celsius !== undefined ? (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1 font-medium">
                      <Thermometer className="w-3 h-3 text-teal-700" />
                      <span>Temp</span>
                    </div>
                    <div className="font-bold text-teal-800 mt-0.5">{vehicle.temp_celsius}°C</div>
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1 font-medium">
                      <Radio className="w-3 h-3 text-emerald-700" />
                      <span>GPS Fix</span>
                    </div>
                    <div className="font-bold text-emerald-700 mt-0.5">3D Lock</div>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 flex items-center justify-center space-x-1 font-medium">
                    <Weight className="w-3 h-3 text-amber-700" />
                    <span>Payload</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">{vehicle.weight_tonnes} T</div>
                </div>
              </div>

              {/* Driver & SOS Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">{vehicle.driver_name}</div>
                  <div className="text-[10px] text-slate-500">{vehicle.driver_phone}</div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-md text-xs font-bold font-mono transition-all ${
                    isEmergency
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
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
