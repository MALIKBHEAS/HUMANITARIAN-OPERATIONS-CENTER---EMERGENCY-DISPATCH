/**
 * Sovereign Tactical Edge Mobile Terminal API Service
 * Phase 2 C4ISR Mobile Telemetry Dispatch
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
 * Transmits Field Operative Emergency SOS / Duress telemetry packet
 */
export async function transmitEmergencySos({ lat, lon, description, securityToken = 'edge_mobile_alpha_01' }) {
  const baseUrl = getApiBaseUrl()
  const endpoint = `${baseUrl}/webhook/incident`

  const payload = {
    type: 'SOS_DURESS',
    severity_level: 5,
    description: description || 'CRITICAL: Field Operative Emergency Dispatch Request.',
    lat: typeof lat === 'number' ? lat : 31.5273,
    lon: typeof lon === 'number' ? lon : 35.0946,
    required_beds: 1,
    security_token: securityToken,
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
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
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
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
