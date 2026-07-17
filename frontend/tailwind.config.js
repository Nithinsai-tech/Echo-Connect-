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
        orange: {
          50: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          100: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          200: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          300: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          400: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          500: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-rgb), ${opacityValue})` : `rgb(var(--orange-rgb))`,
          600: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          700: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-rgb), ${opacityValue})` : `rgb(var(--orange-rgb))`,
          800: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-rgb), ${opacityValue})` : `rgb(var(--orange-rgb))`,
          900: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-rgb), ${opacityValue})` : `rgb(var(--orange-rgb))`,
          950: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-rgb), ${opacityValue})` : `rgb(var(--orange-rgb))`,
          450: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
          455: ({ opacityValue }) => opacityValue !== undefined ? `rgba(var(--orange-light-rgb), ${opacityValue})` : `rgb(var(--orange-light-rgb))`,
        },
        gray: {
          550: '#858E9E',
          850: '#1A2035',
        }
      }
    },
  },
  plugins: [],
}
