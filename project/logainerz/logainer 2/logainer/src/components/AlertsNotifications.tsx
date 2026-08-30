import React, { useState } from 'react';
import { 
  Bell, 
  ShieldAlert, 
  Radio, 
  Volume2, 
  Filter, 
  Sparkles, 
  MapPin, 
  Send 
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';
import { useLanguage } from '../context/LanguageContext';

export const AlertsNotifications: React.FC = () => {
  const { weatherStations, vehicles, addToast, isDisasterModeActive } = useLogistics();
  const { language, speakAlert } = useLanguage();

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [targetCorridor, setTargetCorridor] = useState('ALL');
  const [priorityLevel, setPriorityLevel] = useState<'CRITICAL' | 'WARNING' | 'ADVISORY'>('CRITICAL');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Simulated Alert Feed from System Sensors & Emergency Channels
  const [broadcastHistory, setBroadcastHistory] = useState([
    {
      id: 'ALT-901',
      type: 'CRITICAL',
      title: 'Sonapur Tunnel Massive Mudflow - Total Blockage',
      message: 'NH-6 Sonapur Tunnel impassable for heavy commercial vehicles. Diverting all cold-chain convoys via Haflong.',
      corridor: 'Guwahati - Silchar (NH-6)',
      timestamp: '12 mins ago',
      source: 'BRO Project Pushpak Sensor Node',
      status: 'BROADCASTED'
    },
    {
      id: 'ALT-902',
      type: 'WEATHER',
      title: 'Cloudburst & Flash Flood Warning in East Khasi Hills',
      message: 'Severe precipitation >55mm/hr detected. High risk of slope instability across Shillong-Dawki highway.',
      corridor: 'Meghalaya Southern Highway',
      timestamp: '34 mins ago',
      source: 'IMD Regional Doppler Radar',
      status: 'BROADCASTED'
    },
    {
      id: 'ALT-903',
      type: 'SUPPLY_DELAY',
      title: 'Cryogenic Medical Oxygen Convoy Approaching Chokepoint',
      message: 'Convoy AS-01-GC-9942 approaching Pagla Pahar single-lane restriction. Pilot escort prioritized.',
      corridor: 'Dimapur - Kohima (NH-29)',
      timestamp: '1 hr ago',
      source: 'Fleet Telemetry Gateway',
      status: 'ACKNOWLEDGED'
    },
    {
      id: 'ALT-904',
      type: 'WARNING',
      title: 'Sela Pass Black Ice & Sub-Zero Blizzard Advisory',
      message: 'Tire chains mandatory above 3200m altitude. Visibility under 20 meters.',
      corridor: 'Balipara - Tawang (NH-13)',
      timestamp: '2 hrs ago',
      source: 'Arunachal Highway Patrol',
      status: 'BROADCASTED'
    }
  ]);

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;

    const newAlert = {
      id: `ALT-${Date.now().toString(36).toUpperCase()}`,
      type: priorityLevel,
      title: broadcastTitle,
      message: broadcastMessage,
      corridor: targetCorridor === 'ALL' ? 'All NER Corridors' : targetCorridor,
      timestamp: 'Just now',
      source: 'Admin Central Command Broadcast',
      status: 'BROADCASTED'
    };

    setBroadcastHistory([newAlert, ...broadcastHistory]);
    addToast({
      title: 'Alert Broadcasted',
      message: 'Dispatched to all connected fleet telemetry units & authorities.',
      type: priorityLevel === 'CRITICAL' ? 'error' : 'success'
    });
    
    // Trigger speech synthesis
    speakAlert(`${broadcastTitle}. ${broadcastMessage}`);

    setBroadcastTitle('');
    setBroadcastMessage('');
  };

  const filteredAlerts = broadcastHistory.filter(a => {
    if (filterType === 'ALL') return true;
    return a.type === filterType;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center space-x-2">
              <Bell className="w-6 h-6 text-teal-700" />
              <span>Emergency Alerts & Multi-Channel Broadcast Center</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              ALERT MATRIX v2.0
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time hazard notifications, severe weather triggers, road blockages, delay escalations & multilingual driver dispatch
          </p>
        </div>

        {isDisasterModeActive && (
          <div className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-mono font-bold flex items-center space-x-2 shadow-sm animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>RED ALERT BROADCAST ACTIVE</span>
          </div>
        )}
      </div>

      {/* Broadcast Composer & Quick Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Broadcast Dispatch Composer */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs uppercase font-bold text-teal-800 tracking-wider flex items-center space-x-2">
              <Radio className="w-4 h-4 text-teal-700" />
              <span>Dispatch Live Corridor Broadcast</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Channels: WebSockets, Push, Radio/TTS</span>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alert Headline</label>
              <input
                type="text"
                required
                placeholder="e.g. Critical Bridge Closure at NH-29 - Alternate via Haflong Active"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Corridor / Jurisdiction</label>
                <select
                  value={targetCorridor}
                  onChange={(e) => setTargetCorridor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
                >
                  <option value="ALL">All 8 NER States & Highways</option>
                  <option value="NH-6 (Guwahati - Silchar)">NH-6 (Guwahati - Shillong - Silchar)</option>
                  <option value="NH-13 (Balipara - Tawang)">NH-13 (Trans-Arunachal Highway)</option>
                  <option value="NH-29 (Dimapur - Kohima)">NH-29 (Dimapur - Kohima - Imphal)</option>
                  <option value="NH-10 (Siliguri - Gangtok)">NH-10 (Siliguri - Teesta - Gangtok)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Urgency Priority Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CRITICAL', 'WARNING', 'ADVISORY'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriorityLevel(lvl)}
                      className={`py-2 rounded-lg text-center text-xs font-bold border transition-all ${
                        priorityLevel === lvl
                          ? lvl === 'CRITICAL'
                            ? 'bg-red-700 text-white border-red-700'
                            : lvl === 'WARNING'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Detailed Instructions / Diversion Notes</label>
              <textarea
                rows={3}
                required
                placeholder="Specify precise bypass coordinates, expected clearance time, and emergency vehicle escort arrangements..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                <span>Auto-synthesizes in {language.toUpperCase()} voice profile</span>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm flex items-center space-x-2 transition-all"
              >
                <Send className="w-4 h-4" />
                <span>Transmit Broadcast Alert</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Channel Status & Presets */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-card space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>Multi-Channel Gateway Status</span>
            </h3>

            <div className="space-y-3 mt-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Fleet Telemetry WS</div>
                  <div className="text-[10px] text-slate-500">{vehicles.length} Active Nodes Connected</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ONLINE
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">BRO / NDRF Alert Link</div>
                  <div className="text-[10px] text-slate-500">Direct Secure Dispatch</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  ACTIVE
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">Doppler Weather Feed</div>
                  <div className="text-[10px] text-slate-500">{weatherStations.length} Regional Stations</div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  SYNCED
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-800">Broadcast Guidelines:</div>
            <p>Alerts tagged with CRITICAL automatically interrupt driver route consoles and push audio notifications in regional vernacular.</p>
          </div>
        </div>
      </div>

      {/* Alert Feed Section */}
      <div className="bg-white p-5 rounded-xl space-y-4 border border-slate-200 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider flex items-center space-x-2">
              <Filter className="w-4 h-4 text-teal-700" />
              <span>Active Alert & Notification Log</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">({filteredAlerts.length} Logs)</span>
          </div>

          <div className="flex items-center space-x-2">
            {(['ALL', 'CRITICAL', 'WEATHER', 'SUPPLY_DELAY', 'WARNING'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  filterType === type
                    ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {type.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const isCrit = alert.type === 'CRITICAL';
            const isWeath = alert.type === 'WEATHER';

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  isCrit
                    ? 'bg-red-50/40 border-red-200'
                    : isWeath
                    ? 'bg-sky-50/40 border-sky-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs text-slate-400">{alert.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                      isCrit ? 'bg-red-600 text-white' :
                      isWeath ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                      'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {alert.type}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">• {alert.timestamp}</span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900">{alert.title}</h4>
                  <p className="text-xs text-slate-700 leading-relaxed">{alert.message}</p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500 pt-1">
                    <span className="flex items-center space-x-1 text-teal-800 font-semibold">
                      <MapPin className="w-3 h-3" />
                      <span>{alert.corridor}</span>
                    </span>
                    <span>Source: {alert.source}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:self-center shrink-0">
                  <button
                    onClick={() => {
                      speakAlert(`${alert.title}. ${alert.message}`);
                      addToast({
                        title: 'Voice Replayed',
                        message: 'Replaying broadcast audio.',
                        type: 'info'
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-teal-800 border border-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
                    title="Play multilingual text-to-speech announcement"
                  >
                    <Volume2 className="w-4 h-4 text-teal-700" />
                    <span>Play TTS</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
