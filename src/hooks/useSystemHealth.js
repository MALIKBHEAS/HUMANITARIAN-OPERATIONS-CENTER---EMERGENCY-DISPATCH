import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../api';

export function useSystemHealth(wsConnectionStatus = 'disconnected') {
  const [apiStatus, setApiStatus] = useState('CONNECTING');
  const [apiLatencyMs, setApiLatencyMs] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const checkIntervalRef = useRef(null);

  const checkApiHealth = useCallback(async () => {
    const startTime = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/resources/hospitals`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }).catch(async () => {
        return await fetch(API_BASE_URL.replace('/api', '') + '/', { method: 'GET' });
      });

      const elapsed = Math.round(performance.now() - startTime);
      if (res && res.ok) {
        setApiStatus('ONLINE');
        setApiLatencyMs(elapsed);
        setLastSyncTime(new Date().toISOString().slice(11, 19) + ' UTC');
      } else {
        setApiStatus('DEGRADED');
        setApiLatencyMs(elapsed);
      }
    } catch (err) {
      setApiStatus('OFFLINE');
      setApiLatencyMs(null);
    }
  }, []);

  useEffect(() => {
    checkApiHealth();
    checkIntervalRef.current = setInterval(checkApiHealth, 20000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [checkApiHealth]);

  const wsStatusNormalized =
    wsConnectionStatus === 'CONNECTED' || wsConnectionStatus === 'connected'
      ? 'ONLINE'
      : wsConnectionStatus === 'CONNECTING' || wsConnectionStatus === 'connecting'
      ? 'CONNECTING'
      : 'DISCONNECTED';

  let overallStatus = 'CONNECTING';
  let statusMessage = 'Checking EOC services...';

  if (apiStatus === 'ONLINE' && wsStatusNormalized === 'ONLINE') {
    overallStatus = 'ONLINE';
    statusMessage = 'All emergency communication channels operational';
  } else if (apiStatus === 'ONLINE' && wsStatusNormalized !== 'ONLINE') {
    overallStatus = 'DEGRADED';
    statusMessage = 'REST API operational; WebSocket stream reconnecting';
  } else if (apiStatus === 'OFFLINE') {
    overallStatus = 'OFFLINE';
    statusMessage = 'Backend service unreachable; check host network connection';
  } else {
    overallStatus = 'CONNECTING';
    statusMessage = 'Establishing link with EOC backend...';
  }

  return {
    overallStatus,
    apiStatus,
    wsStatus: wsStatusNormalized,
    apiLatencyMs,
    lastSyncTime,
    statusMessage,
    checkApiHealth,
  };
}

export default useSystemHealth;
