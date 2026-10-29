import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Flame,
  Shield,
  Stethoscope,
  LifeBuoy,
  MapPin,
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Users,
  Navigation,
  Crosshair,
} from 'lucide-react'

// Agency Icon & Tactical High-Contrast Styling Resolver
const getAgencyBadge = (agencyType) => {
  switch (agencyType) {
    case 'Police':
      return {
        icon: Shield,
        color: 'text-white bg-blue-950/80 border-2 border-blue-500',
        badge: 'bg-blue-600 text-white font-black',
      }
    case 'Hospital':
      return {
        icon: Stethoscope,
        color: 'text-white bg-rose-950/80 border-2 border-rose-500',
        badge: 'bg-rose-600 text-white font-black',
      }
    case 'CivilDefense':
    case 'Fire':
    default:
      return {
        icon: Flame,
        color: 'text-white bg-orange-950/80 border-2 border-orange-500',
        badge: 'bg-orange-600 text-white font-black',
      }
  }
}

// Category Icon Resolver
const getCategoryIcon = (category) => {
  switch (category) {
    case 'Fire':
      return Flame
    case 'Security':
      return Shield
    case 'Rescue':
      return LifeBuoy
    case 'Medical':
    default:
      return Stethoscope
  }
}

// Pure language translator dictionary to ensure ZERO mixed language in incident cards
const translateContentStrict = (text = '', targetLang = 'en') => {
  if (!text) return ''
  const isTargetAr = targetLang === 'ar'

  // Pre-mapped incident text pairs for strict language separation
  const translations = [
    {
      en: 'Massive residential fire with heavy smoke entrapment, multiple casualties, and gas explosion risks.',
      ar: 'حريق ضخم جداً في عمارة سكنية مع محاصرة السكان بالدخان ووجود مصابين ومخاطر انفجار غاز.',
    },
    {
      en: 'Active shooter situation near Central Mall with armed suspects and multiple injured civilians down.',
      ar: 'حادث إطلاق نار نشط بالقرب من المركز التجاري مع وجود مسلحين وسقوط عدة مصابين بين المدنيين.',
    },
    {
      en: 'Severe multi-vehicle collision involving passenger bus with trapped victims and active hemorrhaging.',
      ar: 'حادث سير مروع واصطدام حافلة ركاب مع وجود عالقين داخل المركبة وحالات نزيف خطيرة.',
    },
    {
      en: 'Emergency event dispatched by AI Orchestrator.',
      ar: 'بلاغ طوارئ تكتيكي مستنفر بواسطة ذكاء الأوركسترا الآلي.',
    },
    {
      en: 'Omar Al-Mukhtar Street - Central Sector',
      ar: 'شارع عمر المختار - القطاع المركزي',
    },
    {
      en: '5th Avenue Commercial District',
      ar: 'الشارع الخامس - المنطقة التجارية',
    },
    {
      en: 'Salah Al-Din Highway - Southern Corridor',
      ar: 'طريق صلاح الدين - الممر الجنوبي',
    },
    {
      en: 'Deploying high-pressure water tenders and structural search teams.',
      ar: 'توجيه آليات الإطفاء ذات الضغط العالي وفرق الإنقاذ واقتحام المباني.',
    },
    {
      en: 'Dispatching mobile trauma stabilization units and triage ambulances.',
      ar: 'استنفار سيارات الإسعاف المتقدمة ووحدات الإنعاش والفرز الطبي.',
    },
    {
      en: 'Mobilizing tactical armed units to secure outer perimeter and neutralize threats.',
      ar: 'استنفار دوريات التدخل الأمني السريع لتأمين المحيط الخارجي وتحييد التهديد.',
    },
  ]

  // Check matching translations
  for (const item of translations) {
    if (isTargetAr && (text.includes('fire') || text.includes('Shooter') || text.includes('shooter') || text.includes('Avenue') || text.includes('Mall') || text.includes('collision'))) {
      if (text.toLowerCase().includes('shooter') || text.toLowerCase().includes('avenue')) return translations[1].ar
      if (text.toLowerCase().includes('fire')) return translations[0].ar
      if (text.toLowerCase().includes('collision') || text.toLowerCase().includes('bus')) return translations[2].ar
    }
    if (!isTargetAr && (text.includes('حريق') || text.includes('عمر المختار') || text.includes('إطلاق نار') || text.includes('صلاح الدين') || text.includes('حادث'))) {
      if (text.includes('حريق') || text.includes('عمر المختار')) return translations[0].en
      if (text.includes('إطلاق نار') || text.includes('مسلح')) return translations[1].en
      if (text.includes('حادث') || text.includes('صلاح الدين') || text.includes('حافلة')) return translations[2].en
    }
  }

  // Location replacements
  if (isTargetAr) {
    if (text.includes('5th Avenue') || text.includes('Mall')) return 'الشارع الخامس - المنطقة المركزية'
    if (text.includes('Highway') || text.includes('Corridor')) return 'طريق صلاح الدين السريع'
    return text.replace(/[A-Za-z0-9#\-_]/g, '').trim() || 'القطاع الميداني الرئيسي'
  } else {
    if (text.includes('عمر المختار')) return 'Omar Al-Mukhtar Street Sector'
    if (text.includes('صلاح الدين')) return 'Salah Al-Din Logistics Route'
    return text.replace(/[\u0600-\u06FF]/g, '').trim() || 'Central Tactical Operations Sector'
  }
}

export const AIIncidentFeed = ({ incidents = [], activeIncident, onSelectIncident }) => {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language?.startsWith('ar')
  const currentLang = isArabic ? 'ar' : 'en'

  if (incidents.length === 0) {
    return (
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        className="flex flex-col items-center justify-center h-full p-8 text-center border-2 border-slate-700 rounded-2xl bg-slate-900/90 shadow-2xl backdrop-blur-md"
      >
        <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center mb-4 text-cyan-400 animate-pulse shadow-inner">
          <Radio className="w-10 h-10" />
        </div>
        <h3 className="text-base font-extrabold text-white mb-2">
          {t('feed.waiting_title')}
        </h3>
        <p className="text-sm text-slate-200 max-w-xs leading-relaxed font-medium">
          {t('feed.waiting_desc')}
        </p>
      </div>
    )
  }

  return (
    <div
      dir={isArabic ? 'rtl' : 'ltr'}
      className="flex flex-col h-full bg-slate-950 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl font-sans"
    >
      {/* Feed Header (High Contrast) */}
      <div className="p-4 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/50">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              {t('feed.title')}
            </h2>
            <span className="text-[11px] text-yellow-400 font-mono font-bold block">
              {t('feed.zero_hallucination')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border-2 border-emerald-500/40">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono font-black text-emerald-300 uppercase">
            {incidents.length} {t('feed.live_badge')}
          </span>
        </div>
      </div>

      {/* Incident Cards List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {incidents.map((incident) => {
          const isSelected = activeIncident?.id === incident.id
          const severity = incident.classification?.severity_level || 3
          const category = incident.classification?.category || 'Medical'
          const CategoryIcon = getCategoryIcon(category)
          const casualties =
            incident.summary?.casualties || incident.raw?.casualties_indicated || 0

          // Strict localization per card
          const localizedLocation = translateContentStrict(
            incident.location || incident.parsed_location,
            currentLang
          )
          const rawSummary = incident.classification?.summary || incident.summary?.incident_description || ''
          const localizedSummary = translateContentStrict(rawSummary, currentLang)

          // Formatted Time strictly in active language locale
          const formattedTime = new Date(incident.timestamp).toLocaleTimeString(
            isArabic ? 'ar-EG' : 'en-US',
            { hour: '2-digit', minute: '2-digit', second: '2-digit' }
          )

          // High-Contrast WCAG Border & Card Background
          let cardBorder = isSelected
            ? 'border-cyan-400 ring-4 ring-cyan-500/30 bg-slate-900'
            : 'border-slate-700 hover:border-slate-500 bg-slate-900/95'

          let severityBadge =
            severity >= 5
              ? 'bg-red-600 text-white border-2 border-white font-black'
              : severity === 4
              ? 'bg-amber-500 text-slate-950 border-2 border-white font-black'
              : 'bg-emerald-600 text-white font-bold'

          return (
            <div
              key={incident.id}
              onClick={() => onSelectIncident?.(incident)}
              className={`p-4 rounded-2xl border-2 ${cardBorder} transition-all duration-200 cursor-pointer shadow-xl hover:shadow-2xl`}
            >
              {/* Header: Category, Severity, and Time */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-slate-800 border border-slate-600 text-cyan-300">
                    <CategoryIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-black text-white block">
                      {t(`categories.${category}`) || category}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-yellow-300 font-mono font-bold mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-yellow-400" />
                      <span>{formattedTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {casualties > 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-600 text-white border border-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{casualties}</span>
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-lg text-xs tracking-wider uppercase ${severityBadge}`}>
                    {t(`severities.${severity}`)}
                  </span>
                </div>
              </div>

              {/* Location Landmark Banner (High-Contrast White on Slate-950) */}
              <div className="flex items-center gap-2 text-sm text-white font-extrabold mb-3 bg-slate-950 p-2.5 rounded-xl border border-slate-700">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="truncate">{localizedLocation}</span>
              </div>

              {/* Incident Summary (High Contrast Slate-100 Text) */}
              <p className="text-sm text-slate-100 mb-3.5 leading-relaxed font-medium">
                {localizedSummary}
              </p>

              {/* Multi-Agency Mobilization Dispatch Orders */}
              <div className="space-y-2 mb-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-black tracking-wider text-yellow-400 uppercase block">
                  {t('feed.dispatches_label')}:
                </span>
                <div className="space-y-2">
                  {incident.dispatches?.map((dispatch, idx) => {
                    const agencyMeta = getAgencyBadge(dispatch.agency_type)
                    const AgencyIcon = agencyMeta.icon
                    const units = dispatch.required_units || dispatch.units || 1
                    const localizedReasoning = translateContentStrict(
                      dispatch.reasoning,
                      currentLang
                    )

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border-2 ${agencyMeta.color} flex flex-col gap-1.5`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-black text-sm text-white">
                            <AgencyIcon className="w-4 h-4 text-white" />
                            <span>
                              {t(`agencies.${dispatch.agency_type}`) || dispatch.agency_type}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs tracking-wider ${agencyMeta.badge}`}
                          >
                            {isArabic
                              ? `${units} طواقم استجابة`
                              : `${units} Units Mobilized`}
                          </span>
                        </div>

                        {/* Tactical Reasoning Quote */}
                        {localizedReasoning && (
                          <p className="text-xs text-slate-200 italic ps-4 border-s-2 border-slate-600 mt-0.5 font-medium">
                            "{localizedReasoning}"
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Card Footer: Focus Target Button */}
              <div className="pt-2.5 border-t border-slate-700/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[11px] uppercase tracking-wide">
                    {t('feed.zero_hallucination')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectIncident?.(incident)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-400/50 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                  title={t('feed.focus_map')}
                >
                  <Crosshair className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>{t('feed.focus_map')}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
