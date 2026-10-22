import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Workspace aliases so tests resolve `@ob/*` from source without a build step. These mirror
 * the `paths` in tsconfig.base.json — keep the two in sync when adding a package.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@ob/schema": resolve(__dirname, "packages/schema/src/index.ts"),
      "@ob/db": resolve(__dirname, "packages/db/src/withTenant.ts"),
      "@ob/ui": resolve(__dirname, "packages/ui/src/index.ts"),
      "@ob/exporter": resolve(__dirname, "packages/exporter/src/index.ts"),
      /**
       * `server-only` is een markeerpakket: de standaard-entry werpt met opzet, en alleen de
       * `react-server`-conditie levert de lege variant. Vite kent die conditie niet, dus een
       * routetest zou struikelen over een module die in productie prima laadt. Vandaar hier de
       * lege variant — precies wat de server zelf ook krijgt.
       */
      "server-only": resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    include: ["packages/**/*.{test,spec}.{ts,tsx}", "apps/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
