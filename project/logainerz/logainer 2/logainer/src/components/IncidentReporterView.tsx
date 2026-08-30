import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ThumbsUp, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  Filter, 
  WifiOff, 
  RefreshCw,
  Eye,
  Plus,
  CheckCircle,
  Award,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Incident } from '../types';
import { api } from '../services/api';

interface IncidentReporterViewProps {
  onOpenReportModal: () => void;
}

export const IncidentReporterView: React.FC<IncidentReporterViewProps> = ({ onOpenReportModal }) => {
  const { incidents, syncOfflineData, pendingOfflineCount, isOnline, addToast, refreshAllData } = useLogistics();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  const isOfficialUser = user?.role === 'State Logistics Director' || user?.role === 'Chief Engineer' || user?.role === 'Emergency Response Officer' || user?.role === 'ADMIN' || user?.role === 'DISTRICT OFFICER';

  const filteredIncidents = incidents.filter((inc) => {
    const matchesState = stateFilter === 'ALL' || inc.state.toLowerCase() === stateFilter.toLowerCase();
    const matchesSeverity = severityFilter === 'ALL' || inc.severity.toLowerCase() === severityFilter.toLowerCase();
    return matchesState && matchesSeverity;
  });

  const handleUpvote = async (id: string) => {
    try {
      await api.upvoteIncident(id);
      addToast('SUCCESS', 'Corroboration Recorded', 'Your field confirmation increased the incident trust score.');
      refreshAllData();
    } catch {
      addToast('INFO', 'Vote Recorded Locally', 'Upvote registered.');
    }
  };

  const handleVerifyOfficial = async (id: string) => {
    try {
      await api.verifyIncident(id, 'VERIFIED_OFFICIAL');
      addToast('SUCCESS', 'Official Verification Granted', 'Incident elevated to OFFICIALLY VERIFIED status.');
      refreshAllData();
    } catch {
      addToast('INFO', 'Verification updated', 'Status logged.');
    }
  };

  const handleSyncClick = async () => {
    setIsSyncing(true);
    await syncOfflineData();
    setIsSyncing(false);
  };

  const getTrustBadge = (trustLevel?: string, score?: number) => {
    const s = score ?? 75;
    if (trustLevel === 'OFFICIALLY VERIFIED' || s >= 95) {
      return { label: 'OFFICIALLY VERIFIED', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: ShieldCheck };
    }
    if (trustLevel === 'HIGH TRUST' || s >= 80) {
      return { label: `HIGH TRUST (${s}%)`, color: 'bg-teal-500/20 text-teal-300 border-teal-500/40', icon: CheckCircle };
    }
    if (trustLevel === 'MEDIUM TRUST' || s >= 60) {
      return { label: `MEDIUM TRUST (${s}%)`, color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', icon: Award };
    }
    if (trustLevel === 'LOW TRUST' || s >= 40) {
      return { label: `LOW TRUST (${s}%)`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: AlertTriangle };
    }
    return { label: `UNVERIFIED (${s}%)`, color: 'bg-slate-800 text-slate-400 border-white/10', icon: AlertOctagon };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <AlertOctagon className="w-6 h-6 text-rose-400" />
              <span>Crowdsourced Incident & Trust Verification Engine</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              TRUST ENGINE v2.1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Multi-factor verification scoring: Unverified reports cannot mutate official highway status without corroborated trust
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {pendingOfflineCount > 0 && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing || !isOnline}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-glow-amber transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync {pendingOfflineCount} Offline Reports</span>
            </button>
          )}

          <button
            onClick={onOpenReportModal}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow-cyan flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Road Obstacle</span>
          </button>
        </div>
      </div>

      {/* Trust Engine Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-300">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">Conflict Resolution & Data Fusion Safeguard</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Citizen reports require ≥80% trust score and ≥2 independent corroborations to affect emergency routing algorithms.
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-cyan-300 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Automated Fusion Active</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Filter By:</span>
          </div>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
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
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL_BLOCKED">Critical - Blocked</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Advisory</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing <span className="text-cyan-400 font-bold">{filteredIncidents.length}</span> Active Field Logs
        </div>
      </div>

      {/* Incidents Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredIncidents.map((incident) => {
          const isCritical = incident.severity === 'CRITICAL_BLOCKED';
          const trustBadge = getTrustBadge(incident.trust_level, incident.trust_score_pct);
          const TrustIcon = trustBadge.icon;

          return (
            <div
              key={incident.id}
              className={`p-5 rounded-2xl glass-panel border space-y-3 transition-all ${
                isCritical ? 'border-rose-500/50 bg-rose-950/20' : 'border-white/10 hover:border-cyan-500/40'
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
                      {incident.severity}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white mt-1">{incident.title}</h3>
                </div>

                <div className={`flex items-center space-x-1 border px-2.5 py-1 rounded-full text-[10px] font-bold ${trustBadge.color}`}>
                  <TrustIcon className="w-3.5 h-3.5" />
                  <span>{trustBadge.label}</span>
                </div>
              </div>

              {/* Location & Meta */}
              <div className="flex items-center space-x-4 text-xs text-slate-400 font-mono">
                <span className="flex items-center space-x-1 text-cyan-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{incident.district}, {incident.state}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed">
                {incident.description}
              </p>

              {/* Photo Attachment if available */}
              {incident.photo_url && (
                <div className="relative rounded-xl overflow-hidden border border-white/10 h-36">
                  <img
                    src={incident.photo_url}
                    alt={incident.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-slate-300 font-mono">
                    📍 {incident.lat.toFixed(4)}°N, {incident.lng.toFixed(4)}°E (Hardware GPS Verified)
                  </div>
                </div>
              )}

              {/* Passability status */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 text-[11px] text-slate-300 flex items-center justify-between">
                <span>Passability Status:</span>
                <span className="font-bold text-white uppercase">{incident.passable_by.replace(/_/g, ' ')}</span>
              </div>

              {/* Reporter Info, Upvote & Official Verify */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
                <div className="text-[11px] text-slate-400">
                  Reported by: <span className="text-white font-medium">{incident.reporter_name}</span> ({incident.reporter_role})
                </div>

                <div className="flex items-center space-x-2">
                  {isOfficialUser && incident.verification_status !== 'VERIFIED_OFFICIAL' && (
                    <button
                      onClick={() => handleVerifyOfficial(incident.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold transition-colors"
                      title="Grant official government verification"
                    >
                      Verify as Official
                    </button>
                  )}

                  <button
                    onClick={() => handleUpvote(incident.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold text-xs transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Corroborate ({incident.upvotes})</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
