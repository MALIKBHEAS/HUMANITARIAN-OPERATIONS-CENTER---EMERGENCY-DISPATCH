import React, { useState } from 'react';
import DashboardStats from './DashboardStats';
import LiveMap from './LiveMap';
import IncidentFeed from './IncidentFeed';
import { useWebSocket } from '../hooks/useWebSocket';
import { API_BASE_URL, api } from '../api';
import { Send, X, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

const PRESET_SCENARIOS = [
  {
    label: 'Hebron Chemical Explosion',
    city: 'Hebron 🇵🇸',
    type: 'FIRE',
    severity_level: 5,
    description: 'انفجار وحريق ضخم في مصنع للكيماويات في المنطقة الصناعية بالخليل. 12 إصابة بحروق واختناق شديد تحتاج لعناية مكثفة فورية.',
    lat: 31.5273,
    lon: 35.0946,
    required_beds: 12,
    security_token: 'valid_edge_token_hebron',
  },
  {
    label: 'Tokyo Shinjuku High-Rise',
    city: 'Tokyo 🇯🇵',
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
    city: 'Madrid 🇪🇸',
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
    city: 'New York 🇺🇸',
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
    city: 'Riyadh 🇸🇦',
    type: 'CRASH',
    severity_level: 4,
    description: 'حادث تصادم مروري متسلسل على طريق الملك فهد بالرياض. 5 إصابات حرجة تتطلب إسعافاً وتأميناً مرورياً عاجلاً.',
    lat: 24.7150,
    lon: 46.6780,
    required_beds: 5,
    security_token: 'valid_edge_token_riyadh',
  },
];

export default function DashboardLayout() {
  const { status, incidentHistory, latestIncident } = useWebSocket('ws://localhost:9443/ws/live-feed');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simForm, setSimForm] = useState(PRESET_SCENARIOS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleApplyPreset = (scenario) => {
    setSimForm(scenario);
  };

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
        setTimeout(() => {
          setIsSimulatorOpen(false);
          setSubmitSuccess(false);
        }, 1000);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to send incident: ${errData.detail || res.statusText}`);
      }
    } catch (err) {
      alert(`Network error: ${err.message}. Ensure FastAPI backend is running on port 8000.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerSOS = async () => {
    const confirmed = window.confirm(
      "CONFIRM CRITICAL SOS BROADCAST?\n\nThis will trigger an immediate DEFCON-1 duress alert and dispatch autonomous emergency units to your operator coordinates."
    );
    if (!confirmed) return;

    try {
      const sosPayload = {
        type: "SOS_DURESS",
        severity_level: 5,
        description: "CRITICAL OPERATOR DURESS / SOS BROADCAST - Immediate emergency assistance required at command station.",
        lat: 31.5273,
        lon: 35.0946,
        required_beds: 5,
        security_token: "valid_edge_token_sos_override"
      };
      await api.sendIncident(sosPayload);
      alert("CRITICAL SOS BROADCASTED SUCCESSFULLY. Units dispatched.");
    } catch (err) {
      alert(`SOS Broadcast failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden font-sans">
      
      {/* Top Tactical Stat Bar */}
      <DashboardStats incidents={incidentHistory} wsStatus={status} onTriggerSOS={handleTriggerSOS} />

      {/* Main Operational Split View */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
        
        {/* Left / Top: Interactive LiveMap takes up majority of the screen */}
        <div className="flex-1 relative min-h-[350px] lg:h-full overflow-hidden">
          <LiveMap incidents={incidentHistory} latestIncident={latestIncident} />

          {/* Floating Dispatch Test Trigger */}
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="absolute bottom-5 right-5 z-[1000] px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-2xl text-xs font-mono font-bold flex items-center gap-2 border border-red-400 transition-all hover:scale-105 active:scale-95"
          >
            <Send className="w-4 h-4" />
            <span>DISPATCH TEST INCIDENT</span>
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
                        ? 'bg-red-600/30 border-red-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="text-[10px] text-red-400">{p.city}</div>
                    <div className="truncate font-semibold">{p.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleTriggerWebhook} className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-slate-400 block mb-1">INCIDENT TYPE</label>
                <select
                  value={simForm.type}
                  onChange={(e) => setSimForm({ ...simForm, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                >
                  <option value="FIRE">FIRE (حريق)</option>
                  <option value="CRASH">CRASH (حادث سير)</option>
                  <option value="CRIME">CRIME (جريمة جنائية)</option>
                  <option value="HAZMAT">HAZMAT (مواد خطرة)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">DESCRIPTION</label>
                <textarea
                  rows={2}
                  value={simForm.description}
                  onChange={(e) => setSimForm({ ...simForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">LATITUDE (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={simForm.lat}
                    onChange={(e) => setSimForm({ ...simForm, lat: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">LONGITUDE (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={simForm.lon}
                    onChange={(e) => setSimForm({ ...simForm, lon: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">SEVERITY LEVEL (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={simForm.severity_level}
                    onChange={(e) => setSimForm({ ...simForm, severity_level: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">REQUIRED ICU BEDS</label>
                  <input
                    type="number"
                    min="0"
                    value={simForm.required_beds}
                    onChange={(e) => setSimForm({ ...simForm, required_beds: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || submitSuccess}
                className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-600/30"
              >
                {submitSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>INCIDENT TRANSMITTED TO AGENT!</span>
                  </>
                ) : isSubmitting ? (
                  <span>DISPATCHING VIA AI AGENT...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>TRIGGER WEBHOOK (POST /api/webhook/incident)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
