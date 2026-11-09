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
    // Generated build output: the OpenNext worker bundle, wrangler's local
    // state and dry-run output, and Prisma's generated client.
    ".open-next/**",
    ".wrangler/**",
    ".wrangler-dry/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
