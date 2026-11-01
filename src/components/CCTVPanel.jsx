import React, { useMemo } from 'react'
import {
  Video,
  X,
  Compass,
  Eye,
  Maximize2,
  Sliders,
  MapPin,
  Crosshair,
  RotateCw,
  Sun,
  Flame,
  Radio,
  Power,
} from 'lucide-react'

/**
 * Tactical Geospatial Sensor Control Widget (C4ISR Standard)
 * Sleek, floating control panel docked at the bottom-right of the viewport.
 * Controls the map-based CCTV sensor (Azimuth, Zoom, Vision Mode, Coordinates).
 */
export const CCTVPanel = ({
  cctvConfig,
  onChangeConfig,
  onClose,
  onRelocate,
}) => {
  if (!cctvConfig || !cctvConfig.active) return null

  const lat = Number(cctvConfig.lat || 0).toFixed(6)
  const lng = Number(cctvConfig.lng || 0).toFixed(6)
  const azimuth = Math.round(cctvConfig.azimuth || 0)
  const zoom = cctvConfig.zoom || 1
  const mode = cctvConfig.mode || 'DAY'
  const fov = cctvConfig.fov || 60

  // Calculate Cardinal Direction from Azimuth
  const cardinal = useMemo(() => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round((azimuth % 360) / 45) % 8
    return directions[index]
  }, [azimuth])

  const handleAzimuthChange = (e) => {
    const val = parseInt(e.target.value, 10)
    onChangeConfig && onChangeConfig((prev) => ({ ...prev, azimuth: val }))
  }

  const handleZoomChange = (newZoom) => {
    onChangeConfig && onChangeConfig((prev) => ({ ...prev, zoom: newZoom }))
  }

  const handleModeChange = (newMode) => {
    onChangeConfig && onChangeConfig((prev) => ({ ...prev, mode: newMode }))
  }

  const handleQuickAzimuth = (angle) => {
    onChangeConfig && onChangeConfig((prev) => ({ ...prev, azimuth: angle }))
  }

  // Vision Mode Styling Tokens
  const modeBadge = {
    DAY: { label: '[ DAY ]', color: 'text-cyan-400 border-cyan-500/60 bg-cyan-950/40' },
    IR: { label: '[ IR ]', color: 'text-emerald-400 border-emerald-500/60 bg-emerald-950/40 animate-pulse' },
    FLIR: { label: '[ FLIR ]', color: 'text-amber-400 border-amber-500/60 bg-amber-950/40 animate-pulse' },
  }[mode] || { label: '[ DAY ]', color: 'text-cyan-400' }

  return (
    <div
      dir="ltr"
      className="fixed bottom-6 right-6 z-[1600] w-84 sm:w-96 bg-[#090d16]/95 backdrop-blur-md border-2 border-cyan-500/80 rounded-xl shadow-[0_0_35px_rgba(6,182,212,0.35)] p-4 font-mono text-xs select-none animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      {/* ------------------------------------------------------------- */}
      {/* WIDGET HEADER: Status & Power Off                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-700/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-300">
            <Video className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="font-black text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>GEOSPATIAL SENSOR</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${modeBadge.color}`}>
                {modeBadge.label}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>MAP-FEED ACTIVE // C4ISR HUD</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600/30 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/50 transition-colors cursor-pointer"
          title="Deactivate Geospatial CCTV Sensor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. SENSOR COORDINATES (READ-ONLY) + RELOCATE ACTION            */}
      {/* ------------------------------------------------------------- */}
      <div className="mb-3 p-2 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-bold">SENSOR GRID COORDS:</div>
            <div className="text-yellow-300 font-bold text-xs tracking-tight">
              {lat}°N, {lng}°E
            </div>
          </div>
        </div>

        {onRelocate && (
          <button
            type="button"
            onClick={onRelocate}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-400 text-[10px] font-bold transition-all cursor-pointer"
            title="Relocate camera sensor on map"
          >
            <Crosshair className="w-3 h-3" />
            <span>RELOCATE</span>
          </button>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. AZIMUTH SLIDER (0° TO 360°)                                */}
      {/* ------------------------------------------------------------- */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            AZIMUTH BEARING:
          </span>
          <span className="text-cyan-300 font-black text-xs">
            {azimuth}° [{cardinal}]
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="360"
          step="1"
          value={azimuth}
          onChange={handleAzimuthChange}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />

        {/* Quick Cardinal Snap Buttons */}
        <div className="grid grid-cols-4 gap-1 mt-2">
          {[
            { label: 'N 0°', deg: 0 },
            { label: 'E 90°', deg: 90 },
            { label: 'S 180°', deg: 180 },
            { label: 'W 270°', deg: 270 },
          ].map((c) => (
            <button
              key={c.deg}
              type="button"
              onClick={() => handleQuickAzimuth(c.deg)}
              className={`py-0.5 rounded text-[9px] font-bold border transition-colors cursor-pointer ${
                Math.abs(azimuth - c.deg) < 5
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. ZOOM / RANGE MULTIPLIER (1X, 2X, 4X)                       */}
      {/* ------------------------------------------------------------- */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            ZOOM / RANGE MULTIPLIER:
          </span>
          <span className="text-yellow-400 font-bold text-xs">
            {zoom}X ({zoom * 500} METERS)
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { level: 1, label: '1X (500m)' },
            { level: 2, label: '2X (1000m)' },
            { level: 4, label: '4X (2000m)' },
          ].map((z) => (
            <button
              key={z.level}
              type="button"
              onClick={() => handleZoomChange(z.level)}
              className={`py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                zoom === z.level
                  ? 'bg-cyan-600 text-slate-950 border-cyan-300 font-black shadow-md shadow-cyan-950'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-600'
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. VISION MODE TOGGLES [ DAY ] | [ IR ] | [ FLIR ]            */}
      {/* ------------------------------------------------------------- */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
          <Sliders className="w-3 h-3 text-cyan-400" />
          <span>MAP VISION SENSOR FILTER:</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {/* DAY */}
          <button
            type="button"
            onClick={() => handleModeChange('DAY')}
            className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
              mode === 'DAY'
                ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-md shadow-cyan-950'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-cyan-300 hover:border-slate-700'
            }`}
          >
            [ DAY ]
          </button>

          {/* IR */}
          <button
            type="button"
            onClick={() => handleModeChange('IR')}
            className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
              mode === 'IR'
                ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-md shadow-emerald-950 animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-emerald-300 hover:border-slate-700'
            }`}
          >
            [ IR ]
          </button>

          {/* FLIR */}
          <button
            type="button"
            onClick={() => handleModeChange('FLIR')}
            className={`py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
              mode === 'FLIR'
                ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950 animate-pulse'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-amber-300 hover:border-slate-700'
            }`}
          >
            [ FLIR ]
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* FOOTER: Telemetry & Power Off Action                          */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
        <span className="text-slate-400 font-bold">
          FOV: {fov}° // RANGE: {zoom * 500}m
        </span>

        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1 text-red-400 hover:text-red-300 font-bold hover:underline cursor-pointer"
        >
          <Power className="w-3 h-3" />
          <span>DEACTIVATE SENSOR</span>
        </button>
      </div>
    </div>
  )
}

export default CCTVPanel
