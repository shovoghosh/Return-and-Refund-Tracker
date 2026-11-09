import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Prisma's Cloudflare runtime imports its query compiler as
 * `./query_compiler_bg.wasm?module` — the form workerd and esbuild resolve to a
 * pre-compiled `WebAssembly.Module` (no runtime Wasm compilation, which Workers
 * forbid). Vite has no built-in handler for it, so this plugin compiles the
 * module at transform time. Node allows synchronous Wasm compilation, so the
 * same generated client works in tests and in the Worker.
 */
function prismaWasmModule(): Plugin {
  return {
    name: "prisma-wasm-module",
    enforce: "pre",
    load(id) {
      const file = id.split("?")[0];
      if (!id.includes("?module") || !file.endsWith(".wasm")) return null;
      const base64 = readFileSync(file).toString("base64");
      return [
        `const binary = Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0));`,
        `export default new WebAssembly.Module(binary);`,
      ].join("\n");
    },
  };
}

export default defineConfig({
  plugins: [tsconfigPaths(), prismaWasmModule()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globals: true,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
