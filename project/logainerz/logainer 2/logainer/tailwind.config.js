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
        canvas: '#F8F9FA', // Warm limestone / off-white app canvas
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',
          muted: '#F1F5F9',
          border: '#E2E8F0',
          borderStrong: '#CBD5E1'
        },
        ink: {
          DEFAULT: '#0F172A', // Deep ink-navy
          muted: '#475569',
          light: '#64748B',
          soft: '#94A3B8'
        },
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E', // Muted Topographic Teal primary
          800: '#115E59',
          900: '#134E4A'
        },
        brick: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          500: '#EF4444',
          600: '#DC2626', // Brick Red critical / blocked
          700: '#B91C1C',
          800: '#991B1B'
        },
        ochre: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          500: '#F59E0B',
          600: '#D97706', // Ochre warning / deficit
          700: '#B45309',
          800: '#92400E'
        },
        moss: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D', // Moss Green safe / operational
          800: '#166534'
        },
        whatif: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          500: '#8B5CF6',
          600: '#7C3AED', // Muted Violet reserved for What-If intelligence
          700: '#6D28D9',
          800: '#5B21B6'
        },
        ner: {
          dark: '#F8F9FA',
          darker: '#F1F5F9',
          card: '#FFFFFF',
          cardLight: '#F8FAFC',
          border: '#E2E8F0',
          accent: '#0F766E',
          emerald: '#15803D',
          amber: '#D97706',
          rose: '#DC2626',
          blue: '#0284C7',
          purple: '#7C3AED',
          teal: '#0F766E'
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
        'modal': '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
        'floating': '0 4px 12px 0 rgba(15, 23, 42, 0.08)'
      }
    },
  },
  plugins: [],
}
