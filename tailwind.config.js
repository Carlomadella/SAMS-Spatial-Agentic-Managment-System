/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // IDE chrome — driven by CSS variables so the theme can flip (see index.css)
        ink: {
          950: "rgb(var(--c-ink-950) / <alpha-value>)",
          900: "rgb(var(--c-ink-900) / <alpha-value>)",
          850: "rgb(var(--c-ink-850) / <alpha-value>)",
          800: "rgb(var(--c-ink-800) / <alpha-value>)",
          700: "rgb(var(--c-ink-700) / <alpha-value>)",
          600: "rgb(var(--c-ink-600) / <alpha-value>)",
          500: "rgb(var(--c-ink-500) / <alpha-value>)",
        },
        line: "rgb(var(--c-line) / <alpha-value>)",
        mut: "rgb(var(--c-mut) / <alpha-value>)",
        // agent palette (matches the six Sims-like agents)
        agent: {
          blue: "#3b82f6",
          green: "#22c55e",
          orange: "#f97316",
          purple: "#a855f7",
          red: "#ef4444",
          yellow: "#eab308",
        },
        brand: {
          // driven by the shared --c-accent token (index.css) so it flips with the theme
          DEFAULT: "rgb(var(--c-accent) / <alpha-value>)",
          soft: "#9bc1ff",
        },
      },
      boxShadow: {
        panel: "0 10px 40px -12px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(79,140,255,0.4), 0 0 24px -4px rgba(79,140,255,0.5)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        "pulse-soft": "pulse-soft 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
