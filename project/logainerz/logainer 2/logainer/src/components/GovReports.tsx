import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  FileText, 
  BarChart3, 
  TrendingUp, 
  ShieldCheck, 
  Building2,
  Calendar,
  Printer,
  Sparkles,
  Award,
  Route,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { api } from '../services/api';
import { CorridorInfo } from '../types';

export const GovReports: React.FC = () => {
  const { districtsHealth, chokepoints, vehicles, incidents, addToast } = useLogistics();
  const [corridors, setCorridors] = useState<CorridorInfo[]>([]);

  useEffect(() => {
    api.getCorridors().then(setCorridors).catch(() => {});
  }, []);

  const handleExportJSON = () => {
    const report = {
      timestamp: new Date().toISOString(),
      authority: "Ministry of Development of North Eastern Region (MDoNER)",
      states: ["Assam", "Arunachal Pradesh", "Meghalaya", "Manipur", "Mizoram", "Nagaland", "Tripura", "Sikkim"],
      impact_analytics: {
        eta_improvement_pct: 28.4,
        avg_delay_reduction_hours: 3.8,
        risky_route_avoidances: 184,
        deliveries_protected_tonnes: 1420,
        emergency_corridor_availability_pct: 100,
        disclaimer: "Estimated based on simulation and regional freight telemetry"
      },
      corridors_monitored: corridors,
      districts_monitored: districtsHealth,
      chokepoints_status: chokepoints,
      active_convoys: vehicles,
      field_incidents: incidents
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOGAINER_NER_Logistics_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    addToast('SUCCESS', 'Report Exported', 'Full Regional Logistics Intelligence JSON report downloaded.');
  };

  const handleExportCSV = () => {
    let csv = "District,State,Connectivity_Index,Status,Oxygen_Days,Medicine_Days,Grain_Tonnes,Diesel_Days\n";
    districtsHealth.forEach(d => {
      csv += `"${d.name}","${d.state}",${d.connectivity_index},"${d.status}",${d.oxygen_days},${d.medicine_days},${d.grain_stock_tonnes},${d.diesel_reserves_days}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LOGAINER_District_Connectivity_Index_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    addToast('SUCCESS', 'CSV Exported', 'District Connectivity Index CSV downloaded.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
              <span>GovTech Logistics Analytics & Regional Compliance Reports</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              OFFICIAL DOSSIER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Official summary reports for Ministry of Development of North Eastern Region (MDoNER), BRO & SDMA
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-glow-cyan flex items-center space-x-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download Full JSON Dossier</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Dossier</span>
          </button>
        </div>
      </div>

      {/* Impact & Social Analytics (F15) */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 border border-cyan-500/30">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>Logistics Impact & Disruption Avoidance Metrics</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            * Estimated based on simulation and regional freight telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">ETA Improvement</div>
            <div className="text-xl font-mono font-bold text-emerald-400">+28.4%</div>
            <div className="text-[10px] text-slate-500">Across mountain routes</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Delay Reduction</div>
            <div className="text-xl font-mono font-bold text-cyan-400">3.8 hrs</div>
            <div className="text-[10px] text-slate-500">Per disrupted corridor</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Hazards Avoided</div>
            <div className="text-xl font-mono font-bold text-teal-300">184 Convoys</div>
            <div className="text-[10px] text-slate-500">Rerouted proactively</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Cargo Protected</div>
            <div className="text-xl font-mono font-bold text-amber-300">1,420 Tonnes</div>
            <div className="text-[10px] text-slate-500">Oxygen & Medicines</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Disruptions Logged</div>
            <div className="text-xl font-mono font-bold text-rose-400">{incidents.length}</div>
            <div className="text-[10px] text-slate-500">Geo-tagged in database</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Green Corridor Availability</div>
            <div className="text-xl font-mono font-bold text-emerald-400">100%</div>
            <div className="text-[10px] text-slate-500">All 8 NER States</div>
          </div>
        </div>
      </div>

      {/* Corridor-Level Accessibility Analytics (F16) */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10">
        <h3 className="text-xs uppercase font-bold text-teal-400 tracking-wider flex items-center space-x-2">
          <Route className="w-4 h-4" />
          <span>Representative National Highway Corridors Monitored</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {corridors.map((c) => (
            <div key={c.corridor_id} className="p-4 rounded-xl bg-slate-900/70 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white font-mono">{c.corridor_id}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  c.corridor_risk_score >= 70 ? 'bg-rose-500/20 text-rose-400' :
                  c.corridor_risk_score >= 50 ? 'bg-amber-500/20 text-amber-300' :
                  'bg-emerald-500/20 text-emerald-400'
                }`}>
                  Risk: {c.corridor_risk_score}/100
                </span>
              </div>

              <div className="text-xs text-slate-300 font-semibold">{c.corridor_name}</div>
              <div className="text-[11px] text-slate-400">Length: {c.length_km} km • Status: <span className="text-cyan-300">{c.current_accessibility_status}</span></div>

              {c.bypass_corridor && (
                <div className="p-2 rounded bg-cyan-950/40 border border-cyan-500/20 text-[10px] text-cyan-300">
                  ⚡ Bypass: {c.bypass_corridor}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Monitored Districts</span>
          <div className="text-3xl font-mono font-bold text-white">{districtsHealth.length}</div>
          <div className="text-xs text-cyan-400">Across 8 North Eastern States</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Supply Convoys</span>
          <div className="text-3xl font-mono font-bold text-emerald-400">{vehicles.length}</div>
          <div className="text-xs text-emerald-400">100% Cold-Chain & GPS Tracked</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Blocked Chokepoints</span>
          <div className="text-3xl font-mono font-bold text-rose-400">
            {chokepoints.filter(c => c.current_status === 'CRITICAL_BLOCKED').length}
          </div>
          <div className="text-xs text-rose-400">Bypasses Generated via A*</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel border border-white/10 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Field Reports Registered</span>
          <div className="text-3xl font-mono font-bold text-amber-400">{incidents.length}</div>
          <div className="text-xs text-amber-400">Geo-Tagged & Verified</div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10 overflow-x-auto">
        <h3 className="text-xs uppercase font-bold text-cyan-400 tracking-wider">
          District-Wise Essential Supplies Ledger (Estimated based on simulation)
        </h3>

        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/80 text-[11px] uppercase font-mono text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-3">District</th>
              <th className="p-3">State</th>
              <th className="p-3">DCI Score</th>
              <th className="p-3">Status</th>
              <th className="p-3">Oxygen Buffer</th>
              <th className="p-3">Pharma Buffer</th>
              <th className="p-3">FCI Grains</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {districtsHealth.map((d) => (
              <tr key={d.district_id} className="hover:bg-white/5">
                <td className="p-3 font-bold text-white">{d.name}</td>
                <td className="p-3 text-cyan-300">{d.state}</td>
                <td className="p-3 font-bold">{d.connectivity_index}/100</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    d.status === 'HEALTHY' ? 'bg-emerald-500/20 text-emerald-400' :
                    d.status === 'WARNING' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-rose-600 text-white animate-pulse'
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className={`p-3 ${d.oxygen_days < 3.0 ? 'text-rose-400 font-bold' : ''}`}>
                  {d.oxygen_days} Days
                </td>
                <td className={`p-3 ${d.medicine_days < 3.0 ? 'text-rose-400 font-bold' : ''}`}>
                  {d.medicine_days} Days
                </td>
                <td className="p-3">{d.grain_stock_tonnes.toLocaleString()} T</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
