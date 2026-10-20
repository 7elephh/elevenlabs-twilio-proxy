import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        noir: { DEFAULT: "#111214", soft: "#18191c", line: "#2a2a2c" },
        ivoire: { DEFAULT: "#F2EDE4", dim: "#d9d3c8" },
        champagne: { DEFAULT: "#B8AD99", dark: "#8f846f" },
        graphite: { DEFAULT: "#52504C", light: "#7a7771" },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
      },
      letterSpacing: { label: "0.28em" },
      transitionTimingFunction: { lux: "cubic-bezier(0.22, 1, 0.36, 1)" },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "none" } },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        rise: "rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
        fade: "fade 1.2s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
