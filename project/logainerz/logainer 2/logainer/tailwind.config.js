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
        ner: {
          dark: '#0B0F19',
          darker: '#06090E',
          card: '#111827',
          cardLight: '#1F2937',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#06B6D4', // Cyan
          emerald: '#10B981', // Forest / Safe
          amber: '#F59E0B', // Warning / Advisory
          rose: '#F43F5E', // Red Alert / Blocked
          blue: '#3B82F6', // River / Flood
          purple: '#8B5CF6', // AI Intelligence
          teal: '#14B8A6'
        },
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          900: '#14532D',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radarSweep 4s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'ping-slow': 'ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite'
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.4)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.4)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.4)',
        'glow-purple': '0 0 25px -5px rgba(139, 92, 246, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
