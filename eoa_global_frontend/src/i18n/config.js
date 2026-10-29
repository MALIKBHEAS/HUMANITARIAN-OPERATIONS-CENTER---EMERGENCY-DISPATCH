import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './en.json'
import ar from './ar.json'

const resources = {
  en: { translation: en },
  ar: { translation: ar },
}

// Function to update the <html> dir attribute immediately
export const updateDocumentDirection = (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lng)
  if (dir === 'rtl') {
    document.documentElement.classList.add('rtl')
  } else {
    document.documentElement.classList.remove('rtl')
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

// Set initial document direction based on detected or stored language
updateDocumentDirection(i18n.language || 'en')

// Listen for language changes and flip direction in real-time
i18n.on('languageChanged', (lng) => {
  updateDocumentDirection(lng)
})

export default i18n
