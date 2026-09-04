/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        health: {
          green: '#2e7d32',
          orange: '#e08a00',
          red: '#c62828',
          grey: '#8a8f98',
          blue: '#2962ff',
        },
        brand: {
          50: '#f2f1ff',
          100: '#e7e5ff',
          200: '#d1ccff',
          300: '#b0a5ff',
          400: '#8b76ff',
          500: '#6d4dfd',
          600: '#5b30f0',
          700: '#4c22cf',
          800: '#3f1ea7',
          900: '#341c84',
        },
      },
    },
  },
  plugins: [],
}
