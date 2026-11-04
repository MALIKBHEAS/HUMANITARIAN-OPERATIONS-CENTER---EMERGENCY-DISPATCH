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
  LogOut,
  Layers,
  Activity,
  Satellite,
  User,
  Flame,
} from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './Login'
import { transmitEmergencySos } from './services/api'

function TacticalEdgeDashboard() {
  const { user, token, logout } = useAuth()

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
  // 3. Continuous Geolocation Tracking (watchPosition) - ONLY RUNS WHEN AUTHENTICATED
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsState((prev) => ({ ...prev, error: 'GEOLOCATION_UNAVAILABLE' }))
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
      setGpsState((prev) => ({
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
  // 4. Trigger SOS / Duress Dispatch with Enriched Operative Payload
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

    // Coordinates fallback (HQ Default: 31.5273, 35.0946 if GPS is still acquiring)
    const effectiveLat = gpsState.lat !== null ? gpsState.lat : 31.5273
    const effectiveLon = gpsState.lon !== null ? gpsState.lon : 35.0946

    const operativeCallsign =
      user?.callsign ||
      user?.name ||
      (user?.email ? `Operative ${user.email.split('@')[0]}` : 'Operative field1')

    try {
      const response = await transmitEmergencySos({
        lat: effectiveLat,
        lon: effectiveLon,
        description: `CRITICAL FIELD SOS: Triggered by ${operativeCallsign}. Direct sovereign dispatch order.`,
        user: user,
        tokenOverride: token,
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

  const operativeName =
    user?.callsign ||
    user?.name ||
    (user?.email ? `OPERATIVE: ${user.email.split('@')[0].toUpperCase()}` : 'OPERATIVE: FIELD1')

  return (
    <div
      className={`relative w-full h-[100dvh] bg-[#05070a] text-slate-100 flex flex-col justify-between tactical-grid-bg transition-colors duration-300 overflow-hidden font-mono select-none ${
        isFlashing ? 'bg-red-950/50 ring-inset ring-8 ring-red-600/70' : ''
      }`}
    >
      {/* Red Alert Flash Strobe Overlay */}
      {isFlashing && (
        <div className="absolute inset-0 bg-red-600/25 animate-screen-flash pointer-events-none z-50" />
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP STATUS BAR: Operative Call-sign, Network, GPS Lock         */}
      {/* ----------------------------------------------------------------- */}
      <header className="w-full bg-[#0a0e17]/95 border-b border-slate-800/80 px-4 py-3 shrink-0 backdrop-blur z-20">
        <div className="flex items-center justify-between">
          {/* Left: Device Telemetry & Call-Sign */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-950/90 border border-red-500/70 flex items-center justify-center text-red-400 shadow-md shadow-red-950">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wider text-slate-100 uppercase">
                  {operativeName}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-500/60 text-amber-300">
                  {user?.role || 'FIELD_UNIT'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-red-400 inline" />
                <span>C4ISR SECURE SATELLITE TUNNEL</span>
              </div>
            </div>
          </div>

          {/* Right: GPS Satellite Indicators & Session Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* GPS Signal Lock Badge */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold uppercase transition-all ${
                gpsState.locked
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse'
              }`}
            >
              <Satellite className="w-3 h-3" />
              <span>{gpsState.locked ? `GPS ±${gpsState.accuracy}M` : 'GPS ACQUIRING'}</span>
            </div>

            {/* Carrier Network Badge */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold uppercase ${
                isOnline
                  ? 'bg-slate-900 border-slate-700 text-cyan-400'
                  : 'bg-red-950 border-red-600 text-red-300'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              <span className="hidden sm:inline">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </div>

            {/* Session Decommission Button */}
            <button
              type="button"
              onClick={logout}
              className="p-2 rounded-lg bg-slate-900 hover:bg-red-950 border border-slate-700 hover:border-red-500 text-slate-400 hover:text-red-300 transition-all cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="Decommission Session / Lock Terminal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* 2. CENTER: Massive High-Contrast EMERGENCY SOS // DURESS Button    */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
        {/* Tactical Sub-Notice */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/70 border border-red-500/40 text-red-300 text-[10px] tracking-widest uppercase mb-2">
            <Lock className="w-3 h-3 text-red-400" /> DIRECT SATELLITE DISPATCH TUNNEL
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-wider uppercase">
            HUMANITARIAN FIELD EMERGENCY
          </h1>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 font-sans">
            Press and hold or tap to transmit live duress telemetry directly to Central EOC.
          </p>
        </div>

        {/* SOS Button Cluster */}
        <div className="relative flex items-center justify-center my-2">
          {/* Pulsing Concentric Warning Rings */}
          <div className="absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-red-500/20 animate-ping pointer-events-none" />
          <div className="absolute w-52 h-52 sm:w-68 sm:h-68 rounded-full border-2 border-red-500/30 animate-pulse pointer-events-none" />

          {/* Central Massive High-Contrast Action Button */}
          <button
            type="button"
            onClick={handleTriggerSos}
            disabled={dispatchStatus === 'TRANSMITTING'}
            className={`relative w-48 h-48 sm:w-60 sm:h-60 rounded-full border-4 flex flex-col items-center justify-center text-center transition-all duration-150 shadow-2xl cursor-pointer active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${
              dispatchStatus === 'TRANSMITTING'
                ? 'bg-amber-600 border-amber-400 shadow-amber-950/80 animate-pulse'
                : dispatchStatus === 'DISPATCHED'
                ? 'bg-emerald-600 border-emerald-400 shadow-emerald-950/80'
                : dispatchStatus === 'FAILED'
                ? 'bg-red-800 border-red-400 shadow-red-950/90'
                : 'bg-red-600 hover:bg-red-500 border-red-400 shadow-red-950/90 hover:shadow-red-700/50'
            }`}
          >
            {dispatchStatus === 'TRANSMITTING' ? (
              <div className="flex flex-col items-center gap-2 p-2">
                <span className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-sm sm:text-base font-black tracking-widest text-white uppercase">
                  TRANSMITTING
                </span>
                <span className="text-[10px] text-amber-100 uppercase tracking-wider">
                  ENCRYPTING DISPATCH...
                </span>
              </div>
            ) : dispatchStatus === 'DISPATCHED' ? (
              <div className="flex flex-col items-center gap-1.5 p-2">
                <CheckCircle2 className="w-10 h-10 text-white" />
                <span className="text-sm sm:text-base font-black tracking-widest text-white uppercase">
                  DISPATCHED
                </span>
                <span className="text-[10px] text-emerald-100 uppercase tracking-wider">
                  ORDER ACKNOWLEDGED
                </span>
              </div>
            ) : dispatchStatus === 'FAILED' ? (
              <div className="flex flex-col items-center gap-1.5 p-2">
                <AlertTriangle className="w-10 h-10 text-white animate-bounce" />
                <span className="text-sm sm:text-base font-black tracking-widest text-white uppercase">
                  CARRIER FAILED
                </span>
                <span className="text-[9px] text-red-100 uppercase tracking-tight">
                  RETRY TRANSMISSION
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-pulse" />
                <span className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase">
                  EMERGENCY
                </span>
                <span className="text-sm sm:text-base font-black tracking-widest text-white uppercase">
                  SOS // DURESS
                </span>
                <span className="text-[9px] text-red-100 font-bold uppercase tracking-widest mt-1">
                  [1-CLICK DISPATCH]
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Real-Time Transmission Feedback Banner */}
        <div className="mt-6 w-full max-w-sm px-2 text-center min-h-[48px]">
          {dispatchStatus === 'DISPATCHED' && lastIncident && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs shadow-lg animate-in fade-in">
              <div className="font-bold flex items-center justify-center gap-1.5 uppercase">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>EOC DISPATCH ASSIGNED // ID: {lastIncident.incident_id || lastIncident.id}</span>
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">
                Target: {lastIncident.units_assigned?.hospital || 'Central Hospital Triage'} • ETA:{' '}
                {lastIncident.response_time_eta_max_minutes || 4} MIN
              </div>
            </div>
          )}

          {dispatchStatus === 'FAILED' && (
            <div className="p-2.5 rounded-xl bg-red-950/90 border border-red-500 text-red-300 text-xs shadow-lg animate-in fade-in">
              <div className="font-bold flex items-center justify-center gap-1.5 uppercase">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>{errorMessage || 'TRANSMISSION_FAILED: CARRIER REJECTED'}</span>
              </div>
            </div>
          )}

          {dispatchStatus === 'IDLE' && (
            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              CARRIER STANDBY // ALL EMERGENCY FREQUENCIES ACTIVE
            </div>
          )}
        </div>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* 3. BOTTOM BAR: Read-Only Acquired Telemetry Coordinates            */}
      {/* ----------------------------------------------------------------- */}
      <footer className="w-full bg-[#0a0e17]/95 border-t border-slate-800/80 px-4 py-3 shrink-0 backdrop-blur z-20">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          {/* Coordinates Display */}
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[10px]">COORDS:</span>
              <span className="font-bold text-cyan-300 tracking-wider">
                {gpsState.lat !== null
                  ? `${gpsState.lat.toFixed(5)}°N, ${gpsState.lon.toFixed(5)}°E`
                  : '31.52730°N, 35.09460°E (HQ LOCK)'}
              </span>
            </div>
          </div>

          {/* Secondary Telemetry: Altitude, Speed, Accuracy */}
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {gpsState.altitude !== null && (
              <div className="flex items-center gap-1">
                <span>ALT:</span>
                <span className="text-slate-200 font-bold">{gpsState.altitude}M</span>
              </div>
            )}
            {gpsState.speed !== null && (
              <div className="flex items-center gap-1">
                <span>SPEED:</span>
                <span className="text-slate-200 font-bold">{gpsState.speed} KM/H</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>STATUS:</span>
              <span className="text-emerald-400 font-bold">
                {gpsState.locked ? `PRECISION ±${gpsState.accuracy}M` : 'HQ PRESET (STANDBY)'}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function EdgeAppRoot() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-[100dvh] w-full bg-[#05070a] flex flex-col items-center justify-center text-red-400 font-mono text-xs gap-3">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <span className="tracking-widest uppercase">INITIALIZING EDGE CRYPTO ENCLAVE...</span>
      </div>
    )
  }

  // Zero-Trust Perimeter Guard: Login screen blocks all access to the SOS button & tracking
  if (!isAuthenticated) {
    return <Login />
  }

  return <TacticalEdgeDashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <EdgeAppRoot />
    </AuthProvider>
  )
}
