import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        appbg: "var(--app-bg)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        line: "var(--line)",
        panel: "var(--panel)",
        brand: {
          50: "#edf8f2",
          100: "#d8efe2",
          200: "#b4dfc8",
          300: "#80c7a4",
          400: "#48aa7e",
          500: "#16805b",
          600: "#126848",
          700: "#10543d",
          800: "#114332",
          900: "#123b2e"
        }
      },
      boxShadow: {
        soft: "0 22px 60px -18px rgba(15, 23, 42, 0.18)",
        card: "0 1px 0 rgba(15, 23, 42, 0.04), 0 10px 24px -18px rgba(15, 23, 42, 0.18)",
        "card-hover": "0 1px 0 rgba(15, 23, 42, 0.05), 0 18px 34px -20px rgba(15, 23, 42, 0.22)",
        glow: "0 0 0 1px rgba(22, 128, 91, 0.14), 0 10px 26px -12px rgba(22, 128, 91, 0.3)"
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        shimmer: { from: { backgroundPosition: "-400px 0" }, to: { backgroundPosition: "400px 0" } }
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.25s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1)",
        shimmer: "shimmer 1.6s infinite linear"
      }
    }
  },
  plugins: []
};

export default config;
