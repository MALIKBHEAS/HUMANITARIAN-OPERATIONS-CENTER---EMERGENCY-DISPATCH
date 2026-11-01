/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tactical: {
          dark: '#05070a',
          card: '#0c1017',
          border: '#1b2230',
          accent: '#06b6d4',
          danger: '#dc2626',
          dangerGlow: '#ef4444',
          success: '#10b981',
          warning: '#f59e0b',
          muted: '#64748b'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        duressPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)' },
          '50%': { transform: 'scale(1.03)', boxShadow: '0 0 50px rgba(239, 68, 68, 0.8)' },
        },
        screenFlash: {
          '0%, 100%': { opacity: '0' },
          '50%': { opacity: '0.35' },
        }
      },
      animation: {
        'duress-pulse': 'duressPulse 2s infinite ease-in-out',
        'screen-flash': 'screenFlash 0.6s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
