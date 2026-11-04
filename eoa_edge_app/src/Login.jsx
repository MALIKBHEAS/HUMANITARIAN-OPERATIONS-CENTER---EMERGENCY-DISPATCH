import React, { useState } from 'react'
import {
  ShieldAlert,
  Lock,
  Radio,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Satellite,
  UserCheck,
  Crosshair,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from './context/AuthContext'

export default function Login({ onLoginSuccess }) {
  const { login } = useAuth ? useAuth() : { login: null }
  const [username, setUsername] = useState('field1')
  const [password, setPassword] = useState('field123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    if (e) e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (login) {
        const result = await login(username, password)
        if (onLoginSuccess) {
          onLoginSuccess(result.token, result.user)
        }
      }
    } catch (err) {
      setError(err.message || 'Authentication gateway rejected field cipher.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = (user, pass) => {
    setUsername(user)
    setPassword(pass)
    setError(null)
  }

  return (
    <div className="relative w-full h-[100dvh] bg-[#05070a] text-slate-100 flex flex-col justify-between tactical-grid-bg p-4 sm:p-6 overflow-hidden select-none font-mono">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(239,68,68,0.18),rgba(0,0,0,0))] pointer-events-none" />

      {/* Top Tactical Banner */}
      <header className="w-full flex items-center justify-between z-10 shrink-0 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-red-950/90 border border-red-500/70 flex items-center justify-center text-red-400 shadow-md shadow-red-950">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider text-slate-100 uppercase flex items-center gap-1.5">
              <span>C4ISR TACTICAL EDGE</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            </div>
            <div className="text-[10px] text-red-400 font-bold tracking-widest uppercase">
              ZERO-TRUST FIELD ENCLAVE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-500/50 bg-red-950/70 text-[10px] font-bold text-red-300 uppercase shadow-inner">
          <Lock className="w-3.5 h-3.5 text-red-400" />
          <span>LOCKED</span>
        </div>
      </header>

      {/* Central Login Card */}
      <main className="w-full max-w-sm mx-auto my-auto z-10">
        <div className="bg-[#0a0e17]/95 border-2 border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl relative">
          {/* Card Header */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-950/90 border-2 border-red-500/60 text-red-400 mb-3 shadow-lg shadow-red-950">
              <ShieldAlert className="w-7 h-7 animate-pulse" />
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-widest">
              OPERATIVE AUTHENTICATION
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 font-sans">
              Bearer JWT required to activate sovereign emergency transmitter.
            </p>
          </div>

          {/* Quick-fill buttons */}
          <div className="space-y-2 mb-4">
            <button
              type="button"
              onClick={() => handleQuickFill('field1', 'field123')}
              className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-slate-900/90 border border-amber-500/60 hover:border-amber-400 text-xs text-slate-200 hover:text-white flex items-center justify-between transition-all cursor-pointer active:scale-98 shadow-sm"
            >
              <span className="flex items-center gap-2 text-amber-400 font-bold">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>QUICK FILL: FIELD1 // FIELD_UNIT</span>
              </span>
              <span className="text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/50">
                ACTIVE
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('field01@eoa.mil', 'field2026')}
              className="w-full min-h-[38px] py-1.5 px-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-between transition-all cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-slate-400">
                <Crosshair className="w-3.5 h-3.5" />
                <span>Preset: field01@eoa.mil</span>
              </span>
              <span className="text-[9px] text-slate-500 uppercase">ALPHA-01</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-950/90 border border-red-500 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                OPERATIVE CALLSIGN / ID
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. field1"
                className="w-full min-h-[46px] bg-[#05070a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                CIPHER SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[46px] bg-[#05070a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[50px] mt-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm tracking-widest uppercase transition-all shadow-xl shadow-red-950 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>AUTHENTICATING OPERATIVE...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>ACQUIRE FIELD TOKEN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 z-10 border-t border-slate-800/80 pt-3">
        EOA TACTICAL MOBILE PWA • DIRECT EOC LINK • 2026
      </footer>
    </div>
  )
}
