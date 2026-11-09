import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext configuration for Cloudflare Workers.
 *
 * Defaults are correct for this app: every page is either static or rendered on
 * demand, and there is no ISR, so no incremental cache binding is needed. If
 * caching is added later, see https://opennext.js.org/cloudflare/caching.
 */
export default defineCloudflareConfig();
