import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLiveFeed } from '../hooks/useLiveFeed'
import { useSystemHealth } from '../hooks/useSystemHealth'
import { EnterpriseMap } from '../components/EnterpriseMap'
import { CameraCoverageOverlay } from '../components/CameraCoverageOverlay'
import { CCTVControlCenter, DEFAULT_CAMERAS } from '../components/CCTVControlCenter'
import { AIIncidentFeed } from '../components/AIIncidentFeed'
import { TacticalConfirmModal } from '../components/TacticalConfirmModal'
import { apiClient } from '../services/api'
import {
  Radio,
  Building2,
  LogOut,
  Send,
  X,
  AlertCircle,
  Activity,
  Flame,
  ShieldAlert,
  Printer,
  Share2,
  Video,
  Check,
  MapPin,
  Crosshair,
  Users,
  Navigation,
  Clock,
  Compass,
  AlertTriangle,
  LocateFixed,
  Shield,
  Stethoscope,
  Wifi,
  ShieldCheck,
  HeartPulse,
} from 'lucide-react'

// Professional Humanitarian Demo Incidents for EOC Datatable (Strict English Terminology)
const DEFAULT_INCIDENTS = [
  {
    id: 'INC-ALPHA-081',
    timestamp: new Date().toISOString(),
    tenantId: 'eoa-global-hq',
    location: 'Omar Al-Mukhtar St - Central Sector',
    latitude: 31.5125,
    longitude: 34.4533,
    classification: {
      category: 'Fire',
      severity_level: 3,
      summary: 'Major structural fire in commercial/residential complex with trapped civilians, heavy smoke plume, and secondary hazards.',
    },
    status: 'ACTIVE DISPATCH',
    dispatches: [
      { agency_type: 'CivilDefense', units: 3, reasoning: 'Directing high-pressure pump tenders and structural rescue teams.' },
      { agency_type: 'Hospital', units: 2, reasoning: 'Mobilizing mobile trauma stabilization units and triage ambulances.' },
      { agency_type: 'Police', units: 2, reasoning: 'Securing outer cordon perimeter and establishing emergency transit corridor.' },
    ],
  },
  {
    id: 'INC-BETA-042',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    tenantId: 'eoa-global-hq',
    location: 'Salah Al-Din Corridor - South Sector',
    latitude: 31.4285,
    longitude: 34.3792,
    classification: {
      category: 'Rescue',
      severity_level: 4,
      summary: 'Multi-vehicle collision involving freight transport with trapped victims, severe trauma alerts, and transit corridor blockage.',
    },
    status: 'EN ROUTE',
    dispatches: [
      { agency_type: 'Hospital', units: 4, reasoning: 'Transporting critical trauma casualties to nearest surgical facility.' },
      { agency_type: 'Police', units: 3, reasoning: 'Managing transit flow and securing rapid emergency evacuation corridor.' },
    ],
  },
  {
    id: 'INC-GAMMA-019',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    tenantId: 'eoa-global-hq',
    location: 'Port Maritime Terminal - North Dock',
    latitude: 31.5278,
    longitude: 34.4312,
    classification: {
      category: 'Security',
      severity_level: 2,
      summary: 'Security perimeter breach alert and hydrocarbon leak inspection at terminal wharf. Civil protection on standby.',
    },
    status: 'STANDBY',
    dispatches: [
      { agency_type: 'CivilDefense', units: 1, reasoning: 'Pre-positioning foam suppression systems for hydrocarbon hazards.' },
      { agency_type: 'Police', units: 2, reasoning: 'Conducting wharf perimeter sweep and tactical cordon.' },
    ],
  },
]

// =============================================================================
// HUMANITARIAN EMERGENCY OPERATIONS CENTER (EOC) DASHBOARD
// =============================================================================
export const Dashboard = () => {
  const { user, logout, tenantId } = useAuth()
  const { incidents: liveIncidents, isConnected, connectionStatus, liveUnits, setLiveUnits } = useLiveFeed()

  // Real-time Independent System Health Monitor
  const systemHealth = useSystemHealth(connectionStatus || (isConnected ? 'connected' : 'disconnected'))

  const incidents = liveIncidents && liveIncidents.length > 0
    ? liveIncidents
    : DEFAULT_INCIDENTS

  const [activeIncident, setActiveIncident] = useState(incidents[0])
  const [routingTelemetry, setRoutingTelemetry] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  // Real-time UTC & Local Clock
  const [currentTime, setCurrentTime] = useState('')
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const utcString = now.toISOString().slice(11, 19) + 'Z'
      const locString = now.toLocaleTimeString('en-US', { hour12: false })
      setCurrentTime(`UTC: ${utcString} | LOC: ${locString}`)
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Modals & Unified CCTV Control Center state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isCCTVControlCenterOpen, setIsCCTVControlCenterOpen] = useState(false)
  const [cameras, setCameras] = useState(DEFAULT_CAMERAS)
  const [activeCameraId, setActiveCameraId] = useState(DEFAULT_CAMERAS[0].id)

  // ===========================================================================
  // TARGETING MODE & DYNAMIC COORDINATE CAPTURE STATE
  // ===========================================================================
  const [isTargetingMode, setIsTargetingMode] = useState(false)
  const [pendingDispatchType, setPendingDispatchType] = useState('SOS_DURESS')
  const [pendingSeverity, setPendingSeverity] = useState(5)
  const [pendingTargetCoords, setPendingTargetCoords] = useState(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isTransmitting, setIsTransmitting] = useState(false)

  // Memoized routing telemetry handler to prevent cascading render loops
  const handleRoutingResolved = useCallback((data) => {
    setRoutingTelemetry((prev) => {
      if (
        prev &&
        prev.hospitalName === data?.hospitalName &&
        prev.distanceKm === data?.distanceKm &&
        prev.etaMin === data?.etaMin
      ) {
        return prev
      }
      return data
    })
  }, [])

  useEffect(() => {
    if (incidents.length > 0 && !activeIncident) {
      setActiveIncident(incidents[0])
    }
  }, [incidents, activeIncident])

  const triggerToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3800)
  }

  const handlePrintReport = () => setIsPrintModalOpen(true)

  const handleShareCoordinates = () => {
    const lat = activeIncident?.latitude || activeIncident?.lat || 31.5125
    const lng = activeIncident?.longitude || activeIncident?.lng || 34.4533
    const text = `EOC-COORDS: ${lat.toFixed(6)}, ${lng.toFixed(6)} [${activeIncident?.location || 'Target Sector'}]`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      triggerToast('INCIDENT COORDINATES COPIED TO CLIPBOARD')
    } else {
      triggerToast(text)
    }
  }

  // Camera Management Handlers
  const handleUpdateCamera = useCallback((updatedCam) => {
    setCameras((prev) =>
      prev.map((c) => (c.id === updatedCam.id ? { ...c, ...updatedCam } : c))
    )
  }, [])

  const handleSelectCamera = useCallback((cam) => {
    setActiveCameraId(cam.id)
    setIsCCTVControlCenterOpen(true)
  }, [])

  // ===========================================================================
  // CORE WORKFLOW OVERRIDE: LOCATION AFTER REQUEST
  // Step 1: User clicks SOS or New Incident -> enters Targeting Mode
  // ===========================================================================
  const startTargetingWorkflow = (type = 'SOS_DURESS', severity = 5) => {
    setPendingDispatchType(type)
    setPendingSeverity(severity)
    setIsTargetingMode(true)
    triggerToast('TARGET ACQUISITION ACTIVE: CLICK MAP OR FETCH GPS TO LOCK COORDINATES')
  }

  // Step 2: Location dynamically captured from Map Click or Live GPS
  const handleLocationAcquired = (coords, label = 'ACQUIRED TARGET GRID') => {
    setPendingTargetCoords({
      lat: coords.lat,
      lng: coords.lng,
      location: label,
    })
    setIsTargetingMode(false)
    setIsConfirmModalOpen(true)
  }

  // Step 2-B: Fetch Live GPS from Navigator
  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      triggerToast('GEOLOCATION NOT SUPPORTED: CLICK DIRECTLY ON TACTICAL MAP')
      return
    }
    triggerToast('ACQUIRING LIVE OPERATOR GPS TELEMETRY...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleLocationAcquired(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          'LIVE OPERATOR GPS POSITION'
        )
      },
      (err) => {
        triggerToast(`GPS ACQUISITION FAILED (${err.message}): CLICK MAP DIRECTLY`)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  // Step 3: Confirmation Modal Transmit Action -> Execute API Dispatch
  const handleExecuteDispatch = async () => {
    if (!pendingTargetCoords) return
    setIsTransmitting(true)

    try {
      const payload = {
        type: pendingDispatchType || 'SOS_DURESS',
        severity_level: pendingSeverity || 5,
        description:
          pendingDispatchType === 'SOS_DURESS'
            ? 'CRITICAL OPERATOR DURESS / SOS BROADCAST - Autonomous emergency response units dispatched to target coordinates.'
            : 'EMERGENCY DISPATCH - Rapid response forces deployed.',
        lat: pendingTargetCoords.lat,
        lon: pendingTargetCoords.lng,
        required_beds: 5,
        security_token: 'valid_token_c4isr_verified',
      }

      await apiClient.sendIncident(payload)
      triggerToast('CRITICAL DISPATCH TRANSMITTED // UNITS MOBILIZED TO TARGET')
      setIsConfirmModalOpen(false)
      setPendingTargetCoords(null)
    } catch (err) {
      triggerToast(`TRANSMISSION ERROR: ${err.message}`)
    } finally {
      setIsTransmitting(false)
    }
  }

  return (
    <div
      dir="ltr"
      className="h-screen w-screen bg-[#07090e] text-slate-100 flex flex-col font-sans overflow-hidden select-none"
    >
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP HUMANITARIAN EOC COMMAND HEADER                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="h-12 bg-[#0c1017] border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between shrink-0">
        {/* Left: Operations Center Identification */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/80 flex items-center justify-center text-red-400 shadow-sm shadow-red-950">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-white text-xs sm:text-sm tracking-wide uppercase">
              HUMANITARIAN OPERATIONS CENTER // EMERGENCY DISPATCH
            </span>
            <span className="hidden md:inline px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-cyan-300 border border-cyan-800">
              EOC LEVEL-1 READY
            </span>
            <span className="hidden lg:inline text-xs text-slate-400 font-mono">
              TENANT: <span className="text-white font-bold">{tenantId || user?.tenant_id || 'HQ-COMMAND'}</span>
            </span>
          </div>
        </div>

        {/* Center: Live Real-Time Clock Synchronization */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono font-bold text-slate-300 bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>{currentTime}</span>
        </div>

        {/* Right: Operational Health & Dispatch Triggers */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Independent System Health Indicators */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Primary System Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  systemHealth.overallStatus === 'ONLINE'
                    ? 'bg-emerald-400 animate-pulse'
                    : systemHealth.overallStatus === 'DEGRADED'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-red-500'
                }`}
              />
              <span className="text-slate-400 font-bold uppercase text-[10px]">SYS:</span>
              <span
                className={`font-black uppercase text-xs ${
                  systemHealth.overallStatus === 'ONLINE'
                    ? 'text-emerald-400'
                    : systemHealth.overallStatus === 'DEGRADED'
                    ? 'text-amber-300'
                    : 'text-red-400'
                }`}
              >
                {systemHealth.overallStatus}
              </span>
            </div>

            {/* REST API Status & Latency */}
            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  systemHealth.apiStatus === 'ONLINE' ? 'bg-emerald-400' : 'bg-red-500'
                }`}
              />
              <span className="text-slate-400 text-[10px]">API:</span>
              <span className="text-slate-200 font-bold text-xs">{systemHealth.apiStatus}</span>
              {systemHealth.apiLatencyMs !== null && (
                <span className="text-cyan-400 font-mono text-[11px]">({systemHealth.apiLatencyMs}ms)</span>
              )}
            </div>

            {/* WebSocket Stream */}
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  systemHealth.wsStatus === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-400 text-[10px]">FEED:</span>
              <span className="text-slate-200 font-bold text-xs">{systemHealth.wsStatus}</span>
            </div>

            {/* Last Sync */}
            {systemHealth.lastSyncTime && (
              <div className="hidden 2xl:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-400 font-mono">
                <span>SYNC:</span>
                <span className="text-slate-200">{systemHealth.lastSyncTime}</span>
              </div>
            )}
          </div>

          {/* New Incident Dispatch Trigger -> Enters Targeting Mode */}
          <button
            type="button"
            onClick={() => startTargetingWorkflow('FIRE', 4)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-sans font-bold text-xs tracking-wider transition-all border border-slate-700 hover:border-cyan-400 cursor-pointer min-h-[36px]"
            title="Create New Incident via Map Targeting"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">NEW INCIDENT</span>
          </button>

          {/* Prominent Red Emergency Duress / SOS Button -> Enters Targeting Mode */}
          <button
            type="button"
            onClick={() => startTargetingWorkflow('SOS_DURESS', 5)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white font-sans font-black text-xs tracking-wider transition-all border-2 border-red-400 shadow-lg shadow-red-950/80 animate-pulse hover:animate-none cursor-pointer min-h-[36px]"
            title="Immediate Operator Duress / Emergency SOS Broadcast"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <Flame className="w-3.5 h-3.5" />
            <span>[EMERGENCY SOS]</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Terminate Terminal Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* TARGET ACQUISITION HUD STRIP (ACTIVE WHEN TARGETING MODE IS ON)    */}
      {/* ----------------------------------------------------------------- */}
      {isTargetingMode && (
        <div className="bg-red-950/95 border-b-2 border-red-500 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl shadow-red-950 animate-in slide-in-from-top duration-200 z-30">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white animate-spin">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <span>TARGET ACQUISITION MODE ACTIVE</span>
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                  {pendingDispatchType}
                </span>
              </div>
              <p className="text-xs text-red-200 font-medium mt-0.5">
                CLICK ANY POSITION ON THE MAP TO ACQUIRE TARGET COORDINATES OR CAPTURE LIVE GPS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFetchGPS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white font-sans font-bold text-xs uppercase border border-cyan-400 shadow-sm transition-all cursor-pointer min-h-[36px]"
            >
              <LocateFixed className="w-3.5 h-3.5 text-cyan-200" />
              <span>ACQUIRE GPS POSITION</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTargetingMode(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-sans font-bold text-xs uppercase border border-slate-600 transition-all cursor-pointer min-h-[36px]"
            >
              <X className="w-3.5 h-3.5" />
              <span>ABORT TARGETING</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. MAIN 12-COLUMN RIGID GRID LAYOUT                                */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 grid grid-cols-12 gap-1 p-1 overflow-hidden">
        {/* =============================================================== */}
        {/* LEFT / SIDE PANEL: AI INCIDENTS & READINESS (COL-SPAN-4)         */}
        {/* =============================================================== */}
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-1 overflow-hidden h-full">
          {/* Top Panel: AI Incident Queue */}
          <div className="flex-1 overflow-hidden border border-slate-800 bg-[#0d1117]">
            <AIIncidentFeed
              incidents={incidents}
              activeIncident={activeIncident}
              onSelectIncident={setActiveIncident}
            />
          </div>

          {/* Bottom Panel: Live Mobilized Emergency Units */}
          <div className="h-48 shrink-0 border border-slate-800 bg-[#0d1117] p-2.5 flex flex-col overflow-hidden text-xs">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 font-bold">
              <span className="text-yellow-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                EMERGENCY UNITS // TELEMETRY
              </span>
              <span className="text-[10px] text-emerald-400 px-1.5 py-0.5 rounded bg-slate-950 border border-emerald-500/40 font-mono font-bold">
                {liveUnits?.length || 3} MOBILIZED
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar">
              {(liveUnits || []).map((u) => (
                <div
                  key={u.id}
                  className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: u.agencyColor || '#0077ff' }}
                    />
                    <div>
                      <span className="text-white font-bold text-xs">{u.callsign || u.id}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">({u.type})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-yellow-300">
                      {u.lat.toFixed(3)}°N, {u.lng.toFixed(3)}°E
                    </span>
                    <span
                      className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        color: u.agencyColor || '#00ffcc',
                        backgroundColor: `${u.agencyColor || '#00ffcc'}15`,
                        border: `1px solid ${u.agencyColor || '#00ffcc'}40`,
                      }}
                    >
                      {u.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* =============================================================== */}
        {/* CENTER / RIGHT VIEWPORT: MAP (TOP) + DATA MANIFEST (BOTTOM)     */}
        {/* =============================================================== */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-1 overflow-hidden h-full">
          {/* Top Panel: Dedicated Map Viewport with Isolated Camera Coverage Overlay */}
          <div className="h-[58%] border border-slate-800 bg-[#0c1017] relative overflow-hidden">
            <EnterpriseMap
              incidents={incidents}
              activeIncident={activeIncident}
              onSelectIncident={setActiveIncident}
              onRoutingResolved={handleRoutingResolved}
              liveUnits={liveUnits}
              setLiveUnits={setLiveUnits}
              isTargetingMode={isTargetingMode}
              onLocationAcquired={handleLocationAcquired}
              acquiredCoords={pendingTargetCoords}
            >
              {/* Isolated Camera Coverage Overlay (Sector Wedges + Direction Markers) */}
              <CameraCoverageOverlay
                cameras={cameras}
                activeCameraId={activeCameraId}
                onSelectCamera={handleSelectCamera}
              />
            </EnterpriseMap>
          </div>

          {/* Bottom Panel: Incident Data Grid & Unified Action Bar */}
          <div className="h-[42%] border border-slate-800 bg-[#0d1117] flex flex-col overflow-hidden text-xs">
            {/* Datatable Action Bar */}
            <div className="px-3 py-2 bg-[#141922] border-b border-slate-800 flex items-center justify-between shrink-0 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-100 uppercase tracking-wider text-xs">
                  HUMANITARIAN INCIDENT MANIFEST // FIELD OPERATIONS
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-yellow-400 font-mono font-bold text-xs">
                  {incidents.length} RECORDS LOGGED
                </span>
              </div>

              {/* Action Buttons: Print Report, Share Coords, Unified CCTV Control Center */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer min-h-[34px]"
                  title="Print Official Incident Manifest"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-300" />
                  <span>PRINT REPORT</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareCoordinates}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase border border-slate-700 hover:border-yellow-400 transition-all cursor-pointer min-h-[34px]"
                  title="Share Incident Coordinates"
                >
                  <Share2 className="w-3.5 h-3.5 text-yellow-400" />
                  <span>SHARE COORDS</span>
                </button>

                {/* Unified CCTV Control Center (Replaces scattered mode buttons) */}
                <button
                  type="button"
                  onClick={() => setIsCCTVControlCenterOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs uppercase border border-cyan-400 shadow-md transition-all cursor-pointer min-h-[34px]"
                  title="Open Unified CCTV Reconnaissance & Coverage Control Center"
                >
                  <Video className="w-4 h-4 text-cyan-200" />
                  <span>CCTV CONTROL CENTER</span>
                </button>
              </div>
            </div>

            {/* Tabular Datatable Viewport */}
            <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0f141c] text-slate-400 border-b border-slate-800 uppercase tracking-wider font-bold sticky top-0 z-10 text-[11px]">
                    <th className="py-2 px-3 text-start">PRIORITY</th>
                    <th className="py-2 px-3 text-start">TARGET SECTOR</th>
                    <th className="py-2 px-3 text-start">TYPE</th>
                    <th className="py-2 px-3 text-start">GRID COORDINATES</th>
                    <th className="py-2 px-3 text-start">DESCRIPTION / SUMMARY</th>
                    <th className="py-2 px-3 text-start">DESTINATION / ROUTE</th>
                    <th className="py-2 px-3 text-start">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-medium">
                  {incidents.map((row) => {
                    const isSelected = activeIncident?.id === row.id
                    const severity = row.classification?.severity_level || row.severity || 3
                    const lat = row.latitude || row.lat || 31.5125
                    const lng = row.longitude || row.lng || 34.4533
                    const category = row.classification?.category || row.category || 'Fire'

                    let pBadge = 'bg-emerald-950/80 text-emerald-400 border border-emerald-600'
                    if (severity >= 5) pBadge = 'bg-red-950/80 text-red-400 border border-red-600'
                    else if (severity === 4) pBadge = 'bg-orange-950/80 text-orange-400 border border-orange-600'
                    else if (severity === 3) pBadge = 'bg-amber-950/80 text-amber-300 border border-amber-600'

                    return (
                      <tr
                        key={row.id}
                        onClick={() => setActiveIncident(row)}
                        className={`transition-colors cursor-pointer text-xs ${
                          isSelected
                            ? 'bg-[#1b2432] text-white border-l-2 border-l-cyan-400'
                            : 'hover:bg-[#121721] text-slate-300'
                        }`}
                      >
                        {/* Priority Column */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${pBadge}`}>
                            P{severity}-LEVEL
                          </span>
                        </td>

                        {/* Target Location Column */}
                        <td className="py-2 px-3 whitespace-nowrap font-bold text-white">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            <span>{row.location}</span>
                          </div>
                        </td>

                        {/* Type Category Column */}
                        <td className="py-2 px-3 whitespace-nowrap text-cyan-400 font-bold uppercase">
                          {category}
                        </td>

                        {/* Grid Coordinates Column */}
                        <td className="py-2 px-3 whitespace-nowrap font-mono text-yellow-300">
                          {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                        </td>

                        {/* Description / Summary Column */}
                        <td className="py-2 px-3 max-w-sm truncate text-slate-300" title={row.classification?.summary || row.text}>
                          {row.classification?.summary || row.text || 'Emergency incident dispatched.'}
                        </td>

                        {/* Destination / Hospital Route Telemetry Column */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {isSelected && routingTelemetry ? (
                            <span className="font-mono text-cyan-300 font-bold">
                              {routingTelemetry.hospitalName} ({routingTelemetry.distanceKm} km | ETA {routingTelemetry.etaMin}m)
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono">HQ-TRAUMA-CENTER (AUTO)</span>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-950 text-emerald-300 border border-emerald-600/60 flex items-center gap-1.5 w-max">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {row.status || 'ACTIVE DISPATCH'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. MODALS AND NOTIFICATIONS                                        */}
      {/* ----------------------------------------------------------------- */}
      {/* HUD Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3500] bg-slate-900 border-2 border-yellow-400 text-yellow-300 px-4 py-2 rounded-lg text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-in fade-in zoom-in-95">
          <Check className="w-4 h-4 text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified CCTV Reconnaissance & Coverage Control Center */}
      <CCTVControlCenter
        isOpen={isCCTVControlCenterOpen}
        onClose={() => setIsCCTVControlCenterOpen(false)}
        cameras={cameras}
        activeCameraId={activeCameraId}
        onUpdateCamera={handleUpdateCamera}
        onSelectCamera={(cam) => setActiveCameraId(cam.id)}
        activeIncident={activeIncident}
      />

      {/* Human-Centered Confirmation Modal (No Native Alerts) */}
      <TacticalConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleExecuteDispatch}
        targetCoords={pendingTargetCoords}
        incidentType={pendingDispatchType}
        severity={pendingSeverity}
        isTransmitting={isTransmitting}
      />

      {/* Print Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm text-xs font-sans">
          <div className="bg-[#0f141c] border-2 border-slate-600 rounded-lg w-full max-w-lg p-5 shadow-2xl relative text-white">
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="border-b border-slate-700 pb-2 mb-3">
              <div className="text-cyan-400 font-bold uppercase text-xs tracking-wider">
                OFFICIAL HUMANITARIAN DISPATCH MANIFEST
              </div>
              <h3 className="text-base font-bold text-white mt-1">{activeIncident?.location}</h3>
            </div>
            <div className="space-y-2 bg-slate-950 p-3.5 rounded-md text-xs border border-slate-800">
              <p className="text-slate-200 leading-relaxed">
                {activeIncident?.classification?.summary || activeIncident?.text}
              </p>
              <div className="text-yellow-400 font-bold font-mono pt-1">
                PRIORITY: LEVEL {activeIncident?.classification?.severity_level || 3} // STATUS: ACTIVE
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800 mt-4">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-md bg-slate-800 text-white font-bold cursor-pointer text-xs"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  window.print()
                  setIsPrintModalOpen(false)
                }}
                className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold cursor-pointer text-xs"
              >
                PRINT MANIFEST
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
