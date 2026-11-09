import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Exposes the wrangler bindings (D1, R2) to `next dev`, so local development
// uses the same database and object store as the deployed Worker. This is a
// no-op during `next build`.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Prisma ships a `workerd` build of its client. Marking it external keeps
  // Turbopack out of its WebAssembly imports, and lets OpenNext copy the
  // Workers variant into the bundle (see opennextjs.org/cloudflare/howtos/db).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  poweredByHeader: false,
};

export default nextConfig;
