/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Arrakis desert palette
        sand: {
          50: '#fdf8ee',
          100: '#faf0d6',
          200: '#f5e0ac',
          300: '#edc97a',
          400: '#e6b545',
          500: '#df9e1e',
          600: '#c47d13',
          700: '#a35f12',
          800: '#854b17',
          900: '#6e3e18',
          950: '#3c1f09',
        },
        spice: {
          400: '#f97316',
          500: '#ea580c',
          600: '#c2410c',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
