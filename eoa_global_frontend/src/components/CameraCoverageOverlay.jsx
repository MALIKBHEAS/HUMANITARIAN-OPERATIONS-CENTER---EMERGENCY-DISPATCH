import React, { useMemo } from 'react'
import { Marker, Polygon, Popup } from 'react-leaflet'
import L from 'leaflet'
import { Video, Compass, Eye, MapPin, Activity } from 'lucide-react'

/**
 * Calculates geographical coordinates of a camera's viewing sector arc.
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} headingDeg - Compass heading in degrees (0 = North)
 * @param {number} fovDeg - Field of view in degrees
 * @param {number} rangeMeters - Visual coverage range in meters
 * @param {number} numPoints - Interpolation resolution
 */
export function calculateSectorPolygon(lat, lng, headingDeg, fovDeg, rangeMeters, numPoints = 16) {
  const earthRadius = 6371000 // Earth radius in meters
  const halfFov = fovDeg / 2
  const startAngle = headingDeg - halfFov
  const endAngle = headingDeg + halfFov

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

/**
 * Generates an SVG camera marker icon with a direction needle.
 */
export function createCameraMarkerIcon(heading = 0, isSelected = false, status = 'ACTIVE') {
  const statusColor = status === 'ACTIVE' ? '#10b981' : status === 'STANDBY' ? '#f59e0b' : '#94a3b8'
  const ringColor = isSelected ? '#06b6d4' : '#334155'
  const pulseClass = isSelected ? 'box-shadow: 0 0 14px rgba(6, 182, 212, 0.85);' : ''

  const html = `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <div style="position: absolute; inset: 0; border-radius: 9999px; border: 2px solid ${ringColor}; background: rgba(15, 23, 42, 0.92); ${pulseClass}"></div>
      <div style="position: absolute; width: 100%; height: 100%; transform: rotate(${heading}deg); pointer-events: none;">
        <div style="position: absolute; top: -7px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid ${statusColor};"></div>
      </div>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: relative; z-index: 10;">
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    </div>
  `

  return L.divIcon({
    html,
    className: 'custom-camera-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

/**
 * Isolated Camera Coverage Overlay component for Leaflet.
 * Renders camera markers and dynamic viewing sectors without altering the underlying map engine.
 */
export const CameraCoverageOverlay = ({
  cameras = [],
  activeCameraId = null,
  onSelectCamera = null,
  showAllSectors = false,
}) => {
  if (!cameras || cameras.length === 0) return null

  return (
    <>
      {cameras.map((cam) => {
        const isSelected = cam.id === activeCameraId
        const shouldShowSector = isSelected || showAllSectors

        const sectorPolygon = shouldShowSector
          ? calculateSectorPolygon(
              cam.lat,
              cam.lng,
              cam.heading || 0,
              cam.fov || 60,
              cam.rangeMeters || 350
            )
          : null

        return (
          <React.Fragment key={cam.id}>
            {/* Visual Coverage Sector Wedge */}
            {sectorPolygon && (
              <Polygon
                positions={sectorPolygon}
                pathOptions={{
                  color: isSelected ? '#06b6d4' : '#38bdf8',
                  weight: isSelected ? 2 : 1,
                  dashArray: isSelected ? '4, 4' : '2, 4',
                  fillColor: isSelected ? '#06b6d4' : '#0284c7',
                  fillOpacity: isSelected ? 0.22 : 0.1,
                }}
              />
            )}

            {/* Camera Position Marker */}
            <Marker
              position={[cam.lat, cam.lng]}
              icon={createCameraMarkerIcon(cam.heading || 0, isSelected, cam.status)}
              eventHandlers={{
                click: () => onSelectCamera && onSelectCamera(cam),
              }}
            >
              <Popup>
                <div className="p-2 font-sans text-xs bg-slate-900 text-white rounded border border-slate-700 min-w-[200px]">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <Video className="w-3.5 h-3.5" />
                      <span>{cam.name || cam.id}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        cam.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {cam.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="truncate">{cam.location}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                      <span>GRID:</span>
                      <span className="text-yellow-300">
                        {cam.lat.toFixed(5)}°N, {cam.lng.toFixed(5)}°E
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-mono text-[10px]">
                      <span>Heading: <strong className="text-white">{cam.heading}°</strong></span>
                      <span>FOV: <strong className="text-white">{cam.fov}°</strong></span>
                      <span>Range: <strong className="text-white">{cam.rangeMeters}m</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectCamera && onSelectCamera(cam)}
                    className="w-full mt-2 px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[11px] transition-colors"
                  >
                    Open in CCTV Control Center
                  </button>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        )
      })}
    </>
  )
}

export default CameraCoverageOverlay
