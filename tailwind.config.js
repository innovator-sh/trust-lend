/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: "#0A0F1E",
        gold: "#D4AF37",
        goldLight: "#C9A961",
        silver: "#E8E8E8",
        cream: "#F5F3F0",
        offWhite: "#FAFAF8",
        dark: "#1A1A1A",
      },
      fontFamily: {
        satoshi: ['Satoshi', 'sans-serif'],
        cabinet: ['Cabinet Grotesk', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

