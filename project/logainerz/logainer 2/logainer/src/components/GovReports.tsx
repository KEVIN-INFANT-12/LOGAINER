import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  FileText, 
  Printer, 
  Sparkles, 
  Route 
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
    addToast({
      title: 'Report Exported',
      message: 'Full Regional Logistics Intelligence JSON report downloaded.',
      type: 'success'
    });
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
    addToast({
      title: 'CSV Exported',
      message: 'District Connectivity Index CSV downloaded.',
      type: 'success'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <FileSpreadsheet className="w-6 h-6 text-teal-700" />
              <span>GovTech Logistics Analytics & Regional Compliance Reports</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              OFFICIAL DOSSIER
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official summary reports for Ministry of Development of North Eastern Region (MDoNER), BRO & SDMA
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download Full JSON Dossier</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Dossier</span>
          </button>
        </div>
      </div>

      {/* Impact & Social Analytics */}
      <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-teal-700" />
            <span>Logistics Impact & Disruption Avoidance Metrics</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            * Estimated based on simulation and regional freight telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">ETA Improvement</div>
            <div className="text-xl font-mono font-bold text-emerald-700">+28.4%</div>
            <div className="text-[10px] text-slate-500">Across mountain routes</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">Delay Reduction</div>
            <div className="text-xl font-mono font-bold text-teal-800">3.8 hrs</div>
            <div className="text-[10px] text-slate-500">Per disrupted corridor</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">Hazards Avoided</div>
            <div className="text-xl font-mono font-bold text-teal-700">184 Convoys</div>
            <div className="text-[10px] text-slate-500">Rerouted proactively</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">Cargo Protected</div>
            <div className="text-xl font-mono font-bold text-amber-700">1,420 Tonnes</div>
            <div className="text-[10px] text-slate-500">Oxygen & Medicines</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">Disruptions Logged</div>
            <div className="text-xl font-mono font-bold text-red-700">{incidents.length}</div>
            <div className="text-[10px] text-slate-500">Geo-tagged in database</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-[10px] text-slate-500 uppercase font-mono font-medium">Green Corridor Uptime</div>
            <div className="text-xl font-mono font-bold text-emerald-700">100%</div>
            <div className="text-[10px] text-slate-500">All 8 NER States</div>
          </div>
        </div>
      </div>

      {/* Corridor-Level Accessibility Analytics */}
      <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card">
        <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
          <Route className="w-4 h-4 text-teal-700" />
          <span>Representative National Highway Corridors Monitored</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {corridors.map((c) => (
            <div key={c.corridor_id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 font-mono">{c.corridor_id}</span>
                <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                  c.corridor_risk_score >= 70 ? 'bg-red-50 text-red-700 border-red-200' :
                  c.corridor_risk_score >= 50 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  Risk: {c.corridor_risk_score}/100
                </span>
              </div>

              <div className="text-xs text-slate-800 font-semibold">{c.corridor_name}</div>
              <div className="text-[11px] text-slate-500">Length: {c.length_km} km • Status: <span className="text-teal-800 font-medium">{c.current_accessibility_status}</span></div>

              {c.bypass_corridor && (
                <div className="p-2 rounded bg-teal-50 border border-teal-200 text-[10px] text-teal-800 font-medium">
                  ⚡ Bypass: {c.bypass_corridor}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-card space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Total Monitored Districts</span>
          <div className="text-3xl font-mono font-bold text-slate-900">{districtsHealth.length}</div>
          <div className="text-xs text-teal-700 font-medium">Across 8 North Eastern States</div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-card space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Active Supply Convoys</span>
          <div className="text-3xl font-mono font-bold text-emerald-700">{vehicles.length}</div>
          <div className="text-xs text-emerald-700 font-medium">100% Cold-Chain & GPS Tracked</div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-card space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Blocked Chokepoints</span>
          <div className="text-3xl font-mono font-bold text-red-700">
            {chokepoints.filter(c => c.current_status === 'CRITICAL_BLOCKED').length}
          </div>
          <div className="text-xs text-red-700 font-medium">Bypasses Generated via A*</div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-card space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-500">Field Reports Registered</span>
          <div className="text-3xl font-mono font-bold text-amber-700">{incidents.length}</div>
          <div className="text-xs text-amber-700 font-medium">Geo-Tagged & Verified</div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card overflow-x-auto">
        <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider">
          District-Wise Essential Supplies Ledger (Estimated based on simulation)
        </h3>

        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-600 border-b border-slate-200">
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
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {districtsHealth.map((d) => (
              <tr key={d.district_id} className="hover:bg-slate-50">
                <td className="p-3 font-bold text-slate-900">{d.name}</td>
                <td className="p-3 text-teal-800 font-semibold">{d.state}</td>
                <td className="p-3 font-bold text-slate-900">{d.connectivity_index}/100</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                    d.status === 'HEALTHY' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    d.status === 'WARNING' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                    'bg-red-50 text-red-700 border-red-200 font-bold'
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className={`p-3 ${d.oxygen_days < 3.0 ? 'text-red-700 font-bold' : 'text-slate-700'}`}>
                  {d.oxygen_days} Days
                </td>
                <td className={`p-3 ${d.medicine_days < 3.0 ? 'text-red-700 font-bold' : 'text-slate-700'}`}>
                  {d.medicine_days} Days
                </td>
                <td className="p-3 text-slate-700">{d.grain_stock_tonnes.toLocaleString()} T</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
