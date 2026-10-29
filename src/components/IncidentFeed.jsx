import React, { useState } from 'react';
import {
  Flame,
  Car,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Cpu,
  Zap,
  Building2,
  Shield
} from 'lucide-react';

export default function IncidentFeed({ incidents = [], onSimulateIncident }) {
  const [expandedTraceId, setExpandedTraceId] = useState(null);

  const toggleTrace = (id) => {
    setExpandedTraceId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden font-sans">
      
      {/* Feed Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-red-500 animate-pulse" />
          <h2 className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            AI Dispatch Stream
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
            {incidents.length} EVENTS
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            EDGE
          </span>
        </div>
      </div>

      {/* Feed List Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-slate-500">
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-700 flex items-center justify-center mb-3 animate-spin">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            </div>
            <p className="text-xs font-mono text-slate-400">STANDBY FOR EDGE RADAR TRIGGERS</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-[220px]">
              Listening to <code className="text-red-400">/ws/live-feed</code> for incoming incidents.
            </p>
            {onSimulateIncident && (
              <button
                onClick={onSimulateIncident}
                className="mt-4 px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Inject Test Incident</span>
              </button>
            )}
          </div>
        ) : (
          incidents.map((inc, index) => {
            const isDispatched = inc.status === 'DISPATCHED';
            const isExpanded = expandedTraceId === (inc.incident_id || index);

            return (
              <div
                key={inc.incident_id || index}
                className={`p-3.5 rounded-lg border transition-all ${
                  isDispatched
                    ? 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/50'
                    : 'bg-red-950/20 border-red-500/40 hover:border-red-500'
                }`}
              >
                {/* Item Meta Bar */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {inc.incident_type === 'FIRE' ? (
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                    ) : (
                      <Car className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span className="text-[11px] font-mono font-bold text-white">
                      #{inc.incident_id || 'EDGE'} {inc.incident_type || 'INCIDENT'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isDispatched
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {isDispatched ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        DISPATCHED
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        OVERRIDE
                      </>
                    )}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-200 font-medium leading-relaxed mb-2.5">
                  {inc.incident_summary || 'Incident reported via edge gateway.'}
                </p>

                {/* Severity Meter */}
                <div className="flex items-center gap-2 mb-3 text-[10px] font-mono text-slate-400">
                  <span>SEVERITY:</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <span
                        key={level}
                        className={`w-3.5 h-1.5 rounded-sm ${
                          level <= (inc.severity_level || 3)
                            ? level >= 4
                              ? 'bg-red-500'
                              : 'bg-amber-400'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-slate-300 font-bold ml-1">
                    LVL {inc.severity_level || 3}/5
                  </span>
                </div>

                {/* Units Dispatched List (Hospital Name, ETA, Resource) */}
                {inc.dispatches && inc.dispatches.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-1.5">
                    <p className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-between">
                      <span>AI DISPATCH DECISION</span>
                      <span className="text-emerald-400 font-bold">
                        MAX ETA: {inc.response_time_eta_max_minutes || 2}m
                      </span>
                    </p>

                    {inc.dispatches.map((disp, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-center justify-between text-[11px] font-mono p-2 rounded bg-slate-900 border border-slate-800"
                      >
                        <div className="truncate mr-2 flex items-center gap-1.5">
                          {disp.resource_type === 'HOSPITAL' ? (
                            <Building2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="text-slate-200 font-semibold block truncate">
                              {disp.institution_name?.split('(')[0] || 'Assigned Unit'}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {disp.resource_type}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[10px] font-bold whitespace-nowrap">
                          {disp.eta_minutes}m ETA
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Trace Log Inspector Button */}
                {inc.trace_log && inc.trace_log.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => toggleTrace(inc.incident_id || index)}
                      className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 hover:text-white transition-colors py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3 h-3 text-red-400" />
                        <span>Inspect ReAct Trace ({inc.trace_log.length} steps)</span>
                      </span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {/* Expandable Trace Drawer */}
                    {isExpanded && (
                      <div className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] space-y-2 max-h-56 overflow-y-auto">
                        {inc.trace_log.map((step, sIdx) => {
                          const stepType = step.step?.toUpperCase() || 'LOG';
                          const isThought = stepType === 'THOUGHT';
                          const isAction = stepType === 'ACTION';
                          const isObservation = stepType === 'OBSERVATION';

                          return (
                            <div key={sIdx} className="border-b border-slate-900 pb-1.5 last:border-b-0">
                              <span
                                className={`font-bold px-1 py-0.5 rounded text-[9px] mr-1.5 ${
                                  isThought
                                    ? 'bg-purple-900/40 text-purple-300'
                                    : isAction
                                    ? 'bg-blue-900/40 text-blue-300'
                                    : isObservation
                                    ? 'bg-amber-900/40 text-amber-300'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {stepType}
                              </span>
                              {step.tool && (
                                <span className="text-emerald-400 font-bold mr-1">
                                  [{step.tool}]
                                </span>
                              )}
                              <p className="text-slate-300 mt-0.5 whitespace-pre-wrap leading-tight">
                                {step.content || JSON.stringify(step.output || step.params || '')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
