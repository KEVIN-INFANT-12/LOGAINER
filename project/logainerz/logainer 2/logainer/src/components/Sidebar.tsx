import React from 'react';
import { 
  Map, 
  Navigation, 
  Truck, 
  Building2, 
  AlertOctagon, 
  BrainCircuit, 
  ShieldAlert, 
  FileSpreadsheet,
  Package,
  Bell,
  Users,
  Activity,
  Layers,
  Bot
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useLogistics } from '../context/LogisticsContext';

export type TabType = 
  | 'gis-map'
  | 'route-optimizer'
  | 'fleet-telemetry'
  | 'district-connectivity'
  | 'incident-monitoring'
  | 'ai-risk-prediction'
  | 'disaster-mode'
  | 'logistics-monitoring'
  | 'alerts-notifications'
  | 'analytics-reports'
  | 'user-vehicle-management';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { t } = useLanguage();
  const { isDisasterModeActive, chokepoints, incidents } = useLogistics();

  const blockedCount = chokepoints.filter(cp => cp.current_status === 'CRITICAL_BLOCKED').length;
  const pendingIncidentsCount = incidents.filter(i => i.verification_status === 'PENDING_VERIFICATION').length;

  const NAV_ITEMS: { id: TabType; labelKey: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number; badgeColor?: string }[] = [
    { id: 'gis-map', labelKey: 'gis_map', icon: Map },
    { id: 'route-optimizer', labelKey: 'route_optimizer', icon: Navigation },
    { id: 'fleet-telemetry', labelKey: 'fleet_telemetry', icon: Truck, badge: 'LIVE', badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { id: 'district-connectivity', labelKey: 'district_connectivity', icon: Building2 },
    { id: 'incident-monitoring', labelKey: 'incident_monitoring', icon: AlertOctagon, badge: pendingIncidentsCount > 0 ? `${pendingIncidentsCount} new` : undefined, badgeColor: 'bg-amber-500/20 text-amber-300' },
    { id: 'ai-risk-prediction', labelKey: 'ai_risk_prediction', icon: BrainCircuit, badge: '94% AI', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    { id: 'disaster-mode', labelKey: 'disaster_mode', icon: ShieldAlert, badge: isDisasterModeActive ? 'RED ALERT' : undefined, badgeColor: 'bg-rose-500 text-white animate-pulse' },
    { id: 'logistics-monitoring', labelKey: 'logistics_monitoring', icon: Package, badge: 'ESSENTIAL', badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    { id: 'alerts-notifications', labelKey: 'alerts_notifications', icon: Bell, badge: 'DISPATCH', badgeColor: 'bg-amber-500/20 text-amber-300' },
    { id: 'analytics-reports', labelKey: 'analytics_reports', icon: FileSpreadsheet },
    { id: 'user-vehicle-management', labelKey: 'user_vehicle_mgmt', icon: Users }
  ];

  return (
    <aside className="w-16 sm:w-64 border-r border-white/10 bg-[#0B0F19]/95 flex flex-col justify-between py-4 select-none shrink-0 transition-all duration-200 z-20">
      <div className="space-y-1 px-2 sm:px-3">
        <div className="hidden sm:block px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {t('command_modules')}
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const targetId = item.id === ('district_health' as any) ? 'district-health' : item.id;
          const isActive = activeTab === targetId;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(targetId)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/10 text-cyan-400 border border-cyan-500/30 shadow-glow-cyan'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline font-medium">{t(item.labelKey)}</span>
              </div>

              {item.badge && (
                <span className={`hidden sm:inline text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold border ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Region Quick Summary */}
      <div className="hidden sm:block px-3 pt-3 border-t border-white/10">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">NER Chokepoints:</span>
            <span className="font-mono font-bold text-rose-400">{blockedCount} Blocked</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Terrain Model:</span>
            <span className="font-mono font-bold text-purple-400">ConvLSTM v1.0</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 h-full w-[72%]"></div>
          </div>
          <div className="text-[9px] text-slate-500 text-center font-mono">
            Logistics Grid Health: 72%
          </div>
        </div>
      </div>
    </aside>
  );
};
