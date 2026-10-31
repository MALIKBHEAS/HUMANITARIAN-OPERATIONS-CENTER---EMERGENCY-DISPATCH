import React, { useState, useEffect } from 'react'
import {
  Video,
  X,
  Compass,
  Eye,
  Camera,
  Maximize2,
  Minimize2,
  Sliders,
  MapPin,
  ShieldCheck,
  AlertCircle,
  Radio,
  Layers,
  Settings,
  Info,
  ExternalLink,
} from 'lucide-react'

// Default Virtual Geographic Humanitarian Cameras
export const DEFAULT_CAMERAS = [
  {
    id: 'CAM-01-CENTRAL',
    name: 'Central Sector Surveillance',
    location: 'Omar Al-Mukhtar St - Central Sector',
    lat: 31.5135,
    lng: 34.4545,
    heading: 135,
    fov: 65,
    rangeMeters: 450,
    status: 'ACTIVE',
    sourceType: 'simulation',
    streamUrl: '',
  },
  {
    id: 'CAM-02-CORRIDOR',
    name: 'South Logistics Corridor',
    location: 'Salah Al-Din Corridor - South Sector',
    lat: 31.4310,
    lng: 34.3815,
    heading: 45,
    fov: 50,
    rangeMeters: 600,
    status: 'ACTIVE',
    sourceType: 'simulation',
    streamUrl: '',
  },
  {
    id: 'CAM-03-PORT',
    name: 'Port Maritime Facility',
    location: 'Port Maritime Terminal - North Dock',
    lat: 31.5285,
    lng: 34.4325,
    heading: 270,
    fov: 80,
    rangeMeters: 500,
    status: 'STANDBY',
    sourceType: 'simulation',
    streamUrl: '',
  },
]

export const CCTVControlCenter = ({
  isOpen,
  onClose,
  cameras = DEFAULT_CAMERAS,
  activeCameraId = 'CAM-01-CENTRAL',
  onUpdateCamera = null,
  onSelectCamera = null,
  onCaptureSnapshot = null,
}) => {
  const [selectedCamId, setSelectedCamId] = useState(activeCameraId)
  const [visionMode, setVisionMode] = useState('DAY') // 'DAY' | 'IR_SIM' | 'FLIR_SIM'
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState('')

  // Sync activeCameraId
  useEffect(() => {
    if (activeCameraId) setSelectedCamId(activeCameraId)
  }, [activeCameraId])

  // Current selected camera object
  const activeCam = cameras.find((c) => c.id === selectedCamId) || cameras[0] || DEFAULT_CAMERAS[0]

  // Military UTC clock with seconds
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setCurrentTime(now.toISOString().slice(11, 19) + ' UTC')
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!isOpen) return null

  const handleFieldChange = (field, value) => {
    if (!onUpdateCamera) return
    onUpdateCamera({
      ...activeCam,
      [field]: value,
    })
  }

  // Heading cardinal helper
  const getCardinal = (angle) => {
    const deg = (angle % 360 + 360) % 360
    if (deg >= 337.5 || deg < 22.5) return 'N'
    if (deg >= 22.5 && deg < 67.5) return 'NE'
    if (deg >= 67.5 && deg < 112.5) return 'E'
    if (deg >= 112.5 && deg < 157.5) return 'SE'
    if (deg >= 157.5 && deg < 202.5) return 'S'
    if (deg >= 202.5 && deg < 247.5) return 'SW'
    if (deg >= 247.5 && deg < 292.5) return 'W'
    return 'NW'
  }

  return (
    <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none font-sans text-sm">
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col transition-all duration-200 ${
          isFullscreen
            ? 'w-full h-full max-w-none rounded-none'
            : 'w-full max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* =============================================================== */}
        {/* UNIFIED CCTV CONTROL CENTER HEADER                              */}
        {/* =============================================================== */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-sm">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  CCTV CONTROL CENTER
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {cameras.length} CHANNELS ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Geographic Camera Network & Field Surveillance Coordination
              </p>
            </div>
          </div>

          {/* Camera Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {cameras.map((cam) => {
              const isSelected = cam.id === activeCam.id
              return (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => {
                    setSelectedCamId(cam.id)
                    onSelectCamera && onSelectCamera(cam)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-600 text-slate-950 font-bold shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cam.status === 'ACTIVE'
                        ? 'bg-emerald-400'
                        : cam.status === 'STANDBY'
                        ? 'bg-amber-400'
                        : 'bg-slate-400'
                    }`}
                  />
                  <span>{cam.name.split(' ')[0]} ({cam.id.slice(4, 6)})</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =============================================================== */}
        {/* MAIN BODY: VIEWPORT (LEFT) + CONFIGURATION CONTROLS (RIGHT)     */}
        {/* =============================================================== */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">
          
          {/* LEFT: MONITOR VIEWPORT & DISPLAY MODES (COL-SPAN-8) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-hidden relative">
            
            {/* Monitor Mode Toolbar */}
            <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Display Modes Selector */}
              <div className="flex items-center gap-1">
                <span className="text-slate-400 font-semibold mr-1">Display Mode:</span>
                
                <button
                  type="button"
                  onClick={() => setVisionMode('DAY')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all border cursor-pointer ${
                    visionMode === 'DAY'
                      ? 'bg-cyan-600 text-slate-950 border-cyan-400 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                >
                  DAY OPTICAL
                </button>

                <button
                  type="button"
                  onClick={() => setVisionMode('IR_SIM')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                    visionMode === 'IR_SIM'
                      ? 'bg-emerald-600 text-slate-950 border-emerald-400 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-emerald-400'
                  }`}
                >
                  <span>IR NIGHT</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-slate-900/60 font-mono">SIMULATION</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisionMode('FLIR_SIM')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
                    visionMode === 'FLIR_SIM'
                      ? 'bg-amber-600 text-slate-950 border-amber-400 font-bold shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-amber-400'
                  }`}
                >
                  <span>THERMAL</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-slate-900/60 font-mono">SIMULATION</span>
                </button>
              </div>

              {/* Zoom & Snapshot */}
              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-slate-800 rounded-md border border-slate-700 p-0.5 text-xs">
                  {[1, 2, 4].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZoom(z)}
                      className={`px-2 py-0.5 rounded font-mono font-bold cursor-pointer ${
                        zoom === z ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {z}X
                    </button>
                  ))}
                </div>

                {onCaptureSnapshot && (
                  <button
                    type="button"
                    onClick={onCaptureSnapshot}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md font-medium transition-colors cursor-pointer"
                    title="Capture Frame"
                  >
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Snapshot</span>
                  </button>
                )}
              </div>
            </div>

            {/* Technical Honesty Disclaimer Banner when in IR / FLIR Mode */}
            {visionMode !== 'DAY' && (
              <div className="px-4 py-1.5 bg-amber-950/80 border-b border-amber-700/60 text-amber-200 text-xs flex items-center justify-between font-mono shrink-0">
                <div className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    DISPLAY EFFECT SIMULATION ONLY • NO PHYSICAL THERMAL SENSOR ATTACHED • SENSOR READINGS NOT VERIFIED
                  </span>
                </div>
                <span className="text-[10px] opacity-80">MIL-STD LABELED SIM</span>
              </div>
            )}

            {/* Video Feed Canvas Display */}
            <div className="flex-1 relative bg-slate-950 overflow-hidden flex items-center justify-center min-h-[340px]">
              
              {/* Filter Applied Container */}
              <div
                className="w-full h-full relative transition-transform duration-300 ease-out flex items-center justify-center"
                style={{
                  transform: `scale(${zoom})`,
                  filter:
                    visionMode === 'IR_SIM'
                      ? 'grayscale(100%) contrast(140%) brightness(120%) sepia(100%) hue-rotate(85deg) saturate(320%)'
                      : visionMode === 'FLIR_SIM'
                      ? 'contrast(200%) brightness(110%) sepia(100%) hue-rotate(280deg) saturate(500%)'
                      : 'none',
                }}
              >
                {/* Surveillance Scene Graphic */}
                <div
                  className="w-full h-full absolute inset-0"
                  style={{
                    backgroundColor:
                      visionMode === 'IR_SIM' ? '#041d0e' : visionMode === 'FLIR_SIM' ? '#110b27' : '#080d17',
                    backgroundImage: `
                      radial-gradient(circle at 50% 50%, ${
                        visionMode === 'IR_SIM' ? '#0e3a1f' : visionMode === 'FLIR_SIM' ? '#270e4e' : '#101c30'
                      } 0%, transparent 80%),
                      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '100% 100%, 28px 28px, 28px 28px',
                  }}
                >
                  {/* Subtle Iso-geometry Overlay */}
                  <svg className="w-full h-full opacity-50" viewBox="0 0 640 360">
                    <line x1="0" y1="180" x2="640" y2="180" stroke="#0ea5e9" strokeWidth="0.75" strokeDasharray="4 6" opacity="0.4" />
                    <line x1="320" y1="0" x2="320" y2="360" stroke="#0ea5e9" strokeWidth="0.75" strokeDasharray="4 6" opacity="0.4" />
                    <circle cx="320" cy="180" r="120" fill="none" stroke="#0ea5e9" strokeWidth="0.75" strokeDasharray="3 5" opacity="0.3" />
                    <circle cx="320" cy="180" r="40" fill="none" stroke="#0ea5e9" strokeWidth="1" opacity="0.5" />
                    <circle cx="320" cy="180" r="3" fill="#ef4444" />
                  </svg>
                </div>
              </div>

              {/* Top Viewport HUD Overlay */}
              <div className="absolute top-3 inset-x-4 z-10 flex items-start justify-between text-xs font-mono text-cyan-300 drop-shadow pointer-events-none">
                <div>
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>{activeCam.name}</span>
                    <span className="text-xs px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                      {activeCam.id}
                    </span>
                  </div>
                  <div className="text-slate-300 text-xs mt-0.5">
                    {activeCam.location}
                  </div>
                  <div className="text-yellow-300 text-xs font-semibold mt-0.5">
                    POS: {activeCam.lat.toFixed(5)}°N, {activeCam.lng.toFixed(5)}°E
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-white font-bold">{currentTime}</div>
                  <div className="text-emerald-400 font-semibold mt-0.5">
                    HEADING: {activeCam.heading}° {getCardinal(activeCam.heading)} | FOV: {activeCam.fov}°
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    RANGE: ~{activeCam.rangeMeters}m | ZOOM: {zoom}X
                  </div>
                </div>
              </div>

              {/* Bottom Stream Source & Telemetry Bar */}
              <div className="absolute bottom-3 inset-x-4 z-10 flex items-center justify-between text-xs font-mono text-slate-300 bg-slate-900/85 px-3 py-1.5 rounded-lg border border-slate-800 pointer-events-none">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>STREAM: <strong className="text-white">SIMULATED TEST PATTERN</strong></span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  RTSP/HLS INTEGRATION READY
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: CAMERA POSITION & ORIENTATION CONTROLS (COL-SPAN-4) */}
          <div className="col-span-12 lg:col-span-4 p-4 space-y-4 overflow-y-auto bg-slate-900/70 custom-scrollbar">
            
            {/* Group 1: Camera Identification & Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-cyan-400" />
                  <span>A. Camera Information</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">{activeCam.id}</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Camera Name</label>
                <input
                  type="text"
                  value={activeCam.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Sector / Location Label</label>
                <input
                  type="text"
                  value={activeCam.location}
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Operational Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['ACTIVE', 'STANDBY', 'MAINTENANCE'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleFieldChange('status', st)}
                      className={`py-1 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                        activeCam.status === st
                          ? st === 'ACTIVE'
                            ? 'bg-emerald-600 text-slate-950 border-emerald-400 font-bold'
                            : st === 'STANDBY'
                            ? 'bg-amber-600 text-slate-950 border-amber-400 font-bold'
                            : 'bg-slate-700 text-white border-slate-500 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Group 2: Geographic Position Coordinates */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span>B. Geographic Coordinates</span>
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-mono">LATITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={activeCam.lat}
                    onChange={(e) => handleFieldChange('lat', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-mono">LONGITUDE</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={activeCam.lng}
                    onChange={(e) => handleFieldChange('lng', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Camera position is visually synchronized with the interactive map marker.
              </p>
            </div>

            {/* Group 3: Camera Orientation & Dynamic Coverage Sector */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>C. Viewing Sector & Heading</span>
                </h3>
              </div>

              {/* Direction Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Direction / Heading</span>
                  <span className="font-mono text-cyan-400 font-bold">
                    {activeCam.heading}° {getCardinal(activeCam.heading)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={activeCam.heading}
                  onChange={(e) => handleFieldChange('heading', parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Field of View Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Field of View (FOV)</span>
                  <span className="font-mono text-cyan-400 font-bold">{activeCam.fov}°</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  value={activeCam.fov}
                  onChange={(e) => handleFieldChange('fov', parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Coverage Range Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Coverage Range</span>
                  <span className="font-mono text-cyan-400 font-bold">{activeCam.rangeMeters} meters</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1200"
                  step="50"
                  value={activeCam.rangeMeters}
                  onChange={(e) => handleFieldChange('rangeMeters', parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Adjusting heading or FOV dynamically updates the visual coverage sector on the map.
              </p>
            </div>

            {/* Group 4: Stream Architecture & Hardware Readiness */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>D. Real Stream Integration</span>
                </h3>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Feed Source Protocol</label>
                <select
                  value={activeCam.sourceType || 'simulation'}
                  onChange={(e) => handleFieldChange('sourceType', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="simulation">Simulated Test Pattern</option>
                  <option value="rtsp">RTSP Stream (Direct Gateway)</option>
                  <option value="hls">HLS (HTTP Live Streaming)</option>
                  <option value="webrtc">WebRTC Low-Latency Stream</option>
                </select>
              </div>

              {activeCam.sourceType !== 'simulation' && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Stream Endpoint URL</label>
                  <input
                    type="text"
                    value={activeCam.streamUrl || ''}
                    onChange={(e) => handleFieldChange('streamUrl', e.target.value)}
                    placeholder="rtsp://gateway.local:554/live or https://..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}
            </div>

          </div>

        </div>

        {/* =============================================================== */}
        {/* FOOTER ACTION BAR                                               */}
        {/* =============================================================== */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex justify-between items-center text-xs">
          <div className="text-slate-400">
            Selected: <strong className="text-white">{activeCam.name}</strong> ({activeCam.id}) •{' '}
            <span className="text-cyan-400">{activeCam.heading}° {getCardinal(activeCam.heading)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Close Control Center
          </button>
        </div>

      </div>
    </div>
  )
}

export default CCTVControlCenter
