import React from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

export const LanguageSwitcher = () => {
  const { i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'

  const toggleLanguage = () => {
    const nextLang = isArabic ? 'en' : 'ar'
    i18n.changeLanguage(nextLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition-all shadow-sm hover:border-cyan-500/50"
      title={isArabic ? 'Switch to English' : 'التحويل للغة العربية'}
    >
      <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
      <span>{isArabic ? 'English (LTR)' : 'العربية (RTL)'}</span>
    </button>
  )
}
