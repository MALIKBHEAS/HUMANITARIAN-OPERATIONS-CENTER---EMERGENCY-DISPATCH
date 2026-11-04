import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import {
  Shield,
  Lock,
  Radio,
  Building2,
  AlertCircle,
  ArrowRight,
  User,
  KeyRound,
  Terminal,
  Activity,
  Crosshair,
  ShieldAlert,
} from 'lucide-react'

export const Login = () => {
  const { t } = useTranslation()
  const { login, loginWithSSO, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [tenantId, setTenantId] = useState('eoa-global-hq')
  const [selectedRole, setSelectedRole] = useState('COMMANDER')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentTime, setCurrentTime] = useState('')

  // Military UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toISOString().slice(11, 19) + ' UTC')
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // If already authenticated, redirect immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleSelectRole = (role, defaultUser, defaultPass) => {
    setSelectedRole(role)
    setUsername(defaultUser)
    setPassword(defaultPass)
    setTenantId('eoa-global-hq')
    setError('')
  }

  const handleStandardLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password, tenantId)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'Authentication failed. Verify C4ISR clearance credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSSO = async (provider, defaultEmail, targetTenant) => {
    setError('')
    setLoading(true)

    try {
      await loginWithSSO(provider, defaultEmail, targetTenant)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err.message || 'SSO Federation failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden select-none font-mono">
      {/* Background Tactical Grid & Ambient Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.18),rgba(15,23,42,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Top Tactical Status Bar */}
      <header className="flex items-center justify-between z-10 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-black tracking-wider text-slate-100 uppercase">
                EOA GLOBAL // C4ISR
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-950/80 border border-red-500/60 text-red-400 font-bold tracking-widest uppercase">
                DEFCON 1
              </span>
            </div>
            <p className="text-[10px] text-cyan-400 tracking-widest uppercase">
              ZERO-TRUST COMMAND & SENSOR ENCLAVE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>LINK: ACTIVE</span>
            <span className="text-slate-500">|</span>
            <span className="text-cyan-300 font-bold">{currentTime || '00:00:00 UTC'}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Authentication Terminal Card */}
      <main className="w-full max-w-lg mx-auto my-auto z-10 py-6">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          {/* Subtle Top Accent Line */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 transition-all ${
              selectedRole === 'COMMANDER'
                ? 'bg-red-500 shadow-md shadow-red-500'
                : selectedRole === 'OPERATOR'
                ? 'bg-cyan-400 shadow-md shadow-cyan-400'
                : 'bg-amber-400 shadow-md shadow-amber-400'
            }`}
          />

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[10px] tracking-widest uppercase mb-2">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>CRYPTOGRAPHIC AUTHENTICATION PORTAL</span>
            </div>
            <h2 className="text-base font-bold text-slate-100 uppercase tracking-widest">
              OPERATOR IDENTITY VERIFICATION
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Provide sovereign agency credentials to establish an authenticated tactical session.
            </p>
          </div>

          {/* Quick RBAC Clearance Tier Selection */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>SELECT CLEARANCE TIER (QUICK FILL)</span>
              </label>
              <span className="text-[9px] text-slate-500 uppercase">PRESET PROFILES</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* COMMANDER */}
              <button
                type="button"
                onClick={() => handleSelectRole('COMMANDER', 'admin', 'admin123')}
                className={`p-2.5 rounded border text-start transition-all cursor-pointer ${
                  selectedRole === 'COMMANDER'
                    ? 'bg-red-950/80 border-red-500 text-white shadow-lg shadow-red-950/60 ring-1 ring-red-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-red-500/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-bold text-red-400 flex items-center justify-between">
                  <span>COMMANDER</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                </div>
                <div className="text-[9px] text-slate-400 mt-1 leading-tight font-sans">
                  Admin & Sensor Provisioning
                </div>
              </button>

              {/* OPERATOR */}
              <button
                type="button"
                onClick={() => handleSelectRole('OPERATOR', 'operator', 'operator123')}
                className={`p-2.5 rounded border text-start transition-all cursor-pointer ${
                  selectedRole === 'OPERATOR'
                    ? 'bg-cyan-950/80 border-cyan-500 text-white shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-bold text-cyan-400 flex items-center justify-between">
                  <span>OPERATOR</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                </div>
                <div className="text-[9px] text-slate-400 mt-1 leading-tight font-sans">
                  EOC Surveillance (View Only)
                </div>
              </button>

              {/* FIELD UNIT */}
              <button
                type="button"
                onClick={() => handleSelectRole('FIELD_UNIT', 'field1', 'field123')}
                className={`p-2.5 rounded border text-start transition-all cursor-pointer ${
                  selectedRole === 'FIELD_UNIT'
                    ? 'bg-amber-950/80 border-amber-500 text-white shadow-lg shadow-amber-950/60 ring-1 ring-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                  <span>FIELD UNIT</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                </div>
                <div className="text-[9px] text-slate-400 mt-1 leading-tight font-sans">
                  Edge SOS / Duress Transmitter
                </div>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 rounded bg-red-950/80 border border-red-500/60 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleStandardLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                TENANT DOMAIN IDENTIFIER
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute start-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="eoa-global-hq"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-9 py-2 text-xs text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                OPERATOR CALLSIGN / USERNAME
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute start-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or commander@eoa.mil"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-9 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 uppercase tracking-wider">
                SECURITY PASSPHRASE
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute start-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-9 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 px-4 rounded text-slate-950 font-bold text-xs tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50 ${
                selectedRole === 'COMMANDER'
                  ? 'bg-red-500 hover:bg-red-400 shadow-red-900/50'
                  : selectedRole === 'OPERATOR'
                  ? 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-900/50'
                  : 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/50'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>AUTHENTICATING CIPHER...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>AUTHENTICATE & ACQUIRE JWT</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[9px] uppercase font-bold tracking-widest text-slate-500">
              <span className="bg-slate-900 px-3">FEDERATED EMERGENCY AGENCIES (ONE-CLICK SSO)</span>
            </div>
          </div>

          {/* Instant One-Click SSO Partners */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('FEMA', 'commander@fema.gov', 'fema-us')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/60 text-start transition-all cursor-pointer"
            >
              <span className="block font-bold text-cyan-400 text-[11px]">FEMA (US)</span>
              <span className="text-[9px] text-slate-500">fema-us // HQ</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('Palestine RCS', 'ops@palestine-rcs.org', 'palestine-rcs')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-emerald-500/60 text-start transition-all cursor-pointer"
            >
              <span className="block font-bold text-emerald-400 text-[11px]">Palestine (RCS)</span>
              <span className="text-[9px] text-slate-500">palestine-rcs // Rapid Ops</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('INTERPOL', 'tactical@interpol.int', 'interpol-hq')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-blue-500/60 text-start transition-all cursor-pointer"
            >
              <span className="block font-bold text-blue-400 text-[11px]">INTERPOL Command</span>
              <span className="text-[9px] text-slate-500">interpol-hq // Sector Ops</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('Tokyo Fire', 'dispatch@tfd.gov.jp', 'tokyo-fire')}
              className="p-2 rounded bg-slate-950 border border-slate-800 hover:border-orange-500/60 text-start transition-all cursor-pointer"
            >
              <span className="block font-bold text-orange-400 text-[11px]">Tokyo Fire Dept</span>
              <span className="text-[9px] text-slate-500">tokyo-fire // Rescue</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-slate-500 z-10 border-t border-slate-800/80 pt-3">
        EOA GLOBAL DEFENSE STANDARD • ZERO-TRUST AIR-GAP ENCLAVE • NENA/EENA CERTIFIED • 2026
      </footer>
    </div>
  )
}

export default Login
