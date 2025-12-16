import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Sonance Beam Blue palette based on #00A3E1
        primary: {
          50: '#e6f7fc',
          100: '#b3e8f7',
          200: '#80d9f2',
          300: '#4dcaed',
          400: '#26bee8',
          500: '#00A3E1',  // Sonance "The Beam" blue
          600: '#0092ca',
          700: '#007eb0',
          800: '#006994',
          900: '#004d6e',
        },
        // Sonance brand colors
        sonance: {
          charcoal: '#333F48',
          beam: '#00A3E1',
          'light-gray': '#D9D9D6',
        },
      },
      gridTemplateColumns: {
        '3': 'repeat(3, minmax(0, 1fr))',
      },
      gridTemplateRows: {
        '3': 'repeat(3, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
};
export default config;
