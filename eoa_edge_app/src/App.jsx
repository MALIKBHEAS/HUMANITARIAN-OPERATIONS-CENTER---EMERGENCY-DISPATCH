import React, { useState, useEffect, useRef } from 'react'
import {
  ShieldAlert,
  Radio,
  Wifi,
  WifiOff,
  Navigation,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  Activity,
  Satellite
} from 'lucide-react'
import { transmitEmergencySos } from './services/api'

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. Connection & GPS Geolocation State
  // ---------------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [gpsState, setGpsState] = useState({
    locked: false,
    lat: null,
    lon: null,
    accuracy: null,
    altitude: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
  })

  // Transmission State: 'IDLE' | 'TRANSMITTING' | 'DISPATCHED' | 'FAILED'
  const [dispatchStatus, setDispatchStatus] = useState('IDLE')
  const [lastIncident, setLastIncident] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [isFlashing, setIsFlashing] = useState(false)
  const watchIdRef = useRef(null)

  // ---------------------------------------------------------------------------
  // 2. Network Status Synchronization
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 3. Continuous Geolocation Tracking (watchPosition)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsState(prev => ({ ...prev, error: 'GEOLOCATION_UNAVAILABLE' }))
      return
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000,
    }

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy, altitude, heading, speed } = position.coords
      setGpsState({
        locked: true,
        lat: latitude,
        lon: longitude,
        accuracy: Math.round(accuracy),
        altitude: altitude ? Math.round(altitude) : null,
        heading: heading ? Math.round(heading) : null,
        speed: speed ? Math.round(speed * 3.6) : null,
        timestamp: new Date(position.timestamp).toLocaleTimeString(),
        error: null,
      })
    }

    const handleError = (error) => {
      console.warn('[GPS Telemetry] Geolocation notice:', error.message)
      setGpsState(prev => ({
        ...prev,
        locked: false,
        error: error.code === 1 ? 'GPS_PERMISSION_DENIED' : 'ACQUIRING_SATELLITE_LOCK',
      }))
    }

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions)

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // ---------------------------------------------------------------------------
  // 4. Trigger SOS / Duress Dispatch
  // ---------------------------------------------------------------------------
  const handleTriggerSos = async () => {
    if (dispatchStatus === 'TRANSMITTING') return

    // Trigger visual feedback (Screen flashes red)
    setIsFlashing(true)
    setDispatchStatus('TRANSMITTING')
    setErrorMessage(null)

    // Hardware vibration feedback for field mobile operative
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([300, 150, 300, 150, 500])
      } catch (_) {}
    }

    // Coordinates fallback (HQ Default: 31.5273, 35.0946 if GPS is acquiring)
    const effectiveLat = gpsState.lat !== null ? gpsState.lat : 31.5273
    const effectiveLon = gpsState.lon !== null ? gpsState.lon : 35.0946

    try {
      const response = await transmitEmergencySos({
        lat: effectiveLat,
        lon: effectiveLon,
        description: 'CRITICAL: Field Operative Emergency Dispatch Request.',
        securityToken: 'edge_mobile_alpha_01',
      })

      setLastIncident(response)
      setDispatchStatus('DISPATCHED')

      // Stop flashing after 3.5s, keep DISPATCHED state visible
      setTimeout(() => {
        setIsFlashing(false)
      }, 3500)

      // Reset to IDLE after 10s for subsequent transmission readiness
      setTimeout(() => {
        setDispatchStatus('IDLE')
      }, 10000)
    } catch (err) {
      console.error('[Emergency Dispatch Failed]', err)
      setDispatchStatus('FAILED')
      setIsFlashing(false)
      setErrorMessage(err.message || 'CARRIER_TRANSMISSION_REJECTED')
      
      // Auto-reset from failed state after 4s
      setTimeout(() => {
        setDispatchStatus('IDLE')
      }, 4000)
    }
  }

  return (
    <div
      className={`relative w-full h-[100dvh] bg-[#05070a] text-slate-100 flex flex-col justify-between tactical-grid-bg transition-colors duration-300 overflow-hidden ${
        isFlashing ? 'bg-red-950/40 ring-inset ring-8 ring-red-600/60' : ''
      }`}
    >
      {/* Red Alert Flash Strobe Overlay */}
      {isFlashing && (
        <div className="absolute inset-0 bg-red-600/20 animate-screen-flash pointer-events-none z-50" />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP STATUS BAR: Connection, GPS Lock & Tactical Call-Sign       */}
      {/* ----------------------------------------------------------------- */}
      <header className="w-full bg-[#0a0e17]/95 border-b border-slate-800/80 px-4 py-3 shrink-0 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          {/* Left: Device Telemetry & Call-Sign */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/60 flex items-center justify-center text-red-400">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-bold tracking-wider text-slate-200 uppercase">
                  EDGE-01 // FIELD OPS
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-400 inline" />
                C4ISR SOVEREIGN LINK
              </div>
            </div>
          </div>

          {/* Right: Network & GPS Satellite Indicators */}
          <div className="flex items-center gap-2">
            {/* GPS Signal Lock Badge */}
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-mono font-semibold uppercase transition-all ${
                gpsState.locked
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse'
              }`}
            >
              <Satellite className="w-3 h-3" />
              <span>{gpsState.locked ? `GPS LOCK (±${gpsState.accuracy}M)` : 'GPS ACQUIRING'}</span>
            </div>

            {/* Carrier Network Badge */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono font-semibold uppercase ${
                isOnline
                  ? 'bg-slate-900 border-slate-700 text-cyan-400'
                  : 'bg-red-950 border-red-600 text-red-300'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* 2. CENTER: Massive High-Contrast EMERGENCY SOS // DURESS Button    */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        {/* Tactical Sub-Notice */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/50 border border-red-500/30 text-red-400 text-xs font-mono tracking-widest uppercase mb-2">
            <Lock className="w-3 h-3" /> DIRECT SATELLITE DISPATCH TUNNEL
          </div>
          <h1 className="text-base sm:text-lg font-mono font-bold text-slate-200 tracking-wider uppercase">
            HUMANITARIAN FIELD EMERGENCY
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            Tap button below to transmit emergency duress beacon with real-time GPS coordinates directly to EOC.
          </p>
        </div>

        {/* The Massive Tactical SOS Button */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Outer Pulsing Aura Ring */}
          <div
            className={`absolute rounded-full pointer-events-none transition-all duration-700 ${
              dispatchStatus === 'TRANSMITTING'
                ? 'w-72 h-72 sm:w-80 sm:h-80 bg-red-600/30 animate-ping'
                : 'w-64 h-64 sm:w-72 sm:h-72 bg-red-600/10 animate-duress-pulse'
            }`}
          />

          {/* Secondary Concentric Radar Ring */}
          <div className="absolute w-56 h-56 sm:w-64 sm:h-64 rounded-full border border-red-500/30 border-dashed animate-spin [animation-duration:18s] pointer-events-none" />

          {/* Core Interactive SOS Button */}
          <button
            type="button"
            onClick={handleTriggerSos}
            disabled={dispatchStatus === 'TRANSMITTING'}
            className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center p-4 border-4 transition-all duration-200 active:scale-95 shadow-2xl z-10 ${
              dispatchStatus === 'DISPATCHED'
                ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-400 text-white shadow-emerald-900/80 ring-8 ring-emerald-500/30'
                : dispatchStatus === 'TRANSMITTING'
                ? 'bg-gradient-to-b from-amber-600 to-red-700 border-amber-300 text-white shadow-red-900/90 scale-95 ring-8 ring-red-500/50'
                : dispatchStatus === 'FAILED'
                ? 'bg-gradient-to-b from-slate-800 to-red-900 border-red-400 text-white shadow-red-950 ring-4 ring-red-500/20'
                : 'bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 active:from-red-700 active:to-red-900 border-red-400 text-white shadow-red-950/80 ring-8 ring-red-600/30'
            }`}
          >
            {/* Visual Icon based on Transmission State */}
            {dispatchStatus === 'DISPATCHED' ? (
              <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 mb-2 drop-shadow" />
            ) : dispatchStatus === 'TRANSMITTING' ? (
              <Activity className="w-16 h-16 sm:w-20 sm:h-20 mb-2 animate-bounce drop-shadow" />
            ) : dispatchStatus === 'FAILED' ? (
              <AlertTriangle className="w-16 h-16 sm:w-20 sm:h-20 mb-2 text-amber-300 drop-shadow" />
            ) : (
              <ShieldAlert className="w-16 h-16 sm:w-20 sm:h-20 mb-2 drop-shadow animate-pulse" />
            )}

            {/* Button Label */}
            <span className="font-mono font-black text-sm sm:text-base tracking-widest text-center uppercase drop-shadow-md">
              {dispatchStatus === 'TRANSMITTING'
                ? 'TRANSMITTING...'
                : dispatchStatus === 'DISPATCHED'
                ? 'DISPATCHED!'
                : dispatchStatus === 'FAILED'
                ? 'RETRY DISPATCH'
                : 'EMERGENCY SOS // DURESS'}
            </span>

            <span className="text-[10px] font-mono tracking-wider text-red-200 mt-1 uppercase opacity-90">
              {dispatchStatus === 'TRANSMITTING'
                ? 'CONNECTING EOC'
                : dispatchStatus === 'DISPATCHED'
                ? 'UNITS MOBILIZED'
                : dispatchStatus === 'FAILED'
                ? 'TRANSMISSION FAILED'
                : 'PRESS TO BROADCAST'}
            </span>
          </button>
        </div>

        {/* Post-Transmission Dispatch Feedback Card */}
        {dispatchStatus === 'DISPATCHED' && lastIncident && (
          <div className="w-full max-w-sm mt-4 p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl backdrop-blur text-xs font-mono text-emerald-200 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-emerald-800/60 mb-2">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> DISPATCH ACKNOWLEDGED
              </span>
              <span className="text-[11px] text-emerald-400 font-bold">
                {lastIncident.incident_id || 'INC-CONFIRMED'}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">STATUS:</span>
                <span className="font-bold text-emerald-400">UNITS EN ROUTE</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAX ETA:</span>
                <span className="font-bold text-white">~{lastIncident.response_time_eta_max_minutes || 4.0} MIN</span>
              </div>
              {lastIncident.units_assigned?.hospital && (
                <div className="flex justify-between">
                  <span className="text-slate-400">MEDICAL:</span>
                  <span className="truncate max-w-[190px] text-right font-medium text-slate-200">
                    {lastIncident.units_assigned.hospital}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Feedback Card */}
        {dispatchStatus === 'FAILED' && (
          <div className="w-full max-w-sm mt-4 p-3 bg-red-950/80 border border-red-500/60 rounded-xl backdrop-blur text-xs font-mono text-red-200 animate-in fade-in">
            <div className="flex items-center gap-1.5 font-bold text-red-400 mb-1">
              <AlertTriangle className="w-4 h-4" /> TRANSMISSION REJECTED
            </div>
            <p className="text-[11px] text-slate-300">
              {errorMessage || 'Failed to reach EOC Gateway. Check connection.'}
            </p>
          </div>
        )}
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* 3. BOTTOM BAR: Read-only GPS Telemetry & Geographic Coordinates   */}
      {/* ----------------------------------------------------------------- */}
      <footer className="w-full bg-[#0a0e17]/95 border-t border-slate-800/80 px-4 py-3 shrink-0 backdrop-blur z-20">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase mb-1.5">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3 text-cyan-400" />
              LIVE TELEMETRY STREAM
            </span>
            <span>
              {gpsState.timestamp ? `LAST SYNC: ${gpsState.timestamp}` : 'CONNECTING GPS...'}
            </span>
          </div>

          {/* Coordinate Readout Cards */}
          <div className="grid grid-cols-2 gap-2 font-mono">
            {/* Latitude Display */}
            <div className="bg-[#05070a] border border-slate-800 rounded-lg px-2.5 py-1.5 flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                LATITUDE
              </span>
              <span className="text-xs sm:text-sm font-bold text-cyan-300 truncate">
                {gpsState.lat !== null ? Number(gpsState.lat).toFixed(6) : '31.527300 (EST)'}
              </span>
            </div>

            {/* Longitude Display */}
            <div className="bg-[#05070a] border border-slate-800 rounded-lg px-2.5 py-1.5 flex flex-col">
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                LONGITUDE
              </span>
              <span className="text-xs sm:text-sm font-bold text-cyan-300 truncate">
                {gpsState.lon !== null ? Number(gpsState.lon).toFixed(6) : '35.094600 (EST)'}
              </span>
            </div>
          </div>

          {/* Secondary Telemetry: Altitude, Heading, Speed */}
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 mt-2 px-0.5">
            <span>ACCURACY: ±{gpsState.accuracy ?? 15}M</span>
            <span>ALT: {gpsState.altitude !== null ? `${gpsState.altitude}M` : 'SEA LEVEL'}</span>
            <span>BEARING: {gpsState.heading !== null ? `${gpsState.heading}°` : '360° N'}</span>
            <span>VEL: {gpsState.speed !== null ? `${gpsState.speed} KM/H` : '0 KM/H'}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
