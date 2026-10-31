import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { WS_BASE_URL } from '../api';

/**
 * Custom hook managing WebSocket live feed connection.
 * Connects to ws://localhost:9443/ws/live-feed when authenticated.
 * Implements strict in-place deduplication on incident_id (max 50 items).
 */
export function useWebSocket(url = WS_BASE_URL) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('DISCONNECTED'); // CONNECTING | CONNECTED | DISCONNECTED | ERROR
  const [latestIncident, setLatestIncident] = useState(null);
  const [incidentHistory, setIncidentHistory] = useState([]);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);

  const connect = useCallback(() => {
    if (!isAuthenticated) return;

    try {
      setStatus('CONNECTING');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('CONNECTED');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        if (event.data === 'pong') return;

        try {
          const payload = JSON.parse(event.data);
          setLatestIncident(payload);

          // CRITICAL DEDUPLICATION:
          // If incident_id already exists in incidentHistory, replace it in-place.
          // Otherwise, unshift the new incident to the top (max 50 items).
          setIncidentHistory((prev) => {
            if (!payload || payload.incident_id === undefined || payload.incident_id === null) {
              return [payload, ...prev.slice(0, 49)];
            }
            
            const existingIndex = prev.findIndex(
              (item) => item.incident_id === payload.incident_id
            );

            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...payload };
              return updated;
            }

            return [payload, ...prev.slice(0, 49)];
          });
        } catch (err) {
          console.error('Failed to parse WebSocket message JSON:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered error:', err);
        setStatus('ERROR');
      };

      ws.onclose = () => {
        setStatus('DISCONNECTED');
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        // Auto-reconnect after 3 seconds if still authenticated
        if (isAuthenticated) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('WebSocket initialization failed:', err);
      setStatus('ERROR');
    }
  }, [isAuthenticated, url]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [connect]);

  return {
    status,
    latestIncident,
    incidentHistory,
    setIncidentHistory,
  };
}
