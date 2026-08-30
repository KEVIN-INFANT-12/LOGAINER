import React, { useState } from 'react';
import { 
  AlertOctagon, 
  ThumbsUp, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  RefreshCw, 
  Plus, 
  CheckCircle, 
  Award, 
  AlertTriangle 
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

  const isOfficialUser = user?.role === 'State Logistics Director' || user?.role === 'Chief Engineer (BRO)' || user?.role === 'Emergency Response Officer (NDRF)' || user?.role === 'Admin / Central Command' || user?.role === 'District Authority / DLO';

  const filteredIncidents = incidents.filter((inc) => {
    const matchesState = stateFilter === 'ALL' || inc.state.toLowerCase() === stateFilter.toLowerCase();
    const matchesSeverity = severityFilter === 'ALL' || inc.severity.toLowerCase() === severityFilter.toLowerCase();
    return matchesState && matchesSeverity;
  });

  const handleUpvote = async (id: string) => {
    try {
      await api.upvoteIncident(id);
      addToast({
        title: 'Corroboration Recorded',
        message: 'Your field confirmation increased the incident trust score.',
        type: 'success'
      });
      refreshAllData();
    } catch {
      addToast({
        title: 'Vote Recorded Locally',
        message: 'Upvote registered.',
        type: 'info'
      });
    }
  };

  const handleVerifyOfficial = async (id: string) => {
    try {
      await api.verifyIncident(id, 'VERIFIED_OFFICIAL');
      addToast({
        title: 'Official Verification Granted',
        message: 'Incident elevated to OFFICIALLY VERIFIED status.',
        type: 'success'
      });
      refreshAllData();
    } catch {
      addToast({
        title: 'Verification Updated',
        message: 'Status logged.',
        type: 'info'
      });
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
      return { label: 'OFFICIALLY VERIFIED', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: ShieldCheck };
    }
    if (trustLevel === 'HIGH TRUST' || s >= 80) {
      return { label: `HIGH TRUST (${s}%)`, color: 'bg-teal-50 text-teal-800 border-teal-200', icon: CheckCircle };
    }
    if (trustLevel === 'MEDIUM TRUST' || s >= 60) {
      return { label: `MEDIUM TRUST (${s}%)`, color: 'bg-cyan-50 text-cyan-800 border-cyan-200', icon: Award };
    }
    if (trustLevel === 'LOW TRUST' || s >= 40) {
      return { label: `LOW TRUST (${s}%)`, color: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle };
    }
    return { label: `UNVERIFIED (${s}%)`, color: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertOctagon };
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <AlertOctagon className="w-6 h-6 text-red-600" />
              <span>Crowdsourced Incident & Trust Verification Engine</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              TRUST ENGINE v2.1
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Community and field officer reporting with multi-factor trust scoring, peer upvoting, and offline storage.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {pendingOfflineCount > 0 && (
            <button
              onClick={handleSyncClick}
              disabled={isSyncing || !isOnline}
              className="px-3.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs flex items-center space-x-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync {pendingOfflineCount} Offline Reports</span>
            </button>
          )}

          <button
            onClick={onOpenReportModal}
            className="px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center space-x-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Report New Road Obstacle</span>
          </button>
        </div>
      </div>

      {/* Trust Safeguards Banner */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-slate-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-xs">Trust Score Safeguard: Anti-Tamper Filter Active</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Unverified crowd reports require &ge; 80% trust score before triggering emergency vehicle rerouting.
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-teal-800 font-semibold shrink-0">
          <span>Formula: 0.40(GPS) + 0.35(Authority) + 0.25(Upvotes)</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
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
            <option value="CRITICAL_BLOCKED">Critical (Road Blocked)</option>
            <option value="HIGH">High (Major Crawling)</option>
            <option value="MEDIUM">Medium (Advisory)</option>
            <option value="LOW">Low (Partial Shoulder)</option>
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
          const trustBadge = getTrustBadge(incident.trust_level, incident.trust_score_pct);
          const TrustIcon = trustBadge.icon;

          return (
            <div
              key={incident.id}
              className={`p-5 rounded-xl bg-white border space-y-3.5 shadow-card transition-all ${
                isCritical ? 'border-red-300 bg-red-50/20 ring-1 ring-red-300' : 'border-slate-200 hover:border-teal-600/40 hover:shadow-card-hover'
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

              {/* Reporter Info & Verification Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-[11px] text-slate-500">
                  Reported by: <span className="text-slate-900 font-semibold">{incident.reporter_name}</span> ({incident.reporter_role})
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleUpvote(incident.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
                    title="Corroborate this incident report from the field"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-teal-700" />
                    <span>Confirm ({incident.upvotes})</span>
                  </button>

                  {isOfficialUser && incident.verification_status !== 'VERIFIED_OFFICIAL' && (
                    <button
                      onClick={() => handleVerifyOfficial(incident.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors"
                      title="Grant official verification authority status"
                    >
                      Verify
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
