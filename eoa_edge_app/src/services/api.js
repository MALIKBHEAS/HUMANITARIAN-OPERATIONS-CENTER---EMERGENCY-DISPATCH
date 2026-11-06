/**
 * Sovereign Tactical Edge Mobile Terminal API Service
 * Phase 5 C4ISR Zero-Trust Mobile Telemetry & JWT Dispatch
 */

// Primary EOC Backend Endpoint (Port 9443)
export const BACKEND_PORT = '9443'
export const DEFAULT_API_URL = `http://localhost:${BACKEND_PORT}/api`

/**
 * Resolves the active backend API URL.
 * Automatically adapts if field agent accesses edge app via LAN IP or localhost.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname
    // If not accessed on localhost (e.g. mobile device on LAN: 192.168.x.x), route to that host's port 9443
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${BACKEND_PORT}/api`
    }
  }
  return DEFAULT_API_URL
}

/**
 * Retrieves the stored field token
 */
export function getAuthToken() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('edge_token') || null
  }
  return null
}

/**
 * Returns Authorization Bearer header
 */
export function getAuthHeaders() {
  const token = getAuthToken()
  const headers = {
    'ngrok-skip-browser-warning': 'true',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/**
 * Globally clears local storage and notifies listeners on 401 Unauthorized
 */
export function clearAuthAndRedirect() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('edge_token')
    window.localStorage.removeItem('edge_user')
    window.dispatchEvent(new CustomEvent('edge:unauthorized'))
  }
}

/**
 * Global fetch interceptor for mobile edge PWA:
 * Auto-injects Authorization Bearer token & intercepts 401 Unauthorized.
 */
if (typeof window !== 'undefined' && !window.__EDGE_FETCH_INTERCEPTED__) {
  const originalFetch = window.fetch
  window.fetch = async (resource, config = {}) => {
    let url = typeof resource === 'string' ? resource : resource?.url || ''
    const isBackendCall = url.includes(`:${BACKEND_PORT}`) || url.startsWith('/api') || url.startsWith('/v1') || url.includes('ngrok')

    const headers = new Headers(
      config?.headers || (typeof resource !== 'string' && resource?.headers ? resource.headers : {})
    )

    // Bypass ngrok interstitial warning page on all outgoing requests
    if (!headers.has('ngrok-skip-browser-warning')) {
      headers.set('ngrok-skip-browser-warning', 'true')
    }

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
        console.warn('[Edge Mobile] 401 Unauthorized encountered. Clearing field credentials...')
        clearAuthAndRedirect()
      }
      return response
    } catch (err) {
      throw err
    }
  }
  window.__EDGE_FETCH_INTERCEPTED__ = true
}

/**
 * Authenticates field operative to acquire a sovereign FIELD_UNIT Bearer JWT
 */
export async function loginFieldUnit(username, password) {
  const baseUrl = getApiBaseUrl()
  const endpoints = [
    `${baseUrl}/auth/login`,
    `${baseUrl}/v1/auth/login`,
    `http://localhost:${BACKEND_PORT}/api/auth/login`,
  ]

  let lastError = null
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
          client_id: 'eoa-global-hq',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const token = data.access_token
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('edge_token', token)
          window.localStorage.setItem(
            'edge_user',
            JSON.stringify(data.user || { email: username, role: data.role || 'FIELD_UNIT' })
          )
        }
        return data
      } else {
        const errData = await res.json().catch(() => ({}))
        lastError = new Error(errData.detail || `HTTP ${res.status}: Authentication failed`)
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Tactical authentication gateway unreachable.')
}

/**
 * Logs out field operative and decommissions active session token
 */
export function logoutFieldUnit() {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('edge_token')
    window.localStorage.removeItem('edge_user')
  }
}

/**
 * Returns current authenticated field unit token and metadata
 */
export function getFieldAuth() {
  if (typeof window !== 'undefined' && window.localStorage) {
    const token = window.localStorage.getItem('edge_token')
    let user = null
    try {
      user = JSON.parse(window.localStorage.getItem('edge_user') || 'null')
    } catch (_) {}
    return { token, user }
  }
  return { token: null, user: null }
}

/**
 * Transmits Field Operative Emergency SOS / Duress telemetry packet
 * Enforces Zero-Trust Bearer JWT authentication header and enriches payload with operative identity
 */
export async function transmitEmergencySos({
  lat,
  lon,
  description,
  user = null,
  tokenOverride = null,
}) {
  const baseUrl = getApiBaseUrl()
  const endpoint = `${baseUrl}/webhook/incident`

  const { token: savedToken, user: savedUser } = getFieldAuth()
  const activeToken = tokenOverride || savedToken || getAuthToken()
  const activeUser = user || savedUser

  // Identity Extraction & Enrichment
  const operativeName =
    activeUser?.callsign ||
    activeUser?.name ||
    (activeUser?.email ? `Operative ${activeUser.email.split('@')[0]}` : 'Operative field1')

  const operativeId = activeUser?.id || activeUser?.email || 'field1'

  const payload = {
    type: 'SOS_DURESS',
    incident_type: 'SOS_DURESS',
    severity_level: 5,
    severity: 5,
    description: description || `CRITICAL DURESS: Emergency SOS initiated by ${operativeName}.`,
    reported_by: operativeName,
    callsign: operativeName,
    field_unit_id: operativeId,
    source: 'TACTICAL_EDGE_MOBILE_PWA',
    lat: typeof lat === 'number' ? lat : 31.5273,
    lon: typeof lon === 'number' ? lon : 35.0946,
    required_beds: 1,
    security_token: activeToken || 'edge_mobile_field1',
  }

  const reqHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  }

  if (activeToken) {
    reqHeaders['Authorization'] = `Bearer ${activeToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      if (res.status === 401) {
        clearAuthAndRedirect()
      }
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.detail || errorData.message || `HTTP ${res.status}: ${res.statusText}`)
    }

    return await res.json()
  } catch (err) {
    clearTimeout(timeoutId)

    // Resilient fallback attempt directly to localhost:9443 if LAN resolution failed
    if (baseUrl !== DEFAULT_API_URL) {
      try {
        const fallbackRes = await fetch(`${DEFAULT_API_URL}/webhook/incident`, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload),
        })
        if (fallbackRes.ok) {
          return await fallbackRes.json()
        }
      } catch (_) {}
    }
    throw err
  }
}
