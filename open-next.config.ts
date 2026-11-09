import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 *
 * `buildCommand` is what `opennextjs-cloudflare build` runs to build the Next
 * app. It must point at a dedicated script: OpenNext's default is
 * `npm run build`, and `build` is the OpenNext build itself (so the default
 * would recurse). Keeping `build` as the OpenNext build is deliberate — that is
 * the command Cloudflare Workers Builds runs, and it leaves `.open-next/` ready
 * for `wrangler deploy`.
 */
const config = defineCloudflareConfig();

const openNextConfig = {
  ...config,
  buildCommand: "npm run build:next",
};

export default openNextConfig;
