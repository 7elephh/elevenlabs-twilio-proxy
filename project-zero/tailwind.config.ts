import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#08090b",
          900: "#0d0f12",
          850: "#111418",
          800: "#171b21",
          700: "#232830",
          600: "#333a45",
        },
        chalk: {
          100: "#f2f5f7",
          300: "#c2c9d2",
          500: "#8b95a3",
          600: "#6b7583",
        },
        signal: {
          DEFAULT: "#3ddc84",
          dim: "#1f7d4c",
        },
        alert: {
          DEFAULT: "#ff6b57",
          dim: "#8a3327",
        },
        caution: "#f5b544",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
