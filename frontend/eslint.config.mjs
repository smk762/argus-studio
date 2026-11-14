import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Dragonhound shared layer: vendored verbatim (vendor/dh) and served
    // unchanged (public/dh-theme.js); fixes go upstream to dragonhound-site/shared.
    "vendor/**",
    "public/dh-theme.js",
  ]),
]);

export default eslintConfig;
