/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
      },
      colors: {
        ink: '#101727',
        teal: '#0f766e',
        coral: '#e85d3f',
        mist: '#f3f7fb',
      },
      boxShadow: {
        glass: '0 18px 40px rgba(16, 23, 39, 0.16)',
      },
    },
  },
  plugins: [],
};
