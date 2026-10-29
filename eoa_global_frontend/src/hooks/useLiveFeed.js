import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

export const useLiveFeed = () => {
  const { token, tenantId } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [activeIncident, setActiveIncident] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const socketRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(() => {
    if (!token || !tenantId) return

    // Determine correct WebSocket protocol based on browser environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // If running Vite on port 3000, Vite proxies /ws to localhost:8000
    const wsUrl = `${protocol}//${host}/ws/live-feed/${tenantId}?token=${encodeURIComponent(token)}`

    setConnectionStatus('connecting')

    try {
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket

      socket.onopen = () => {
        setConnectionStatus('connected')
        // Clear any pending reconnects
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
          reconnectTimeoutRef.current = null
        }
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Filter out simple ping/acks
          if (data.type === 'HEARTBEAT_ACK') return

          // Process Initial Connection or Live Incident Stream
          if (data.type === 'AI_ORCHESTRATED_DISPATCH_ORDER' || data.type === 'LIVE_INCIDENT_STREAM_UPDATE') {
            // Normalize payload structure
            const normalizedIncident = {
              id: data.dispatch_id || data.event_id || `inc-${Date.now()}`,
              timestamp: data.processed_at || data.timestamp || new Date().toISOString(),
              tenantId: data.tenant_id,
              location: data.parsed_location || data.location?.address_or_landmark || 'General Operational Sector',
              latitude: data.location?.latitude || data.raw_incident?.latitude || (31.5 + (Math.random() * 0.1 - 0.05)),
              longitude: data.location?.longitude || data.raw_incident?.longitude || (34.45 + (Math.random() * 0.1 - 0.05)),
              classification: data.classification || {
                category: 'General',
                severity_level: 3,
                summary: 'Emergency event dispatched.',
              },
              dispatches: data.dispatches || data.tactical_dispatches || [],
              summary: data.summary || data.tactical_summary || {},
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

        // Auto-reconnect with exponential backoff if not closed cleanly
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

    // Send heartbeat keep-alive every 25 seconds
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

  // Helper method to trigger a test emergency SOS into the live queue
  const triggerTestSOS = async (sosPayload) => {
    if (!token) return

    const response = await fetch('/api/v1/sos/trigger', {
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

  // Prepend new incident directly into local feed and set as active target
  const addIncident = useCallback((incident) => {
    setIncidents((prev) => [incident, ...prev.filter((i) => i.id !== incident.id)])
    setActiveIncident(incident)
  }, [])

  return {
    incidents,
    activeIncident,
    setActiveIncident,
    addIncident,
    connectionStatus,
    triggerTestSOS,
    tenantId,
  }
}
