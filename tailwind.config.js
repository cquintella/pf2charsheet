/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: 'rgb(var(--bg-canvas) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        inset: 'rgb(var(--bg-inset) / <alpha-value>)',
        control: 'rgb(var(--bg-control) / <alpha-value>)',
        'control-hover': 'rgb(var(--bg-control-hover) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle) / <alpha-value>)',
        'border-strong': 'rgb(var(--border-strong) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-hover': 'rgb(var(--accent-hover) / <alpha-value>)',
        'accent-text': 'rgb(var(--accent-text) / <alpha-value>)',
        'accent-contrast': 'rgb(var(--accent-contrast) / <alpha-value>)',
        'status-success': 'rgb(var(--status-success) / <alpha-value>)',
        'status-success-bg': 'rgb(var(--status-success-bg) / <alpha-value>)',
        'status-success-border': 'rgb(var(--status-success-border) / <alpha-value>)',
        'status-danger': 'rgb(var(--status-danger) / <alpha-value>)',
        'status-danger-bg': 'rgb(var(--status-danger-bg) / <alpha-value>)',
        'status-danger-border': 'rgb(var(--status-danger-border) / <alpha-value>)',
        'status-warn': 'rgb(var(--status-warn) / <alpha-value>)',
        'status-warn-bg': 'rgb(var(--status-warn-bg) / <alpha-value>)',
        'status-warn-border': 'rgb(var(--status-warn-border) / <alpha-value>)',
        'status-info': 'rgb(var(--status-info) / <alpha-value>)',
        'status-info-bg': 'rgb(var(--status-info-bg) / <alpha-value>)',
        'status-info-border': 'rgb(var(--status-info-border) / <alpha-value>)',
        'status-purple': 'rgb(var(--status-purple) / <alpha-value>)',
        'status-purple-bg': 'rgb(var(--status-purple-bg) / <alpha-value>)',
        'status-purple-border': 'rgb(var(--status-purple-border) / <alpha-value>)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
