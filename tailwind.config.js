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
        // IDE chrome (dark, VS Code-ish but cleaner)
        ink: {
          950: "#0a0c12",
          900: "#0d1017",
          850: "#11151f",
          800: "#151a26",
          700: "#1b2230",
          600: "#232c3d",
          500: "#2e3950",
        },
        line: "#222b3d",
        mut: "#8a93a6",
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
          DEFAULT: "#4f8cff",
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
