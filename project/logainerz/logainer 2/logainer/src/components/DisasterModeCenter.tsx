import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Plane, 
  Truck
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';

export const DisasterModeCenter: React.FC = () => {
  const { isDisasterModeActive, toggleDisasterMode, vehicles, addToast } = useLogistics();
  const { speakAlert } = useLanguage();

  const handleTrigger = () => {
    toggleDisasterMode();
    if (!isDisasterModeActive) {
      speakAlert("Monsoon Disaster Red Alert Active. Automated Green Corridors Dispatched.");
    }
  };

  const criticalVehicles = vehicles.filter(v => v.cargo_type.includes('MEDICINE') || v.cargo_type.includes('OXYGEN'));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Red Alert Banner */}
      <div className={`p-6 rounded-xl border shadow-card transition-all ${
        isDisasterModeActive
          ? 'bg-red-50 border-red-300 ring-1 ring-red-300'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-lg ${
              isDisasterModeActive ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
            }`}>
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Disaster & Emergency Monsoon Red Alert Command Center
                </h2>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold uppercase ${
                  isDisasterModeActive ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-100 text-slate-700'
                }`}>
                  {isDisasterModeActive ? 'ACTIVE RED ALERT' : 'STANDBY'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Integrated NDRF 1st Bn, SDMA & BRO Disaster Protocol: Automated medical rerouting, emergency green corridors, and heavy-lift drone dispatches
              </p>
            </div>
          </div>

          <button
            onClick={handleTrigger}
            className={`px-5 py-2.5 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all shrink-0 ${
              isDisasterModeActive
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-red-700 hover:bg-red-800 text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>{isDisasterModeActive ? 'DEACTIVATE RED ALERT' : 'SIMULATE MONSOON RED ALERT'}</span>
          </button>
        </div>
      </div>

      {/* Emergency Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Automated Rerouting & Green Corridors */}
        <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card lg:col-span-2">
          <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
            <Truck className="w-4 h-4 text-teal-700" />
            <span>Priority Green Corridor Convoys (Auto-Rerouted)</span>
          </h3>

          <div className="space-y-3">
            {criticalVehicles.map((v) => (
              <div key={v.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">{v.vehicle_no}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                      {v.cargo_desc}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Route: <span className="text-slate-900 font-semibold">{v.origin_name}</span> ➔ <span className="text-slate-900 font-semibold">{v.destination_name}</span>
                  </div>
                  <div className="text-[11px] text-teal-800 font-medium font-mono">
                    🛡️ NDRF Escort Assigned | Pilot Speed: {v.speed_kmh} km/h
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    GREEN CORRIDOR ACTIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Drone Emergency Dispatch */}
        <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card">
          <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
            <Plane className="w-4 h-4 text-teal-700" />
            <span>Heavy-Lift Drone Dispatch Queue</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>Mission #DR-081</span>
                <span className="text-teal-700 font-mono text-[11px]">STANDBY</span>
              </div>
              <div className="text-slate-700">
                Payload: <strong>35 kg Critical Anti-Venom & Insulin</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Target: Mangan PHC, North Sikkim (Road cutoff via NH-10)
              </div>
              <button
                onClick={() => addToast({
                  title: 'Drone Dispatched',
                  message: 'Mission DR-081 heavy-lift UAV launched from Gangtok Base.',
                  type: 'success'
                })}
                className="w-full py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shadow-sm"
              >
                Launch UAV Payload
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span>Mission #DR-082</span>
                <span className="text-teal-700 font-mono text-[11px]">STANDBY</span>
              </div>
              <div className="text-slate-700">
                Payload: <strong>50 kg Water Purification Tabs & ORS</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Target: Sonapur Valley Hamlet, Meghalaya
              </div>
              <button
                onClick={() => addToast({
                  title: 'Drone Dispatched',
                  message: 'Mission DR-082 heavy-lift UAV launched from Shillong Base.',
                  type: 'success'
                })}
                className="w-full py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors shadow-sm"
              >
                Launch UAV Payload
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
