import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/renderer/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/renderer/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#07040f',
          900: '#0a0612',
          800: '#120a1f',
          700: '#1a0f2e',
          600: '#24143d',
        },
        nebula: {
          300: '#e9d5ff',
          400: '#d8b4fe',
          500: '#c084fc',
          600: '#a855f7',
          700: '#9333ea',
        },
        rose: {
          glow: '#f472b6',
          deep: '#db2777',
          soft: '#fbcfe8',
        },
        gold: {
          soft: '#f5d0a9',
          mid: '#e8b86d',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(192, 132, 252, 0.25)',
        'glow-sm': '0 0 12px rgba(244, 114, 182, 0.2)',
        panel: '0 8px 32px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      backgroundImage: {
        'nebula-radial':
          'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(168, 85, 247, 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 20%, rgba(236, 72, 153, 0.16), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 90%, rgba(99, 102, 241, 0.12), transparent 45%)',
      },
      fontFamily: {
        display: ['"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
