import type { Config } from "tailwindcss";

/**
 * Identite visuelle Callio.
 *
 * Ces valeurs sont une reconstruction a partir de la description du produit
 * (fond noir, violet Callio, cartes sombres) : le site commercial n'etant pas
 * present dans ce depot, les teintes exactes n'ont pas pu etre relevees.
 * Tout l'habillage de l'application derive de ce seul fichier — recaler les
 * hex ici suffit a aligner l'application sur le site.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Fonds, du plus profond au plus clair.
        night: {
          950: "#07070b",
          900: "#0b0b12",
          850: "#101019",
          800: "#16161f",
          700: "#1f1f2b",
          600: "#2b2b3a",
        },
        // Violet Callio.
        callio: {
          50: "#f3efff",
          200: "#d6c7ff",
          400: "#a684ff",
          500: "#8b5cf6",
          600: "#7338e8",
          700: "#5b21c4",
        },
        // Texte.
        mist: {
          100: "#f5f5fa",
          300: "#c8c8d8",
          500: "#8e8ea8",
          600: "#6b6b85",
        },
        // Statuts.
        ok: { DEFAULT: "#34d399", dim: "#10664a" },
        warn: { DEFAULT: "#fbbf24", dim: "#7a5306" },
        danger: { DEFAULT: "#f87171", dim: "#7f2a2a" },
      },
      borderRadius: {
        card: "1rem",
        control: "0.625rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.8)",
        glow: "0 0 0 1px rgba(139,92,246,0.35), 0 8px 32px -12px rgba(139,92,246,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
