import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  CircleMarker,
  LayersControl,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import { Crosshair, Video } from 'lucide-react'
import { TACTICAL_WAYPOINTS } from '../hooks/useLiveFeed'

// Guarantee Leaflet global is available for plugins
if (typeof window !== 'undefined') {
  window.L = L
}

// Asynchronously load leaflet-routing-machine plugin
const ensureRoutingMachine = async () => {
  if (typeof window === 'undefined') return false
  window.L = L
  if (!window.L.Routing) {
    try {
      await import('leaflet-routing-machine')
    } catch (err) {
      console.warn('[C4ISR OSINT] Failed to load leaflet-routing-machine:', err)
      return false
    }
  }
  return Boolean(window.L && window.L.Routing && typeof window.L.Routing.control === 'function')
}

// =============================================================================
// 1. MILITARY COORDINATE GRATICULE OVERLAY
// Dynamic SVG geographic targeting grid with latitude/longitude marks & crosshairs
// =============================================================================
const MilitaryGraticuleOverlay = React.memo(() => {
  const map = useMap()
  const [gridData, setGridData] = useState({ lines: [], labels: [] })

  const updateGraticule = () => {
    if (!map) return
    const bounds = map.getBounds()
    const zoom = map.getZoom()

    // Determine grid line spacing based on zoom level
    let step = 0.5
    if (zoom >= 16) step = 0.005
    else if (zoom >= 14) step = 0.01
    else if (zoom >= 12) step = 0.02
    else if (zoom >= 10) step = 0.05
    else if (zoom >= 8) step = 0.1
    else if (zoom >= 6) step = 0.25

    const minLat = Math.floor(bounds.getSouth() / step) * step
    const maxLat = Math.ceil(bounds.getNorth() / step) * step
    const minLng = Math.floor(bounds.getWest() / step) * step
    const maxLng = Math.ceil(bounds.getEast() / step) * step

    const lines = []
    const labels = []

    // Latitude horizontal lines
    for (let lat = minLat; lat <= maxLat + 0.0001; lat += step) {
      const p1 = map.latLngToContainerPoint([lat, bounds.getWest()])
      const p2 = map.latLngToContainerPoint([lat, bounds.getEast()])
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, key: `lat-${lat.toFixed(4)}` })
      labels.push({
        x: 10,
        y: Math.max(14, p1.y - 4),
        text: `${lat.toFixed(3)}°N`,
        key: `lbl-lat-${lat.toFixed(4)}`,
      })
    }

    // Longitude vertical lines
    for (let lng = minLng; lng <= maxLng + 0.0001; lng += step) {
      const p1 = map.latLngToContainerPoint([bounds.getNorth(), lng])
      const p2 = map.latLngToContainerPoint([bounds.getSouth(), lng])
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, key: `lng-${lng.toFixed(4)}` })
      labels.push({
        x: p1.x + 4,
        y: 16,
        text: `${lng.toFixed(3)}°E`,
        key: `lbl-lng-${lng.toFixed(4)}`,
      })
    }

    setGridData({ lines, labels })
  }

  useEffect(() => {
    updateGraticule()
    map.on('move', updateGraticule)
    map.on('zoom', updateGraticule)
    map.on('resize', updateGraticule)
    return () => {
      map.off('move', updateGraticule)
      map.off('zoom', updateGraticule)
      map.off('resize', updateGraticule)
    }
  }, [map])

  return (
    <div className="absolute inset-0 pointer-events-none z-[400] overflow-hidden select-none">
      <svg className="w-full h-full">
        {/* Graticule Grid Lines */}
        {gridData.lines.map((l) => (
          <line
            key={l.key}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#0284c7"
            strokeWidth="1"
            strokeDasharray="4 6"
            strokeOpacity="0.35"
          />
        ))}

        {/* Tactical Crosshair Nodes at Grid Intersections */}
        {gridData.lines.slice(0, 15).map((l, i) => (
          <g key={`cross-${i}`}>
            <line x1={l.x1 - 4} y1={l.y1} x2={l.x1 + 4} y2={l.y1} stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.6" />
            <line x1={l.x1} y1={l.y1 - 4} x2={l.x1} y2={l.y1 + 4} stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.6" />
          </g>
        ))}

        {/* Military Coordinate Margin Labels */}
        {gridData.labels.map((lbl) => (
          <text
            key={lbl.key}
            x={lbl.x}
            y={lbl.y}
            fill="#38bdf8"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
            className="opacity-75 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
          >
            {lbl.text}
          </text>
        ))}
      </svg>

      {/* Military Targeting Corner Reticles */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400 opacity-60" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400 opacity-60" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400 opacity-60" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400 opacity-60" />

      {/* Compass Ordinal Watermark */}
      <div className="absolute top-2 right-14 font-mono text-[9px] text-cyan-400/60 font-bold px-1.5 py-0.5 rounded bg-slate-900/80 border border-cyan-800/40">
        GRATICULE: WGS84 // UTM 36N
      </div>
    </div>
  )
})

// =============================================================================
// 2. CAMERA CONTROLLER: Center targeting on selected incident
// =============================================================================
const MapCameraController = React.memo(({ targetCoordinates }) => {
  const map = useMap()
  const prevCoordRef = useRef(null)

  useEffect(() => {
    if (!targetCoordinates || !targetCoordinates[0] || !targetCoordinates[1]) return

    const key = `${targetCoordinates[0].toFixed(5)}_${targetCoordinates[1].toFixed(5)}`
    if (prevCoordRef.current === key) return
    prevCoordRef.current = key

    try {
      map.flyTo(targetCoordinates, 14, {
        duration: 1.2,
        easeLinearity: 0.25,
      })
    } catch (e) {
      map.setView(targetCoordinates, 14)
    }
  }, [targetCoordinates, map])

  return null
})

// Haversine distance calculator
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Tactical route fallback path
const generateFallbackRoute = (startLat, startLng, endLat, endLng) => {
  const midLat = startLat + (endLat - startLat) * 0.45
  const midLng = startLng + (endLng - startLng) * 0.55
  return [
    [startLat, startLng],
    [startLat, midLng],
    [midLat, midLng],
    [midLat, endLng],
    [endLat, endLng],
  ]
}

// =============================================================================
// 3. TACTICAL MILITARY MARKERS
// Strict High-Contrast Color Code:
// RED   = High-Value Target / Active Incident
// BLUE  = Friendly Units / Emergency Dispatched Forces / Trauma Hospital
// =============================================================================
const createMilitaryTargetMarker = (severity = 3, id = 'TGT') => {
  const html = `
    <div class="relative flex items-center justify-center cursor-pointer">
      <div class="absolute -inset-2 rounded-full border border-red-500 animate-ping opacity-75"></div>
      <div class="w-8 h-8 rounded-md bg-red-600 border-2 border-white text-white font-mono font-black text-xs flex items-center justify-center shadow-lg shadow-red-950">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </div>
      <span class="absolute -bottom-4 px-1 rounded bg-black/90 text-red-400 font-mono text-[8px] font-bold border border-red-600 whitespace-nowrap">
        TGT-P${severity}
      </span>
    </div>
  `

  return L.divIcon({
    html,
    className: 'military-target-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

const createFriendlyUnitMarker = (unitType = 'MED-01') => {
  const html = `
    <div class="relative flex items-center justify-center cursor-pointer">
      <div class="w-8 h-8 rounded-md bg-blue-600 border-2 border-white text-white font-mono font-black text-xs flex items-center justify-center shadow-lg shadow-blue-950">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </div>
      <span class="absolute -bottom-4 px-1 rounded bg-black/90 text-blue-400 font-mono text-[8px] font-bold border border-blue-600 whitespace-nowrap">
        FRIENDLY
      </span>
    </div>
  `

  return L.divIcon({
    html,
    className: 'military-friendly-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  })
}

// Marker for dynamically acquired target coordinates
const createAcquiredTargetMarker = () => {
  const html = `
    <div class="relative flex items-center justify-center">
      <div class="absolute -inset-3 rounded-full border-2 border-red-500 animate-ping opacity-85"></div>
      <div class="w-9 h-9 rounded-full bg-red-600 border-2 border-white flex items-center justify-center shadow-[0_0_25px_rgba(239,68,68,1)] text-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </div>
      <span class="absolute -bottom-5 px-1.5 py-0.2 rounded bg-black/95 text-red-400 font-mono text-[9px] font-black border border-red-500 whitespace-nowrap animate-pulse">
        TARGET LOCK
      </span>
    </div>
  `

  return L.divIcon({
    html,
    className: 'military-acquired-target-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

// Map Event Listener for Dynamic Click Targeting and CCTV Placement
const TargetingMapEvents = ({
  isTargetingMode,
  onLocationAcquired,
  isCctvPlacementMode,
  onCctvPlaced,
}) => {
  useMapEvents({
    click(e) {
      if (isCctvPlacementMode && onCctvPlaced) {
        onCctvPlaced({ lat: e.latlng.lat, lng: e.latlng.lng })
      } else if (isTargetingMode && onLocationAcquired) {
        onLocationAcquired({ lat: e.latlng.lat, lng: e.latlng.lng })
      }
    },
  })
  return null
}

// Tactical CCTV Camera DivIcon with Direction Needle
const createCctvCameraIcon = (azimuth = 0, mode = 'DAY') => {
  const accentColor = mode === 'IR' ? '#10b981' : mode === 'FLIR' ? '#f97316' : '#06b6d4'
  return L.divIcon({
    className: 'custom-pin-cctv-camera',
    html: `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <div style="position: absolute; inset: 0; border-radius: 9999px; border: 2px solid ${accentColor}; background: rgba(10, 14, 23, 0.9); box-shadow: 0 0 16px ${accentColor}90;"></div>
        <div style="position: absolute; width: 100%; height: 100%; transform: rotate(${azimuth}deg); pointer-events: none; transition: transform 0.15s ease-out;">
          <div style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 10px solid ${accentColor};"></div>
        </div>
        <div style="position: relative; z-index: 10; font-size: 15px; display: flex; align-items: center; justify-content: center;">
          📹
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

// Calculates FOV cone coordinates
const calculateFovConePolygon = (lat, lng, azimuthDeg, fovDeg = 60, zoomMultiplier = 1, numPoints = 24) => {
  if (!lat || !lng) return null
  const earthRadius = 6371000
  const baseRangeMeters = 500
  const rangeMeters = baseRangeMeters * (zoomMultiplier || 1)
  const halfFov = (fovDeg || 60) / 2
  const startAngle = azimuthDeg - halfFov
  const endAngle = azimuthDeg + halfFov

  const points = [[lat, lng]]

  for (let i = 0; i <= numPoints; i++) {
    const angle = startAngle + (i / numPoints) * (endAngle - startAngle)
    const rad = (angle * Math.PI) / 180

    const dLat = (rangeMeters * Math.cos(rad)) / earthRadius
    const dLng = (rangeMeters * Math.sin(rad)) / (earthRadius * Math.cos((lat * Math.PI) / 180))

    const ptLat = lat + (dLat * 180) / Math.PI
    const ptLng = lng + (dLng * 180) / Math.PI

    points.push([ptLat, ptLng])
  }

  points.push([lat, lng])
  return points
}

// =============================================================================
// 4. OSINT ROUTING ENGINE CONTROLLER (LEAFLET ROUTING MACHINE + OSRM)
// Optimized to prevent infinite render loops & memory leaks
// =============================================================================
const OSINTRoutingMachine = React.memo(({ activeIncident, onRoutingResolved }) => {
  const map = useMap()
  const routingControlRef = useRef(null)
  const isMountedRef = useRef(true)
  const onRoutingResolvedRef = useRef(onRoutingResolved)
  const prevIncidentKeyRef = useRef('')

  // Keep callback reference updated without triggering effect re-execution
  useEffect(() => {
    onRoutingResolvedRef.current = onRoutingResolved
  }, [onRoutingResolved])

  const incidentId = activeIncident?.id || null
  const incLat = activeIncident ? (activeIncident.latitude || activeIncident.lat) : null
  const incLng = activeIncident ? (activeIncident.longitude || activeIncident.lng) : null
  const incidentKey = incidentId && incLat && incLng ? `${incidentId}_${incLat.toFixed(5)}_${incLng.toFixed(5)}` : null

  useEffect(() => {
    isMountedRef.current = true

    if (!incidentKey || !incLat || !incLng) {
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current)
        } catch (e) {}
        routingControlRef.current = null
      }
      prevIncidentKeyRef.current = ''
      return
    }

    // Critical Guard: Only resolve if incident actually changed
    if (prevIncidentKeyRef.current === incidentKey) {
      return
    }
    prevIncidentKeyRef.current = incidentKey

    const abortController = new AbortController()

    const resolveDispatch = async () => {
      let hospitalCoord = null
      let hospitalName = 'HQ-TRAUMA-CENTER-ALPHA'

      // Search nearest trauma facility via Overpass
      try {
        const q = `[out:json][timeout:4];(node["amenity"="hospital"](around:5000,${incLat},${incLng}););out center;`
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`
        const res = await fetch(url, { signal: abortController.signal })
        if (res.ok) {
          const d = await res.json()
          if (d.elements?.length > 0) {
            const first = d.elements[0]
            hospitalCoord = [first.lat, first.lon]
            hospitalName = first.tags?.name || first.tags?.['name:en'] || hospitalName
          }
        }
      } catch (err) {}

      if (!hospitalCoord) {
        hospitalCoord = [incLat + 0.0105, incLng - 0.0125]
      }

      if (!isMountedRef.current) return

      const dist = calculateDistanceKm(incLat, incLng, hospitalCoord[0], hospitalCoord[1])
      const roadDistKm = Math.max(0.8, dist * 1.25)
      const etaMin = Math.max(1.2, (roadDistKm / 52) * 60).toFixed(1)
      const fallbackRoute = generateFallbackRoute(incLat, incLng, hospitalCoord[0], hospitalCoord[1])

      // Push telemetry up via stable ref to avoid render loops
      onRoutingResolvedRef.current?.({
        hospitalCoord,
        hospitalName,
        distanceKm: roadDistKm.toFixed(2),
        etaMin,
        fallbackRoute,
      })

      // Clean up previous routing control before creating a new one
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current)
        } catch (e) {}
        routingControlRef.current = null
      }

      // Initialize OSRM routing control
      const hasRouting = await ensureRoutingMachine()
      if (hasRouting && isMountedRef.current) {
        try {
          const control = window.L.Routing.control({
            waypoints: [
              window.L.latLng(incLat, incLng),
              window.L.latLng(hospitalCoord[0], hospitalCoord[1]),
            ],
            router: window.L.Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1',
            }),
            lineOptions: {
              styles: [
                {
                  color: '#00ffcc', // High-contrast luminous cyan
                  weight: 4,
                  opacity: 0.9,
                  dashArray: '6, 6',
                  lineCap: 'round',
                },
              ],
              extendToWaypoints: true,
              missingRouteStyles: [
                {
                  color: '#00ffcc',
                  weight: 4,
                  opacity: 0.9,
                  dashArray: '6, 6',
                  lineCap: 'round',
                },
              ],
            },
            show: false,
            addWaypoints: false,
            routeWhileDragging: false,
            fitSelectedRoutes: false,
            showAlternatives: false,
            createMarker: () => null,
          })

          control.addTo(map)
          routingControlRef.current = control
        } catch (err) {
          console.warn('[C4ISR] OSRM Control init fallback:', err)
        }
      }
    }

    resolveDispatch()

    // Proper Leaflet control removal on unmount or incident change
    return () => {
      isMountedRef.current = false
      abortController.abort()
      if (routingControlRef.current) {
        try {
          map.removeControl(routingControlRef.current)
        } catch (e) {}
        routingControlRef.current = null
      }
    }
  }, [incidentKey, incLat, incLng, map])

  return null
})

// =============================================================================
// 4.5 CANONICAL TACTICAL TRANSIT ROUTES & DEMO FIELD UNITS
// =============================================================================
const ROUTE_A_WAYPOINTS = TACTICAL_WAYPOINTS?.ROUTE_A_MEDICAL || [
  [31.4920, 34.4320],
  [31.4985, 34.4410],
  [31.5050, 34.4490],
  [31.5125, 34.4533],
  [31.5190, 34.4580],
  [31.5240, 34.4640],
]

const ROUTE_B_WAYPOINTS = TACTICAL_WAYPOINTS?.ROUTE_B_CIVIL_DEFENSE || [
  [31.5280, 34.4320],
  [31.5220, 34.4390],
  [31.5170, 34.4460],
  [31.5125, 34.4533],
  [31.5060, 34.4620],
  [31.4990, 34.4710],
]

const DEFAULT_FIELD_UNITS = [
  {
    id: 'UNIT-BRAVO-01',
    callsign: 'RAPID-CD-01',
    type: 'CivilDefense',
    lat: 31.5280,
    lng: 34.4320,
    speed: 56,
    heading: 142,
    status: 'TRANSIT ROUTE B',
    agencyColor: '#00ffcc',
    routeId: 'ROUTE_B',
    currentWaypointIndex: 0,
  },
  {
    id: 'UNIT-ALPHA-02',
    callsign: 'MEDEVAC-02',
    type: 'Hospital',
    lat: 31.4920,
    lng: 34.4320,
    speed: 48,
    heading: 52,
    status: 'TRANSIT ROUTE A',
    agencyColor: '#ff3399',
    routeId: 'ROUTE_A',
    currentWaypointIndex: 0,
  },
  {
    id: 'UNIT-TACTICAL-03',
    callsign: 'PATROL-SWAT-03',
    type: 'Police',
    lat: 31.5125,
    lng: 34.4533,
    speed: 0,
    heading: 0,
    status: 'PERIMETER HOLD',
    agencyColor: '#0077ff',
    routeId: 'STATIC',
    currentWaypointIndex: 0,
  },
]

// =============================================================================
// 5. MAIN ENTERPRISE TACTICAL TOPOGRAPHICAL MAP (C4ISR / BMS)
// =============================================================================
export const EnterpriseMap = ({
  incidents = [],
  activeIncident,
  onSelectIncident,
  onRoutingResolved,
  liveUnits,
  setLiveUnits,
  isTargetingMode = false,
  onLocationAcquired,
  acquiredCoords = null,
  cctvConfig = null,
  isCctvPlacementMode = false,
  onCctvPlaced = null,
  onCancelCctvPlacement = null,
  children,
}) => {

  const defaultCenter = useMemo(() => [31.5125, 34.4533], [])
  const targetCoordinates = useMemo(() => {
    if (!activeIncident) return defaultCenter
    const lat = activeIncident.latitude || activeIncident.lat || defaultCenter[0]
    const lng = activeIncident.longitude || activeIncident.lng || defaultCenter[1]
    return [lat, lng]
  }, [
    activeIncident?.id,
    activeIncident?.latitude,
    activeIncident?.longitude,
    activeIncident?.lat,
    activeIncident?.lng,
    defaultCenter,
  ])

  const [telemetry, setTelemetry] = useState(null)
  const [internalUnits, setInternalUnits] = useState(DEFAULT_FIELD_UNITS)

  // Use external units from useLiveFeed if provided, otherwise internalUnits
  const currentUnits = liveUnits && liveUnits.length > 0 ? liveUnits : internalUnits

  // Live Simulation: Advance Unit point-by-point along Route B every 2000ms
  const currentStepRef = useRef(0)
  const isMovingForwardRef = useRef(true)

  useEffect(() => {
    const route = ROUTE_B_WAYPOINTS
    if (!route || route.length === 0) return

    const intervalId = setInterval(() => {
      let nextStep = currentStepRef.current + (isMovingForwardRef.current ? 1 : -1)
      if (nextStep >= route.length) {
        nextStep = route.length - 2
        isMovingForwardRef.current = false
      } else if (nextStep < 0) {
        nextStep = 1
        isMovingForwardRef.current = true
      }
      currentStepRef.current = nextStep
      const [nextLat, nextLng] = route[nextStep]

      const updateUnitsList = (prevUnits) => {
        if (!prevUnits || prevUnits.length === 0) return prevUnits
        return prevUnits.map((u) => {
          if (u.id === 'UNIT-BRAVO-01' || u.routeId === 'ROUTE_B') {
            return {
              ...u,
              lat: nextLat,
              lng: nextLng,
              currentWaypointIndex: nextStep,
              status: `TRANSIT ROUTE B [WP ${nextStep + 1}/${route.length}]`,
              lastUpdated: Date.now(),
            }
          }
          return u
        })
      }

      if (typeof setLiveUnits === 'function') {
        setLiveUnits(updateUnitsList)
      } else {
        setInternalUnits(updateUnitsList)
      }
    }, 2000)

    // Critical Requirement: Must include clearInterval cleanup function in useEffect return statement
    return () => {
      clearInterval(intervalId)
    }
  }, [setLiveUnits])

  const handleTelemetry = useCallback(
    (data) => {
      setTelemetry((prev) => {
        if (
          prev &&
          prev.hospitalName === data.hospitalName &&
          prev.distanceKm === data.distanceKm &&
          prev.etaMin === data.etaMin
        ) {
          return prev
        }
        return data
      })
      onRoutingResolved?.(data)
    },
    [onRoutingResolved]
  )

  // Dynamic Map CSS Filter (The Master Illusion)
  const mapFilterStyle = useMemo(() => {
    if (!cctvConfig?.active) return 'none'
    if (cctvConfig.mode === 'IR') {
      return 'grayscale(100%) sepia(100%) hue-rotate(85deg) brightness(1.2) contrast(1.5)'
    }
    if (cctvConfig.mode === 'FLIR') {
      return 'grayscale(100%) invert(100%) hue-rotate(180deg) brightness(1.3) contrast(2)'
    }
    return 'none'
  }, [cctvConfig?.active, cctvConfig?.mode])

  // Dynamic FOV Cone Polygon
  const fovConePolygon = useMemo(() => {
    if (!cctvConfig?.active || !cctvConfig?.lat || !cctvConfig?.lng) return null
    return calculateFovConePolygon(
      cctvConfig.lat,
      cctvConfig.lng,
      cctvConfig.azimuth || 0,
      cctvConfig.fov || 60,
      cctvConfig.zoom || 1
    )
  }, [cctvConfig?.active, cctvConfig?.lat, cctvConfig?.lng, cctvConfig?.azimuth, cctvConfig?.fov, cctvConfig?.zoom])

  const fovConeStyle = useMemo(() => {
    const mode = cctvConfig?.mode || 'DAY'
    if (mode === 'IR') {
      return {
        color: '#10b981',
        fillColor: '#10b981',
        fillOpacity: 0.3,
        dashArray: '6, 6',
        weight: 2,
      }
    }
    if (mode === 'FLIR') {
      return {
        color: '#f97316',
        fillColor: '#ef4444',
        fillOpacity: 0.35,
        dashArray: '6, 6',
        weight: 2,
      }
    }
    return {
      color: '#06b6d4',
      fillColor: '#06b6d4',
      fillOpacity: 0.25,
      dashArray: '6, 6',
      weight: 2,
    }
  }, [cctvConfig?.mode])

  return (
    <div className={`relative w-full h-full bg-[#0a0d13] overflow-hidden select-none ${isTargetingMode || isCctvPlacementMode ? 'cursor-crosshair' : ''}`}>
      {/* C4ISR Map Viewport Header Indicator (Strict Non-Overlapping Border) */}
      <div className="absolute top-1 left-2 z-[450] flex items-center gap-2 pointer-events-none font-mono">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-700">
          C4ISR TOPOGRAPHIC VIEWPORT // BBOX ACTIVE
        </span>
      </div>

      {/* Targeting Mode Active Banner Indicator */}
      {isTargetingMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[460] px-4 py-1.5 bg-red-950/95 border-2 border-red-500 rounded text-red-300 font-mono text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse pointer-events-none">
          <Crosshair className="w-4 h-4 text-red-500 animate-spin" />
          <span>TARGET ACQUISITION: CLICK ANYWHERE ON MAP TO LOCK COORDINATES</span>
        </div>
      )}

      {/* CCTV Placement Mode Active Banner Indicator */}
      {isCctvPlacementMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[460] px-4 py-2 bg-cyan-950/95 border-2 border-cyan-400 rounded-lg text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-2.5 shadow-[0_0_25px_rgba(6,182,212,0.8)] animate-pulse">
          <Video className="w-4 h-4 text-cyan-300 animate-spin" />
          <span>CCTV PLACEMENT MODE: CLICK MAP TO DEPLOY SENSOR</span>
          {onCancelCctvPlacement && (
            <button
              type="button"
              onClick={onCancelCctvPlacement}
              className="ml-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 text-[10px] cursor-pointer"
            >
              CANCEL
            </button>
          )}
        </div>
      )}

      {/* Scanline HUD overlay when CCTV Sensor is active */}
      {cctvConfig?.active && (
        <div className="absolute inset-0 pointer-events-none z-[400] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] opacity-25" />
      )}

      {/* Primary Leaflet Container with Topographical & Tactical Light Basemaps */}
      <MapContainer
        center={targetCoordinates}
        zoom={13}
        scrollWheelZoom={true}
        attributionControl={false}
        className={`w-full h-full z-0 bg-[#0c1017] ${isTargetingMode || isCctvPlacementMode ? 'cursor-crosshair' : ''}`}
        style={{
          filter: mapFilterStyle,
          transition: 'filter 0.35s ease-in-out',
        }}
      >
        <MapCameraController targetCoordinates={targetCoordinates} />
        <TargetingMapEvents
          isTargetingMode={isTargetingMode}
          onLocationAcquired={onLocationAcquired}
          isCctvPlacementMode={isCctvPlacementMode}
          onCctvPlaced={onCctvPlaced}
        />

        {/* Tactical Coordinate Graticule Overlay */}
        <MilitaryGraticuleOverlay />

        {/* BaseLayer Switcher: 100% Free Public CDNs (Zero Watermarks, No API Key Required) */}
        <LayersControl position="topright">
          {/* 1. High-Res Satellite Reconnaissance (Esri World Imagery) - Default C4ISR Layer */}
          <LayersControl.BaseLayer checked name="Satellite Recon (Esri)">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
              attribution="&copy; Esri, Maxar, Earthstar Geographics"
            />
          </LayersControl.BaseLayer>

          {/* 2. Tactical Navigation (OpenStreetMap Standard) */}
          <LayersControl.BaseLayer name="Tactical Street (OpenStreetMap)">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
              attribution="&copy; OpenStreetMap contributors"
            />
          </LayersControl.BaseLayer>

          {/* 3. Tactical Topographical Map (OpenTopoMap) */}
          <LayersControl.BaseLayer name="Tactical Topo (OpenTopoMap)">
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              maxZoom={17}
              subdomains="abc"
              attribution="&copy; OpenTopoMap contributors"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* OSRM Routing Controller */}
        <OSINTRoutingMachine
          activeIncident={activeIncident}
          onRoutingResolved={handleTelemetry}
        />

        {/* ============================================================= */}
        {/* STATIC TACTICAL ROUTES (POLYLINES)                            */}
        {/* ============================================================= */}
        {/* Route A (Medical Supply): color #ff3399, weight 4, opacity 0.85 */}
        <Polyline
          positions={ROUTE_A_WAYPOINTS}
          pathOptions={{
            color: '#ff3399',
            weight: 4,
            opacity: 0.85,
            dashArray: '8, 6',
            lineCap: 'round',
          }}
        />

        {/* Route B (Rapid Civil Defense): color #00ffcc, weight 4, opacity 0.85 */}
        <Polyline
          positions={ROUTE_B_WAYPOINTS}
          pathOptions={{
            color: '#00ffcc',
            weight: 4,
            opacity: 0.85,
            dashArray: '8, 6',
            lineCap: 'round',
          }}
        />

        {/* Dynamic Incident OSINT Vector (Luminous Cyan) */}
        {telemetry?.fallbackRoute && (
          <Polyline
            positions={telemetry.fallbackRoute}
            pathOptions={{
              color: '#00ffcc',
              weight: 4,
              opacity: 0.95,
              dashArray: '4, 4',
              lineCap: 'round',
            }}
          />
        )}

        {/* ============================================================= */}
        {/* LIVE FIELD UNIT TELEMETRY (GLOWING DOTS VIA CIRCLEMARKER)     */}
        {/* Minimalist high-contrast geometry replacing bulky pins        */}
        {/* Required: radius={6}, fillColor="#ffffff", weight={2}, fillOpacity={1} */}
        {/* ============================================================= */}
        {currentUnits.map((unit) => {
          const unitColor = unit.agencyColor || '#0077ff'
          return (
            <CircleMarker
              key={unit.id}
              center={[unit.lat, unit.lng]}
              radius={6}
              fillColor="#ffffff"
              color={unitColor}
              weight={2}
              fillOpacity={1}
            >
              <Popup>
                <div className="p-2 font-mono text-[10px] bg-slate-900 text-white rounded border border-slate-700 min-w-[170px]">
                  <div
                    className="font-bold flex items-center justify-between border-b border-slate-700 pb-1 mb-1"
                    style={{ color: unitColor }}
                  >
                    <span>{unit.callsign || unit.id}</span>
                    <span className="text-[8px] px-1 py-0.2 bg-black/90 rounded border border-slate-700 uppercase">
                      {unit.type}
                    </span>
                  </div>
                  <div className="text-slate-300">
                    STATUS: <span className="text-emerald-400 font-bold">{unit.status}</span>
                  </div>
                  <div className="text-slate-300">
                    SPEED: <span className="text-white font-bold">{unit.speed} km/h</span>
                  </div>
                  <div className="text-cyan-400 text-[9px] mt-1 font-mono">
                    GRID: {unit.lat.toFixed(4)}°N, {unit.lng.toFixed(4)}°E
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Red Target Markers for Incidents */}
        {incidents.map((inc) => {
          const lat = inc.latitude || inc.lat
          const lng = inc.longitude || inc.lng
          if (!lat || !lng) return null

          const severity = inc.classification?.severity_level || inc.severity || 3

          return (
            <Marker
              key={inc.id || `${lat}-${lng}`}
              position={[lat, lng]}
              icon={createMilitaryTargetMarker(severity, inc.id)}
              eventHandlers={{
                click: () => onSelectIncident?.(inc),
              }}
            >
              <Popup>
                <div className="p-2 font-mono text-[11px] bg-slate-900 text-white rounded">
                  <div className="font-bold text-red-500 mb-1 border-b border-slate-700 pb-1">
                    TARGET LOCATED // {inc.id}
                  </div>
                  <div className="font-bold">{inc.location}</div>
                  <div className="text-slate-300 text-[10px] mt-1">
                    {inc.classification?.summary || inc.text}
                  </div>
                  <div className="text-cyan-400 text-[10px] mt-1 font-mono">
                    GRID: {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
        {/* Dynamically Acquired Target Marker */}
        {acquiredCoords && acquiredCoords.lat && acquiredCoords.lng && (
          <Marker
            position={[acquiredCoords.lat, acquiredCoords.lng]}
            icon={createAcquiredTargetMarker()}
          >
            <Popup>
              <div className="p-2 font-mono text-[11px] bg-slate-900 text-white rounded border border-red-500">
                <div className="font-bold text-red-500 mb-1">DYNAMIC TARGET LOCKED</div>
                <div className="text-yellow-300 font-bold">
                  {Number(acquiredCoords.lat).toFixed(6)}°N, {Number(acquiredCoords.lng).toFixed(6)}°E
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        {/* ============================================================= */}
        {/* GEOSPATIAL CCTV SENSOR: FOV Cone & Tactical Camera Marker     */}
        {/* ============================================================= */}
        {cctvConfig?.active && fovConePolygon && (
          <Polygon positions={fovConePolygon} pathOptions={fovConeStyle} />
        )}

        {cctvConfig?.active && cctvConfig.lat && cctvConfig.lng && (
          <Marker
            position={[cctvConfig.lat, cctvConfig.lng]}
            icon={createCctvCameraIcon(cctvConfig.azimuth || 0, cctvConfig.mode || 'DAY')}
          >
            <Popup>
              <div className="p-2 font-mono text-xs bg-slate-950 text-white rounded border border-cyan-500 min-w-[190px]">
                <div className="flex items-center justify-between border-b border-slate-700 pb-1 mb-1 font-bold text-cyan-400">
                  <div className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    <span>CCTV SENSOR</span>
                  </div>
                  <span className="text-[10px] text-slate-300 uppercase">[{cctvConfig.mode}]</span>
                </div>
                <div className="space-y-1 text-slate-300 text-[11px]">
                  <div>GRID: <span className="text-yellow-300 font-bold">{Number(cctvConfig.lat).toFixed(5)}°N, {Number(cctvConfig.lng).toFixed(5)}°E</span></div>
                  <div>AZIMUTH: <span className="text-cyan-300 font-bold">{cctvConfig.azimuth}°</span></div>
                  <div>ZOOM / RANGE: <span className="text-emerald-400 font-bold">{cctvConfig.zoom}X ({cctvConfig.zoom * 500}m)</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Isolated Overlays / Camera Layers */}
        {children}
      </MapContainer>
    </div>
  )
}
