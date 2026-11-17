import { readFileSync } from "node:fs";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The runtime-config accessors: runtimeConfig() itself and every function
// curatorEnv.ts exports (lensUrl(), isLive(), devMode(), …), read from the file
// so a new accessor is covered without touching this list.
const accessorNames = [
  "runtimeConfig",
  ...readFileSync(new URL("./src/lib/curatorEnv.ts", import.meta.url), "utf8").matchAll(/^export function (\w+)\(/gm),
].map((m) => (typeof m === "string" ? m : m[1]));
if (accessorNames.length < 10) throw new Error("eslint.config.mjs: found too few accessors in src/lib/curatorEnv.ts");
const ACCESSORS = `/^(${accessorNames.join("|")})$/`;

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
  {
    // Config is resolved per request, never baked into the bundle (argus-studio#56).
    // Next inlines a literal `process.env.FOO` at build time, so one published
    // image could no longer deploy to a second origin. Read config through
    // runtimeConfig.ts, which indexes the environment with a computed key.
    // NODE_ENV is the exception: it is a build-time fact by design.
    files: ["src/**/*.{ts,tsx,mts,js,jsx,mjs}"],
    ignores: [
      "src/**/*.test.ts",
      // The one sanctioned literal read: the static demo is a separate build.
      "src/lib/staticDemo.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][computed=false][property.name!='NODE_ENV']",
          message:
            "A literal process.env.NAME is inlined at build time. Read it through runtimeConfig() or an accessor in curatorEnv.ts.",
        },
        {
          // The Trusted Types policy has no createHTML, so an HTML string
          // written to a sink is refused once it is enforced (#198).
          selector:
            ":matches(AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/], CallExpression[callee.property.name='insertAdjacentHTML'], CallExpression[callee.object.name='document'][callee.property.name=/^(write|writeln)$/])",
          message: "Never write an HTML string to the DOM. Render it with React, or build nodes.",
        },
        {
          // The config is not known when a module is evaluated on the client,
          // so a module-scope call captures an empty or stale value.
          selector: `CallExpression[callee.name=${ACCESSORS}]:not(:function CallExpression)`,
          message:
            "Runtime config is not known at module scope. Call the accessor inside the function that needs it.",
        },
        {
          selector:
            "MemberExpression[object.type='MemberExpression'][object.object.name='process'][object.property.name='env'][computed=true][property.type='Literal']",
          message:
            "A literal process.env['NAME'] is inlined at build time. Read it through runtimeConfig() or an accessor in curatorEnv.ts.",
        },
      ],
    },
  },
]);

export default eslintConfig;
