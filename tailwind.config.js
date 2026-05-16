/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {
    keyframes: {
      scaleIn: {
        '0%': { transform: 'scale(0)', opacity: '0' },
        '60%': { transform: 'scale(1.2)', opacity: '1' },
        '100%': { transform: 'scale(1)', opacity: '1' },
      },
      slideUp: {
        '0%': { transform: 'translateY(100%)' },
        '100%': { transform: 'translateY(0)' },
      },
    },
    animation: {
      scaleIn: 'scaleIn 0.3s ease-out',
      'slide-up': 'slideUp 0.25s ease-out',
    },
  } },
  plugins: [],
}
