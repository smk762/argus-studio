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
    // The Dragonhound shared layer, vendored verbatim; fixes go upstream to
    // dragonhound-site/shared. Its served copy, public/dh-theme.js, lints clean
    // since dh-shared 1.2.0, so it is linted like the rest.
    "vendor/**",
  ]),
]);

export default eslintConfig;
