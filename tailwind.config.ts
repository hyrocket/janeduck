import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateX(-50%) translateY(8px)" },
          to:   { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
        slideUpEnter: {
          from: { transform: "translateY(100%)" },
          to:   { transform: "translateY(0)" },
        },
        slideDownExit: {
          from: { transform: "translateY(0)" },
          to:   { transform: "translateY(100%)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(250, 204, 21, 0.5)" },
          "50%":      { boxShadow: "0 0 0 8px rgba(250, 204, 21, 0)" },
        },
      },
      animation: {
        "fade-in":         "fadeIn 0.2s ease-out",
        "slide-up-enter":  "slideUpEnter 0.5s ease-out",
        "slide-down-exit": "slideDownExit 0.5s ease-out forwards",
        "pulse-glow":      "pulseGlow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
