/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Workspace packages ship raw TS source with explicit ".js" import extensions (NodeNext ESM
  // convention, needed for vitest/tsc). Webpack doesn't do that extension remapping by default;
  // this teaches it to, so `import "./labels.js"` resolves to labels.ts.
  transpilePackages: [
    "@winsznx/bellstate-engine",
    "@winsznx/bellstate-calendars",
    "@winsznx/bellstate-ui",
  ],
  // The workspace pins TypeScript 7 (every package here uses it); Next's own build-time
  // typecheck only supports TS 5/6's compiler API. Real type safety still comes from `npx tsc
  // --noEmit` run directly against this app's tsconfig, the same way every other package in
  // this monorepo is checked — not from Next's redundant internal pass.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
