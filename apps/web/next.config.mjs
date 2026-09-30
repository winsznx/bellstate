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
    // wagmi's connectors barrel (pulled in by RainbowKit's root export) includes a `baseAccount`
    // connector for Coinbase Smart Wallet, which we don't offer (see app/_lib/wagmi.ts — only
    // okxWallet/metaMaskWallet/injectedWallet). It transitively requires @coinbase/cdp-sdk's
    // optional x402 peer packages, which aren't installed and are never reachable from our code
    // path. Aliasing them to false tells webpack to resolve them to an empty module instead of
    // failing the build over a dependency chain nothing here actually calls.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/core/client": false,
      "@x402/evm": false,
      "@x402/evm/exact/client": false,
      "@x402/evm/upto/client": false,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;
