import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Activity, 
  Sliders, 
  ShieldAlert, 
  Clock, 
  CloudRain, 
  Mountain, 
  History, 
  CheckCircle2, 
  AlertTriangle,
  Search,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  MapPin,
  Truck,
  Layers,
  FileCheck,
  RefreshCw,
  Navigation,
  ShieldCheck,
  Info,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useLogistics } from '../context/LogisticsContext';
import { 
  WhatIfScenarioType, 
  WhatIfSimulationResult, 
  WhatIfComparisonItem,
  WhatIfAuditLogItem,
  DistrictHealth
} from '../types';

export const MLRiskPredictor: React.FC = () => {
  const { addToast } = useLogistics();

  // --- Scenario Inputs ---
  const [scenarioType, setScenarioType] = useState<WhatIfScenarioType>('continuous_rainfall');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [rainfallMultiplier, setRainfallMultiplier] = useState<number>(1.3); // +30% default
  const [customMultiplier, setCustomMultiplier] = useState<number>(1.3);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('East Khasi Hills');

  // Searchable District Selector state
  const [districtSearchQuery, setDistrictSearchQuery] = useState<string>('East Khasi Hills');
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState<boolean>(false);
  const [allDistricts, setAllDistricts] = useState<DistrictHealth[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const districtDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Scenario specific parameters
  const [targetRoadSegment, setTargetRoadSegment] = useState<string>('ROAD-NH06-SONAPUR');
  const [congestionMultiplier, setCongestionMultiplier] = useState<number>(1.25);

  // Simulation execution & data state
  const [simulationResult, setSimulationResult] = useState<WhatIfSimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'connectivity' | 'trips' | 'routes' | 'comparison' | 'audit'>('overview');

  // Comparison & Audit Log state
  const [comparisonData, setComparisonData] = useState<WhatIfComparisonItem[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<WhatIfAuditLogItem[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [showModelModal, setShowModelModal] = useState<boolean>(false);

  // Load districts on mount
  useEffect(() => {
    const loadDistricts = async () => {
      try {
        const districts = await api.getDistrictsHealth();
        if (districts && districts.length > 0) {
          setAllDistricts(districts);
        }
      } catch (err) {
        console.error('Failed to load districts list:', err);
      }
    };
    loadDistricts();
    loadAuditLogs();
    loadSavedScenarios();
  }, []);

  // Filtered districts for searchable typeahead
  const filteredDistricts = allDistricts.filter(d => 
    d.name.toLowerCase().includes(districtSearchQuery.toLowerCase()) ||
    d.state.toLowerCase().includes(districtSearchQuery.toLowerCase())
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(event.target as Node)) {
        setIsDistrictDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation in district dropdown
  const handleDistrictKeyDown = (e: React.KeyboardEvent) => {
    if (!isDistrictDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsDistrictDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, filteredDistricts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDistricts[highlightedIndex]) {
        selectDistrict(filteredDistricts[highlightedIndex].name);
      }
    } else if (e.key === 'Escape') {
      setIsDistrictDropdownOpen(false);
    }
  };

  const selectDistrict = (districtName: string) => {
    setSelectedDistrict(districtName);
    setDistrictSearchQuery(districtName);
    setIsDistrictDropdownOpen(false);
  };

  const loadAuditLogs = async () => {
    try {
      const logs = await api.getWhatIfAuditLogs();
      setAuditLogs(logs);
    } catch {}
  };

  const loadSavedScenarios = async () => {
    try {
      const scen = await api.getWhatIfSavedScenarios();
      setSavedScenarios(scen);
    } catch {}
  };

  // Run What-If Simulation
  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setErrorMessage(null);
    try {
      const multiplier = rainfallMultiplier === -1 ? customMultiplier : rainfallMultiplier;
      const res = await api.simulateWhatIfScenario({
        scenario_type: scenarioType,
        duration_days: durationDays,
        rainfall_multiplier: multiplier,
        district: selectedDistrict,
        region: 'NER',
        parameters: {
          target_road_segment_id: targetRoadSegment,
          congestion_multiplier: congestionMultiplier,
          base_rain_mm: 28.0
        }
      });

      setSimulationResult(res);
      addToast({
        title: 'Simulation Complete',
        message: `ConvLSTM evaluated ${res.affected_roads.length} road segments across ${res.prediction_horizon}.`,
        type: 'success'
      });
      loadAuditLogs();
    } catch (err: any) {
      console.error('What-If simulation error:', err);
      const msg = err.message || 'Scenario simulation failed — please retry.';
      setErrorMessage(msg);
      addToast({
        title: 'Simulation Failed',
        message: msg,
        type: 'error'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Run Comparison Matrix across multipliers
  const handleRunComparison = async () => {
    setIsLoadingComparison(true);
    try {
      const comp = await api.compareWhatIfScenarios({
        district: selectedDistrict,
        duration_days: durationDays,
        multipliers: [1.0, 1.1, 1.2, 1.3]
      });
      setComparisonData(comp);
      setActiveResultTab('comparison');
    } catch (err: any) {
      console.error('Comparison error:', err);
      addToast({
        title: 'Comparison Error',
        message: 'Could not load comparative scenario matrix.',
        type: 'error'
      });
    } finally {
      setIsLoadingComparison(false);
    }
  };

  // Auto-run baseline simulation on initial mount if empty
  useEffect(() => {
    if (!simulationResult && !isSimulating) {
      handleRunSimulation();
    }
  }, []);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="gov-card p-5 bg-white border border-slate-200 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-200">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-slate-900">What-If Scenario Simulator</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200 uppercase tracking-wider">
                  ConvLSTM Intelligence Layer
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Spatiotemporal multi-hazard projection engine over 16-channel neural architecture (NERAI)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowModelModal(true)}
            className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <Info className="w-3.5 h-3.5 text-purple-700" />
            <span>Model Provenance</span>
          </button>

          <button
            onClick={handleRunComparison}
            disabled={isLoadingComparison}
            className="px-3.5 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-xs font-semibold flex items-center space-x-1.5 transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5 text-teal-700" />
            <span>{isLoadingComparison ? 'Computing Matrix...' : 'Compare Parameter Sets'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Control Panel (Left) + Results Visualizer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: Scenario Configuration Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Scenario Configuration</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">STEP 1 of 2</span>
            </div>

            {/* 1. Scenario Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Scenario Type:</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'continuous_rainfall', label: 'Continuous Heavy Rainfall', desc: 'Sustained monsoon rain across regional mountain corridors' },
                  { id: 'extreme_rainfall', label: 'Extreme Cloudburst / Flash Flood', desc: 'Sudden high-intensity localized precipitation spike' },
                  { id: 'road_blockage', label: 'Strategic Road Corridor Blockage', desc: 'Single or multi-lane mountain landslide blockage' },
                  { id: 'bridge_failure', label: 'Bridge Failure / River Washout', desc: 'Critical river crossing or structural bridge closure' },
                  { id: 'traffic_surge', label: 'Evacuation / Heavy Traffic Surge', desc: 'Severe vehicular congestion & evacuation volume' },
                  { id: 'combined', label: 'Combined Multi-Hazard Crisis', desc: 'Rainfall + traffic surge + active road blockage' }
                ].map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => setScenarioType(scen.id as WhatIfScenarioType)}
                    className={`text-left p-2.5 rounded-lg text-xs transition-all border ${
                      scenarioType === scen.id
                        ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{scen.label}</span>
                      {scenarioType === scen.id && <span className="w-2 h-2 rounded-full bg-purple-700"></span>}
                    </div>
                    <p className="text-[11px] text-slate-500 font-normal mt-0.5">{scen.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Searchable District Selector (Section 14.2) */}
            <div ref={districtDropdownRef} className="relative">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>District / Epicenter (Searchable):</span>
                <span className="text-[10px] text-purple-700 font-semibold">{filteredDistricts.length} available</span>
              </label>

              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={districtSearchQuery}
                  onChange={(e) => {
                    setDistrictSearchQuery(e.target.value);
                    setIsDistrictDropdownOpen(true);
                    setHighlightedIndex(0);
                  }}
                  onFocus={() => setIsDistrictDropdownOpen(true)}
                  onKeyDown={handleDistrictKeyDown}
                  placeholder="Type district name (e.g. East Khasi Hills, Tawang)..."
                  className="w-full pl-8 pr-8 py-2 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none focus:border-purple-600 shadow-xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                <button
                  type="button"
                  onClick={() => setIsDistrictDropdownOpen(!isDistrictDropdownOpen)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDistrictDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Typeahead Autocomplete Menu */}
              {isDistrictDropdownOpen && (
                <div className="absolute z-30 w-full mt-1 max-h-52 overflow-y-auto rounded-lg bg-white border border-slate-200 shadow-modal py-1 text-xs">
                  {filteredDistricts.length > 0 ? (
                    filteredDistricts.map((d, index) => (
                      <div
                        key={d.district_id || d.name}
                        onClick={() => selectDistrict(d.name)}
                        className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors ${
                          index === highlightedIndex ? 'bg-purple-50 text-purple-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3 h-3 text-purple-700 shrink-0" />
                          <span>{d.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal">{d.state}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400 text-xs">
                      No matching districts found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Duration Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Simulation Duration:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 5, 7].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDurationDays(days)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      durationDays === days
                        ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {days} {days === 1 ? 'Day' : 'Days'}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Rainfall Multiplier Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Precipitation Intensity Multiplier:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 1.0, label: 'Current Intensity (1.0x)' },
                  { value: 1.1, label: '+10% Intensity (1.1x)' },
                  { value: 1.2, label: '+20% Intensity (1.2x)' },
                  { value: 1.3, label: '+30% Intensity (1.3x)' }
                ].map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setRainfallMultiplier(item.value)}
                    className={`p-2 rounded-lg text-xs font-semibold text-left transition-all border ${
                      rainfallMultiplier === item.value
                        ? 'bg-purple-50 text-purple-900 border-purple-300 font-bold shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Additional parameters for specific scenarios */}
            {(scenarioType === 'road_blockage' || scenarioType === 'combined') && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Chokepoint Segment:</label>
                <select
                  value={targetRoadSegment}
                  onChange={(e) => setTargetRoadSegment(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium focus:bg-white focus:outline-none"
                >
                  <option value="ROAD-NH06-SONAPUR">NH-6 Sonapur Tunnel Landslide Sector</option>
                  <option value="ROAD-NH29-PAGLAPAHAR">NH-29 Pagla Pahar Rockfall Zone</option>
                  <option value="ROAD-NH13-SELA">NH-13 Sela Pass Alpine Hairpins</option>
                  <option value="ROAD-NH10-TEESTA">NH-10 Sevoke - Teesta Gorge (29th Mile)</option>
                  <option value="ROAD-NH02-MAO-SENAPATI">NH-2 Mao - Senapati Pass Sinking Zone</option>
                </select>
              </div>
            )}

            {/* Run Button */}
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="w-full py-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Executing ConvLSTM Forward Pass...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run What-If Simulation</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT: Simulation Results & Disruption Intelligence (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* SIMULATION DISCLAIMER BANNER (Section 22) */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>SIMULATION — NOT A LIVE PREDICTION</span>
            </div>
            <span className="text-[11px] text-amber-800 font-mono">
              Hypothetical {durationDays}-Day Stress Test ({simulationResult?.predicted_risk_level || 'EVALUATED'})
            </span>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Simulation Notice</p>
                <p className="text-[11px] text-red-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {simulationResult && (
            <>
              {/* Summary KPI Cards (Section 14.1) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-card">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">High-Risk Roads</div>
                  <div className="text-lg font-extrabold text-red-700 mt-1 flex items-center space-x-1">
                    <span>🔴</span>
                    <span>{simulationResult.kpi_summary.high_risk_roads_count}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Threshold &gt; 0.66</div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-card">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Medium-Risk Roads</div>
                  <div className="text-lg font-extrabold text-amber-700 mt-1 flex items-center space-x-1">
                    <span>🟠</span>
                    <span>{simulationResult.kpi_summary.medium_risk_roads_count}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">0.33 to 0.66</div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-card">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Affected Areas</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1 flex items-center space-x-1">
                    <span>🏘️</span>
                    <span>{simulationResult.kpi_summary.potentially_isolated_areas_count}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">PostGIS graph eval</div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-card">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Impacted Trips</div>
                  <div className="text-lg font-extrabold text-teal-800 mt-1 flex items-center space-x-1">
                    <span>🚚</span>
                    <span>{simulationResult.kpi_summary.impacted_active_trips_count}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Active convoy fleet</div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-card col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Estimated Delay</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-1 flex items-center space-x-1">
                    <span>⏱️</span>
                    <span>+{simulationResult.kpi_summary.estimated_average_delay_hours}h</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Corridor clearance</div>
                </div>
              </div>

              {/* Tab Navigation for Detailed Simulation Outputs */}
              <div className="flex items-center space-x-1 border-b border-slate-200 overflow-x-auto select-none pt-1">
                {[
                  { id: 'overview', label: 'Road Risk Predictions', count: simulationResult.affected_roads.length },
                  { id: 'connectivity', label: 'Area Connectivity', count: simulationResult.affected_areas.length },
                  { id: 'trips', label: 'Impacted Active Trips', count: simulationResult.logistics_impact.impacted_trips.length },
                  { id: 'routes', label: 'Candidate Routes', count: simulationResult.candidate_routes.length },
                  { id: 'comparison', label: 'Comparison Matrix' },
                  { id: 'audit', label: 'Audit Trail', count: auditLogs.length }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveResultTab(tab.id as any)}
                    className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                      activeResultTab === tab.id
                        ? 'border-purple-700 text-purple-900 bg-purple-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== undefined && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* TAB 1: Road Risk Predictions */}
              {activeResultTab === 'overview' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Predicted Road Corridor Risk (ConvLSTM Output)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Evaluated across {simulationResult.affected_roads.length} major lifeline highways in North Eastern Region
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="gov-table w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                          <th className="py-2.5 px-3">Road Segment / Highway</th>
                          <th className="py-2.5 px-3">District & State</th>
                          <th className="py-2.5 px-3">Current → Scenario</th>
                          <th className="py-2.5 px-3">Risk Delta (Δ)</th>
                          <th className="py-2.5 px-3">Disruption Type</th>
                          <th className="py-2.5 px-3">Est. Delay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {simulationResult.affected_roads.map((road) => (
                          <tr key={road.segment_id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{road.name}</div>
                              <div className="text-[11px] text-slate-500">{road.highway} • {road.terrain}</div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <div>{road.district}</div>
                              <div className="text-[10px] text-slate-400">{road.state}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  road.current_level === 'HIGH' ? 'bg-red-50 text-red-700' : (road.current_level === 'MEDIUM' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800')
                                }`}>
                                  {road.current_risk}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  road.scenario_level === 'HIGH' ? 'bg-red-600 text-white shadow-xs' : (road.scenario_level === 'MEDIUM' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900')
                                }`}>
                                  {road.scenario_risk} ({road.scenario_level})
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              <span className={road.risk_delta > 0.2 ? 'text-red-700' : (road.risk_delta > 0.05 ? 'text-amber-700' : 'text-slate-600')}>
                                +{road.risk_delta}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800">
                                {road.predicted_disruption}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              +{road.estimated_delay_hours} hrs
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Village / Area Connectivity Impact */}
              {activeResultTab === 'connectivity' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Village & District Connectivity Impact (PostGIS Network Analysis)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Evaluated road isolation, alternate connectivity corridors, and detour overheads
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {simulationResult.affected_areas.map((area, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{area.area_name}</div>
                            <div className="text-[11px] text-slate-500">{area.district}, {area.state}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            area.is_isolated ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {area.future_accessibility}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-200">
                          <div><strong>Primary Road:</strong> {area.primary_connecting_road}</div>
                          <div className="text-purple-900 font-semibold">
                            <strong>Alternative Route:</strong> {area.alternative_connection}
                          </div>
                          <div className="flex items-center space-x-3 text-[10px] text-slate-500 pt-0.5">
                            <span>Detour: <strong>+{area.detour_additional_km} km</strong></span>
                            <span>Time Penalty: <strong>+{area.detour_additional_hours} hrs</strong></span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: Active Fleet Trips Impact */}
              {activeResultTab === 'trips' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Active Fleet Trips Re-Evaluation Under Scenario
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cross-referenced against active logistics convoys and cold-chain medical consignments
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {simulationResult.logistics_impact.impacted_trips.map((trip) => (
                      <div key={trip.trip_id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${trip.is_critical_cargo ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-teal-50 text-teal-700 border border-teal-200'}`}>
                            <Truck className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-xs">{trip.trip_code}</span>
                              <span className="text-xs text-slate-600">({trip.vehicle_no})</span>
                              {trip.is_critical_cargo && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                  COLD CHAIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {trip.origin_name} → {trip.destination_name} • Driver: {trip.driver_name}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                            trip.status === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : (trip.status === 'REROUTING_RECOMMENDED' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200')
                          }`}>
                            {trip.status_badge}
                          </span>
                          <div className="text-[11px] text-slate-600 font-medium max-w-xs text-right">
                            {trip.action_recommended}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Candidate Routes & Multi-Factor Scoring */}
              {activeResultTab === 'routes' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Candidate Route Evaluation & Recommendations
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Multi-factor scoring formula: (40% Risk + 30% ETA + 15% Distance + 15% Accessibility)
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {simulationResult.candidate_routes.map((route, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition-all ${
                          route.is_recommended
                            ? 'bg-purple-50/50 border-purple-300 shadow-sm'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <span className="font-bold text-xs text-slate-900">{route.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200">
                            {route.recommendation_badge}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 my-3 text-xs">
                          <div>
                            <div className="text-[10px] text-slate-500">Distance</div>
                            <div className="font-bold text-slate-900">{route.distance_km} km</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500">Scenario ETA</div>
                            <div className="font-bold text-slate-900">{route.scenario_eta_display || route.eta_display}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500">Scenario Risk</div>
                            <div className="font-bold text-purple-900">{route.scenario_risk || route.risk_score}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500">Safety Score</div>
                            <div className="font-bold text-emerald-700">{route.safety_score || 85.0} / 100</div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          <strong>Road Status:</strong> {route.road_bridge_status || route.route_status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: Comparison Matrix */}
              {activeResultTab === 'comparison' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Comparative Parameter Matrix: {selectedDistrict} ({durationDays} Days)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Side-by-side progression across +10%, +20%, and +30% precipitation intensity
                      </p>
                    </div>

                    <button
                      onClick={handleRunComparison}
                      disabled={isLoadingComparison}
                      className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold hover:bg-purple-100 flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingComparison ? 'animate-spin' : ''}`} />
                      <span>Recalculate Matrix</span>
                    </button>
                  </div>

                  {comparisonData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="gov-table w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                            <th className="py-2.5 px-3">Precipitation Multiplier</th>
                            <th className="py-2.5 px-3">Regional Risk</th>
                            <th className="py-2.5 px-3">Risk Level</th>
                            <th className="py-2.5 px-3">High-Risk Roads</th>
                            <th className="py-2.5 px-3">Isolated Areas</th>
                            <th className="py-2.5 px-3">Impacted Trips</th>
                            <th className="py-2.5 px-3">Est. Avg Delay</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {comparisonData.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-purple-900">{item.label}</td>
                              <td className="py-2.5 px-3 font-mono font-bold">{item.overall_risk_score}</td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.risk_level === 'HIGH' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                                }`}>
                                  {item.risk_level}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-red-700">{item.high_risk_roads_count}</td>
                              <td className="py-2.5 px-3 font-semibold">{item.isolated_areas_count}</td>
                              <td className="py-2.5 px-3 font-semibold">{item.impacted_trips_count}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">+{item.estimated_avg_delay_hours} hrs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                      Click &ldquo;Compare Parameter Sets&rdquo; to compute the side-by-side escalation matrix.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: Audit Trail */}
              {activeResultTab === 'audit' && (
                <div className="gov-card p-5 bg-white border border-slate-200 shadow-card space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Simulation Run Audit Logs
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      System immutable ledger of What-If scenario triggers and model evaluations
                    </p>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.log_id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({log.log_id})</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            By: {log.username} • District: {log.details?.district} • Duration: {log.details?.duration_days} Days
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Model Provenance Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-modal border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">ConvLSTM Model Architecture Provenance</h3>
                  <p className="text-xs text-slate-500">Trained Spatiotemporal Neural Network (NERAI)</p>
                </div>
              </div>
              <button onClick={() => setShowModelModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div><strong>Model Type:</strong> 2-Layer ConvLSTM2D + Conv2D + Dense Output</div>
                <div><strong>Input Shape:</strong> (Batch=1, Frames=6, Height=16, Width=16, Channels=16)</div>
                <div><strong>Spatial Domain:</strong> North Eastern Region (21.5°N - 29.5°N, 88.0°E - 97.5°E)</div>
                <div><strong>Weights Location:</strong> <code>NERAI/outputs/model/convlstm_model.keras</code></div>
              </div>

              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-[11px]">
                <strong>Channels Monitored:</strong> rainfall_1d_mm, rainfall_3d_mm, rainfall_7d_mm, rainfall_anomaly_score, flood_event_pressure, flood_historical_susceptibility, landslide_event_pressure, landslide_historical_susceptibility, environmental_risk_score, traffic_demand_veh_day, traffic_capacity_ratio, current_speed_kmh, congestion_index, road_status_encoded, vehicle_count_density, landslide_event_density.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowModelModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
