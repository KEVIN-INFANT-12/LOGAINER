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
  Sparkles,
  AlertTriangle,
  Layers,
  Database,
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
    <header className="h-16 border-b border-white/10 bg-[#0B0F19]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 sticky top-0">
      {/* Brand & Region Title */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-teal-500 to-emerald-400 p-[1px] shadow-glow-cyan">
          <div className="w-full h-full bg-[#0B0F19] rounded-xl flex items-center justify-center">
            <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              {t('app_title')}
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              NER Grid v2.0
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-400 font-medium">
            {t('app_subtitle')}
          </p>
        </div>
      </div>

      {/* Real-time Telemetry Status Bar */}
      <div className="hidden lg:flex items-center space-x-4 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/5 text-xs font-mono">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>{vehicles.length} {t('active_fleets')}</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center space-x-1.5 text-rose-400 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>{blockedCount} {t('chokepoints_blocked')}</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center space-x-1.5 text-amber-300">
          <span>{criticalDistrictsCount} {t('deficit_districts')}</span>
        </div>
      </div>

      {/* Action Controls & User Switcher */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Disaster Mode Trigger */}
        <button
          onClick={handleDisasterClick}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md ${
            isDisasterModeActive
              ? 'bg-rose-600 text-white animate-pulse shadow-glow-rose'
              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
          }`}
          title="Simulate severe monsoon cloudburst triggering automated green corridors"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline">
            {isDisasterModeActive ? t('reset_alert') : t('simulate_red_alert')}
          </span>
        </button>

        {/* Voice Announcement Broadcast Button */}
        <button
          onClick={onOpenVoiceModal}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/20 transition-colors"
          title="Multilingual audio broadcasts for truck drivers"
        >
          <Volume2 className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline">{t('audio_broadcast')}</span>
        </button>

        {/* Minimal Offline / Online & Synchronization Indicator */}
        <div className="flex items-center space-x-1.5">
          {isOnline ? (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => syncOfflineData()}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                title="Connected to Central Command. Click to sync."
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-mono text-[11px]">🟢 Online — {pendingOfflineCount > 0 ? `📤 ${pendingOfflineCount} pending upload` : 'Synced'}</span>
                {isSyncing && <RotateCcw className="w-3 h-3 text-cyan-400 animate-spin ml-1" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => syncOfflineData()}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-colors animate-pulse"
                title="Offline Mode Active. Using cached trip & route data. Reports queued locally in IndexedDB."
              >
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="font-mono text-[11px]">🔴 Offline — Using cached data</span>
                {pendingOfflineCount > 0 && (
                  <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                    📤 {pendingOfflineCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Quick Offline Simulation Toggle for Testing */}
          <button
            onClick={toggleOfflineSimulation}
            className={`px-2 py-1 rounded text-[10px] font-mono border transition-all ${
              isOfflineSimulated
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border-white/5 hover:text-slate-200'
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
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10"
          >
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-semibold uppercase">{language}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isLangOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl glass-panel-glow py-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 max-h-80 overflow-y-auto">
              <div className="px-3 py-1 text-[10px] uppercase font-bold text-cyan-400 border-b border-white/10 sticky top-0 bg-[#0B0F19]/90 backdrop-blur-md">
                Select Interface Language
              </div>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsLangOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-cyan-500/10 transition-colors ${
                    language === lang.code ? 'text-cyan-400 font-bold bg-cyan-500/10' : 'text-slate-300'
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

        {/* User Role Switcher Dropdown with 🔒 Lock Indicator */}
        <div className="relative">
          <button
            onClick={() => setIsRoleOpen(!isRoleOpen)}
            className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10"
            title="Admin & District Authority Access (Argon2 / JWT Secure)"
          >
            <div className="relative w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold text-xs">
              <Lock className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-[11px] font-semibold truncate max-w-[120px] flex items-center space-x-1">
                <span>{user?.full_name}</span>
              </div>
              <div className="text-[9px] text-cyan-400 truncate max-w-[120px]">{user?.role}</div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isRoleOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl glass-panel-glow p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95">
              <div className="pb-2 border-b border-white/10 mb-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center space-x-1">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    <span>{user?.full_name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    AUTHENTICATED
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{user?.department}</div>
                <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Jurisdiction: {user?.state}</div>
              </div>

              <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                <span>Admin Authority Roles:</span>
              </div>
              <div className="space-y-1">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      switchRole(r);
                      setIsRoleOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${
                      user?.role === r ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span>{r}</span>
                    {user?.role === r && <span className="text-cyan-400 text-xs">✓</span>}
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
