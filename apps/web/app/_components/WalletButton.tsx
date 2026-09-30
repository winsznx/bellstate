"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";

/** PRD S11.2 G1/G5 — wallet button in the shell, opens RainbowKit's real connect modal.
 * ConnectButton.Custom renders nothing itself; every piece below is wired to real wagmi/
 * RainbowKit state (account, chain, connection status), not placeholder markup. */
export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, openChainModal, mounted }) => {
        const ready = mounted;

        if (!ready) {
          return <div className="h-[38px] w-full animate-pulse rounded-pill bg-white/60" aria-hidden />;
        }

        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-pill border border-border-strong bg-white text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-muted"
            >
              <Wallet size={16} aria-hidden />
              Connect wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-pill bg-close-soft text-sm font-medium text-close"
            >
              Wrong network
            </button>
          );
        }

        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="flex min-h-[38px] w-full items-center justify-center gap-2 rounded-pill border border-border-strong bg-white text-sm font-medium text-ink transition-colors duration-fast hover:bg-surface-muted"
          >
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
