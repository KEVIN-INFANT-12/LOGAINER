import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Plane, 
  Radio, 
  Truck, 
  Activity, 
  MapPin, 
  RefreshCw, 
  Download,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';

export const DisasterModeCenter: React.FC = () => {
  const { isDisasterModeActive, toggleDisasterMode, vehicles, chokepoints, districtsHealth, addToast } = useLogistics();
  const { t, speakAlert } = useLanguage();

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
      <div className={`p-6 rounded-3xl border transition-all ${
        isDisasterModeActive
          ? 'bg-rose-950/40 border-rose-500/60 shadow-glow-rose'
          : 'glass-panel border-white/10'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className={`p-3.5 rounded-2xl ${
              isDisasterModeActive ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}>
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Disaster & Emergency Monsoon Red Alert Command Center
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold uppercase ${
                  isDisasterModeActive ? 'bg-rose-600 text-white animate-ping' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isDisasterModeActive ? 'STATUS: ACTIVE RED ALERT' : 'STATUS: STANDBY'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Integrated NDRF 1st Bn, SDMA & BRO Disaster Protocol: Automated medical rerouting, emergency green corridors, and heavy-lift drone dispatches
              </p>
            </div>
          </div>

          <button
            onClick={handleTrigger}
            className={`px-6 py-3 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center space-x-2 transition-all shrink-0 ${
              isDisasterModeActive
                ? 'bg-slate-800 hover:bg-slate-700 text-white border border-white/20'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-glow-rose animate-pulse'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
            <span>{isDisasterModeActive ? 'DEACTIVATE RED ALERT' : 'SIMULATE MONSOON RED ALERT'}</span>
          </button>
        </div>
      </div>

      {/* Emergency Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Automated Rerouting & Green Corridors */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10 lg:col-span-2">
          <h3 className="text-xs uppercase font-bold text-cyan-400 tracking-wider flex items-center space-x-2">
            <Truck className="w-4 h-4" />
            <span>Priority Green Corridor Convoys (Auto-Rerouted)</span>
          </h3>

          <div className="space-y-3">
            {criticalVehicles.map((v) => (
              <div key={v.id} className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-white text-sm">{v.vehicle_no}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                      {v.cargo_desc}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Route: <span className="text-white">{v.origin_name}</span> ➔ <span className="text-white">{v.destination_name}</span>
                  </div>
                  <div className="text-[11px] text-teal-300 font-mono">
                    🛡️ NDRF Escort Assigned | Pilot Speed: {v.speed_kmh} km/h
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    GREEN CORRIDOR ACTIVE
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Drone Emergency Dispatch */}
        <div className="glass-panel p-5 rounded-2xl space-y-4 border border-white/10">
          <h3 className="text-xs uppercase font-bold text-purple-400 tracking-wider flex items-center space-x-2">
            <Plane className="w-4 h-4" />
            <span>Heavy-Lift Drone Dispatch Queue</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between font-bold text-white">
                <span>Mission #DR-081</span>
                <span className="text-purple-400 font-mono">STANDBY</span>
              </div>
              <div className="text-slate-300">
                Payload: <strong>35 kg Critical Anti-Venom & Insulin</strong>
              </div>
              <div className="text-[11px] text-slate-400">
                Target: Mangan PHC, North Sikkim (Road cutoff via NH-10)
              </div>
              <button
                onClick={() => addToast('SUCCESS', 'Drone Dispatched', 'Mission DR-081 heavy-lift UAV launched from Gangtok Base.')}
                className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors"
              >
                Launch UAV Payload
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between font-bold text-white">
                <span>Mission #DR-082</span>
                <span className="text-purple-400 font-mono">STANDBY</span>
              </div>
              <div className="text-slate-300">
                Payload: <strong>50 kg Water Purification Tabs & ORS</strong>
              </div>
              <div className="text-[11px] text-slate-400">
                Target: Sonapur Valley Hamlet, Meghalaya
              </div>
              <button
                onClick={() => addToast('SUCCESS', 'Drone Dispatched', 'Mission DR-082 heavy-lift UAV launched from Shillong Base.')}
                className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition-colors"
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
