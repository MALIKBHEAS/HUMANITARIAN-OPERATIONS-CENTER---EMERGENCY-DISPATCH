/**
 * Sovereign C4ISR Frontend API & WebSocket Service
 * Strictly locked to backend port 9443
 */
export const API_BASE_URL = 'http://localhost:9443/api'
export const WS_BASE_URL = 'ws://localhost:9443/ws/live-feed'
export const baseURL = API_BASE_URL

export const apiClient = {
  baseURL: API_BASE_URL,
  async get(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', ...(options.headers || {}) },
        ...options,
      })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
      if (!endpoint.startsWith('http')) {
        const fallbackUrl = `/api${cleanEndpoint}`
        const fbRes = await fetch(fallbackUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json', ...(options.headers || {}) },
          ...options,
        })
        if (!fbRes.ok) throw err
        return await fbRes.json()
      }
      throw err
    }
  },
  async post(endpoint, data, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const reqHeaders = { 'Content-Type': 'application/json', ...(options.headers || {}) }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(data),
        ...options,
      })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
      // Tactical Fallback: If port 9443 fetch fails, attempt internal reverse-proxy
      if (!endpoint.startsWith('http')) {
        try {
          const fallbackUrl = `/api${cleanEndpoint}`
          const fbRes = await fetch(fallbackUrl, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(data),
            ...options,
          })
          if (fbRes.ok) {
            return await fbRes.json()
          }
        } catch (_) {}
      }
      throw err
    }
  },
  async sendIncident(incidentData) {
    return this.post('/webhook/incident', incidentData)
  },
}

export const api = apiClient
export default apiClient
