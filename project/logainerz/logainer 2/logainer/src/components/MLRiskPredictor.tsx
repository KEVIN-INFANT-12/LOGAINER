import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Activity, 
  Sliders, 
  ShieldCheck, 
  Clock, 
  Layers, 
  AlertTriangle,
  Compass,
  CloudRain,
  Mountain,
  FileCheck,
  History,
  Grid,
  CheckCircle2,
  Send
} from 'lucide-react';
import { api } from '../services/api';
import { useLogistics } from '../context/LogisticsContext';
import { MLPrediction } from '../types';

export const MLRiskPredictor: React.FC = () => {
  const { addToast } = useLogistics();

  // Spatiotemporal ConvLSTM Features
  const [rainfall1d, setRainfall1d] = useState<number>(28.0);
  const [rainfall3d, setRainfall3d] = useState<number>(65.0);
  const [rainfall7d, setRainfall7d] = useState<number>(140.0);
  const [anomalyScore, setAnomalyScore] = useState<number>(0.48);
  const [floodPressure, setFloodPressure] = useState<number>(0.35);
  const [landslidePressure, setLandslidePressure] = useState<number>(0.55);
  const [envRiskScore, setEnvRiskScore] = useState<number>(0.52);
  const [currentSpeed, setCurrentSpeed] = useState<number>(34.0);
  const [congestionIdx, setCongestionIdx] = useState<number>(0.45);
  const [roadStatus, setRoadStatus] = useState<string>('OPEN');
  const [lat, setLat] = useState<number>(26.1445);
  const [lng, setLng] = useState<number>(91.7362);

  const [prediction, setPrediction] = useState<MLPrediction | null>(null);
  const [modelStats, setModelStats] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isPredicting, setIsPredicting] = useState<boolean>(false);
  const [showMetricsModal, setShowMetricsModal] = useState<boolean>(false);

  // Feedback loop state
  const [feedbackOutcome, setFeedbackOutcome] = useState<string>('DISRUPTION_OCCURRED');
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState<boolean>(false);
  const [isCachedResult, setIsCachedResult] = useState<boolean>(false);
  const [isStaleResult, setIsStaleResult] = useState<boolean>(false);
  const [cachedAtTime, setCachedAtTime] = useState<string | null>(null);

  const runPrediction = async () => {
    setIsPredicting(true);
    try {
      const res = await api.predictRisk({
        rainfall_1d_mm: rainfall1d,
        rainfall_3d_mm: rainfall3d,
        rainfall_7d_mm: rainfall7d,
        rainfall_anomaly_score: anomalyScore,
        flood_event_pressure: floodPressure,
        landslide_event_pressure: landslidePressure,
        environmental_risk_score: envRiskScore,
        current_speed_kmh: currentSpeed,
        congestion_index: congestionIdx,
        road_status: roadStatus,
        latitude: lat,
        longitude: lng
      });
      
      if (res && res.prediction) {
        setPrediction(res.prediction);
        setIsCachedResult(!!res.is_cached);
        setIsStaleResult(!!res.is_stale);
        setCachedAtTime(res.cached_at || null);
        if (res.history) {
          setHistoryLogs(res.history);
        } else {
          loadHistory();
        }
      }
    } catch (e: any) {
      console.error("ConvLSTM model error:", e);
      addToast('ERROR', 'Prediction Failed', 'Unable to reach ConvLSTM spatiotemporal backend.');
    } finally {
      setIsPredicting(false);
    }
  };

  const loadModelStats = async () => {
    try {
      const stats = await api.getModelStats();
      if (stats) {
        setModelStats(stats);
      }
    } catch (e) {
      console.error("Model stats load error:", e);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.getPredictionHistory();
      if (res && res.history) {
        setHistoryLogs(res.history);
      }
    } catch (e) {
      console.error("Prediction history load error:", e);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!historyLogs.length) return;
    setIsSubmittingFeedback(true);
    try {
      const latestPredId = historyLogs[0].prediction_id;
      await api.submitFeedback({
        prediction_id: latestPredId,
        actual_outcome: feedbackOutcome,
        notes: feedbackNotes || 'Admin field outcome comparison'
      });
      addToast('SUCCESS', 'Feedback Recorded', 'Predicted disruption vs actual outcome recorded for model evaluation.');
      setFeedbackNotes('');
    } catch (e) {
      addToast('ERROR', 'Feedback Submission Failed', 'Unable to record feedback.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    loadModelStats();
    loadHistory();
    runPrediction();
  }, []);

  // Debounced auto-prediction
  useEffect(() => {
    const handler = setTimeout(() => {
      runPrediction();
    }, 300);
    return () => clearTimeout(handler);
  }, [rainfall1d, rainfall3d, anomalyScore, floodPressure, landslidePressure, envRiskScore, currentSpeed, congestionIdx, roadStatus, lat, lng]);

  const getRiskColor = (risk: string) => {
    const r = (risk || '').toUpperCase();
    if (r.includes('HIGH') || r.includes('CRITICAL')) return 'text-rose-400 bg-rose-500/20 border-rose-500/30';
    if (r.includes('MEDIUM') || r.includes('MODERATE')) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
    return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <BrainCircuit className="w-6 h-6 text-purple-400" />
              <span>ConvLSTM Spatiotemporal Disruption Risk Intelligence</span>
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
              16-CHANNEL CONVLSTM2D
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Pre-trained ConvLSTM neural network loaded from <code className="text-cyan-300 font-mono font-bold">nerai/outputs/model/convlstm_model.keras</code> predicting spatiotemporal disruption risk over 16×16 spatial grids.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowMetricsModal(!showMetricsModal)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 flex items-center space-x-2 transition-all"
          >
            <FileCheck className="w-4 h-4 text-cyan-400" />
            <span>ConvLSTM Evaluation Metrics</span>
          </button>
        </div>
      </div>

      {/* Model Metadata Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center space-x-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Architecture</div>
            <div className="text-xs font-bold text-white font-mono">ConvLSTM2D (32→16 Filters)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center space-x-3">
          <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Sequence History</div>
            <div className="text-xs font-bold text-cyan-300 font-mono">6 Populated Hour-Bins</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center space-x-3">
          <Grid className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Spatial Grid</div>
            <div className="text-xs font-bold text-purple-300 font-mono">16×16 Cells (NER Extent)</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex items-center space-x-3">
          <Activity className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">ROC-AUC Score</div>
            <div className="text-xs font-bold text-amber-300 font-mono">
              {modelStats?.metrics?.roc_auc ? modelStats.metrics.roc_auc.toFixed(3) : '0.741'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Feature Sliders + ConvLSTM Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Channels (Left Column) */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Spatiotemporal Feature Channels (ConvLSTM Input)</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              16 CHANNELS
            </span>
          </div>

          <div className="space-y-3.5">
            {/* Rainfall 1d */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                  <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                  <span>24h Rainfall Accumulation (mm)</span>
                </span>
                <span className="font-mono text-cyan-300 font-bold">{rainfall1d} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="150"
                value={rainfall1d}
                onChange={(e) => setRainfall1d(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Landslide Event Pressure */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" />
                  <span>Landslide Event Pressure Index</span>
                </span>
                <span className="font-mono text-amber-300 font-bold">{landslidePressure}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={landslidePressure}
                onChange={(e) => setLandslidePressure(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Flood Event Pressure */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300 flex items-center space-x-1.5 font-medium">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Flood Event Pressure Index</span>
                </span>
                <span className="font-mono text-cyan-300 font-bold">{floodPressure}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={floodPressure}
                onChange={(e) => setFloodPressure(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Convoy Speed & Congestion */}
            <div className="grid grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Current Speed (km/h)</span>
                  <span className="font-mono text-emerald-300 font-bold">{currentSpeed} km/h</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={currentSpeed}
                  onChange={(e) => setCurrentSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">Congestion Index</span>
                  <span className="font-mono text-purple-300 font-bold">{congestionIdx}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={congestionIdx}
                  onChange={(e) => setCongestionIdx(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                />
              </div>
            </div>

            {/* Location and Road Status */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Road Status</label>
                <select
                  value={roadStatus}
                  onChange={(e) => setRoadStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="OPEN">OPEN (Unrestricted)</option>
                  <option value="PARTIAL_BLOCK">PARTIAL_BLOCK</option>
                  <option value="CLOSED">CLOSED / BLOCKED</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.01"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.01"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Results (Right Column) */}
        <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>ConvLSTM Inference Output</span>
              </h3>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                {isCachedResult ? 'OFFLINE CACHE' : 'REAL-TIME PROBABILITY'}
              </span>
            </div>

            {/* Offline / Cached Prediction Alert */}
            {isCachedResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                isStaleResult ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
              }`}>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{isStaleResult ? '[STALE CACHED PREDICTION]' : '[CACHED OFFLINE DATA]'}</strong>: Captured {cachedAtTime ? new Date(cachedAtTime).toLocaleTimeString() : 'earlier session'}.
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900/60">
                  {isStaleResult ? 'TTL Expired' : 'Active TTL'}
                </span>
              </div>
            )}

            {/* Risk Gauge Card */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-bold uppercase">Disruption Risk Level</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${getRiskColor(prediction?.risk_level || 'LOW')}`}>
                  {prediction?.risk_level || 'LOW'}
                </span>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-2xl font-bold text-white font-mono">
                    {prediction ? (prediction.risk_probability || prediction.disruption_probability || 0).toFixed(4) : '0.2400'}
                  </span>
                  <span className="text-xs text-slate-400">Risk Probability (0.0 - 1.0)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (prediction?.risk_probability || 0) > 0.66
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : (prediction?.risk_probability || 0) > 0.33
                        ? 'bg-gradient-to-r from-cyan-500 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, (prediction?.risk_probability || 0.24) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
                <div>
                  <span className="text-slate-400">Predicted Disruption:</span>
                  <div className="font-bold text-white">ROAD_DISRUPTION</div>
                </div>
                <div>
                  <span className="text-slate-400">Estimated Delay:</span>
                  <div className="font-bold text-cyan-300 font-mono">+{prediction?.estimated_delay_mins || 15} mins</div>
                </div>
              </div>
            </div>

            {/* Recommended Action Advisory */}
            <div className="p-3.5 rounded-xl bg-slate-800/50 border border-white/10 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-cyan-300">Decision Engine Advisory:</span>
              <p>{prediction?.recommended_action || 'Corridor stable for all freight movements.'}</p>
            </div>
          </div>

          {/* Feedback Loop Comparison Widget */}
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-purple-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Prediction vs Actual Outcome Feedback Loop</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={feedbackOutcome}
                onChange={(e) => setFeedbackOutcome(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
              >
                <option value="DISRUPTION_OCCURRED">Disruption Occurred (True Pos)</option>
                <option value="NO_DISRUPTION">No Disruption (Normal Traffic)</option>
                <option value="PARTIAL_DELAY">Minor Congestion / Slowdown</option>
              </select>

              <button
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center justify-center space-x-1 transition-all disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmittingFeedback ? 'Logging...' : 'Log Field Outcome'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prediction History Table */}
      <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span>ConvLSTM Spatiotemporal Prediction Audit Logs</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            {historyLogs.length} LOGGED PREDICTIONS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[11px] uppercase font-bold">
                <th className="py-2 px-3">Prediction ID</th>
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Corridor / Grid</th>
                <th className="py-2 px-3">Risk Probability</th>
                <th className="py-2 px-3">Risk Level</th>
                <th className="py-2 px-3">Model</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
              {historyLogs.slice(0, 8).map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-bold text-cyan-300">{log.prediction_id}</td>
                  <td className="py-2.5 px-3 text-slate-400">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Just now'}</td>
                  <td className="py-2.5 px-3 text-slate-300">{log.grid_cell || 'R8:C6 (Guwahati)'}</td>
                  <td className="py-2.5 px-3 text-white font-bold">{log.risk_score || log.disruption_probability}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskColor(log.risk_level)}`}>
                      {log.risk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-purple-300">ConvLSTM v1.0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metrics Modal */}
      {showMetricsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <span>ConvLSTM Spatiotemporal Model Verification Metrics</span>
              </h3>
              <button onClick={() => setShowMetricsModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-800 rounded-xl border border-white/5">
                <span className="text-slate-400">Accuracy</span>
                <div className="text-base font-bold text-white font-mono">67.6%</div>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl border border-white/5">
                <span className="text-slate-400">ROC-AUC</span>
                <div className="text-base font-bold text-cyan-300 font-mono">0.741</div>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl border border-white/5">
                <span className="text-slate-400">Recall</span>
                <div className="text-base font-bold text-emerald-300 font-mono">65.3%</div>
              </div>
              <div className="p-3 bg-slate-800 rounded-xl border border-white/5">
                <span className="text-slate-400">Brier Score</span>
                <div className="text-base font-bold text-amber-300 font-mono">0.232</div>
              </div>
            </div>

            <div className="p-3 bg-slate-800 rounded-xl border border-white/5 text-xs text-slate-300 space-y-1 font-mono">
              <div className="text-cyan-400 font-bold">Model Architecture:</div>
              <div>Input Shape: (Batch, 6 Sequence Frames, 16 Height, 16 Width, 16 Channels)</div>
              <div>Layer 1: ConvLSTM2D(32 Filters, 3x3 Kernel, Return Sequences=True)</div>
              <div>Layer 2: BatchNormalization()</div>
              <div>Layer 3: ConvLSTM2D(16 Filters, 3x3 Kernel, Return Sequences=False)</div>
              <div>Layer 4: Conv2D(16 Filters, 3x3, ReLU) + GlobalAveragePooling2D()</div>
              <div>Layer 5: Dense(32, ReLU) + Dense(1, Sigmoid Risk Probability)</div>
            </div>

            <button
              onClick={() => setShowMetricsModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Close Metrics View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
