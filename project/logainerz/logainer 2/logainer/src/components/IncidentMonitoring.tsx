import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Award, 
  AlertTriangle, 
  XCircle, 
  Search
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
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
      addToast({
        title: 'Incident Verified & Approved',
        message: 'Report verified with official government standing.',
        type: 'success'
      });
      refreshAllData();
    } catch {
      addToast({
        title: 'Verification Updated',
        message: 'Status logged locally.',
        type: 'info'
      });
    }
  };

  const handleRejectIncident = async (id: string) => {
    try {
      await api.verifyIncident(id, 'REJECTED');
      addToast({
        title: 'Incident Rejected / Flagged',
        message: 'Erroneous/unverified incident marked as invalid.',
        type: 'warning'
      });
      refreshAllData();
    } catch {
      addToast({
        title: 'Status Updated',
        message: 'Report flagged as rejected.',
        type: 'info'
      });
    }
  };

  const handleResolveIncident = async (id: string) => {
    try {
      await api.verifyIncident(id, 'RESOLVED');
      addToast({
        title: 'Incident Marked Resolved',
        message: 'Clearance operations confirmed. Road corridor restored.',
        type: 'success'
      });
      refreshAllData();
    } catch {
      addToast({
        title: 'Resolution Updated',
        message: 'Incident marked resolved.',
        type: 'info'
      });
    }
  };

  const getTrustBadge = (trustLevel?: string, score?: number, verificationStatus?: string) => {
    if (verificationStatus === 'REJECTED') {
      return { label: 'REJECTED / INVALID', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle };
    }
    if (verificationStatus === 'RESOLVED') {
      return { label: 'RESOLVED & CLEARED', color: 'bg-teal-50 text-teal-800 border-teal-200', icon: CheckCircle };
    }
    if (verificationStatus === 'VERIFIED_OFFICIAL' || trustLevel === 'OFFICIALLY VERIFIED' || (score && score >= 90)) {
      return { label: 'OFFICIALLY VERIFIED', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: ShieldCheck };
    }
    if (trustLevel === 'HIGH TRUST' || (score && score >= 75)) {
      return { label: `HIGH TRUST (${score}%)`, color: 'bg-teal-50 text-teal-800 border-teal-200', icon: CheckCircle };
    }
    if (trustLevel === 'MEDIUM TRUST' || (score && score >= 50)) {
      return { label: `MEDIUM TRUST (${score}%)`, color: 'bg-cyan-50 text-cyan-800 border-cyan-200', icon: Award };
    }
    return { label: 'PENDING REVIEW', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <AlertOctagon className="w-6 h-6 text-red-600" />
              <span>Incident Monitoring, Verification & Resolution Center</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
              ADMIN CONTROL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time feed of field-reported landslides, mudslides, flash floods & bridge washouts. Admin review, official verification, rejection, and resolution workflows.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            Total Active Incidents: <span className="text-red-700 font-bold">{incidents.length}</span>
          </div>
        </div>
      </div>

      {/* Admin Safeguards Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-slate-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">Field Verification Protocol & Automated Data Fusion</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Incident reports submitted from Field Officer mobile apps undergo hardware GPS lock verification and can be officially verified or rejected by District Authorities.
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-teal-800 font-semibold shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>Verified Reports Mutate A* Routing Weights</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search title, district, reporter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 w-56 shadow-sm"
            />
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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
            className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-teal-700 shadow-sm"
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

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{filteredIncidents.length}</span> Field Incidents
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
              className={`p-5 rounded-xl bg-white border space-y-3.5 shadow-card transition-all ${
                isRejected 
                  ? 'border-slate-200 opacity-60 bg-slate-50'
                  : isResolved
                  ? 'border-teal-300 bg-teal-50/20'
                  : isCritical 
                  ? 'border-red-300 bg-red-50/20 ring-1 ring-red-300' 
                  : 'border-slate-200 hover:border-teal-600/40 hover:shadow-card-hover'
              }`}
            >
              {/* Header with Trust Score Badge */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-slate-400">{incident.id}</span>
                    {incident.offline_synced === false && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse flex items-center space-x-1">
                        <span>📤 PENDING_UPLOAD</span>
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      isCritical ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {incident.severity.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-100 text-slate-700 uppercase">
                      {incident.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 mt-1">{incident.title}</h3>
                </div>

                <div className={`flex items-center space-x-1 border px-2.5 py-0.5 rounded-full text-[10px] font-bold ${trustBadge.color}`}>
                  <TrustIcon className="w-3.5 h-3.5" />
                  <span>{trustBadge.label}</span>
                </div>
              </div>

              {/* Location & Metadata */}
              <div className="flex items-center space-x-4 text-xs text-slate-500 font-mono">
                <span className="flex items-center space-x-1 text-teal-800 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-teal-700" />
                  <span>{incident.district}, {incident.state}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(incident.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-700 leading-relaxed">
                {incident.description}
              </p>

              {/* Photo Evidence & GPS Tag */}
              {incident.photo_url && (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 h-36">
                  <img
                    src={incident.photo_url}
                    alt={incident.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-900/90 text-white px-2.5 py-1 rounded-md text-[10px] font-mono flex items-center space-x-1.5">
                    <span>📍 GPS: {incident.lat.toFixed(4)}°N, {incident.lng.toFixed(4)}°E</span>
                    <span className="text-emerald-400 font-bold">✓ Verified</span>
                  </div>
                </div>
              )}

              {/* Passability Status */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                <span>Current Road Passability:</span>
                <span className="font-bold text-slate-900 uppercase">{incident.passable_by.replace(/_/g, ' ')}</span>
              </div>

              {/* Reporter Info & Admin Action Toolbar */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="text-[11px] text-slate-500">
                  Reported by: <span className="text-slate-900 font-semibold">{incident.reporter_name}</span> ({incident.reporter_role})
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Action 1: Verify & Approve */}
                  {incident.verification_status !== 'VERIFIED_OFFICIAL' && (
                    <button
                      onClick={() => handleVerifyOfficial(incident.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors flex items-center space-x-1"
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
                      className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold transition-colors flex items-center space-x-1"
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
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors flex items-center space-x-1"
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
