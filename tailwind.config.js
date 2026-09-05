import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Ink: near-black surfaces (night is default)
        ink: {
          50: '#f4f4f5',
          100: '#e8e8ea',
          200: '#c9c9ce',
          300: '#9b9ba3',
          400: '#6e6e78',
          500: '#4a4a52',
          600: '#34343b',
          700: '#25252b',
          800: '#18181d',
          900: '#0c0c10',
          950: '#060608',
        },
        // Violet: glow accent
        violet: {
          50: '#f5f0ff',
          100: '#ece4ff',
          200: '#d9c8ff',
          300: '#b89eff',
          400: '#9b6fff',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b5',
          800: '#4a1d96',
          900: '#3b1679',
        },
        // Lime: electric pill accent
        lime: {
          50: '#f3ffe0',
          100: '#e6ffbf',
          200: '#d4ff94',
          300: '#bdf566',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
        },
      },
      fontFamily: {
        display: ['"Anton"', 'Impact', 'sans-serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'blink': 'blink 1s steps(2, start) infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 60px -10px rgba(124, 58, 237, 0.5)' },
          '50%': { boxShadow: '0 0 100px -10px rgba(124, 58, 237, 0.8)' },
        },
      },
    },
  },
  plugins: [typography],
};
