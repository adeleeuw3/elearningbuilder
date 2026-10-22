/**
 * The ONLY sanctioned way to touch tenant data (security invariant #1).
 *
 * Opens a transaction, sets a LOCAL GUC `app.tenant_id`, and runs your callback with a
 * tenant-scoped transaction handle. RLS policies key off `current_setting('app.tenant_id')`,
 * so every query inside is automatically constrained to the tenant. Because the setting is
 * LOCAL, it is scoped to the transaction and cannot leak across pooled connections.
 *
 * Rules enforced by lint (eslint-rules/no-raw-db.js) and CLAUDE.md:
 *   - Never import/use the raw `db` client in a request path.
 *   - Never derive tenantId from client-supplied body/query — pass the session's tenantId.
 *
 * The app connects as a NON-owner, NON-superuser role so RLS is non-bypassable.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: requireEnv("DATABASE_URL"),
  // Restricted app role — must NOT own the tables and must NOT be superuser.
  // (Owners/superusers bypass RLS. Verify with the migration's role grants.)
  max: 10,
});

/** Raw client — intentionally NOT exported. Only withTenant may reach the DB. */
const db = drizzle(pool);

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Run `fn` in a transaction scoped to `tenantId` via RLS. */
export async function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    // Fail closed: never run a query without a valid tenant scope.
    throw new Error("withTenant: invalid tenantId");
  }
  return db.transaction(async (tx) => {
    // set_config(..., true) => LOCAL to this transaction. Parameterized, no injection.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return fn(tx);
  });
}

/**
 * Escape hatch for genuinely cross-tenant admin/platform operations (e.g. billing rollups,
 * tenant provisioning). Explicit, greppable, and audited. Do NOT use in request handlers.
 */
export async function withPlatformScope<T>(reason: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  console.warn(`[db] platform-scope access: ${reason}`);
  return db.transaction((tx) => fn(tx));
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
