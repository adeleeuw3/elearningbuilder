/**
 * `next dev` and `next build` both write to `.next` by default; building while dev runs corrupts
 * the dev server's chunk graph. Override per-process with an env var (which propagates to Next's
 * build workers, unlike process.argv):
 *   NEXT_DIST_DIR=.next-build npx next build
 */
const distDir = process.env.NEXT_DIST_DIR || ".next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir,
  reactStrictMode: true,
  // Workspace-pakketten worden als TS-bron geïmporteerd, dus Next moet ze zelf omzetten.
  transpilePackages: ["@ob/ui", "@ob/schema", "@ob/exporter"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
