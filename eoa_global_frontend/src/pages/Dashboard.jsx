import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useLiveFeed } from '../hooks/useLiveFeed'
import { EnterpriseMap } from '../components/EnterpriseMap'
import { AIIncidentFeed } from '../components/AIIncidentFeed'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import {
  Radio,
  Building2,
  LogOut,
  Send,
  X,
  AlertCircle,
  Activity,
  Layers,
  Sparkles,
  Flame,
  ShieldAlert,
  Printer,
  Share2,
  Video,
  Eye,
  Camera,
  Compass,
  Check,
  Crosshair,
  Volume2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Shield,
  MapPin,
  Users,
} from 'lucide-react'

// Demo Fallback Tactical Incident if no live incident has been broadcast yet
const DEFAULT_TACTICAL_INCIDENT = {
  id: 'INC-ALPHA-2026-081',
  timestamp: new Date().toISOString(),
  tenantId: 'eoa-global-hq',
  location: 'شارع عمر المختار - القطاع المركزي الرئيسي',
  latitude: 31.5125,
  longitude: 34.4533,
  classification: {
    category: 'Fire',
    severity_level: 4,
    summary:
      'حريق ضخم جداً في عمارة سكنية مع محاصرة السكان بالدخان ووجود مصابين ومخاطر انفجار غاز.',
  },
  dispatches: [
    {
      agency_type: 'CivilDefense',
      units: 3,
      reasoning: 'توجيه آليات الإطفاء ذات الضغط العالي وفرق الإنقاذ واقتحام المباني.',
    },
    {
      agency_type: 'Hospital',
      units: 2,
      reasoning: 'استنفار سيارات الإسعاف المتقدمة ووحدات الإنعاش والفرز الطبي.',
    },
    {
      agency_type: 'Police',
      units: 2,
      reasoning: 'تأمين المحيط الخارجي وإخلاء الشارع المحيط لتسهيل وصول مركبات الطوارئ.',
    },
  ],
  summary: {
    casualties: 4,
  },
}

// Preset Emergency Scenarios with Global GPS Coordinates
const DEMO_PRESETS = [
  {
    id: 'gaza_fire',
    labelAr: 'حريق غزة (شارع عمر المختار)',
    labelEn: 'Gaza High-Rise Fire',
    text: 'حريق ضخم جداً في عمارة سكنية بشارع عمر المختار مع وجود 4 مصابين محاصرين بالدخان ومخاطر انفجار أسطوانات الغاز!',
    lat: 31.5125,
    lng: 34.4533,
    location: 'شارع عمر المختار - غزة',
    category: 'Fire',
    severity: 4,
    casualties: 4,
    dispatches: [
      { agency_type: 'CivilDefense', units: 3, reasoning: 'توجيه آليات الإطفاء ذات الضغط العالي وفرق الإنقاذ واقتحام المباني.' },
      { agency_type: 'Hospital', units: 2, reasoning: 'استنفار سيارات الإسعاف المتقدمة ووحدات الإنعاش والفرز الطبي.' },
      { agency_type: 'Police', units: 2, reasoning: 'تأمين المحيط الخارجي وإخلاء الشارع المحيط لتسهيل وصول مركبات الطوارئ.' },
    ],
  },
  {
    id: 'ny_shooter',
    labelAr: 'إطلاق نار (مانهاتن - نيويورك)',
    labelEn: 'Midtown Manhattan Active Shooter',
    text: 'Active shooter incident in Midtown Manhattan - Central District with casualties reported and armed suspect spotted on 5th Avenue!',
    lat: 40.7128,
    lng: -74.0060,
    location: '5th Avenue, Midtown Manhattan - New York',
    category: 'Security',
    severity: 5,
    casualties: 3,
    dispatches: [
      { agency_type: 'Police', units: 6, reasoning: 'Tactical SWAT deployment, active shooter neutralization, and block lockdown.' },
      { agency_type: 'Hospital', units: 4, reasoning: 'Trauma center casualty evacuation and rapid mobile triage staging.' },
      { agency_type: 'CivilDefense', units: 2, reasoning: 'Structural safety perimeter and civilian evacuation escort.' },
    ],
  },
  {
    id: 'tokyo_rescue',
    labelAr: 'حريق وإنقاذ (طوكيو - شينجوكو)',
    labelEn: 'Tokyo High-Rise Fire & Rescue',
    text: 'حريق هائل واحتجاز مدنيين في برج سكني وتجاري بحي شينجوكو مع تصاعد الدخان الكثيف وانهيارات جزئية!',
    lat: 35.6895,
    lng: 139.6917,
    location: 'Shinjuku Central - Tokyo',
    category: 'Rescue',
    severity: 4,
    casualties: 2,
    dispatches: [
      { agency_type: 'CivilDefense', units: 4, reasoning: 'Tokyo Fire Dept ladder trucks and high-rise evacuation team.' },
      { agency_type: 'Hospital', units: 3, reasoning: 'Emergency critical care paramedics and smoke inhalation treatment.' },
      { agency_type: 'Police', units: 2, reasoning: 'Traffic control and crowd management around Shinjuku station perimeter.' },
    ],
  },
  {
    id: 'gaza_medical',
    labelAr: 'حادث سير جماعي (طريق صلاح الدين)',
    labelEn: 'Mass Casualty Vehicle Collision',
    text: 'حادث سير مروع واصطدام حافلة في طريق صلاح الدين مع 6 مصابين عالقين داخل المركبة وحالات نزيف خطيرة!',
    lat: 31.5300,
    lng: 34.4600,
    location: 'طريق صلاح الدين الرئيسي',
    category: 'Medical',
    severity: 4,
    casualties: 6,
    dispatches: [
      { agency_type: 'Hospital', units: 4, reasoning: 'استدعاء وحدات العناية المركزة المتنقلة ونقل المصابين لمجمع الشفاء الطبي.' },
      { agency_type: 'CivilDefense', units: 2, reasoning: 'قص هياكل المركبات باستخدام أدوات الهيدروليك لإخراج العالقين.' },
      { agency_type: 'Police', units: 2, reasoning: 'إغلاق مسار الطريق السريع وتوجيه حركة المرور للطرق الفرعية.' },
    ],
  },
]

// =============================================================================
// EMBEDDED TACTICAL SATELLITE CCTV STREAM COMPONENT
// Renders live aerial imagery matching exact incident lat/lng with pan/tilt/zoom
// and multi-spectral sensor filters (Optical, Thermal IR, Night-Vision Infrared)
// =============================================================================
const TacticalCCTVFeed = ({ incident, mode, isArabic }) => {
  const [zoomScale, setZoomScale] = useState(1.4)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [liveTime, setLiveTime] = useState(new Date().toISOString().replace('T', ' ').slice(0, 19))

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(new Date().toISOString().replace('T', ' ').slice(0, 19))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const lat = incident?.latitude || 31.5125
  const lng = incident?.longitude || 34.4533

  // Slippy tile math at zoom 17
  const zoom = 17
  const n = Math.pow(2, zoom)
  const rad = (lat * Math.PI) / 180
  const centerX = Math.floor(((lng + 180) / 360) * n)
  const centerY = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)

  // 3x3 adjacent tiles grid
  const offsets = [
    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 0 },  { dx: 0, dy: 0 },  { dx: 1, dy: 0 },
    { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 },
  ]

  // Dynamic Multi-Spectral Visual Filters
  const getFilterStyle = () => {
    if (mode === 'thermal') {
      return 'invert(100%) hue-rotate(190deg) contrast(180%) saturate(260%)'
    }
    if (mode === 'infrared') {
      return 'grayscale(100%) sepia(100%) hue-rotate(90deg) saturate(350%) contrast(150%) brightness(85%)'
    }
    return 'contrast(115%) brightness(95%)'
  }

  return (
    <div className="relative h-80 md:h-96 w-full bg-slate-950 overflow-hidden select-none">
      {/* Sovereign Air-Gapped Tactical Sensor Surface */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-transform duration-150 ease-out"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
          filter: getFilterStyle(),
        }}
      >
        <div className="w-[768px] h-[768px] bg-slate-900 border border-cyan-500/30 flex items-center justify-center relative shadow-inner">
          {/* Tactical coordinate grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />
          <div className="text-center font-mono text-cyan-400/80 p-6 rounded-xl bg-slate-950/80 border border-cyan-500/40 backdrop-blur-md">
            <Radio className="w-10 h-10 mx-auto mb-2 text-cyan-400 animate-pulse" />
            <div className="text-sm font-black tracking-widest uppercase">
              {isArabic ? 'بث استطلاع تكتيكي جوي مشفر' : 'TACTICAL AIR-GAP SENSOR FEED'}
            </div>
            <div className="text-xs text-yellow-400 font-bold mt-1">
              LAT: {lat.toFixed(5)}°N | LNG: {lng.toFixed(5)}°E
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              SENSOR ID: FLIR-EOA-{incident?.id?.slice(-4) || '9921'} | ZOOM: {zoomScale.toFixed(1)}X
            </div>
          </div>
        </div>
      </div>

      {/* Optical Scanlines & Sensor Vignette */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.45)_50%)] bg-[length:100%_4px] pointer-events-none opacity-60" />
      <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.85)] pointer-events-none" />

      {/* Targeting Reticle & Tactical Crosshairs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border border-cyan-400/30 rounded-full flex items-center justify-center">
          <div className="w-32 h-32 border border-cyan-400/50 rounded-full border-dashed animate-spin" style={{ animationDuration: '30s' }} />
        </div>
        <div className="absolute w-12 h-12 border-2 border-red-500/80 flex items-center justify-center">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
        </div>
        <div className="absolute w-64 h-px bg-cyan-400/40" />
        <div className="absolute h-64 w-px bg-cyan-400/40" />
        <div className="absolute top-10 left-10 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80" />
        <div className="absolute top-10 right-10 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80" />
        <div className="absolute bottom-10 left-10 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80" />
        <div className="absolute bottom-10 right-10 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80" />
      </div>

      {/* Top Left HUD Telemetry */}
      <div className="absolute top-3 start-3 text-[11px] font-mono text-cyan-300 space-y-0.5 drop-shadow-md bg-slate-950/75 p-2.5 rounded-xl border border-cyan-500/30 backdrop-blur-sm">
        <p className="font-bold text-white flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          UAV GIMBAL FEED // CAM-FLIR-01
        </p>
        <p>LAT: {lat.toFixed(5)}° N</p>
        <p>LNG: {lng.toFixed(5)}° E</p>
        <p>ALTITUDE: 142M AGL • AZ: 184° SSE</p>
        <p className="text-yellow-400 font-bold">ZOOM: {zoomScale.toFixed(1)}X</p>
      </div>

      {/* Top Right Target Telemetry */}
      <div className="absolute top-3 end-3 text-[11px] font-mono text-emerald-400 text-end drop-shadow-md bg-slate-950/75 p-2.5 rounded-xl border border-emerald-500/30 backdrop-blur-sm">
        <p className="font-black text-white truncate max-w-[220px]">{incident?.location || 'Target Sector'}</p>
        <p>MODE: {mode.toUpperCase()} // 60 FPS</p>
        <p className="text-yellow-400 font-bold">{liveTime} UTC</p>
        <p className="text-cyan-300 font-bold">STATUS: LOCKED</p>
      </div>

      {/* Bottom Center Pan/Tilt/Zoom In-Feed Joystick Controls */}
      <div className="absolute bottom-3 start-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-2xl border border-slate-700 shadow-xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => setZoomScale((prev) => Math.max(1.0, prev - 0.2))}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoomScale((prev) => Math.min(3.0, prev + 0.2))}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => setPanOffset((prev) => ({ ...prev, y: prev.y + 25 }))}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white active:scale-95"
          title="Tilt Up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPanOffset((prev) => ({ ...prev, y: prev.y - 25 }))}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white active:scale-95"
          title="Tilt Down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPanOffset((prev) => ({ ...prev, x: prev.x + 25 }))}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white active:scale-95"
          title="Pan Left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setPanOffset((prev) => ({ ...prev, x: prev.x - 25 }))}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white active:scale-95"
          title="Pan Right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => {
            setZoomScale(1.4)
            setPanOffset({ x: 0, y: 0 })
          }}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-yellow-400 font-bold active:scale-95"
          title="Recenter"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export const Dashboard = () => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith('ar')
  const { user, tenantId, logout } = useAuth()
  const {
    incidents: streamIncidents,
    activeIncident: streamActiveIncident,
    setActiveIncident,
    addIncident,
    connectionStatus,
    triggerTestSOS,
  } = useLiveFeed()

  // Scenario selection via URL parameter (?scenario=ny_shooter or ?scenario=tokyo_rescue)
  const scenarioParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scenario') : null
  const selectedPreset = DEMO_PRESETS.find((p) => p.id === scenarioParam)
  const fallbackIncident = selectedPreset
    ? {
        id: `INC-DEMO-${selectedPreset.id.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        tenantId: 'eoa-global-hq',
        location: selectedPreset.location,
        latitude: selectedPreset.lat,
        longitude: selectedPreset.lng,
        classification: {
          category: selectedPreset.category,
          severity_level: selectedPreset.severity,
          summary: selectedPreset.text,
        },
        dispatches: selectedPreset.dispatches,
        summary: { casualties: selectedPreset.casualties },
      }
    : DEFAULT_TACTICAL_INCIDENT

  // Use stream incidents, or fallback to tactical incident to ensure immediate operational readiness
  const incidents = streamIncidents.length > 0 ? streamIncidents : [fallbackIncident]
  const activeIncident = streamActiveIncident || incidents[0]

  // Modals state
  const [isSOSModalOpen, setIsSOSModalOpen] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isCCTVModalOpen, setIsCCTVModalOpen] = useState(false)
  const [cctvMode, setCctvMode] = useState('optical') // 'optical' | 'thermal' | 'infrared'

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('')

  // SOS Form state & Selected Preset
  const [selectedPresetId, setSelectedPresetId] = useState('gaza_fire')
  const [targetCoords, setTargetCoords] = useState({ lat: 31.5125, lng: 34.4533 })
  const [sosText, setSosText] = useState(
    DEMO_PRESETS[0].text
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  const handleSendSOS = async (e) => {
    e.preventDefault()
    if (!sosText.trim()) return

    const activePreset = DEMO_PRESETS.find((p) => p.id === selectedPresetId)
    const lat = targetCoords?.lat || (activePreset ? activePreset.lat : 31.5125)
    const lng = targetCoords?.lng || (activePreset ? activePreset.lng : 34.4533)
    const locationName = activePreset?.location || (isArabic ? 'القطاع التكتيكي للحادث' : 'Tactical Incident Sector')
    const category = activePreset?.category || 'Fire'
    const severity = activePreset?.severity || 4
    const casualties = activePreset?.casualties || 2
    const dispatches = activePreset?.dispatches || [
      { agency_type: 'CivilDefense', units: 2, reasoning: 'Direct intervention units deployed.' },
      { agency_type: 'Hospital', units: 2, reasoning: 'Emergency medical response dispatched.' },
      { agency_type: 'Police', units: 1, reasoning: 'Perimeter cordoned.' },
    ]

    const incidentId = `INC-${Date.now().toString().slice(-6)}`
    const newIncident = {
      id: incidentId,
      timestamp: new Date().toISOString(),
      tenantId: tenantId || 'eoa-global-hq',
      location: locationName,
      latitude: lat,
      longitude: lng,
      classification: {
        category,
        severity_level: severity,
        summary: sosText,
      },
      dispatches,
      summary: {
        casualties,
      },
    }

    // 1. Immediately close popup to prevent operator workflow interruption
    setIsSOSModalOpen(false)

    // 2. Add directly to feed and focus camera
    addIncident(newIncident)
    setActiveIncident(newIncident)

    // 3. User feedback toast
    showToast(
      isArabic
        ? `تم توجيه المنظومة إلى: ${locationName} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`
        : `System Targeted: ${locationName} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`
    )

    // 4. Background queue delivery
    try {
      await triggerTestSOS({
        title: sosText.slice(0, 40) + '...',
        description: sosText,
        incident_type: category,
        severity: severity >= 4 ? 'CRITICAL' : 'HIGH',
        latitude: lat,
        longitude: lng,
      })
    } catch (err) {
      console.warn('Backend SOS queue dispatch note:', err)
    }
  }

  // Action 1: Share Coordinates
  const handleShareCoordinates = () => {
    if (!activeIncident) return
    const lat = activeIncident.latitude.toFixed(5)
    const lng = activeIncident.longitude.toFixed(5)
    const textToCopy = `EOA GLOBAL INCIDENT [${activeIncident.id}]: Lat ${lat}, Lng ${lng} - Target: ${activeIncident.location}`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
    }
    showToast(
      isArabic
        ? `تم نسخ إحداثيات الهدف: (${lat}°N, ${lng}°E)`
        : `Coordinates Transmitted: (${lat}°N, ${lng}°E)`
    )
  }

  // Action 2: Print Incident Report
  const handlePrintReport = () => {
    setIsPrintModalOpen(true)
  }

  // Action 3: Activate Nearby CCTV
  const handleActivateCCTV = () => {
    setIsCCTVModalOpen(true)
  }

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans select-none"
    >
      {/* ----------------------------------------------------------------- */}
      {/* 1. TOP OPERATIONS HEADER (High-Contrast Tactical Bar)             */}
      {/* ----------------------------------------------------------------- */}
      <header className="h-14 bg-slate-900 border-b-2 border-slate-700 px-4 flex items-center justify-between shrink-0 z-20 shadow-xl">
        {/* Brand & Tenant Identifier */}
        <div className="flex items-center gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 shadow-md">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-black text-base tracking-wider text-white uppercase block leading-tight">
                {t('app.title')}
              </span>
              <span className="text-[10px] text-yellow-400 font-mono font-bold tracking-widest uppercase">
                {t('app.eoc')}
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-slate-700 mx-1 hidden sm:block" />

          {/* Active Tenant Partition */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-[11px] text-slate-300 uppercase font-bold tracking-wider">
              {t('nav.active_tenant')}:
            </span>
            <span className="font-mono font-black text-yellow-400 text-xs">{tenantId}</span>
          </div>
        </div>

        {/* Live Status, Language, and Controls */}
        <div className="flex items-center gap-3">
          {/* Live Telemetry Status Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border-2 border-slate-700 text-xs font-mono font-bold">
            {connectionStatus === 'connected' ? (
              <>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 text-xs hidden md:inline">
                  {t('nav.connected')}
                </span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span className="text-yellow-400 text-xs hidden md:inline">
                  {t('nav.connecting')}
                </span>
              </>
            )}
          </div>

          {/* Trigger Emergency SOS Modal Button */}
          <button
            onClick={() => setIsSOSModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs tracking-wider uppercase transition-all shadow-lg shadow-red-600/30 active:scale-95 border border-red-400"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">{t('nav.trigger_sos')}</span>
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* Logout Button */}
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title={t('nav.logout')}
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* 2. MAIN EOC COMMAND BODY (Tactical Map + High-Contrast Feed)      */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col md:flex-row p-3 gap-3 overflow-hidden">
        {/* Tactical GIS Map (62% width) */}
        <section className="flex-1 md:w-[62%] h-[48vh] md:h-full">
          <EnterpriseMap
            incidents={incidents}
            activeIncident={activeIncident}
            onSelectIncident={setActiveIncident}
          />
        </section>

        {/* AI Incident & Multi-Agency Dispatch Feed (38% width) */}
        <section className="md:w-[38%] h-[52vh] md:h-full">
          <AIIncidentFeed
            incidents={incidents}
            activeIncident={activeIncident}
            onSelectIncident={setActiveIncident}
          />
        </section>
      </main>

      {/* ----------------------------------------------------------------- */}
      {/* 3. INTERACTIVE TACTICAL TOOLBAR (Fixed Bottom Command Bar)         */}
      {/* ----------------------------------------------------------------- */}
      <footer className="h-14 bg-slate-900 border-t-2 border-slate-700 px-4 flex items-center justify-between shrink-0 z-20 shadow-2xl">
        {/* Left: Active Target Hotspot Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono">
            <Crosshair className="w-4 h-4 text-yellow-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span className="text-slate-400 font-bold uppercase text-[10px]">
              {t('toolbar.active_focus')}:
            </span>
            <span className="text-white font-extrabold truncate max-w-[180px] sm:max-w-xs">
              {activeIncident ? activeIncident.location : t('toolbar.no_active_incident')}
            </span>
          </div>
          {activeIncident && (
            <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-yellow-400 border border-slate-600">
              {activeIncident.latitude.toFixed(4)}°N, {activeIncident.longitude.toFixed(4)}°E
            </span>
          )}
        </div>

        {/* Right: Interactive Action Buttons (WCAG High-Contrast Buttons) */}
        <div className="flex items-center gap-2.5">
          {/* Button 1: Print Incident Report */}
          <button
            type="button"
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs tracking-wider uppercase transition-all border border-slate-600 hover:border-cyan-400 shadow-md active:scale-95"
            title="Print Official Incident Report Manifest"
          >
            <Printer className="w-4 h-4 text-cyan-300" />
            <span className="hidden sm:inline">{t('toolbar.print_report')}</span>
          </button>

          {/* Button 2: Share Coordinates */}
          <button
            type="button"
            onClick={handleShareCoordinates}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs tracking-wider uppercase transition-all border border-slate-600 hover:border-yellow-400 shadow-md active:scale-95"
            title="Transmit & Copy Target Coordinates"
          >
            <Share2 className="w-4 h-4 text-yellow-400" />
            <span className="hidden sm:inline">{t('toolbar.share_coords')}</span>
          </button>

          {/* Button 3: Activate Nearby CCTV */}
          <button
            type="button"
            onClick={handleActivateCCTV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs tracking-wider uppercase transition-all border-2 border-cyan-300 shadow-lg shadow-cyan-600/30 active:scale-95"
            title="Open Embedded Tactical Video Surveillance Feed"
          >
            <Video className="w-4 h-4 text-slate-950" />
            <span className="hidden sm:inline">{t('toolbar.activate_cctv')}</span>
          </button>
        </div>
      </footer>

      {/* ----------------------------------------------------------------- */}
      {/* TOAST FEEDBACK ALERT NOTIFICATION                                */}
      {/* ----------------------------------------------------------------- */}
      {toastMessage && (
        <div className="fixed bottom-20 start-1/2 -translate-x-1/2 z-[2000] bg-slate-900 border-2 border-yellow-400 text-yellow-300 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-mono text-xs font-bold animate-bounce">
          <Check className="w-4 h-4 text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL 1: EMBEDDED TACTICAL CCTV SURVEILLANCE FEED                 */}
      {/* ----------------------------------------------------------------- */}
      {isCCTVModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-slate-900 border-2 border-cyan-400 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col">
            {/* CCTV Window Header */}
            <div className="p-4 bg-slate-950 border-b-2 border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
                <span className="font-mono font-black text-sm text-white tracking-widest uppercase">
                  {t('cctv.feed_name')}
                </span>
                <span className="px-2 py-0.5 rounded bg-red-600 text-white font-mono text-[10px] font-black uppercase">
                  REC • 1080P
                </span>
              </div>
              <button
                onClick={() => setIsCCTVModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Live Tactical Optical / Thermal Video Component */}
            <TacticalCCTVFeed
              incident={activeIncident}
              mode={cctvMode}
              isArabic={isArabic}
            />

            {/* Video Controls & Mode Toggles */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase">{t('cctv.status')}:</span>
                <button
                  type="button"
                  onClick={() => setCctvMode('optical')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    cctvMode === 'optical'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {t('cctv.optical')}
                </button>
                <button
                  type="button"
                  onClick={() => setCctvMode('thermal')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    cctvMode === 'thermal'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {t('cctv.thermal')}
                </button>
                <button
                  type="button"
                  onClick={() => setCctvMode('infrared')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                    cctvMode === 'infrared'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {t('cctv.infrared')}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCCTVModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
              >
                {t('cctv.close_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL 2: PRINT OFFICIAL INCIDENT REPORT MANIFEST                   */}
      {/* ----------------------------------------------------------------- */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-slate-900 border-2 border-slate-600 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setIsPrintModalOpen(false)}
              className="absolute top-5 end-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Official Report Header */}
            <div className="border-b-2 border-slate-700 pb-4 mb-4">
              <div className="flex items-center gap-2 text-cyan-400 mb-1">
                <Printer className="w-5 h-5" />
                <span className="text-xs font-mono font-bold uppercase tracking-widest">
                  {t('report.agency_header')}
                </span>
              </div>
              <h3 className="text-lg font-black text-white">{t('report.title')}</h3>
              <p className="text-xs text-yellow-400 font-mono mt-0.5 font-bold">
                INCIDENT ID: {activeIncident?.id || 'INC-2026-ALPHA'} • TENANT: {tenantId}
              </p>
            </div>

            {/* Printable Content Details */}
            <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block font-semibold">LOCATION SECTOR:</span>
                  <span className="font-black text-white text-sm">{activeIncident?.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold">SEVERITY INDEX:</span>
                  <span className="font-mono font-black text-yellow-400 text-sm">
                    LEVEL {activeIncident?.classification?.severity_level || 4} / 5
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">COORDINATES:</span>
                <span className="font-mono font-bold text-cyan-300">
                  {activeIncident?.latitude.toFixed(6)}° N, {activeIncident?.longitude.toFixed(6)}° E
                </span>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">AI TACTICAL SUMMARY:</span>
                <p className="text-slate-200 leading-relaxed font-medium bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  {activeIncident?.classification?.summary || 'Tactical emergency dispatched by AI.'}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block font-semibold mb-1">MOBILIZED UNITS:</span>
                <div className="space-y-1">
                  {activeIncident?.dispatches?.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
                      <span className="font-bold text-white">{t(`agencies.${d.agency_type}`) || d.agency_type}</span>
                      <span className="font-mono font-black text-yellow-400">{d.required_units || d.units || 1} Units</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                {t('report.close_btn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print()
                  setIsPrintModalOpen(false)
                }}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30"
              >
                <Printer className="w-4 h-4" />
                <span>{t('report.print_btn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* MODAL 3: BROADCAST NEW DISTRESS SOS                               */}
      {/* ----------------------------------------------------------------- */}
      {isSOSModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white">
            <button
              onClick={() => setIsSOSModalOpen(false)}
              className="absolute top-5 end-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2 text-red-500">
              <Flame className="w-6 h-6" />
              <h3 className="font-black text-base text-white">{t('modal.title')}</h3>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed font-medium">
              {t('modal.desc')}
            </p>

            {/* Quick Emergency Presets with Target Coordinates */}
            <div className="mb-4">
              <span className="text-[11px] font-black text-yellow-400 uppercase tracking-wider block mb-2">
                {t('modal.quick_examples')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {DEMO_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedPresetId(preset.id)
                        setSosText(preset.text)
                        setTargetCoords({ lat: preset.lat, lng: preset.lng })
                      }}
                      className={`p-2.5 rounded-xl border text-start transition-all font-semibold flex flex-col gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg shadow-cyan-900/30 ring-1 ring-cyan-400'
                          : 'bg-slate-800 hover:bg-slate-700/80 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-white text-xs">
                          {isArabic ? preset.labelAr : preset.labelEn}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-yellow-400">
                          {preset.lat.toFixed(2)}°, {preset.lng.toFixed(2)}°
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate">
                        {preset.location}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <form onSubmit={handleSendSOS} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-white">
                    {t('modal.input_label')}
                  </label>
                  <span className="text-[10px] font-mono font-bold text-yellow-400">
                    TARGET: {targetCoords.lat.toFixed(4)}°N, {targetCoords.lng.toFixed(4)}°E
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={sosText}
                  onChange={(e) => setSosText(e.target.value)}
                  placeholder={t('modal.input_placeholder')}
                  className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSOSModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  {t('modal.cancel_btn')}
                </button>
                <button
                  type="submit"
                  disabled={!sosText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-600/30 cursor-pointer active:scale-95 transition-all"
                >
                  <Send className="w-4 h-4 rtl:rotate-180" />
                  <span>{t('modal.send_btn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
