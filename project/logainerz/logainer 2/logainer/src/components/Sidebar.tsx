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
  Users
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
    { id: 'fleet-telemetry', labelKey: 'fleet_telemetry', icon: Truck, badge: 'LIVE', badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    { id: 'district-connectivity', labelKey: 'district_connectivity', icon: Building2 },
    { id: 'incident-monitoring', labelKey: 'incident_monitoring', icon: AlertOctagon, badge: pendingIncidentsCount > 0 ? `${pendingIncidentsCount} new` : undefined, badgeColor: 'bg-amber-50 text-amber-800 border-amber-200' },
    { id: 'ai-risk-prediction', labelKey: 'ai_risk_prediction', icon: BrainCircuit, badge: 'What-If AI', badgeColor: 'bg-purple-50 text-purple-800 border-purple-200' },
    { id: 'disaster-mode', labelKey: 'disaster_mode', icon: ShieldAlert, badge: isDisasterModeActive ? 'RED ALERT' : undefined, badgeColor: 'bg-red-600 text-white' },
    { id: 'logistics-monitoring', labelKey: 'logistics_monitoring', icon: Package, badge: 'ESSENTIAL', badgeColor: 'bg-teal-50 text-teal-800 border-teal-200' },
    { id: 'alerts-notifications', labelKey: 'alerts_notifications', icon: Bell, badge: 'DISPATCH', badgeColor: 'bg-amber-50 text-amber-800 border-amber-200' },
    { id: 'analytics-reports', labelKey: 'analytics_reports', icon: FileSpreadsheet },
    { id: 'user-vehicle-management', labelKey: 'user_vehicle_mgmt', icon: Users }
  ];

  return (
    <aside className="w-16 sm:w-64 border-r border-slate-200/90 bg-slate-50 flex flex-col justify-between py-4 select-none shrink-0 transition-all duration-200 z-20">
      <div className="space-y-1 px-2 sm:px-3">
        <div className="hidden sm:block px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all group ${
                isActive
                  ? 'bg-teal-50 text-teal-900 font-bold border-l-4 border-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 transition-transform group-hover:scale-105 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">{t(item.labelKey)}</span>
              </div>

              {item.badge && (
                <span className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md font-semibold border ${item.badgeColor || 'bg-slate-200 text-slate-700'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Region Quick Summary */}
      <div className="hidden sm:block px-3 pt-3 border-t border-slate-200">
        <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">NER Chokepoints:</span>
            <span className="font-bold text-red-700">{blockedCount} Blocked</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Prediction Model:</span>
            <span className="font-bold text-purple-700">ConvLSTM v1.0</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div className="bg-teal-600 h-full w-[78%] rounded-full"></div>
          </div>
          <div className="text-[10px] text-slate-500 text-center font-medium">
            Logistics Grid Health: 78%
          </div>
        </div>
      </div>
    </aside>
  );
};
