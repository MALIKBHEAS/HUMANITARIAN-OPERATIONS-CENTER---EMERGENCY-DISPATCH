import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loginFieldUnit, logoutFieldUnit, getFieldAuth, clearAuthAndRedirect } from '../services/api'

const AuthContext = createContext(null)

/**
 * Safely decodes base64url JWT token payload
 */
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
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem('edge_token') || null
    }
    return null
  })

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    logoutFieldUnit()
    setToken(null)
    setUser(null)
  }, [])

  // Sync token state and validate expiration
  useEffect(() => {
    if (token) {
      const payload = decodeJwtPayload(token)
      if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
        const username = payload.sub || 'field1'
        const rawName = payload.name || username
        const operativeCallsign = rawName.includes('Operative') ? rawName : `Operative ${rawName}`

        setUser({
          id: payload.user_id || username,
          email: payload.sub,
          name: rawName,
          callsign: operativeCallsign,
          role: payload.role || 'FIELD_UNIT',
          tenantId: payload.tenant_id || 'eoa-global-hq',
        })
      } else {
        // Token expired or invalid
        logout()
      }
    } else {
      setUser(null)
    }
    setLoading(false)
  }, [token, logout])

  // Global 401 Unauthorized signal listener
  useEffect(() => {
    const handleUnauthorized = () => {
      console.warn('[Edge Auth] 401 Unauthorized received. Terminating field session...')
      logout()
    }
    window.addEventListener('edge:unauthorized', handleUnauthorized)
    return () => {
      window.removeEventListener('edge:unauthorized', handleUnauthorized)
    }
  }, [logout])

  const login = async (username, password) => {
    const data = await loginFieldUnit(username, password)
    const jwtToken = data.access_token

    setToken(jwtToken)
    const payload = decodeJwtPayload(jwtToken)
    const userEmail = payload?.sub || username
    const rawName = payload?.name || userEmail.split('@')[0]
    const operativeCallsign = rawName.includes('Operative') ? rawName : `Operative ${rawName}`

    const userProfile = {
      id: payload?.user_id || username,
      email: userEmail,
      name: rawName,
      callsign: operativeCallsign,
      role: payload?.role || data.role || 'FIELD_UNIT',
      tenantId: payload?.tenant_id || 'eoa-global-hq',
    }

    setUser(userProfile)
    return { token: jwtToken, user: userProfile }
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role: user?.role || 'FIELD_UNIT',
        isAuthenticated: !!token && !!user,
        loading,
        login,
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

export default AuthContext
