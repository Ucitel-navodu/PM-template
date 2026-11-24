/*
 * ORLEN Unipetrol look (Manuál vizuálního stylu 2021).
 * Tailwind's stock scales used across the app are remapped to the brand:
 *   gray            -> brand greys (#676d6f Pantone 431 C, #aeafab Pantone 429 C, #2b3035, #f8f6f6)
 *   rose / red      -> brand red #d81e04 (Pantone 485 C) and the supplementary dark red #791307
 *   emerald / green -> supplementary green #689425 / #163d14
 *   amber / yellow  -> supplementary yellow #fbba00 (text steps darkened for >= 4.5 : 1)
 *   orange          -> supplementary orange #e84e0f
 *   sky / blue / indigo / cyan -> supplementary blues #00b1eb / #00779c / #00404a
 *   violet / purple / slate    -> supplementary blue-grey #90a3b2
 * Text steps (600+ on light, 300 on dark) keep at least 4.5 : 1 contrast.
 */
const gray = { 50: '#f8f6f6', 100: '#efeeed', 200: '#e2e2e0', 300: '#cbccc9', 400: '#aeafab', 500: '#676d6f', 600: '#575c5f', 700: '#43484b', 800: '#2b3035', 900: '#1f2326', 950: '#16191b' }
const red = { 50: '#fdf0ee', 100: '#fbded9', 200: '#f5b6ac', 300: '#ec8070', 400: '#e24f39', 500: '#d81e04', 600: '#c41b04', 700: '#a11603', 800: '#791307', 900: '#5a0e05', 950: '#3a0903' }
const green = { 50: '#f1f6ea', 100: '#e0ebcd', 200: '#c4da9f', 300: '#a5c46f', 400: '#86ae48', 500: '#689425', 600: '#567b1f', 700: '#456319', 800: '#2f4a16', 900: '#163d14', 950: '#0d2a0c' }
const yellow = { 50: '#fff8e1', 100: '#ffefb8', 200: '#fee08a', 300: '#fdcf4d', 400: '#fbba00', 500: '#e0a600', 600: '#9a6c00', 700: '#7d5700', 800: '#5e4100', 900: '#3f2c00', 950: '#2a1d00' }
const orange = { 50: '#fdeee7', 100: '#fbd6c6', 200: '#f6ad8e', 300: '#f08257', 400: '#ec6731', 500: '#e84e0f', 600: '#b93e0c', 700: '#953209', 800: '#702507', 900: '#4b1905', 950: '#2f1003' }
const blue = { 50: '#e6f6fd', 100: '#c2eafa', 200: '#8fd8f4', 300: '#4cc4ef', 400: '#00b1eb', 500: '#0094c4', 600: '#00779c', 700: '#005f7d', 800: '#00404a', 900: '#002f37', 950: '#001e23' }
const slate = { 50: '#f3f6f8', 100: '#e4eaee', 200: '#c9d4dc', 300: '#adbdc9', 400: '#90a3b2', 500: '#73899a', 600: '#5a6f80', 700: '#465767', 800: '#33404c', 900: '#222b33', 950: '#151b20' }

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // The manual's font for internal materials (Futura PT is licensed for desktop use only).
        sans: ['Arial', '"Helvetica Neue"', 'Helvetica', 'sans-serif'],
      },
      colors: {
        gray,
        neutral: gray,
        zinc: gray,
        red,
        rose: red,
        green,
        emerald: green,
        lime: green,
        yellow,
        amber: yellow,
        orange,
        blue,
        sky: blue,
        indigo: blue,
        cyan: blue,
        teal: blue,
        slate,
        violet: slate,
        purple: slate,
        fuchsia: slate,
        health: {
          green: '#689425',
          orange: '#fbba00',
          red: '#d81e04',
          grey: '#90a3b2',
          blue: '#00779c',
        },
        // Palette-driven (see src/index.css): brand red on both ORLEN palettes.
        brand: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, `rgb(var(--pm-brand-${k}) / <alpha-value>)`])),
      },
    },
  },
  plugins: [],
}
