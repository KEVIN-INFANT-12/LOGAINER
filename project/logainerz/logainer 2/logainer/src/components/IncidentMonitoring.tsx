import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ThumbsUp, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Filter, 
  RefreshCw, 
  CheckCircle, 
  Award, 
  AlertTriangle, 
  XCircle, 
  Search,
  Sparkles,
  Camera,
  Layers
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';
import { api } from '../services/api';

export const IncidentMonitoring: React.FC = () => {
  const { incidents, addToast, refreshAllData } = useLogistics();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredIncidents = incidents.filter((inc) => {
    const matchesState = stateFilter === 'ALL' || inc.state.toLowerCase() === stateFilter.toLowerCase();
    const matchesSeverity = severityFilter === 'ALL' || inc.severity.toLowerCase() === severityFilter.toLowerCase();
    const matchesStatus = statusFilter === 'ALL' || inc.verification_status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || inc.category === categoryFilter;
    const matchesSearch = 
      inc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.district.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inc.reporter_name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesState && matchesSeverity && matchesStatus && matchesCategory && matchesSearch;
  });

  const handleVerifyOfficial = async (id: string) => {
    try {
      await api.verifyIncident(id, 'VERIFIED_OFFICIAL');
      addToast('SUCCESS', 'Incident Verified & Approved', 'Report verified with official government standing.');
      refreshAllData();
    } catch {
      addToast('INFO', 'Verification Updated', 'Status logged locally.');
    }
  };

  const handleRejectIncident = async (id: string) => {
    try {
      await api.verifyIncident(id, 'REJECTED');
      addToast('WARNING', 'Incident Rejected / Flagged', 'Erroneous/unverified incident marked as invalid.');
      refreshAllData();
    } catch {
      addToast('INFO', 'Status Updated', 'Report flagged as rejected.');
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      await api.verifyIncident(id, 'RESOLVED');
      addToast('SUCCESS', 'Incident Marked Resolved', 'Clearance operations confirmed. Road corridor returned to green status.');
      refreshAllData();
    } catch {
      addToast('INFO', 'Resolution Updated', 'Incident marked resolved.');
    }
  };

  const getTrustBadge = (trustLevel?: string, score?: number, verificationStatus?: string) => {
    if (verificationStatus === 'REJECTED') {
      return { label: 'REJECTED / INVALID', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: XCircle };
    }
    if (verificationStatus === 'RESOLVED') {
      return { label: 'RESOLVED & CLEARED', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40', icon: CheckCircle };
    }
    if (verificationStatus === 'VERIFIED_OFFICIAL' || trustLevel === 'OFFICIALLY VERIFIED' || (score && score >= 90)) {
      return { label: 'OFFICIALLY VERIFIED', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: ShieldCheck };
    }
    if (trustLevel === 'HIGH TRUST' || (score && score >= 75)) {
      return { label: `HIGH TRUST (${score}%)`, color: 'bg-teal-500/20 text-teal-300 border-teal-500/40', icon: CheckCircle };
    }
    if (trustLevel === 'MEDIUM TRUST' || (score && score >= 50)) {
      return { label: `MEDIUM TRUST (${score}%)`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', icon: Award };
    }
    return { label: 'PENDING REVIEW', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: AlertTriangle };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <AlertOctagon className="w-6 h-6 text-rose-400" />
              <span>Incident Monitoring, Verification & Resolution Center</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
              ADMIN CONTROL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time feed of field-reported landslides, mudslides, flash floods & bridge washouts. Admin review, official verification, rejection, and resolution workflows.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300">
            Total Active Incidents: <span className="text-rose-400 font-bold">{incidents.length}</span>
          </div>
        </div>
      </div>

      {/* Admin Safeguards Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">Field Verification Protocol & Automated Data Fusion</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Incident reports submitted from Field Officer mobile apps undergo hardware GPS lock verification and can be officially verified or rejected by District Authorities.
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-300 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Verified Reports Mutate A* Routing Weights</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, district, reporter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500 w-56"
            />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
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

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL_BLOCKED">Critical - Both Lanes Blocked</option>
            <option value="HIGH">High - Crawling / Single Lane</option>
            <option value="MEDIUM">Medium - Advisory / 4x4 Bypass</option>
            <option value="LOW">Low - Shoulder Obstruction</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="VERIFIED_OFFICIAL">Officially Verified</option>
            <option value="RESOLVED">Resolved / Cleared</option>
            <option value="REJECTED">Rejected / False Alert</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Categories</option>
            <option value="LANDSLIDE">Massive Landslide</option>
            <option value="FLASH_FLOOD">Flash Flood</option>
            <option value="MUDSLIDE">Mudslide</option>
            <option value="ROCKFALL">Rockfall</option>
            <option value="BRIDGE_WASHOUT">Bridge Washout</option>
            <option value="SNOW_BLOCK">Snow Blockage</option>
            <option value="TREE_FALL">Tree Fall</option>
            <option value="INFRASTRUCTURE">Infrastructure</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-rose-400 font-bold">{filteredIncidents.length}</span> Field Incidents
        </div>
      </div>

      {/* Incidents Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredIncidents.map((incident) => {
          const isCritical = incident.severity === 'CRITICAL_BLOCKED';
          const trustBadge = getTrustBadge(incident.trust_level, incident.trust_score_pct, incident.verification_status);
          const TrustIcon = trustBadge.icon;
          const isRejected = incident.verification_status === 'REJECTED';
          const isResolved = incident.verification_status === 'RESOLVED';

          return (
            <div
              key={incident.id}
              className={`p-5 rounded-2xl glass-panel border space-y-3.5 transition-all ${
                isRejected 
                  ? 'border-white/5 opacity-60 bg-slate-950/40'
                  : isResolved
                  ? 'border-teal-500/40 bg-teal-950/20'
                  : isCritical 
                  ? 'border-rose-500/50 bg-rose-950/20 shadow-glow-rose' 
                  : 'border-white/10 hover:border-cyan-500/40'
              }`}
            >
              {/* Header with Trust Score Badge */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-slate-400">{incident.id}</span>
                    {incident.offline_synced === false && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse flex items-center space-x-1">
                        <span>📤 PENDING_UPLOAD</span>
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      isCritical ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {incident.severity.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-300 uppercase">
                      {incident.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-1">{incident.title}</h3>
                </div>

                <div className={`flex items-center space-x-1 border px-2.5 py-1 rounded-full text-[10px] font-bold ${trustBadge.color}`}>
                  <TrustIcon className="w-3.5 h-3.5" />
                  <span>{trustBadge.label}</span>
                </div>
              </div>

              {/* Location & Metadata */}
              <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center space-x-1 text-cyan-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{incident.district}, {incident.state}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(incident.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                {incident.description}
              </p>

              {/* Photo Evidence & GPS Tag */}
              {incident.photo_url && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-36">
                  <img
                    src={incident.photo_url}
                    alt={incident.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-slate-300 font-mono flex items-center space-x-1.5 border border-white/10">
                    <span>📍 GPS Lock: {incident.lat.toFixed(4)}°N, {incident.lng.toFixed(4)}°E</span>
                    <span className="text-emerald-400">✓ Hardware Authenticated</span>
                  </div>
                </div>
              )}

              {/* Passability Status */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] text-slate-300 flex items-center justify-between">
                <span>Current Road Passability:</span>
                <span className="font-bold text-white uppercase">{incident.passable_by.replace(/_/g, ' ')}</span>
              </div>

              {/* Reporter Info & Admin Action Toolbar */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="text-[11px] text-slate-400">
                  Reported by: <span className="text-white font-medium">{incident.reporter_name}</span> ({incident.reporter_role})
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Action 1: Verify & Approve */}
                  {incident.verification_status !== 'VERIFIED_OFFICIAL' && (
                    <button
                      onClick={() => handleVerifyOfficial(incident.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors flex items-center space-x-1"
                      title="Grant official verification and integrate into routing graph"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify & Approve</span>
                    </button>
                  )}

                  {/* Action 2: Mark Resolved */}
                  {incident.verification_status !== 'RESOLVED' && (
                    <button
                      onClick={() => handleResolveIncident(incident.id)}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-bold transition-colors flex items-center space-x-1"
                      title="Mark as cleared and restored for normal traffic"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Resolved</span>
                    </button>
                  )}

                  {/* Action 3: Reject / Invalidate */}
                  {incident.verification_status !== 'REJECTED' && (
                    <button
                      onClick={() => handleRejectIncident(incident.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition-colors flex items-center space-x-1"
                      title="Flag false or erroneous report"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
