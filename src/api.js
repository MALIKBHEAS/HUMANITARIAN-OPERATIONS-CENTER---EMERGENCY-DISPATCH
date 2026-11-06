/**
 * Sovereign C4ISR Frontend API & WebSocket Service
 * Strictly locked to backend port 9443
 */

export const API_BASE_URL = 'http://localhost:9443/api';
export const WS_BASE_URL = 'ws://localhost:9443/ws/live-feed';
export const baseURL = API_BASE_URL;

/**
 * Standard fetch helper for HTTP requests
 */
export async function apiRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody.detail || errorBody.message || response.statusText;
      throw new Error(`API Error [${response.status}]: ${message}`);
    }

    return await response.json();
  } catch (err) {
    if (!endpoint.startsWith('http')) {
      try {
        const fallbackUrl = `/api${cleanEndpoint}`;
        const fallbackRes = await fetch(fallbackUrl, {
          ...options,
          headers,
        });
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch (_) {}
    }
    throw err;
  }
}

/**
 * API client helper object
 */
export const api = {
  baseURL: API_BASE_URL,
  get: (endpoint, options = {}) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options = {}) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  
  // High-priority incident dispatch webhook
  sendIncident: (incidentData) => apiRequest('/webhook/incident', {
    method: 'POST',
    body: JSON.stringify(incidentData),
  }),
  
  // Tactical emergency resources
  getResources: () => apiRequest('/resources/all'),
  getHospitals: () => apiRequest('/resources/hospitals'),
  getPolice: () => apiRequest('/resources/police'),
};

export default api;
