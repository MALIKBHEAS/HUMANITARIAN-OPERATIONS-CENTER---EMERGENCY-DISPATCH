import React, { createContext, useContext, useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

const AuthContext = createContext(null)

// Helper to decode JWT payload safely without external dependencies
const decodeJwtPayload = (token) => {
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
  const [token, setToken] = useState(() => localStorage.getItem('eoa_token') || null)
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('eoa_tenant_id') || 'fema-us')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token)
      if (payload && payload.exp * 1000 > Date.now()) {
        setUser({
          email: payload.sub,
          tenantId: payload.tenant_id,
          role: payload.role || 'OPERATOR',
          name: payload.name || payload.sub,
        })
        setTenantId(payload.tenant_id)
      } else {
        // Token expired
        logout()
      }
    }
    setLoading(false)
  }, [token])

  const login = async (username, password, targetTenantId) => {
    const formData = new URLSearchParams()
    formData.append('username', username)
    formData.append('password', password)
    if (targetTenantId) {
      formData.append('client_id', targetTenantId)
    }

    const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'Authentication failed')
    }

    const data = await response.json()
    const jwtToken = data.access_token
    const resolvedTenant = data.tenant_id || targetTenantId

    localStorage.setItem('eoa_token', jwtToken)
    localStorage.setItem('eoa_tenant_id', resolvedTenant)

    setToken(jwtToken)
    setTenantId(resolvedTenant)

    const payload = decodeJwtPayload(jwtToken)
    setUser({
      email: payload?.sub || username,
      tenantId: resolvedTenant,
      role: payload?.role || 'OPERATOR',
      name: payload?.name || username,
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
      role: 'DISPATCHER',
    }

    const response = await fetch(`${API_BASE_URL}/v1/auth/sso/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ssoPayload),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.detail || 'SSO Federation failed')
    }

    const data = await response.json()
    const jwtToken = data.access_token

    localStorage.setItem('eoa_token', jwtToken)
    localStorage.setItem('eoa_tenant_id', targetTenantId)

    setToken(jwtToken)
    setTenantId(targetTenantId)

    const payload = decodeJwtPayload(jwtToken)
    setUser({
      email: payload?.sub || email,
      tenantId: targetTenantId,
      role: payload?.role || 'DISPATCHER',
      name: payload?.name || `${provider} Officer`,
    })

    return data
  }

  const logout = () => {
    localStorage.removeItem('eoa_token')
    localStorage.removeItem('eoa_tenant_id')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        tenantId,
        user,
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
