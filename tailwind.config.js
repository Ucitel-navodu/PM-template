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
        // Palette-driven (see src/index.css): light violet by default, accent of the chosen palette on dark ones.
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, `rgb(var(--pm-brand-${k}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
}
