import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet, okxWallet, metaMaskWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { xLayer } from "./chains";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// Confirmed by reading the installed package's own source: okxWallet/metaMaskWallet detect their
// extension via `hasInjectedProvider`, which reads `window.ethereum` — unavailable during SSR, so
// on the server they always fall through to building a real WalletConnect connector, which throws
// without a real project ID (`getWalletConnectConnector` in RainbowKit's own source rejects `""`
// outright). `injectedWallet` has no such fallback (`createConnector: getInjectedConnector({})`,
// no projectId anywhere in its source) — it's RainbowKit's own generic "Browser Wallet" entry and
// connects to any EIP-1193 provider, OKX Wallet included, just without OKX's own icon. Once a real
// WalletConnect project ID exists, add okxWallet/metaMaskWallet back (imported above already) for
// branded icons and the QR/mobile fallback.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Browser wallets",
      wallets: walletConnectProjectId ? [okxWallet, metaMaskWallet, injectedWallet] : [injectedWallet],
    },
  ],
  {
    appName: "Bellstate",
    projectId: walletConnectProjectId ?? "",
  },
);

export const wagmiConfig = createConfig({
  chains: [xLayer],
  connectors,
  transports: {
    [xLayer.id]: http(xLayer.rpcUrls.default.http[0]),
  },
  ssr: true,
});
