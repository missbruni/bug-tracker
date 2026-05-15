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
    },
    animation: {
      scaleIn: 'scaleIn 0.3s ease-out',
    },
  } },
  plugins: [],
}
