import type { Config } from "tailwindcss";

const config: Config = {
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
        sans: ['Montserrat', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Override default blue with Sonance brand blue (#00A3E1)
        blue: {
          50: '#F0F9FE',
          100: '#E0F2FD',
          200: '#BAE5FB',
          300: '#7DD3F8',
          400: '#38BCF2',
          500: '#10ADE8',
          600: '#00A3E1',
          700: '#0083B8',
          800: '#006E96',
          900: '#005B7C',
          950: '#003A52',
        },
        // Sonance Brand Colors
        sonance: {
          charcoal: {
            DEFAULT: '#333F48',
            light: '#4A5A66',
            dark: '#1F2A33',
          },
          cyan: {
            DEFAULT: '#00A3E1',
            light: '#33B5E7',
            dark: '#0082B4',
          },
        },
        // Semantic Colors
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
        ring: 'var(--ring)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'cyan-glow': '0 0 20px rgba(0, 163, 225, 0.15), 0 0 40px rgba(0, 163, 225, 0.1)',
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
export default config;
