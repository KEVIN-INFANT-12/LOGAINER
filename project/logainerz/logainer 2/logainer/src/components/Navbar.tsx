import React, { useState } from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Volume2, 
  ShieldAlert, 
  Languages, 
  UserCheck, 
  ChevronDown, 
  RotateCcw,
  AlertTriangle,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { useLanguage, LANGUAGES, LanguageCode } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useLogistics } from '../context/LogisticsContext';
import { Role } from '../types';

interface NavbarProps {
  onOpenVoiceModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenVoiceModal }) => {
  const { language, setLanguage, t, speakAlert } = useLanguage();
  const { user, switchRole } = useAuth();
  const { 
    isOnline, 
    isOfflineSimulated,
    toggleOfflineSimulation,
    pendingOfflineCount, 
    isSyncing,
    syncOfflineData, 
    isDisasterModeActive, 
    toggleDisasterMode,
    chokepoints,
    vehicles,
    districtsHealth
  } = useLogistics();

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);

  const blockedCount = chokepoints.filter(cp => cp.current_status === 'CRITICAL_BLOCKED' || cp.current_status === 'HIGH_RISK').length;
  const criticalDistrictsCount = districtsHealth.filter(d => d.status === 'CRITICAL_DEFICIT').length;

  const handleDisasterClick = () => {
    toggleDisasterMode();
    if (!isDisasterModeActive) {
      speakAlert(t('disaster_active'));
    }
  };

  const ROLES: Role[] = [
    'Admin / Central Command',
    'State Logistics Director',
    'Chief Engineer (BRO)',
    'Emergency Response Officer (NDRF)',
    'District Authority / DLO'
  ];

  return (
    <header className="h-16 border-b border-slate-200/90 bg-white px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0 shadow-sm">
      {/* Brand & Region Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-700 text-white shadow-sm">
          <Radio className="w-5 h-5 text-white" />
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              {t('app_title')}
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-teal-50 text-teal-800 border border-teal-200">
              NER Grid v2.0
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-500 font-medium">
            {t('app_subtitle')}
          </p>
        </div>
      </div>

      {/* Real-time Telemetry Status Bar */}
      <div className="hidden lg:flex items-center space-x-3 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
        <div className="flex items-center space-x-1.5 text-emerald-800 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
          <span>{vehicles.length} {t('active_fleets')}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center space-x-1.5 text-red-700 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>{blockedCount} {t('chokepoints_blocked')}</span>
        </div>
        <span className="text-slate-300">|</span>
        <div className="flex items-center space-x-1.5 text-amber-800 font-medium">
          <span>{criticalDistrictsCount} {t('deficit_districts')}</span>
        </div>
      </div>

      {/* Action Controls & User Switcher */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Disaster Mode Trigger */}
        <button
          onClick={handleDisasterClick}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
            isDisasterModeActive
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
          }`}
          title="Simulate severe monsoon cloudburst triggering automated green corridors"
        >
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span className="hidden sm:inline">
            {isDisasterModeActive ? t('reset_alert') : t('simulate_red_alert')}
          </span>
        </button>

        {/* Voice Announcement Broadcast Button */}
        <button
          onClick={onOpenVoiceModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors shadow-sm"
          title="Multilingual audio broadcasts for truck drivers"
        >
          <Volume2 className="w-4 h-4 text-teal-700" />
          <span className="hidden md:inline">{t('audio_broadcast')}</span>
        </button>

        {/* Minimal Offline / Online & Synchronization Indicator */}
        <div className="flex items-center space-x-1.5">
          {isOnline ? (
            <button
              onClick={() => syncOfflineData()}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              title="Connected to Central Command. Click to sync."
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span className="font-medium text-[11px]">🟢 Online — {pendingOfflineCount > 0 ? `📤 ${pendingOfflineCount} pending upload` : 'Synced'}</span>
              {isSyncing && <RotateCcw className="w-3 h-3 text-teal-700 animate-spin ml-1" />}
            </button>
          ) : (
            <button
              onClick={() => syncOfflineData()}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              title="Offline Mode Active. Using cached trip & route data. Reports queued locally in IndexedDB."
            >
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              <span className="font-medium text-[11px]">🔴 Offline — Using cached data</span>
              {pendingOfflineCount > 0 && (
                <span className="bg-amber-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  📤 {pendingOfflineCount}
                </span>
              )}
            </button>
          )}

          {/* Quick Offline Simulation Toggle for Field Testing */}
          <button
            onClick={toggleOfflineSimulation}
            className={`px-2 py-1 rounded text-[11px] font-medium border transition-all ${
              isOfflineSimulated
                ? 'bg-amber-100 text-amber-900 border-amber-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle simulated hill zero-connectivity mode for field testing"
          >
            {isOfflineSimulated ? 'Sim: OFFLINE' : 'Sim: Net'}
          </button>
        </div>

        {/* Multilingual Selector */}
        <div className="relative">
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm"
          >
            <Languages className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-semibold uppercase">{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isLangOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 py-2 shadow-modal z-50 animate-in fade-in zoom-in-95 max-h-80 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 sticky top-0 bg-white">
                Select Interface Language
              </div>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    language === lang.code ? 'text-teal-800 font-bold bg-teal-50/60' : 'text-slate-700'
                  }`}
                >
                  <span className="flex items-center space-x-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">{lang.nativeName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRoleOpen(!isRoleOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm"
            title="Admin & District Authority Access"
          >
            <div className="relative w-6 h-6 rounded-md bg-teal-50 text-teal-800 flex items-center justify-center font-bold text-xs border border-teal-200">
              <Lock className="w-3 h-3 text-teal-700" />
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-[11px] font-bold text-slate-900 truncate max-w-[120px] flex items-center space-x-1">
                <span>{user?.full_name}</span>
              </div>
              <div className="text-[10px] text-teal-700 truncate max-w-[120px] font-medium">{user?.role}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isRoleOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white border border-slate-200 p-3 shadow-modal z-50 animate-in fade-in zoom-in-95">
              <div className="pb-2.5 border-b border-slate-100 mb-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-700" />
                    <span>{user?.full_name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                    AUTHENTICATED
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">{user?.department}</div>
                <div className="text-[10px] text-teal-700 font-medium mt-0.5">Jurisdiction: {user?.state}</div>
              </div>

              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-teal-700" />
                <span>Switch Authority Persona:</span>
              </div>
              <div className="space-y-1">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setIsRoleOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      user?.role === r ? 'bg-teal-50 text-teal-900 font-bold border border-teal-200' : 'text-slate-700'
                    }`}
                  >
                    <span>{r}</span>
                    {user?.role === r && <span className="text-teal-700 text-xs font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
