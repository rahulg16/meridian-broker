/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Broker terminal palette
        broker: {
          dark: '#0f172a',      // slate-900
          panel: '#1e293b',     // slate-800
          surface: '#334155',   // slate-700
          text: '#f8fafc',      // slate-50
          muted: '#94a3b8',     // slate-400
          green: '#10b981',     // emerald-500
          red: '#ef4444',       // red-500
          amber: '#f59e0b',     // amber-500
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};