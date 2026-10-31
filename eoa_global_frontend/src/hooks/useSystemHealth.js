import { useState, useEffect, useCallback, useRef } from 'react'
import { API_BASE_URL } from '../services/api'

/**
 * Custom hook monitoring independent health of the Humanitarian EOC system:
 * - REST API Availability & Latency
 * - WebSocket Live Telemetry Link
 * - Computed Overall System Status (ONLINE, DEGRADED, OFFLINE, CONNECTING)
 * - Last Sync Timestamp
 */
export function useSystemHealth(wsConnectionStatus = 'disconnected') {
  const [apiStatus, setApiStatus] = useState('CONNECTING') // 'ONLINE' | 'OFFLINE' | 'CONNECTING'
  const [apiLatencyMs, setApiLatencyMs] = useState(null)
  const [lastSyncTime, setLastSyncTime] = useState(null)
  const checkIntervalRef = useRef(null)

  const checkApiHealth = useCallback(async () => {
    const startTime = performance.now()
    try {
      // Probe resources endpoint or root
      const res = await fetch(`${API_BASE_URL}/resources/hospitals`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }).catch(async () => {
        // Fallback probe
        return await fetch(API_BASE_URL.replace('/api', '') + '/', { method: 'GET' })
      })

      const elapsed = Math.round(performance.now() - startTime)
      if (res && res.ok) {
        setApiStatus('ONLINE')
        setApiLatencyMs(elapsed)
        setLastSyncTime(new Date().toISOString().slice(11, 19) + ' UTC')
      } else {
        setApiStatus('DEGRADED')
        setApiLatencyMs(elapsed)
      }
    } catch (err) {
      setApiStatus('OFFLINE')
      setApiLatencyMs(null)
    }
  }, [])

  useEffect(() => {
    checkApiHealth()
    checkIntervalRef.current = setInterval(checkApiHealth, 20000)

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
    }
  }, [checkApiHealth])

  // Derive WebSocket normalized status
  const wsStatusNormalized =
    wsConnectionStatus === 'connected'
      ? 'ONLINE'
      : wsConnectionStatus === 'connecting'
      ? 'CONNECTING'
      : 'DISCONNECTED'

  // Derive Overall System Status
  let overallStatus = 'CONNECTING'
  let statusMessage = 'Checking EOC services...'

  if (apiStatus === 'ONLINE' && wsStatusNormalized === 'ONLINE') {
    overallStatus = 'ONLINE'
    statusMessage = 'All emergency communication channels operational'
  } else if (apiStatus === 'ONLINE' && wsStatusNormalized !== 'ONLINE') {
    overallStatus = 'DEGRADED'
    statusMessage = 'REST API operational; WebSocket stream reconnecting'
  } else if (apiStatus === 'OFFLINE') {
    overallStatus = 'OFFLINE'
    statusMessage = 'Backend service unreachable; check host network connection'
  } else {
    overallStatus = 'CONNECTING'
    statusMessage = 'Establishing link with EOC backend...'
  }

  return {
    overallStatus,
    apiStatus,
    wsStatus: wsStatusNormalized,
    apiLatencyMs,
    lastSyncTime,
    statusMessage,
    checkApiHealth,
  }
}

export default useSystemHealth
