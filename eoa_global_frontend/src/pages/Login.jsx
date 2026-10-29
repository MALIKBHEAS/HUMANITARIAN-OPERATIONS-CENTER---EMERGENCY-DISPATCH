import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { Shield, Lock, Radio, Building2, AlertCircle, ArrowRight } from 'lucide-react'

export const Login = () => {
  const { t } = useTranslation()
  const { login, loginWithSSO } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('dispatcher@fema.gov')
  const [password, setPassword] = useState('password123')
  const [tenantId, setTenantId] = useState('fema-us')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStandardLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password, tenantId)
      navigate('/')
    } catch (err) {
      setError(err.message || t('auth.error_login'))
    } finally {
      setLoading(false)
    }
  }

  const handleQuickSSO = async (provider, defaultEmail, targetTenant) => {
    setError('')
    setLoading(true)

    try {
      await loginWithSSO(provider, defaultEmail, targetTenant)
      navigate('/')
    } catch (err) {
      setError(err.message || 'SSO Federation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-between p-4 md:p-8 relative overflow-hidden">
      {/* Background Tactical Grid Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Top Bar with Language Switcher */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-slate-100 uppercase">
              {t('app.title')}
            </h1>
            <p className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">
              {t('app.subtitle')}
            </p>
          </div>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md mx-auto my-auto z-10">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-cyan-400 mb-3 shadow-inner">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{t('auth.login_title')}</h2>
            <p className="text-xs text-slate-400 mt-1">{t('auth.login_subtitle')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleStandardLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('auth.tenant_label')}
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute start-3 top-3" />
                <input
                  type="text"
                  required
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder={t('auth.tenant_placeholder')}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-9 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('auth.email_label')}
              </label>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email_placeholder')}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('auth.password_label')}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute start-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-9 py-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              <span>{loading ? t('auth.authenticating') : t('auth.sign_in_btn')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-slate-500">
              <span className="bg-slate-900 px-3">{t('auth.sso_title')}</span>
            </div>
          </div>

          {/* Instant One-Click SSO Partners */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('FEMA', 'commander@fema.gov', 'fema-us')}
              className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-200 text-start transition-all"
            >
              <span className="block font-bold text-cyan-400">FEMA (US)</span>
              <span className="text-[10px] text-slate-400">fema-us</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('Palestine RCS', 'ops@palestine-rcs.org', 'palestine-rcs')}
              className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 text-slate-200 text-start transition-all"
            >
              <span className="block font-bold text-emerald-400">Palestine (RCS)</span>
              <span className="text-[10px] text-slate-400">palestine-rcs</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('INTERPOL', 'tactical@interpol.int', 'interpol-hq')}
              className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 text-slate-200 text-start transition-all"
            >
              <span className="block font-bold text-blue-400">INTERPOL Command</span>
              <span className="text-[10px] text-slate-400">interpol-hq</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickSSO('Tokyo Fire', 'dispatch@tfd.gov.jp', 'tokyo-fire')}
              className="p-2.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/50 text-slate-200 text-start transition-all"
            >
              <span className="block font-bold text-orange-400">Tokyo Fire Dept</span>
              <span className="text-[10px] text-slate-400">tokyo-fire</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-[11px] text-slate-500 z-10">
        EOA Global Enterprise Edition • Multilingual NENA/EENA Standard Certified • 2026
      </div>
    </div>
  )
}
