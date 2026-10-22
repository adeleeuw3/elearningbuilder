/**
 * Note: `next dev` and `next build` both write to `.next` by default. Running a build while the
 * dev server is up replaces chunks the browser already holds, and the page dies with
 * "Cannot find module './835.js'". Restart dev (and delete `.next`) if that happens.
 *
 * To run both at once, point the build at its own directory:
 *   NEXT_DIST_DIR=.next-build npx next build
 * An env var is used rather than sniffing process.argv because Next spawns build workers whose
 * argv does not include "build" — argv-based detection resolves differently per process and the
 * build fails with a missing pages-manifest.
 */
const distDir = process.env.NEXT_DIST_DIR || ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  reactStrictMode: true,
  // @ob/* are source-only workspace packages; Next must compile their TS/JSX.
  transpilePackages: ["@ob/ui", "@ob/schema"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
