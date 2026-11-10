/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        note: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          400: '#facc15',
          500: '#eab308',
          900: '#3b2f0b',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'Inter', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
