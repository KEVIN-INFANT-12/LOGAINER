import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { LogisticsProvider } from './context/LogisticsContext';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { GISMap } from './components/GISMap';
import { RouteOptimizer } from './components/RouteOptimizer';
import { FleetTracker } from './components/FleetTracker';
import { DistrictHealth } from './components/DistrictHealth';
import { IncidentMonitoring } from './components/IncidentMonitoring';
import { MLRiskPredictor } from './components/MLRiskPredictor';
import { DisasterModeCenter } from './components/DisasterModeCenter';
import { LogisticsMonitoring } from './components/LogisticsMonitoring';
import { AlertsNotifications } from './components/AlertsNotifications';
import { GovReports } from './components/GovReports';
import { UserVehicleManagement } from './components/UserVehicleManagement';
import { VoiceBroadcastModal } from './components/VoiceBroadcastModal';
import { AlertToastContainer } from './components/AlertToast';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('gis-map');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#F8F9FA] text-slate-900 overflow-hidden select-none">
      {/* Top GovTech Operations Navbar */}
      <Navbar
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
      />

      {/* Main Content Area: Sidebar + Active Tab Module */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dynamic Module Container */}
        <main className="flex-1 overflow-y-auto bg-[#F8F9FA] p-3 sm:p-5 relative">
          {activeTab === 'gis-map' && <GISMap />}
          {activeTab === 'route-optimizer' && <RouteOptimizer />}
          {activeTab === 'fleet-telemetry' && <FleetTracker />}
          {activeTab === 'district-connectivity' && <DistrictHealth />}
          {activeTab === 'incident-monitoring' && <IncidentMonitoring />}
          {activeTab === 'ai-risk-prediction' && <MLRiskPredictor />}
          {activeTab === 'disaster-mode' && <DisasterModeCenter />}
          {activeTab === 'logistics-monitoring' && <LogisticsMonitoring />}
          {activeTab === 'alerts-notifications' && <AlertsNotifications />}
          {activeTab === 'analytics-reports' && <GovReports />}
          {activeTab === 'user-vehicle-management' && <UserVehicleManagement />}
        </main>
      </div>

      {/* Global Voice Dispatch Modal */}
      <VoiceBroadcastModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Real-time Alert Toast Notifications */}
      <AlertToastContainer />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <LogisticsProvider>
          <AppContent />
        </LogisticsProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
