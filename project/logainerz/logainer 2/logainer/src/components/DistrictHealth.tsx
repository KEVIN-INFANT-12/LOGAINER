import React, { useState } from 'react';
import { 
  Building2, 
  Activity, 
  AlertOctagon, 
  CheckCircle2, 
  Fuel, 
  Wheat, 
  Droplet, 
  Plane, 
  Filter,
  Search
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';

export const DistrictHealth: React.FC = () => {
  const { districtsHealth } = useLogistics();
  const { t } = useLanguage();

  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredDistricts = districtsHealth.filter((d) => {
    const matchesState = selectedState === 'ALL' || d.state.toLowerCase() === selectedState.toLowerCase();
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.state.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesState && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return { label: 'Optimal Buffer', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
      case 'WARNING':
        return { label: 'Moderate Vulnerability', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'ADVISORY':
        return { label: 'Advisory Active', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'CRITICAL_DEFICIT':
        return { label: 'CRITICAL ISOLATION DEFICIT', color: 'bg-rose-600 text-white animate-pulse' };
      default:
        return { label: 'Monitored', color: 'bg-slate-800 text-slate-300' };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-cyan-400" />
            <span>District Connectivity Index (DCI) & Supply Chain Reserves</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time monitoring of medical oxygen, life-saving medicines, FCI grain stock & high-risk isolated districts
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search district..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All 8 NER States</option>
            <option value="Assam">Assam</option>
            <option value="Arunachal Pradesh">Arunachal Pradesh</option>
            <option value="Meghalaya">Meghalaya</option>
            <option value="Manipur">Manipur</option>
            <option value="Mizoram">Mizoram</option>
            <option value="Nagaland">Nagaland</option>
            <option value="Tripura">Tripura</option>
            <option value="Sikkim">Sikkim</option>
          </select>
        </div>
      </div>

      {/* Critical Deficit Alert Banner */}
      {districtsHealth.some(d => d.status === 'CRITICAL_DEFICIT') && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/50 shadow-glow-rose flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-rose-600 text-white">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Severe Supply Isolation Alert in Hill Districts</div>
              <div className="text-xs text-rose-200">
                East Jaintia Hills & North Sikkim (Mangan) have &lt; 48 hours of medical oxygen remaining due to highway cutoffs.
              </div>
            </div>
          </div>

          <button className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg flex items-center space-x-1.5 shrink-0">
            <Plane className="w-4 h-4" />
            <span>DISPATCH DRONE / AIRLIFT CONVOY</span>
          </button>
        </div>
      )}

      {/* Districts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDistricts.map((d) => {
          const badge = getStatusBadge(d.status);
          const isCritical = d.status === 'CRITICAL_DEFICIT';

          return (
            <div
              key={d.district_id}
              className={`p-5 rounded-2xl glass-panel border transition-all ${
                isCritical ? 'border-rose-500/60 shadow-glow-rose bg-rose-950/20' : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-white/10">
                <div>
                  <h3 className="font-bold text-base text-white">{d.name}</h3>
                  <div className="text-xs text-cyan-400 font-medium">{d.state}</div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase font-mono">DCI Score</div>
                  <div className={`text-lg font-mono font-black ${
                    d.connectivity_index >= 80 ? 'text-emerald-400' : d.connectivity_index >= 50 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {d.connectivity_index} / 100
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="my-3 flex items-center justify-between">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>

                <span className="text-[11px] text-slate-400 font-mono">
                  {d.active_chokepoints} Chokepoints
                </span>
              </div>

              {/* Commodity Stock Gauges */}
              <div className="space-y-2.5 my-4 text-xs font-mono">
                {/* Medical Oxygen */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Medical Oxygen:</span>
                    </span>
                    <span className={`font-bold ${d.oxygen_days < 3.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {d.oxygen_days} Days Buffer
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${d.oxygen_days < 3.0 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                      style={{ width: `${Math.min(d.oxygen_days * 5, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Essential Medicines */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <Activity className="w-3.5 h-3.5 text-teal-400" />
                      <span>Essential Pharma:</span>
                    </span>
                    <span className={`font-bold ${d.medicine_days < 3.0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {d.medicine_days} Days Buffer
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${d.medicine_days < 3.0 ? 'bg-rose-500' : 'bg-teal-500'}`}
                      style={{ width: `${Math.min(d.medicine_days * 4, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Food Grains */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <Wheat className="w-3.5 h-3.5 text-amber-400" />
                      <span>FCI Grain Silos:</span>
                    </span>
                    <span className="font-bold text-white">
                      {d.grain_stock_tonnes.toLocaleString()} Tonnes
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${Math.min((d.grain_stock_tonnes / 10000) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Diesel Reserves */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-300 flex items-center space-x-1">
                      <Fuel className="w-3.5 h-3.5 text-purple-400" />
                      <span>Diesel Reserves:</span>
                    </span>
                    <span className="font-bold text-white">
                      {d.diesel_reserves_days} Days
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500"
                      style={{ width: `${Math.min(d.diesel_reserves_days * 6.6, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">Vulnerability: {(d.vulnerability_score * 100).toFixed(0)}%</span>
                <button className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs flex items-center space-x-1">
                  <span>View Supply Chain Plan ➔</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
