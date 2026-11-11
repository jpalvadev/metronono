/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        teal: {
          50: "hsl(166 76% 97% / <alpha-value>)",
          100: "hsl(168 80% 90% / <alpha-value>)",
          200: "hsl(170 78% 80% / <alpha-value>)",
          300: "hsl(172 81% 60% / <alpha-value>)",
          400: "hsl(173 85% 45% / <alpha-value>)",
          500: "hsl(174 100% 33% / <alpha-value>)",
          600: "hsl(174 100% 29% / <alpha-value>)",
          700: "hsl(176 100% 24% / <alpha-value>)",
          800: "hsl(177 100% 19% / <alpha-value>)",
          900: "hsl(178 100% 14% / <alpha-value>)",
          950: "hsl(180 100% 8% / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
