/** @type {import('tailwindcss').Config} */
export default {
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
      },
    },
  },
  plugins: [],
}
