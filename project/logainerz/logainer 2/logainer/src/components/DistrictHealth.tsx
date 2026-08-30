import React, { useState } from 'react';
import { 
  Building2, 
  Activity, 
  AlertOctagon, 
  Wheat, 
  Droplet, 
  Plane, 
  Search,
  Fuel
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
        return { label: 'Optimal Buffer', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'WARNING':
        return { label: 'Moderate Vulnerability', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'ADVISORY':
        return { label: 'Advisory Active', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'CRITICAL_DEFICIT':
        return { label: 'CRITICAL ISOLATION DEFICIT', color: 'bg-red-50 text-red-700 border-red-200 font-bold' };
      default:
        return { label: 'Monitored', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
            <Building2 className="w-6 h-6 text-teal-700" />
            <span>District Connectivity Index (DCI) & Supply Chain Reserves</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
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
              className="pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
            />
          </div>

          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-600 text-white shadow-sm">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-red-900">Severe Supply Isolation Alert in Hill Districts</div>
              <div className="text-xs text-red-800">
                East Jaintia Hills & North Sikkim (Mangan) have &lt; 48 hours of medical oxygen remaining due to highway cutoffs.
              </div>
            </div>
          </div>

          <button className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 shrink-0 transition-all">
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
              className={`p-5 rounded-xl bg-white border shadow-card transition-all ${
                isCritical ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-200 hover:border-teal-600/40 hover:shadow-card-hover'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-base text-slate-900">{d.name}</h3>
                  <div className="text-xs text-teal-700 font-semibold">{d.state}</div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">DCI Score</div>
                  <div className={`text-lg font-mono font-bold ${
                    d.connectivity_index >= 80 ? 'text-emerald-700' : d.connectivity_index >= 50 ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {d.connectivity_index} / 100
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="my-3 flex items-center justify-between">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.color}`}>
                  {badge.label}
                </span>

                <span className="text-[11px] text-slate-500 font-mono">
                  {d.active_chokepoints} Chokepoints
                </span>
              </div>

              {/* Commodity Stock Gauges */}
              <div className="space-y-2.5 my-4 text-xs font-mono">
                {/* Medical Oxygen */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-700 flex items-center space-x-1 font-medium">
                      <Droplet className="w-3.5 h-3.5 text-teal-700" />
                      <span>Medical Oxygen:</span>
                    </span>
                    <span className={`font-bold ${d.oxygen_days < 3.0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {d.oxygen_days} Days Buffer
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full ${d.oxygen_days < 3.0 ? 'bg-red-600' : 'bg-teal-700'}`}
                      style={{ width: `${Math.min(d.oxygen_days * 5, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Essential Medicines */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-700 flex items-center space-x-1 font-medium">
                      <Activity className="w-3.5 h-3.5 text-teal-700" />
                      <span>Essential Pharma:</span>
                    </span>
                    <span className={`font-bold ${d.medicine_days < 3.0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {d.medicine_days} Days Buffer
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className={`h-full ${d.medicine_days < 3.0 ? 'bg-red-600' : 'bg-emerald-600'}`}
                      style={{ width: `${Math.min(d.medicine_days * 4, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Food Grains */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-700 flex items-center space-x-1 font-medium">
                      <Wheat className="w-3.5 h-3.5 text-amber-700" />
                      <span>FCI Grain Silos:</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {d.grain_stock_tonnes.toLocaleString()} Tonnes
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-amber-500"
                      style={{ width: `${Math.min((d.grain_stock_tonnes / 10000) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Diesel Reserves */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-700 flex items-center space-x-1 font-medium">
                      <Fuel className="w-3.5 h-3.5 text-slate-600" />
                      <span>Diesel Reserves:</span>
                    </span>
                    <span className="font-bold text-slate-900">
                      {d.diesel_reserves_days} Days
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-slate-700"
                      style={{ width: `${Math.min(d.diesel_reserves_days * 6.6, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-500">Vulnerability: {(d.vulnerability_score * 100).toFixed(0)}%</span>
                <button className="text-teal-700 hover:text-teal-800 font-semibold text-xs flex items-center space-x-1">
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
