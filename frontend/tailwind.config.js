/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#1a1a2e',
          panel: '#222238',
          elevated: '#2b2b42',
          border: '#3a3a52',
          text: '#f3f4f6',
          muted: '#a1a1aa',
          accent: '#8bb8c8',
          'accent-hover': '#a1c8d5',
        },
      },
    },
  },
  plugins: [],
};
