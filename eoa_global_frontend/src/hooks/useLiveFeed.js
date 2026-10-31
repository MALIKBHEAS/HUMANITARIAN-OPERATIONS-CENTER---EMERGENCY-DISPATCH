import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL, WS_BASE_URL } from '../services/api'

// Canonical Tactical Transit Waypoints for Route A (Medical) & Route B (Civil Defense)
export const TACTICAL_WAYPOINTS = {
  ROUTE_A_MEDICAL: [
    [31.4920, 34.4320],
    [31.4985, 34.4410],
    [31.5050, 34.4490],
    [31.5125, 34.4533],
    [31.5190, 34.4580],
    [31.5240, 34.4640],
  ],
  ROUTE_B_CIVIL_DEFENSE: [
    [31.5280, 34.4320],
    [31.5220, 34.4390],
    [31.5170, 34.4460],
    [31.5125, 34.4533],
    [31.5060, 34.4620],
    [31.4990, 34.4710],
  ],
}

// Initial Live Mobilized Field Units for C4ISR Tracking
const INITIAL_LIVE_UNITS = [
  {
    id: 'UNIT-BRAVO-01',
    callsign: 'RAPID-CD-01',
    type: 'CivilDefense',
    lat: 31.5280,
    lng: 34.4320,
    speed: 56,
    heading: 142,
    status: 'TRANSIT ROUTE B',
    agencyColor: '#00ffcc', // Rapid Civil Defense Color
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
    agencyColor: '#ff3399', // Medical Supply Color
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
    agencyColor: '#0077ff', // Military Blue
    routeId: 'STATIC',
    currentWaypointIndex: 0,
  },
]

export const useLiveFeed = () => {
  const { token, tenantId } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [activeIncident, setActiveIncident] = useState(null)
  const [liveUnits, setLiveUnits] = useState(INITIAL_LIVE_UNITS)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(() => {
    if (!token || !tenantId) return

    const wsUrl = `${WS_BASE_URL}/${tenantId}?token=${encodeURIComponent(token)}`

    setConnectionStatus('connecting')

    try {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setConnectionStatus('connected')
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === 'HEARTBEAT_ACK') return

          // Process Real-time GPS Unit Telemetry stream
          if (data.type === 'UNIT_TELEMETRY_UPDATE' || data.type === 'GPS_STREAM') {
            setLiveUnits((prevUnits) => {
              const existingIdx = prevUnits.findIndex((u) => u.id === data.unit_id)
              const updatedUnit = {
                id: data.unit_id,
                callsign: data.callsign || data.unit_id,
                type: data.unit_type || 'CivilDefense',
                lat: data.latitude,
                lng: data.longitude,
                speed: data.speed || 48,
                heading: data.heading || 0,
                status: data.status || 'EN ROUTE',
                agencyColor: data.agency_color || '#0077ff',
                lastUpdated: Date.now(),
              }
              if (existingIdx >= 0) {
                const next = [...prevUnits]
                next[existingIdx] = { ...next[existingIdx], ...updatedUnit }
                return next
              }
              return [...prevUnits, updatedUnit]
            })
            return
          }

          // Process AI Orchestrated Incident Dispatches
          if (data.type === 'AI_ORCHESTRATED_DISPATCH_ORDER' || data.type === 'LIVE_INCIDENT_STREAM_UPDATE') {
            const normalizedIncident = {
              id: data.dispatch_id || data.event_id || `inc-${Date.now()}`,
              timestamp: data.processed_at || data.timestamp || new Date().toISOString(),
              tenantId: data.tenant_id,
              location: data.parsed_location || data.location?.address_or_landmark || 'General Operational Sector',
              latitude: data.location?.latitude || data.raw_incident?.latitude || (31.5125 + (Math.random() * 0.02 - 0.01)),
              longitude: data.location?.longitude || data.raw_incident?.longitude || (34.4533 + (Math.random() * 0.02 - 0.01)),
              classification: data.classification || {
                category: 'General',
                severity_level: 3,
                summary: 'Emergency event dispatched.',
              },
              dispatches: data.dispatches || data.tactical_dispatches || [],
              summary: data.summary || data.tactical_summary || {},
              status: 'ACTIVE DISPATCH',
              raw: data,
            }

            setIncidents((prev) => [normalizedIncident, ...prev])
            setActiveIncident(normalizedIncident)
          }
        } catch (err) {
          console.error('[LiveFeed] Failed to parse WebSocket packet:', err)
        }
      }

      socket.onerror = (error) => {
        console.warn('[LiveFeed] WebSocket encountered error:', error)
      }

      socket.onclose = (event) => {
        setConnectionStatus('disconnected')
        socketRef.current = null

        if (event.code !== 1000 && !reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null
            connect()
          }, 3000)
        }
      }
    } catch (e) {
      setConnectionStatus('disconnected')
    }
  }, [token, tenantId])

  useEffect(() => {
    connect()

    const heartbeatInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }))
      }
    }, 25000)

    return () => {
      clearInterval(heartbeatInterval)
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounted')
      }
    }
  }, [connect])

  const triggerTestSOS = async (sosPayload) => {
    if (!token) return

    const response = await fetch(`${API_BASE_URL}/v1/sos/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sosPayload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Failed to submit SOS')
    }

    return await response.json()
  }

  const addIncident = useCallback((incident) => {
    setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)])
    setActiveIncident(incident)
  }, [])

  return {
    incidents,
    activeIncident,
    setActiveIncident,
    addIncident,
    liveUnits,
    setLiveUnits,
    connectionStatus,
    triggerTestSOS,
    tenantId,
  }
}
