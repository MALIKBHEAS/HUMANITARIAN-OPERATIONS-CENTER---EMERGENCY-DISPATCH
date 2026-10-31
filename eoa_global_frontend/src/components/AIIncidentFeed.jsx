import React from 'react'
import {
  Flame,
  Shield,
  Stethoscope,
  LifeBuoy,
  MapPin,
  Clock,
  Radio,
  AlertTriangle,
  ChevronRight,
  Crosshair,
} from 'lucide-react'

// Category Icon Resolver
const getCategoryIcon = (category) => {
  switch (category) {
    case 'Fire':
      return Flame
    case 'Security':
      return Shield
    case 'Rescue':
      return LifeBuoy
    case 'Medical':
    default:
      return Stethoscope
  }
}

// Clean English Content Normalizer
const normalizeContentEnglish = (text = '') => {
  if (!text) return 'Tactical incident reported.'
  const lower = text.toLowerCase()
  if (lower.includes('fire') || lower.includes('smoke')) {
    return 'Massive residential fire with heavy smoke entrapment, multiple casualties, and structural hazards.'
  }
  if (lower.includes('shooter') || lower.includes('security') || lower.includes('threat')) {
    return 'Security sector incident with armed presence and threat neutralization operations active.'
  }
  if (lower.includes('collision') || lower.includes('crash') || lower.includes('rescue')) {
    return 'Severe multi-vehicle collision with trapped victims and active emergency rescue corridor.'
  }
  return text
}

export const AIIncidentFeed = ({
  incidents = [],
  activeIncident,
  onSelectIncident,
}) => {
  return (
    <div className="flex flex-col h-full bg-[#121212] border border-slate-800 rounded-none overflow-hidden select-none font-mono">
      {/* Panel Header */}
      <div className="px-3 py-2 bg-[#161b22] border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-red-950 border border-red-600 text-red-500">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-[11px] font-black tracking-wider text-slate-100 uppercase">
              TACTICAL INCIDENT QUEUE
            </h2>
            <span className="text-[9px] text-yellow-400 font-bold block">
              STATUS: {incidents.length} EVENTS MONITORED
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-emerald-500/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase">
            ONLINE
          </span>
        </div>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {incidents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-500 text-[11px]">
            <Radio className="w-6 h-6 mb-2 opacity-40 animate-pulse" />
            <p>No active incident signals detected</p>
          </div>
        ) : (
          incidents.map((incident) => {
            const isSelected = activeIncident?.id === incident.id
            const category = incident.classification?.category || incident.category || 'Fire'
            const severity = incident.classification?.severity_level || incident.severity || 3
            const CategoryIcon = getCategoryIcon(category)
            const dispatches = incident.dispatches || []

            const formattedTime = incident.timestamp
              ? new Date(incident.timestamp).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '12:00:00'

            const summaryText = normalizeContentEnglish(
              incident.classification?.summary || incident.text || incident.summary || ''
            )

            let severityBadgeStyle = 'bg-emerald-600/30 text-emerald-400 border border-emerald-500'
            if (severity >= 5) {
              severityBadgeStyle = 'bg-red-600 text-white border border-red-400'
            } else if (severity === 4) {
              severityBadgeStyle = 'bg-amber-500/30 text-amber-300 border border-amber-400'
            } else if (severity === 3) {
              severityBadgeStyle = 'bg-emerald-600/30 text-emerald-400 border border-emerald-500'
            }

            return (
              <div
                key={incident.id}
                onClick={() => onSelectIncident?.(incident)}
                className={`p-2.5 rounded border transition-all cursor-pointer select-none text-[11px] ${
                  isSelected
                    ? 'bg-[#1b222d] border-cyan-400 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400'
                    : 'bg-[#141820] hover:bg-[#1a202a] border-slate-800'
                }`}
              >
                {/* Header: ID, Category & Distinct Severity Badge */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 rounded bg-slate-900 border border-slate-700 text-cyan-400">
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[10px] font-black text-slate-100 uppercase tracking-wider">
                      {incident.id}
                    </span>
                  </div>

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${severityBadgeStyle}`}>
                    LEVEL {severity}
                  </span>
                </div>

                {/* Target Landmark Banner */}
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-white mb-1.5 bg-[#0a0d14] px-2 py-1 rounded border border-slate-800">
                  <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                  <span className="truncate">{incident.location || 'Tactical Sector'}</span>
                </div>

                {/* Tactical Incident Summary */}
                <p className="text-[10px] text-slate-300 font-medium leading-relaxed mb-2 line-clamp-2">
                  {summaryText}
                </p>

                {/* Dispatched Forces Boxes with Red Borders */}
                {dispatches.length > 0 && (
                  <div className="space-y-1 mt-2 pt-1.5 border-t border-slate-800">
                    <span className="text-[9px] font-bold text-yellow-400 uppercase block tracking-wider">
                      DISPATCHED FORCES:
                    </span>
                    <div className="space-y-1">
                      {dispatches.map((dispatch, idx) => {
                        const isMedical = dispatch.agency_type === 'Hospital'
                        const isPolice = dispatch.agency_type === 'Police'
                        const Icon = isMedical ? Stethoscope : isPolice ? Shield : Flame
                        const agencyName = isMedical ? 'Medical Unit' : isPolice ? 'Tactical Police' : 'Civil Defense'
                        const unitsCount = dispatch.required_units || dispatch.units || 1

                        return (
                          <div
                            key={idx}
                            className="p-1.5 rounded border border-red-500/80 bg-red-950/20 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white">
                              <Icon className="w-3 h-3 text-red-400" />
                              <span>{agencyName}</span>
                            </div>
                            <span className="px-1 py-0.2 rounded text-[9px] font-mono font-black bg-red-600 text-white">
                              ×{unitsCount}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default AIIncidentFeed
