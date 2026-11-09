import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Database access.
 *
 * The Prisma client is generated without a Rust engine (`engineType = "client"`),
 * so it must be handed a driver adapter:
 *
 *  - Cloudflare Workers: the D1 binding from `wrangler.jsonc`.
 *  - Tests (plain Node): a better-sqlite3 adapter injected by `tests/setup.ts`,
 *    because there is no D1 binding outside the Workers runtime.
 *
 * The client is created lazily on first query rather than at module load: a
 * Worker can evaluate a module outside any request, where bindings are not yet
 * attached.
 *
 * `prisma.user.findMany()` still works because the export is a proxy that
 * forwards each property chain to the real client once it exists.
 */

type D1Like = ConstructorParameters<typeof PrismaD1>[0];
type AdapterFactory = () => Promise<unknown> | unknown;

const globalForPrisma = globalThis as unknown as {
  __prismaAdapterFactory?: AdapterFactory;
  __prismaClientPromise?: Promise<PrismaClient>;
};

/** Test hook: set before the first query to supply a non-D1 adapter. */
export function setPrismaAdapterFactory(factory: AdapterFactory | undefined): void {
  globalForPrisma.__prismaAdapterFactory = factory;
  globalForPrisma.__prismaClientPromise = undefined;
}

async function createClient(): Promise<PrismaClient> {
  const factory = globalForPrisma.__prismaAdapterFactory;
  if (factory) {
    return new PrismaClient({ adapter: (await factory()) as never });
  }

  let env: unknown;
  try {
    ({ env } = await getCloudflareContext({ async: true }));
  } catch {
    throw new Error(
      "No database binding available. Inside Workers this should be the D1 binding `DB`; " +
        "during `next dev` run with the OpenNext dev bindings, and in tests set a Prisma adapter factory.",
    );
  }

  const db = (env as { DB?: D1Like }).DB;
  if (!db) {
    throw new Error(
      "The D1 binding `DB` is missing. Check wrangler.jsonc (d1_databases) and that the database was created.",
    );
  }
  return new PrismaClient({ adapter: new PrismaD1(db) });
}

function client(): Promise<PrismaClient> {
  globalForPrisma.__prismaClientPromise ??= createClient();
  // A failed creation must not be cached forever: the next request retries.
  globalForPrisma.__prismaClientPromise.catch(() => {
    globalForPrisma.__prismaClientPromise = undefined;
  });
  return globalForPrisma.__prismaClientPromise;
}

/** Builds a callable proxy for one property path, e.g. ["user", "findMany"]. */
function delegate(path: string[]): unknown {
  const callable = (...args: unknown[]) =>
    client().then((prisma) => {
      let owner: Record<string, unknown> = prisma as unknown as Record<string, unknown>;
      for (let i = 0; i < path.length - 1; i++) {
        owner = owner[path[i]] as Record<string, unknown>;
      }
      const method = owner[path[path.length - 1]] as (...a: unknown[]) => unknown;
      return method.apply(owner, args);
    });

  return new Proxy(callable, {
    get(_target, prop) {
      // Never look thenable: awaiting the proxy itself must not trigger a query.
      if (prop === "then") return undefined;
      return delegate([...path, String(prop)]);
    },
  });
}

export const prisma = delegate([]) as unknown as PrismaClient;

export default prisma;
