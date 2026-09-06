/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wom: {
          primary: "hsl(var(--wom-primary) / <alpha-value>)",
          "primary-foreground": "hsl(var(--wom-primary-foreground) / <alpha-value>)",
          secondary: "hsl(var(--wom-secondary) / <alpha-value>)",
          accent: "hsl(var(--wom-accent) / <alpha-value>)",
          background: "hsl(var(--wom-background) / <alpha-value>)",
          surface: "hsl(var(--wom-surface) / <alpha-value>)",
          muted: "hsl(var(--wom-muted) / <alpha-value>)",
          text: "hsl(var(--wom-text) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
