/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // We can add some clean custom colors if needed later, but standard tailwind colors are present by default.
      }
    },
  },
  plugins: [],
}
