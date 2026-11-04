import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { Login } from './pages/Login'
import './i18n/config'

// Protected Route Guard: Blocks all access to Dashboard, LiveMap, and CCTVControlCenter without valid JWT
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400 font-mono text-xs gap-3">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <span className="tracking-widest uppercase">VERIFYING C4ISR ZERO-TRUST SECURITY CLEARANCE...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Public Route Guard: Redirects authenticated operators directly to the C4ISR Dashboard
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
