import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { API_BASE_URL } from '../services/api'

const AuthContext = createContext(null)

// Helper to decode JWT payload safely without external dependencies
export const decodeJwtPayload = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eoa_token') || null
    }
    return null
  })
  const [tenantId, setTenantId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eoa_tenant_id') || 'eoa-global-hq'
    }
    return 'eoa-global-hq'
  })
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eoa_token')
      localStorage.removeItem('eoa_tenant_id')
    }
    setToken(null)
    setUser(null)
  }, [])

  // Sync token state and payload
  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token)
      if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
        const resolvedRole = payload.role || 'OPERATOR'
        const isCmdr = resolvedRole === 'COMMANDER' || payload.is_superuser === true

        setUser({
          id: payload.user_id || payload.sub,
          email: payload.sub,
          tenantId: payload.tenant_id || tenantId,
          role: resolvedRole,
          name: payload.name || payload.sub,
          isCommander: isCmdr,
          isOperator: resolvedRole === 'OPERATOR',
          isFieldUnit: resolvedRole === 'FIELD_UNIT',
          isSuperuser: !!payload.is_superuser,
        })
        if (payload.tenant_id) {
          setTenantId(payload.tenant_id)
        }
      } else {
        // Token missing or expired
        logout()
      }
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [token, logout, tenantId])

  // Global 401 Unauthorized Event Listener
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[AuthContext] Received 401 Unauthorized signal. Evicting session credentials...')
      logout()
    }
    window.addEventListener('eoa:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('eoa:unauthorized', handleUnauthorized)
    }
  }, [logout])

  const login = async (username, password, targetTenantId = 'eoa-global-hq') => {
    const payload = {
      username: username.trim(),
      password: password,
      tenant_id: targetTenantId,
      client_id: targetTenantId,
    }

    let response
    try {
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch (netErr) {
      // Fallback try v1 endpoint
      response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Authentication failed. Invalid C4ISR credentials.')
    }

    const data = await response.json()
    const jwtToken = data.access_token
    const resolvedTenant = data.tenant_id || targetTenantId

    localStorage.setItem('eoa_token', jwtToken)
    localStorage.setItem('eoa_tenant_id', resolvedTenant)

    setToken(jwtToken)
    setTenantId(resolvedTenant)

    const tokenPayload = decodeJwtPayload(jwtToken)
    const resolvedRole = tokenPayload?.role || data.role || 'OPERATOR'
    const isCmdr = resolvedRole === 'COMMANDER' || tokenPayload?.is_superuser === true

    setUser({
      id: tokenPayload?.user_id || data.user?.id || username,
      email: tokenPayload?.sub || data.user?.email || username,
      tenantId: resolvedTenant,
      role: resolvedRole,
      name: tokenPayload?.name || data.user?.name || username,
      isCommander: isCmdr,
      isOperator: resolvedRole === 'OPERATOR',
      isFieldUnit: resolvedRole === 'FIELD_UNIT',
      isSuperuser: isCmdr,
    })

    return data
  }

  const loginWithSSO = async (provider, email, targetTenantId) => {
    const ssoPayload = {
      provider,
      identity_token: `SSO_ASSERTION_FEDERATED_TOKEN_${Date.now()}`,
      email,
      tenant_id: targetTenantId,
      full_name: `${provider} Emergency Officer`,
      role: 'OPERATOR',
    }

    const response = await fetch(`${API_BASE_URL}/v1/auth/sso/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(ssoPayload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'SSO Federation failed.')
    }

    const data = await response.json()
    const jwtToken = data.access_token

    localStorage.setItem('eoa_token', jwtToken)
    localStorage.setItem('eoa_tenant_id', targetTenantId)

    setToken(jwtToken)
    setTenantId(targetTenantId)

    const payload = decodeJwtPayload(jwtToken)
    const resolvedRole = payload?.role || 'OPERATOR'
    const isCmdr = resolvedRole === 'COMMANDER' || payload?.is_superuser === true

    setUser({
      id: payload?.user_id || email,
      email: payload?.sub || email,
      tenantId: targetTenantId,
      role: resolvedRole,
      name: payload?.name || `${provider} Officer`,
      isCommander: isCmdr,
      isOperator: resolvedRole === 'OPERATOR',
      isFieldUnit: resolvedRole === 'FIELD_UNIT',
      isSuperuser: isCmdr,
    })

    return data
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        tenantId,
        user,
        role: user?.role || 'OPERATOR',
        isCommander: !!user?.isCommander,
        isOperator: user?.role === 'OPERATOR',
        isFieldUnit: user?.role === 'FIELD_UNIT',
        isAuthenticated: !!token && !!user,
        loading,
        login,
        loginWithSSO,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
