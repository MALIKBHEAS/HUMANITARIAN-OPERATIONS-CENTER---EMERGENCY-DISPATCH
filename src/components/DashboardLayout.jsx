import React, { useState } from 'react';
import DashboardStats from './DashboardStats';
import LiveMap from './LiveMap';
import IncidentFeed from './IncidentFeed';
import TacticalConfirmModal from './TacticalConfirmModal';
import CCTVPanel from './CCTVPanel';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { API_BASE_URL, api } from '../api';
import { Send, X, AlertCircle, Sparkles, CheckCircle2, Crosshair, LocateFixed, Check, Video } from 'lucide-react';

const PRESET_SCENARIOS = [
  {
    label: 'Hebron Chemical Explosion',
    city: 'Hebron Sector',
    type: 'FIRE',
    severity_level: 5,
    description: 'Explosion and heavy structural fire at chemical facility in Hebron Industrial Sector. 12 burn and smoke entrapment casualties requiring urgent ICU trauma care.',
    lat: 31.5273,
    lon: 35.0946,
    required_beds: 12,
    security_token: 'valid_edge_token_hebron',
  },
  {
    label: 'Tokyo Shinjuku High-Rise',
    city: 'Tokyo Sector',
    type: 'FIRE',
    severity_level: 5,
    description: 'Explosion and multi-floor fire at Shinjuku commercial tower. 10 casualties requiring immediate ICU trauma care.',
    lat: 35.6938,
    lon: 139.6917,
    required_beds: 10,
    security_token: 'valid_edge_token_tokyo',
  },
  {
    label: 'Madrid M-30 Multi-Collision',
    city: 'Madrid Sector',
    type: 'CRASH',
    severity_level: 4,
    description: 'Multi-vehicle collision on highway M-30 Madrid involving heavy fuel tanker. 6 motorists critically injured.',
    lat: 40.4816,
    lon: -3.6872,
    required_beds: 6,
    security_token: 'valid_edge_token_madrid',
  },
  {
    label: 'New York Subway Fire',
    city: 'New York Sector',
    type: 'CRASH',
    severity_level: 4,
    description: 'Underground electrical transformer explosion near Times Square subway station. 8 patients requiring urgent triage.',
    lat: 40.7580,
    lon: -73.9855,
    required_beds: 8,
    security_token: 'valid_edge_token_ny',
  },
  {
    label: 'Riyadh Highway Pileup',
    city: 'Riyadh Sector',
    type: 'CRASH',
    severity_level: 4,
    description: 'Multi-vehicle high-speed pileup on King Fahd Road in Riyadh. 5 critical casualties requiring urgent trauma routing and perimeter clearance.',
    lat: 24.7150,
    lon: 46.6780,
    required_beds: 5,
    security_token: 'valid_edge_token_riyadh',
  },
];

export default function DashboardLayout() {
  const { status, incidentHistory, latestIncident } = useWebSocket('ws://localhost:9443/ws/live-feed');
  const systemHealth = useSystemHealth(status);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simForm, setSimForm] = useState(PRESET_SCENARIOS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // ===========================================================================
  // 1. STATE MANAGEMENT: CCTV GEOSPATIAL SENSOR & PLACEMENT MODE
  // ===========================================================================
  const [cctvConfig, setCctvConfig] = useState({
    active: false,
    lat: null,
    lng: null,
    azimuth: 0,
    fov: 60,
    zoom: 1,
    mode: 'DAY',
  });
  const [isCctvPlacementMode, setIsCctvPlacementMode] = useState(false);

  // ===========================================================================
  // TARGETING MODE & DYNAMIC COORDINATE DISPATCH
  // ===========================================================================
  const [isTargetingMode, setIsTargetingMode] = useState(false);
  const [pendingDispatchType, setPendingDispatchType] = useState('SOS_DURESS');
  const [pendingSeverity, setPendingSeverity] = useState(5);
  const [pendingTargetCoords, setPendingTargetCoords] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const handleApplyPreset = (scenario) => {
    setSimForm(scenario);
  };

  // Workflow: CCTV Placement Mode Activation
  const handleActivateCctvPlacement = () => {
    setIsCctvPlacementMode(true);
    triggerToast('CCTV PLACEMENT MODE ACTIVE: CLICK MAP TO DEPLOY SENSOR');
  };

  // Workflow: Map Click in CCTV Placement Mode
  const handleCctvPlaced = (coords) => {
    setCctvConfig((prev) => ({
      ...prev,
      lat: coords.lat,
      lng: coords.lng,
      active: true,
    }));
    setIsCctvPlacementMode(false);
    triggerToast('GEOSPATIAL SENSOR DEPLOYED: MAP FEED ACTIVE');
  };

  // Workflow: Start Targeting Mode on SOS Click
  const handleTriggerSOS = () => {
    setPendingDispatchType('SOS_DURESS');
    setPendingSeverity(5);
    setIsTargetingMode(true);
    triggerToast('TARGET ACQUISITION ACTIVE: CLICK MAP OR FETCH GPS TO LOCK COORDINATES');
  };

  // Workflow: Start Targeting Mode on Test Incident Click
  const handleTriggerTestIncident = () => {
    setPendingDispatchType('FIRE');
    setPendingSeverity(4);
    setIsTargetingMode(true);
    triggerToast('TARGET ACQUISITION ACTIVE: CLICK MAP OR FETCH GPS TO LOCK COORDINATES');
  };

  // Workflow: Captured Coordinates from Map Click
  const handleLocationAcquired = (coords) => {
    setPendingTargetCoords({
      lat: coords.lat,
      lng: coords.lng,
      location: 'ACQUIRED TACTICAL SECTOR',
    });
    setIsTargetingMode(false);
    setIsConfirmModalOpen(true);
  };

  // Workflow: Captured Live GPS Coordinates
  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      triggerToast('GEOLOCATION NOT SUPPORTED: CLICK DIRECTLY ON TACTICAL MAP');
      return;
    }
    triggerToast('ACQUIRING LIVE OPERATOR GPS TELEMETRY...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPendingTargetCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          location: 'LIVE OPERATOR GPS POSITION',
        });
        setIsTargetingMode(false);
        setIsConfirmModalOpen(true);
      },
      (err) => {
        triggerToast(`GPS ACQUISITION FAILED: ${err.message}. CLICK MAP DIRECTLY`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Workflow: Execute Dispatch from Tactical Confirmation Modal
  const handleExecuteDispatch = async () => {
    if (!pendingTargetCoords) return;
    setIsTransmitting(true);

    try {
      const sosPayload = {
        type: pendingDispatchType || 'SOS_DURESS',
        severity_level: pendingSeverity || 5,
        description:
          pendingDispatchType === 'SOS_DURESS'
            ? 'CRITICAL OPERATOR DURESS / SOS BROADCAST - Autonomous units deployed to locked target coordinates.'
            : 'TACTICAL EMERGENCY DISPATCH - Autonomous response units mobilized.',
        lat: pendingTargetCoords.lat,
        lon: pendingTargetCoords.lng,
        required_beds: 5,
        security_token: 'valid_edge_token_sos_override',
      };

      await api.sendIncident(sosPayload);
      triggerToast('CRITICAL DISPATCH TRANSMITTED // UNITS MOBILIZED TO TARGET');
      setIsConfirmModalOpen(false);
      setPendingTargetCoords(null);
    } catch (err) {
      triggerToast(`DISPATCH FAILED: ${err.message}`);
    } finally {
      setIsTransmitting(false);
    }
  };

  // Webhook injector fallback handler without native alert
  const handleTriggerWebhook = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    try {
      const res = await fetch(`${API_BASE_URL}/webhook/incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simForm),
      });

      if (res.ok) {
        setSubmitSuccess(true);
        triggerToast('INCIDENT DISPATCHED SUCCESSFULLY TO EDGE RUNTIME');
        setTimeout(() => {
          setIsSimulatorOpen(false);
          setSubmitSuccess(false);
        }, 1000);
      } else {
        const errData = await res.json().catch(() => ({}));
        triggerToast(`DISPATCH ERROR: ${errData.detail || res.statusText}`);
      }
    } catch (err) {
      triggerToast(`NETWORK ERROR: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden font-sans">
      
      {/* Top Tactical Stat Bar */}
      <DashboardStats
        incidents={incidentHistory}
        wsStatus={status}
        systemHealth={systemHealth}
        onTriggerSOS={handleTriggerSOS}
        cctvConfig={cctvConfig}
        onTriggerCCTVPlacement={handleActivateCctvPlacement}
      />

      {/* Target Acquisition Mode Active HUD Banner */}
      {isTargetingMode && (
        <div className="bg-red-950/95 border-b-2 border-red-500 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl shadow-red-950 animate-in slide-in-from-top duration-200 z-30 font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-white animate-spin">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <div className="font-black text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <span>TARGET ACQUISITION MODE ACTIVE</span>
                <span className="px-1.5 py-0.2 rounded bg-red-600 text-white text-[9px] font-bold">
                  {pendingDispatchType}
                </span>
              </div>
              <p className="text-[10px] text-red-200 font-bold">
                CLICK ANY POSITION ON THE TACTICAL MAP TO ACQUIRE TARGET COORDINATES OR CAPTURE LIVE GPS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchGPS}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-mono font-bold text-[10px] uppercase border border-cyan-400 shadow-sm transition-all cursor-pointer"
            >
              <LocateFixed className="w-3 h-3 text-cyan-300" />
              <span>ACQUIRE GPS / CURRENT LOCATION</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTargetingMode(false)}
              className="flex items-center gap-1 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono font-bold text-[10px] uppercase border border-slate-600 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>ABORT TARGETING</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Operational Split View */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        
        {/* Left / Top: Interactive LiveMap with CCTV Sensor & Dynamic Map Filters */}
        <div className="flex-1 relative min-h-[350px] lg:h-full overflow-hidden">
          <LiveMap
            incidents={incidentHistory}
            latestIncident={latestIncident}
            isTargetingMode={isTargetingMode}
            onLocationAcquired={handleLocationAcquired}
            acquiredCoords={pendingTargetCoords}
            cctvConfig={cctvConfig}
            isCctvPlacementMode={isCctvPlacementMode}
            onCctvPlaced={handleCctvPlaced}
            onCancelCctvPlacement={() => setIsCctvPlacementMode(false)}
          />

          {/* Floating Dispatch Test Trigger -> Enters Targeting Mode */}
          <button
            onClick={handleTriggerTestIncident}
            className="absolute bottom-5 right-5 z-[1000] px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-2xl text-xs font-mono font-bold flex items-center gap-2 border border-red-400 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-white" />
            <span>TARGET & DISPATCH INCIDENT</span>
          </button>
        </div>

        {/* Right / Bottom: Strictly Constrained IncidentFeed Sidebar */}
        <div className="w-full lg:w-[400px] h-[40vh] lg:h-full flex-shrink-0 z-10 border-t lg:border-t-0 lg:border-l border-slate-800">
          <IncidentFeed
            incidents={incidentHistory}
            onSimulateIncident={() => setIsSimulatorOpen(true)}
          />
        </div>

      </div>

      {/* 2. THE TACTICAL CONTROL WIDGET (CCTVPanel.jsx) */}
      <CCTVPanel
        cctvConfig={cctvConfig}
        onChangeConfig={setCctvConfig}
        onClose={() => setCctvConfig((prev) => ({ ...prev, active: false }))}
        onRelocate={handleActivateCctvPlacement}
      />

      {/* Custom Tactical Confirmation Modal (No Native Alerts) */}
      <TacticalConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecuteDispatch}
        targetCoords={pendingTargetCoords}
        incidentType={pendingDispatchType}
        severity={pendingSeverity}
        isTransmitting={isTransmitting}
      />

      {/* HUD Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3500] bg-slate-900 border-2 border-yellow-400 text-yellow-300 px-4 py-2 rounded text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95">
          <Check className="w-3.5 h-3.5 text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Incident Injector Modal */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <h3 className="text-sm font-mono font-bold text-white uppercase flex items-center gap-2">
                  Emergency Webhook Injector
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    EOA ReAct
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">Trigger edge incident payload for autonomous AI dispatch</p>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="mb-4">
              <label className="text-[11px] font-mono text-slate-400 block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                ONE-CLICK GLOBAL PRESET SCENARIOS:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_SCENARIOS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-2 rounded border text-left transition-all text-xs font-mono ${
                      simForm.label === p.label
                        ? 'border-red-500 bg-red-950/40 text-red-200'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold truncate">{p.city}</div>
                    <div className="text-[10px] opacity-75">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleTriggerWebhook} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">INCIDENT TYPE</label>
                  <select
                    value={simForm.type}
                    onChange={(e) => setSimForm({ ...simForm, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  >
                    <option value="FIRE">FIRE (Multi-floor)</option>
                    <option value="CRASH">CRASH (Mass transit)</option>
                    <option value="CRIME">CRIME (Armed threat)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">SEVERITY LEVEL (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={simForm.severity_level}
                    onChange={(e) => setSimForm({ ...simForm, severity_level: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 text-[10px] block mb-1">INCIDENT DESCRIPTION</label>
                <textarea
                  rows="2"
                  value={simForm.description}
                  onChange={(e) => setSimForm({ ...simForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">LATITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simForm.lat}
                    onChange={(e) => setSimForm({ ...simForm, lat: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simForm.lon}
                    onChange={(e) => setSimForm({ ...simForm, lon: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 text-[10px] block mb-1">BEDS NEEDED</label>
                  <input
                    type="number"
                    value={simForm.required_beds}
                    onChange={(e) => setSimForm({ ...simForm, required_beds: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSimulatorOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 font-bold"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold flex items-center gap-1.5 shadow-lg shadow-red-950"
                >
                  {isSubmitting ? (
                    'DISPATCHING...'
                  ) : submitSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      DISPATCHED!
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      SUBMIT EMERGENCY
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
