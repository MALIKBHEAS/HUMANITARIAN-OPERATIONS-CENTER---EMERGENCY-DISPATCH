/**
 * Sovereign C4ISR Frontend API & WebSocket Service
 * Strictly locked to backend port 9443 with Zero-Trust JWT Authentication
 * Handles Authorization headers, automatic 401 interceptor redirection, and API methods.
 */

export const API_BASE_URL = 'http://localhost:9443/api'
export const WS_BASE_URL = 'ws://localhost:9443/ws/live-feed'
export const baseURL = API_BASE_URL

/**
 * Retrieves the current authentication token from local storage
 */
export function getAuthToken() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('eoa_token') || null
  }
  return null
}

/**
 * Returns the Authorization header object if token is present
 */
export function getAuthHeaders() {
  const token = getAuthToken()
  if (token) {
    return { Authorization: `Bearer ${token}` }
  }
  return {}
}

/**
 * Globally clears local storage and forces redirection to /login on 401 Unauthorized
 */
export function clearAuthAndRedirect() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('eoa_token')
    window.localStorage.removeItem('eoa_tenant_id')
    window.dispatchEvent(new CustomEvent('eoa:unauthorized'))
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }
}

/**
 * Install global fetch interceptor to automatically inject Authorization headers
 * and handle 401 Unauthorized responses.
 */
if (typeof window !== 'undefined' && !window.__EOA_FETCH_INTERCEPTED__) {
  const originalFetch = window.fetch
  window.fetch = async (resource, config = {}) => {
    let url = typeof resource === 'string' ? resource : resource?.url || ''
    
    // Check if destination is targeting our backend or relative API
    const isBackendCall =
      url.startsWith(API_BASE_URL) ||
      url.includes(':9443') ||
      url.startsWith('/api') ||
      url.startsWith('/v1')

    const headers = new Headers(
      config?.headers || (typeof resource !== 'string' && resource?.headers ? resource.headers : {})
    )

    if (isBackendCall && !headers.has('Authorization')) {
      const token = getAuthToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    const newConfig = { ...config, headers }
    try {
      const response = await originalFetch(resource, newConfig)
      if (response.status === 401 && isBackendCall && !url.includes('/auth/login')) {
        console.warn('[C4ISR Security] 401 Unauthorized encountered. Terminating terminal session...')
        clearAuthAndRedirect()
      }
      return response
    } catch (err) {
      throw err
    }
  }
  window.__EOA_FETCH_INTERCEPTED__ = true
}

export const apiClient = {
  baseURL: API_BASE_URL,

  async get(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const authHeaders = getAuthHeaders()

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json', ...authHeaders, ...(options.headers || {}) },
        ...options,
      })
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthAndRedirect()
        }
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
      if (!endpoint.startsWith('http')) {
        const fallbackUrl = `/api${cleanEndpoint}`
        try {
          const fbRes = await fetch(fallbackUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json', ...authHeaders, ...(options.headers || {}) },
            ...options,
          })
          if (fbRes.ok) return await fbRes.json()
        } catch (_) {}
      }
      throw err
    }
  },

  async post(endpoint, data, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const authHeaders = getAuthHeaders()
    const reqHeaders = { 'Content-Type': 'application/json', ...authHeaders, ...(options.headers || {}) }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(data),
        ...options,
      })
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthAndRedirect()
        }
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
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

  async delete(endpoint, options = {}) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`
    const authHeaders = getAuthHeaders()

    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json', ...authHeaders, ...(options.headers || {}) },
        ...options,
      })
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthAndRedirect()
        }
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`)
      }
      return await res.json()
    } catch (err) {
      throw err
    }
  },

  // Tactical SOS / Incident Submission
  async sendIncident(incidentData) {
    return this.post('/webhook/incident', incidentData)
  },

  // Dynamic RTSP Vision Management
  async addVisionStream(payload) {
    return this.post('/vision/add-stream', payload)
  },

  async removeVisionStream(streamId) {
    return this.delete(`/vision/stream/${streamId}`)
  },

  async getVisionStatus() {
    return this.get('/vision/status')
  },

  async getVisionStreams() {
    return this.get('/vision/streams')
  },
}

export const api = apiClient
export default apiClient
