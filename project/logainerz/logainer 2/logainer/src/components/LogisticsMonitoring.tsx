import React, { useState } from 'react';
import { 
  Package, 
  Truck, 
  Thermometer, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Filter, 
  Layers, 
  TrendingUp, 
  ShieldAlert, 
  Wheat, 
  Droplet, 
  Fuel, 
  Hammer, 
  Apple, 
  Search,
  Activity,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { FleetVehicle } from '../types';

export const LogisticsMonitoring: React.FC = () => {
  const { vehicles, districtsHealth, chokepoints, isDisasterModeActive } = useLogistics();

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredVehicles = vehicles.filter((v) => {
    const matchesCat = categoryFilter === 'ALL' || v.cargo_type === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesSearch = 
      v.vehicle_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.cargo_desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.destination_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.origin_name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesStatus && matchesSearch;
  });

  // Category stats calculation
  const totalTonnes = vehicles.reduce((sum, v) => sum + (v.weight_tonnes || 0), 0);
  const coldChainVehicles = vehicles.filter(v => v.cargo_type === 'ESSENTIAL_MEDICINES_COLD_CHAIN');
  const oxygenVehicles = vehicles.filter(v => v.cargo_type === 'MEDICAL_OXYGEN_CYLINDERS');
  const foodVehicles = vehicles.filter(v => v.cargo_type === 'FOOD_GRAINS_PDS');
  const agriVehicles = vehicles.filter(v => v.cargo_type === 'AGRICULTURAL_PRODUCE');
  const constructionVehicles = vehicles.filter(v => v.cargo_type === 'CONSTRUCTION_MATERIALS');
  const delayedCount = vehicles.filter(v => v.status === 'EMERGENCY_SOS' || v.status === 'REROUTED_AI').length;

  const getCargoCategoryMeta = (cargoType: string) => {
    switch (cargoType) {
      case 'ESSENTIAL_MEDICINES_COLD_CHAIN':
        return { label: 'Medicines & Vaccines (Cold-Chain)', icon: Activity, color: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'MEDICAL_OXYGEN_CYLINDERS':
        return { label: 'Medical Oxygen Cylinders', icon: Droplet, color: 'text-teal-400', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/30' };
      case 'FOOD_GRAINS_PDS':
        return { label: 'Food Grains (FCI / PDS)', icon: Wheat, color: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'AGRICULTURAL_PRODUCE':
        return { label: 'Agri & Horticultural Produce', icon: Apple, color: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'CONSTRUCTION_MATERIALS':
        return { label: 'Construction & Repair Kits', icon: Hammer, color: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'PETROLEUM_FUEL':
        return { label: 'Petroleum & High-Altitude Fuel', icon: Fuel, color: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      default:
        return { label: 'Disaster Relief Kits', icon: Package, color: 'text-slate-300', badge: 'bg-slate-700 text-slate-200' };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <Package className="w-6 h-6 text-teal-400" />
              <span>Essential Commodities & Supply Chain Logistics Monitoring</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
              SUPPLY INTEGRITY GRID
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time delivery status, route bottlenecks, cold-chain temperature thresholds, and buffer monitoring for medicines, food, agri produce & construction materials
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300">
            Total Cargo: <span className="text-teal-400 font-bold">{totalTonnes.toLocaleString()} Tonnes</span>
          </div>
        </div>
      </div>

      {/* Commodity Category Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Cold-Chain Medicines */}
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-300 font-bold">{coldChainVehicles.length} Convoys</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Cold-Chain Pharma</div>
          <div className="text-lg font-mono font-bold text-white">2-8°C Target</div>
          <div className="text-[10px] text-emerald-400 font-mono">100% Temp Compliant</div>
        </div>

        {/* Medical Oxygen */}
        <div className="p-4 rounded-2xl glass-panel border border-teal-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <Droplet className="w-4 h-4 text-teal-400" />
            <span className="text-[10px] font-mono text-teal-300 font-bold">{oxygenVehicles.length} Tankers</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Medical Oxygen</div>
          <div className="text-lg font-mono font-bold text-white">Cryogenic</div>
          <div className="text-[10px] text-teal-300 font-mono">Priority Green Lane</div>
        </div>

        {/* FCI Food Grains */}
        <div className="p-4 rounded-2xl glass-panel border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <Wheat className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-300 font-bold">{foodVehicles.length} Fleets</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Food Grains (PDS)</div>
          <div className="text-lg font-mono font-bold text-white">FCI Silos</div>
          <div className="text-[10px] text-amber-400 font-mono">Buffer: 18-24 Days</div>
        </div>

        {/* Agricultural Produce */}
        <div className="p-4 rounded-2xl glass-panel border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <Apple className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-300 font-bold">{agriVehicles.length} Trucks</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Agri & Horticulture</div>
          <div className="text-lg font-mono font-bold text-white">Fresh Logistics</div>
          <div className="text-[10px] text-emerald-400 font-mono">Zero Perish Loss</div>
        </div>

        {/* Construction Materials */}
        <div className="p-4 rounded-2xl glass-panel border border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <Hammer className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-mono text-purple-300 font-bold">{constructionVehicles.length} Convoys</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Construction / BRO</div>
          <div className="text-lg font-mono font-bold text-white">Bridge Bailey</div>
          <div className="text-[10px] text-purple-300 font-mono">Pre-Fabricated Steel</div>
        </div>

        {/* At Risk / Bottlenecks */}
        <div className="p-4 rounded-2xl glass-panel border border-rose-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-mono text-rose-300 font-bold">{delayedCount} Rerouted</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-300">Supply Bottlenecks</div>
          <div className="text-lg font-mono font-bold text-rose-400">AI Bypasses</div>
          <div className="text-[10px] text-rose-300 font-mono">Avg Delay: +45m</div>
        </div>
      </div>

      {/* Active Bottlenecks & Corridor Constraints Alert */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">Corridor Bottleneck Mitigation Protocol</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Sonapur Tunnel and Sela Pass sectors have automatic pilot escort assignments for cold-chain vaccines and medical oxygen.
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-300 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>100% Medical Shipments Monitored</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search vehicle, cargo, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500 w-56 sm:w-64"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Supply Categories</option>
            <option value="ESSENTIAL_MEDICINES_COLD_CHAIN">Medicines & Vaccines (Cold-Chain)</option>
            <option value="MEDICAL_OXYGEN_CYLINDERS">Medical Oxygen Cryogenic</option>
            <option value="FOOD_GRAINS_PDS">Food Grains (FCI PDS)</option>
            <option value="AGRICULTURAL_PRODUCE">Agricultural & Horticultural Produce</option>
            <option value="CONSTRUCTION_MATERIALS">Construction & Bridge Materials</option>
            <option value="PETROLEUM_FUEL">Petroleum Fuel</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Delivery Statuses</option>
            <option value="EN_ROUTE">En Route</option>
            <option value="REROUTED_AI">Rerouted via AI Bypass</option>
            <option value="PILOT_ESCORT">Pilot Escort Active</option>
            <option value="EMERGENCY_SOS">Emergency Alert / SOS</option>
            <option value="DELIVERED">Delivered to Depot</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-teal-400 font-bold">{filteredVehicles.length}</span> Active Deliveries
        </div>
      </div>

      {/* Shipment Records Table */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10 overflow-x-auto">
        <h3 className="text-xs uppercase font-bold text-teal-400 tracking-wider flex items-center space-x-2">
          <Truck className="w-4 h-4" />
          <span>Regional Freight Ledger & Delivery Verification</span>
        </h3>

        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-[11px] uppercase font-mono text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-3">Vehicle / ID</th>
              <th className="p-3">Cargo Commodity</th>
              <th className="p-3">Corridor Routing</th>
              <th className="p-3">Progress</th>
              <th className="p-3">Telemetry / Temp</th>
              <th className="p-3">Driver & Escort</th>
              <th className="p-3">Delivery Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {filteredVehicles.map((v) => {
              const meta = getCargoCategoryMeta(v.cargo_type);
              const Icon = meta.icon;

              return (
                <tr key={v.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-white">{v.vehicle_no}</div>
                    <div className="text-[10px] text-slate-400">{v.id}</div>
                  </td>

                  <td className="p-3">
                    <div className="flex items-center space-x-1.5">
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[180px]">{v.cargo_desc}</span>
                    </div>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 border ${meta.badge}`}>
                      {meta.label.split(' ')[0]}
                    </span>
                  </td>

                  <td className="p-3">
                    <div className="flex items-center space-x-1 text-slate-200">
                      <span className="font-semibold text-white">{v.origin_name}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="font-semibold text-teal-300">{v.destination_name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{v.weight_tonnes} Tonnes Load</div>
                  </td>

                  <td className="p-3">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>{v.progress_pct}%</span>
                      <span>{v.speed_kmh} km/h</span>
                    </div>
                    <div className="w-24 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full"
                        style={{ width: `${v.progress_pct}%` }}
                      />
                    </div>
                  </td>

                  <td className="p-3">
                    {v.temp_celsius !== undefined ? (
                      <div className="flex items-center space-x-1 text-teal-300 font-bold">
                        <Thermometer className="w-3.5 h-3.5" />
                        <span>{v.temp_celsius}°C</span>
                        <span className="text-[9px] text-slate-400">(Cold Chain)</span>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-[11px]">Ambient Standard</div>
                    )}
                    <div className="text-[10px] text-slate-500 font-mono">GPS Locked</div>
                  </td>

                  <td className="p-3">
                    <div className="text-white text-[11px]">{v.driver_name}</div>
                    <div className="text-[10px] text-slate-400">{v.driver_phone}</div>
                  </td>

                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                      v.status === 'EN_ROUTE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                      v.status === 'REROUTED_AI' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' :
                      v.status === 'PILOT_ESCORT' ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' :
                      v.status === 'EMERGENCY_SOS' ? 'bg-rose-600 text-white animate-pulse border-rose-500' :
                      'bg-slate-800 text-slate-300 border-white/10'
                    }`}>
                      {v.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
