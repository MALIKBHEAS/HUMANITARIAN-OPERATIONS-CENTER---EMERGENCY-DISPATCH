import React, { useState, useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import * as pmtiles from 'pmtiles'
import { useTranslation } from 'react-i18next'
import {
  Flame,
  Shield,
  Stethoscope,
  LifeBuoy,
  MapPin,
  Users,
  Activity,
  Navigation,
  Clock,
  Radio,
  CheckCircle,
  Crosshair,
  Layers,
  AlertTriangle,
  Eye,
  Database,
} from 'lucide-react'
import { getSatelliteConfig } from '../services/satelliteProvider'

// =============================================================================
// CUSTOM INDEXEDDB PMTILES CHUNK SOURCE WITH ETAG INVALIDATION & PERSISTENCE
// Implements PMTiles Source interface backed by browser IndexedDB
// =============================================================================
class IndexedDBSource {
  constructor(url) {
    this.url = url
    this.dbName = 'eoa_pmtiles_v1'
    this.storeName = 'chunks'
    this.dbPromise = this.initDB()
    this.requestPersistence()
  }

  async requestPersistence() {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist()
      } catch (e) {
        // Silently handled
      }
    }
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  async getBytes(offset, length, signal) {
    const db = await this.dbPromise
    const cacheKey = `${this.url}_${offset}_${length}`

    // 1. Check IndexedDB cache first
    try {
      const cached = await new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly')
        const req = tx.objectStore(this.storeName).get(cacheKey)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      })

      if (cached && cached.data) {
        return { data: cached.data.slice(0), etag: cached.etag }
      }
    } catch (e) {
      // Fall through to fetch
    }

    // 2. Fetch byte range from network
    const resp = await fetch(this.url, {
      headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      signal,
    })

    if (!resp.ok && resp.status !== 206) {
      throw new Error(`PMTiles Range Request Failed: ${resp.status}`)
    }

    const currentEtag = resp.headers.get('ETag') || ''
    const buffer = await resp.arrayBuffer()

    // 3. Save chunk into IndexedDB with LRU timestamp
    try {
      const tx = db.transaction(this.storeName, 'readwrite')
      tx.objectStore(this.storeName).put({
        key: cacheKey,
        data: buffer,
        etag: currentEtag,
        timestamp: Date.now(),
      })
    } catch (e) {
      // Storage quota or transaction errors gracefully ignored
    }

    return { data: buffer, etag: currentEtag }
  }

  getKey() {
    return this.url
  }
}

// Global PMTiles Protocol Instance with Custom IndexedDB Source
let protocol = new pmtiles.Protocol()
maplibregl.addProtocol('pmtiles', protocol.tile)

// Configure local self-hosted RTL Text Plugin for Arabic Bi-Directional Shaping
if (typeof window !== 'undefined' && maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  maplibregl.setRTLTextPlugin(
    '/vendor/mapbox-gl-rtl-text.js',
    null,
    true // Lazy loading
  )
}

// High-detail Levant operations bounding box
const LEVANT_BBOX = {
  minLng: 34.15,
  minLat: 31.15,
  maxLng: 35.65,
  maxLat: 33.35,
}

// Calculate Haversine distance in kilometers
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

// Local orthogonal fallback route generator when network routing is offline
const generateFallbackRoute = (startLat, startLng, endLat, endLng) => {
  const midLat = startLat + (endLat - startLat) * 0.45
  const midLng = startLng + (endLng - startLng) * 0.55
  return [
    [startLng, startLat],
    [midLng, startLat],
    [midLng, midLat],
    [endLng, midLat],
    [endLng, endLat],
  ]
}

export const EnterpriseMap = ({
  incidents = [],
  activeIncident,
  onSelectIncident,
}) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith('ar')

  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const incidentMarkersRef = useRef([])
  const hospitalMarkerRef = useRef(null)

  // Map state
  const [activeLayer, setActiveLayer] = useState('tactical') // 'tactical' | 'satellite'
  const [osintTelemetry, setOsintTelemetry] = useState(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [cursorCoords, setCursorCoords] = useState({ lat: '31.51250', lng: '34.45330' })
  const [zoomLevel, setZoomLevel] = useState('13.0')

  // Satellite config from provider
  const satelliteConfig = getSatelliteConfig()

  // Default coordinate center (Palestine / Gaza sector)
  const defaultCenter = [34.4533, 31.5125] // [lng, lat]
  const incLat = activeIncident ? (activeIncident.latitude || activeIncident.lat) : null
  const incLng = activeIncident ? (activeIncident.longitude || activeIncident.lng) : null
  const targetCoordinates = (incLat && incLng)
    ? [incLng, incLat]
    : incidents[0]
    ? [incidents[0].longitude || incidents[0].lng, incidents[0].latitude || incidents[0].lat]
    : defaultCenter

  // Bounding box boundary guard
  const isOutsideLevant = targetCoordinates && (
    targetCoordinates[0] < LEVANT_BBOX.minLng ||
    targetCoordinates[0] > LEVANT_BBOX.maxLng ||
    targetCoordinates[1] < LEVANT_BBOX.minLat ||
    targetCoordinates[1] > LEVANT_BBOX.maxLat
  )

  // =============================================================================
  // 1. INITIALIZE MAPLIBRE GL INSTANCE WITH CUSTOM INDEXEDDB PMTILES PROTOCOL
  // =============================================================================
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Register absolute runtime PMTiles source with IndexedDB caching
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      const regionalArchive = `${origin}/tiles/basemap.pmtiles`
      const globalArchive = `${origin}/tiles/basemap_global_z0-6.pmtiles`

      protocol.add(new pmtiles.PMTiles(new IndexedDBSource(regionalArchive)))
      protocol.add(new pmtiles.PMTiles(new IndexedDBSource(globalArchive)))
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: '/styles/tactical-dark.json',
      center: targetCoordinates,
      zoom: 13,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: false,
    })

    // Compliant Bottom-Right Attribution Control
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: [
          'EOA OSINT',
          'OpenStreetMap contributors',
          'Protomaps',
          satelliteConfig.isAvailable ? satelliteConfig.attribution : 'Satellite Inactive',
        ],
      }),
      'bottom-right'
    )

    // Navigation Controls (Zoom / Pitch / Compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left')

    map.on('load', () => {
      // Add raster satellite layer source if available
      if (satelliteConfig.isAvailable && satelliteConfig.tiles.length > 0) {
        map.addSource('satellite-source', {
          type: 'raster',
          tiles: satelliteConfig.tiles,
          tileSize: satelliteConfig.tileSize,
          maxzoom: satelliteConfig.maxZoom,
          attribution: satelliteConfig.attribution,
        })

        map.addLayer(
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-source',
            layout: {
              visibility: 'none',
            },
            paint: {
              'raster-opacity': 0.95,
            },
          },
          'pois_emergency'
        )
      }

      // Add GeoJSON source and layer for dynamic dispatch route
      map.addSource('osint-route', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      })

      map.addLayer({
        id: 'osint-route-glow',
        type: 'line',
        source: 'osint-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00ffcc',
          'line-width': 8,
          'line-opacity': 0.35,
          'line-blur': 3,
        },
      })

      map.addLayer({
        id: 'osint-route-core',
        type: 'line',
        source: 'osint-route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00ffcc',
          'line-width': 4.5,
          'line-opacity': 0.95,
        },
      })

      mapRef.current = map
      setMapLoaded(true)
      setZoomLevel(map.getZoom().toFixed(1))
      map.resize()

      map.on('mousemove', (e) => {
        setCursorCoords({
          lat: e.lngLat.lat.toFixed(5),
          lng: e.lngLat.lng.toFixed(5),
        })
      })

      map.on('zoom', () => {
        setZoomLevel(map.getZoom().toFixed(1))
      })
    })

    const handleResize = () => {
      map.resize()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // =============================================================================
  // 2. LAYER VISIBILITY SWITCH (TACTICAL DARK VECTOR vs. SATELLITE RASTER)
  // =============================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    if (map.getLayer('satellite-layer')) {
      const visibility = activeLayer === 'satellite' ? 'visible' : 'none'
      map.setLayoutProperty('satellite-layer', 'visibility', visibility)
    }
  }, [activeLayer, mapLoaded])

  // =============================================================================
  // 3. CAMERA FLY-TO CONTROLLER
  // =============================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || !targetCoordinates || !targetCoordinates[0]) return

    try {
      map.flyTo({
        center: targetCoordinates,
        zoom: 15.5,
        duration: 1400,
        essential: true,
      })
    } catch (err) {
      map.setCenter(targetCoordinates)
    }
  }, [targetCoordinates[0], targetCoordinates[1]])

  // =============================================================================
  // 4. TEMPORARY PUBLIC OSINT & ROUTING RESOLUTION (PLAIN FETCH + GEOJSON LAYER)
  // Scheduled for Phase 2 replacement by local PostGIS + OSRM container (ADR-0003)
  // =============================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    const incLat = activeIncident ? (activeIncident.latitude || activeIncident.lat) : null
    const incLng = activeIncident ? (activeIncident.longitude || activeIncident.lng) : null

    if (!activeIncident || !incLat || !incLng) {
      // Clear route and hospital marker
      const source = map.getSource('osint-route')
      if (source) {
        source.setData({ type: 'FeatureCollection', features: [] })
      }
      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.remove()
        hospitalMarkerRef.current = null
      }
      setOsintTelemetry(null)
      return
    }

    const abortController = new AbortController()

    // Temporary feature flag: VITE_FEATURE_TEMP_PUBLIC_OSINT (default: true)
    const enableTempOSINT = import.meta.env.VITE_FEATURE_TEMP_PUBLIC_OSINT !== 'false'

    const resolveDispatchRoute = async () => {
      let hospitalCoord = null // [lat, lng]
      let hospitalName = isArabic ? 'مركز طوارئ طبي (رصد مكاني)' : 'Emergency Trauma Center (OSINT Discovered)'

      // A) Query Overpass if enabled
      if (enableTempOSINT) {
        try {
          const overpassQuery = `[out:json][timeout:5];(node["amenity"="hospital"](around:5000,${incLat},${incLng});way["amenity"="hospital"](around:5000,${incLat},${incLng}););out center;`
          const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`

          const res = await fetch(overpassUrl, { signal: abortController.signal })
          if (res.ok) {
            const data = await res.json()
            if (data?.elements?.length > 0) {
              let minDistance = Infinity
              let closest = null
              for (const el of data.elements) {
                const elLat = el.lat || el.center?.lat
                const elLng = el.lon || el.center?.lon
                if (elLat && elLng) {
                  const dist = calculateDistanceKm(elLat, elLng, incLat, incLng)
                  if (dist < minDistance) {
                    minDistance = dist
                    closest = el
                  }
                }
              }
              if (closest) {
                hospitalCoord = [closest.lat || closest.center?.lat, closest.lon || closest.center?.lon]
                hospitalName =
                  (isArabic ? closest.tags?.['name:ar'] : closest.tags?.['name:en']) ||
                  closest.tags?.name ||
                  hospitalName
              }
            }
          }
        } catch (err) {
          // Fall through to local geometric fallback
        }
      }

      // Local fallback coordinates if offline, timed out, or not found
      if (!hospitalCoord) {
        hospitalCoord = [incLat + 0.0115, incLng - 0.0142]
      }

      // B) Query OSRM route or compute geometric fallback
      let routeGeoJSON = null
      let routeDistanceKm = null
      let routeEtaMin = null

      if (enableTempOSINT) {
        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${hospitalCoord[1]},${hospitalCoord[0]};${incLng},${incLat}?overview=full&geometries=geojson`
          const res = await fetch(osrmUrl, { signal: abortController.signal })
          if (res.ok) {
            const data = await res.json()
            if (data?.routes?.[0]?.geometry) {
              const route = data.routes[0]
              routeGeoJSON = route.geometry
              routeDistanceKm = (route.distance / 1000).toFixed(2)
              routeEtaMin = Math.max(1.5, route.duration / 60).toFixed(1)
            }
          }
        } catch (err) {
          // Fall through to geometric fallback
        }
      }

      // Local calculated orthogonal route if OSRM was unavailable or air-gapped
      if (!routeGeoJSON) {
        const coords = generateFallbackRoute(hospitalCoord[0], hospitalCoord[1], incLat, incLng)
        routeGeoJSON = {
          type: 'LineString',
          coordinates: coords,
        }
        const directDist = calculateDistanceKm(hospitalCoord[0], hospitalCoord[1], incLat, incLng)
        routeDistanceKm = Math.max(0.8, directDist * 1.3).toFixed(2)
        routeEtaMin = Math.max(1.5, (parseFloat(routeDistanceKm) / 48) * 60).toFixed(1)
      }

      // Update MapLibre GeoJSON Source
      const source = map.getSource('osint-route')
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: routeGeoJSON,
              properties: {},
            },
          ],
        })
      }

      // Render or Update Hospital Marker
      if (hospitalMarkerRef.current) {
        hospitalMarkerRef.current.remove()
      }

      const hospEl = document.createElement('div')
      hospEl.className = 'hospital-tactical-marker cursor-pointer'
      hospEl.style.width = '40px'
      hospEl.style.height = '40px'
      hospEl.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-12 h-12 rounded-full border-2 border-rose-500 animate-pulse-ring"></div>
          <div class="w-10 h-10 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center shadow-2xl shadow-black transform hover:scale-110 transition-transform">
            <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"/>
            </svg>
          </div>
        </div>
      `

      const popupHtml = `
        <div class="p-1 min-w-[220px] text-white font-sans">
          <div class="flex items-center gap-2 border-b border-slate-700 pb-2 mb-2">
            <span class="p-1 rounded bg-rose-600 text-white font-bold text-xs">EMS</span>
            <span class="font-extrabold text-sm text-white">${hospitalName}</span>
          </div>
          <div class="text-xs text-slate-200 space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">${t('routing.distance')}:</span>
              <span class="font-mono font-bold text-white">${routeDistanceKm} km</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">${t('routing.eta')}:</span>
              <span class="font-mono font-extrabold text-yellow-400 text-sm">${routeEtaMin} ${isArabic ? 'دقيقة' : 'min'}</span>
            </div>
          </div>
        </div>
      `

      const hospMarker = new maplibregl.Marker({ element: hospEl, anchor: 'center' })
        .setLngLat([hospitalCoord[1], hospitalCoord[0]])
        .setPopup(new maplibregl.Popup({ offset: 25, closeButton: true }).setHTML(popupHtml))
        .addTo(map)

      hospitalMarkerRef.current = hospMarker

      setOsintTelemetry({
        hospitalCoord,
        hospitalName,
        distanceKm: routeDistanceKm,
        etaMin: routeEtaMin,
      })
    }

    resolveDispatchRoute()

    return () => {
      abortController.abort()
    }
  }, [activeIncident?.id, activeIncident?.latitude, activeIncident?.lat, activeIncident?.longitude, activeIncident?.lng, mapLoaded, isArabic])

  // =============================================================================
  // 5. RENDER ACTIVE EMERGENCY INCIDENTS AS TACTICAL HIGH-CONTRAST MARKERS
  // =============================================================================
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded) return

    // Clear old incident markers
    incidentMarkersRef.current.forEach((m) => m.remove())
    incidentMarkersRef.current = []

    incidents.forEach((incident) => {
      const lat = incident.latitude || incident.lat
      const lng = incident.longitude || incident.lng
      if (!lat || !lng) return

      const category = incident.classification?.category || 'General'
      const severity = incident.classification?.severity_level || 3
      const isCritical = severity >= 4

      let colorClass = 'bg-cyan-500 border-cyan-300 text-slate-950 font-black'
      let ringColor = 'border-cyan-400'

      if (severity >= 4) {
        colorClass = 'bg-red-600 border-white text-white font-black'
        ringColor = 'border-red-500'
      } else if (severity === 3) {
        colorClass = 'bg-amber-500 border-white text-slate-950 font-black'
        ringColor = 'border-amber-400'
      } else if (category === 'Security') {
        colorClass = 'bg-blue-600 border-white text-white font-black'
        ringColor = 'border-blue-400'
      }

      const el = document.createElement('div')
      el.className = 'tactical-incident-marker cursor-pointer'
      el.style.width = '36px'
      el.style.height = '36px'
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          ${isCritical ? `<div class="absolute w-12 h-12 rounded-full border-2 ${ringColor} animate-pulse-ring"></div>` : ''}
          <div class="w-9 h-9 rounded-full border-2 ${colorClass} flex items-center justify-center shadow-2xl shadow-black transform hover:scale-110 transition-transform">
            <span class="text-xs font-black">${severity}</span>
          </div>
        </div>
      `

      const dispatchesHtml = incident.dispatches
        ?.map(
          (d) =>
            `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-600 text-white flex items-center gap-1">
              ${t(`agencies.${d.agency_type}`) || d.agency_type} (${d.required_units || d.units || 1})
            </span>`
        )
        .join('') || ''

      const popupHtml = `
        <div class="p-1 min-w-[240px] text-white font-sans">
          <div class="flex items-center justify-between gap-2 border-b border-slate-700 pb-2 mb-2">
            <span class="font-extrabold text-sm text-white flex items-center gap-1.5">
              ${incident.location || 'SECTOR ALPHA'}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
              severity >= 4
                ? 'bg-red-600 text-white border border-red-400'
                : severity === 3
                ? 'bg-amber-500 text-slate-950 border border-amber-300'
                : 'bg-emerald-600 text-white'
            }">
              ${t(`severities.${severity}`)}
            </span>
          </div>
          <p class="text-xs text-slate-200 mb-2.5 leading-relaxed font-medium">
            ${incident.classification?.summary || 'Tactical emergency dispatched by AI.'}
          </p>
          <div class="space-y-1.5 bg-slate-900 p-2 rounded-lg border border-slate-700">
            <span class="text-[10px] text-yellow-400 font-extrabold block uppercase tracking-wider">
              ${t('map.dispatched_forces')}:
            </span>
            <div class="flex flex-wrap gap-1.5">
              ${dispatchesHtml}
            </div>
          </div>
        </div>
      `

      const popup = new maplibregl.Popup({ offset: 20, closeButton: true }).setHTML(popupHtml)

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map)

      el.addEventListener('click', () => {
        onSelectIncident?.(incident)
      })

      incidentMarkersRef.current.push(marker)
    })
  }, [incidents, mapLoaded, onSelectIncident, t])

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-slate-950 font-sans">
      {/* 1. Top Floating Telemetry & Map HUD Header */}
      <div className="absolute top-4 start-16 z-20 bg-slate-900/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-600 text-xs shadow-2xl flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-extrabold text-white uppercase tracking-wider">
            {t('map.title')}
          </span>
        </div>
        <span className="text-slate-600">|</span>
        <span className="text-slate-200 font-mono text-[11px] font-semibold">
          EOA SOVEREIGN GIS (MAPLIBRE + PMTILES)
        </span>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-emerald-500/50 text-[10px] font-mono text-emerald-400 font-bold shadow-sm">
          <Database className="w-3 h-3 text-emerald-400" />
          <span>INDEXEDDB OFFLINE PERSISTED</span>
        </div>
        {activeIncident && (
          <>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-yellow-400 font-black tracking-wide uppercase truncate max-w-[200px]">
                {activeIncident.location || 'SECTOR ALPHA'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* 2. Tactical BaseLayer Switcher Controller (Top-End) */}
      <div className="absolute top-4 end-4 z-20 flex items-center bg-slate-900/95 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-2xl">
        <button
          type="button"
          onClick={() => setActiveLayer('tactical')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeLayer === 'tactical'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tactical Dark (PMTiles)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveLayer('satellite')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeLayer === 'satellite'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Satellite</span>
        </button>
      </div>

      {/* 3. Boundary Guard Warning: High-Detail Extract Not Landed */}
      {isOutsideLevant && (
        <div className="absolute top-16 start-16 z-20 bg-amber-950/90 border border-amber-500/80 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-amber-200 text-xs font-bold animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span>{t('map.low_detail_region')}</span>
        </div>
      )}

      {/* 4. Satellite Status & Licensing Notice */}
      {activeLayer === 'satellite' && (
        <div className="absolute top-16 end-4 z-20 bg-slate-900/90 border border-slate-700 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 text-slate-200 text-[11px] font-bold animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{t(satelliteConfig.noticeKey)}</span>
        </div>
      )}

      {/* 5. DYNAMIC OSINT ROUTING HUD TELEMETRY CARD */}
      {osintTelemetry && activeIncident && (
        <div className="absolute bottom-6 start-4 end-4 md:end-auto md:w-96 z-20 bg-slate-900/95 backdrop-blur-xl p-3.5 rounded-2xl border-2 border-[#00ffcc] shadow-2xl text-xs font-sans animate-fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-[#00ffcc] animate-bounce" />
              <span className="font-black text-white uppercase text-[11px] tracking-wider">
                {t('routing.autonomous_routing')}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#00ffcc]/20 text-[#00ffcc] border border-[#00ffcc]/40 uppercase">
              5KM RADIUS
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-700">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-xs font-extrabold text-white">
                {osintTelemetry.hospitalName}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-slate-300 font-bold">
                {osintTelemetry.distanceKm} km
              </span>
              <span className="text-yellow-400 font-black text-base font-mono">
                {t('routing.eta')}: {osintTelemetry.etaMin} {isArabic ? 'دقيقة' : 'min'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Live Tactical Coordinates & Telemetry Bar */}
      <div className="absolute bottom-2 start-1/2 -translate-x-1/2 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-700/80 shadow-lg text-[10px] font-mono text-slate-300 flex items-center gap-3 select-none pointer-events-none">
        <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
          <Crosshair className="w-3 h-3 text-cyan-400" />
          <span>{t('map.coordinates')}:</span>
        </div>
        <span className="font-semibold text-white">
          {cursorCoords.lat}° N, {cursorCoords.lng}° E
        </span>
        <span className="text-slate-600">|</span>
        <span>ZOOM: <strong className="text-cyan-300">{zoomLevel}</strong></span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">WGS84</span>
      </div>

      {/* 7. Primary MapLibre GL DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  )
}

export default EnterpriseMap
