import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/**
 * ESLint 9, configuration a plat.
 *
 * eslint-config-next 16 expose directement des objets de configuration a plat :
 * aucune passerelle de compatibilite n'est necessaire.
 */
const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescriptConfig,
  {
    rules: {
      // Un parametre prefixe d'un souligne est volontairement inutilise :
      // c'est le cas des methodes d'interface qu'une implementation n'exploite
      // pas, ou la signature doit pourtant rester conforme.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default config;
