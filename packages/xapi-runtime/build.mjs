/**
 * Bundles the runtime into the spec-named files that ship inside export packages:
 *   dist/xapi_client_min.js  — the LRS client + statement builders + discovery (IIFE global)
 *   dist/xapi-bootstrap.js    — thin entry that discovers the LRS and creates a session
 *
 * `__DEV_LRS__` is compiled to `false` for production packages, hard-disabling the dev-only
 * manifest/well-known discovery step. Pass --dev to enable it for local testing.
 */
import { build } from "esbuild";

const dev = process.argv.includes("--dev");

const common = {
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: !dev,
  sourcemap: true,
  define: { __DEV_LRS__: JSON.stringify(dev) },
  logLevel: "info",
};

await build({
  ...common,
  entryPoints: { xapi_client_min: "src/client.ts" },
  globalName: "OBxapiClient",
  outdir: "dist",
});

await build({
  ...common,
  entryPoints: { "xapi-bootstrap": "src/index.ts" },
  globalName: "OBxapi",
  outdir: "dist",
});

console.log(`[xapi-runtime] built (${dev ? "DEV: manifest discovery ON" : "PROD: manifest discovery OFF"})`);
