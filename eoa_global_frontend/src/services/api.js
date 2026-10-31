/**
 * Sovereign C4ISR Frontend API & WebSocket Service
 * Explicitly locked to backend port 9443
 */
export const API_BASE_URL = 'http://localhost:9443/api'
export const WS_BASE_URL = 'ws://localhost:9443/ws/live-feed'
export const baseURL = API_BASE_URL

export const apiClient = {
  baseURL: API_BASE_URL,
  async get(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const res = await fetch(url, { method: 'GET', ...options })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return res.json()
  },
  async post(endpoint, data, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: JSON.stringify(data),
      ...options,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    return res.json()
  },
  async sendIncident(incidentData) {
    return this.post('/webhook/incident', incidentData)
  },
}

export const api = apiClient
export default apiClient
