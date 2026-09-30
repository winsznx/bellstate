import { DurableObject } from "cloudflare:workers";
import { DOMAIN_IDS } from "@winsznx/bellstate-protocol";
import { createXLayerClient } from "../chain/client.js";
import { HUB_READ_ABI } from "../chain/hubAbi.js";
import type { OnchainMarketView } from "../chain/marketViewToState.js";
import { CHAIN_POLL_INTERVAL_MS, LISTING_ID } from "../constants.js";
import type { Env } from "../env.js";

export interface ChainView {
  marketView: OnchainMarketView;
  calendarVersion: number;
  frozenUntil: number;
  usMarketsDomainVersion: bigint;
  latestBlockTimestamp: number;
  signerSet: { active: readonly `0x${string}`[]; quorum: number; version: number };
  /** Unix seconds this view was last successfully refreshed onchain. */
  fetchedAt: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * PRD §8.1's Chain Durable Object: every 5s, reads the hub's real onchain view for the one
 * registered listing this build attests, plus the signer set / calendar version / freeze state /
 * US_MARKETS domain version CoreDO needs to diff against and to decide whether it may sign at all.
 *
 * The view is cached in memory only (not `ctx.storage`) — at a 5s poll cadence, a freshly evicted
 * instance is at most one alarm tick (≤5s) away from a fresh read, which the constructor's
 * immediate self-arm (below) minimizes further. See usHaltsDO.ts for the same reasoning applied to
 * a slower-cadence DO.
 *
 * Reads each view function independently rather than batching via Multicall3: PRD §8.1 describes
 * Multicall for "all subjects", and this build has exactly one. Worth revisiting once more than
 * one listing/program is registered and this DO's per-tick call count actually grows.
 */
export class ChainDO extends DurableObject<Env> {
  private client: ReturnType<typeof createXLayerClient> | null = null;
  private cached: ChainView | null = null;
  private lastError: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const existing = await ctx.storage.getAlarm();
      if (existing === null) {
        await ctx.storage.setAlarm(Date.now());
      }
    });
  }

  /** Watchdog target (worker.ts's `scheduled()`): re-arms this DO if its alarm was ever dropped. */
  async ensureAlarm(): Promise<void> {
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  async alarm(): Promise<void> {
    await this.refresh();
    await this.ctx.storage.setAlarm(Date.now() + CHAIN_POLL_INTERVAL_MS);
  }

  private getClient(): ReturnType<typeof createXLayerClient> {
    this.client ??= createXLayerClient(this.env.XLAYER_RPC_URLS);
    return this.client;
  }

  private async refresh(): Promise<void> {
    const client = this.getClient();
    const hubAddress = this.env.HUB_ADDRESS as `0x${string}`;

    try {
      const [calendarVersion, frozenUntil, marketView, domainDigest, signerSet, block] = await Promise.all([
        client.readContract({ address: hubAddress, abi: HUB_READ_ABI, functionName: "calendarVersion" }),
        client.readContract({ address: hubAddress, abi: HUB_READ_ABI, functionName: "frozenUntil" }),
        client.readContract({ address: hubAddress, abi: HUB_READ_ABI, functionName: "marketView", args: [LISTING_ID] }),
        client.readContract({ address: hubAddress, abi: HUB_READ_ABI, functionName: "domainDigests", args: [DOMAIN_IDS.US_MARKETS] }),
        client.readContract({ address: hubAddress, abi: HUB_READ_ABI, functionName: "signerSet" }),
        client.getBlock(),
      ]);

      const [usMarketsDomainVersion] = domainDigest;
      const [activeSigners, quorum, signerSetVersion] = signerSet;

      this.cached = {
        marketView,
        calendarVersion,
        frozenUntil: Number(frozenUntil),
        usMarketsDomainVersion,
        latestBlockTimestamp: Number(block.timestamp),
        signerSet: { active: activeSigners, quorum, version: signerSetVersion },
        fetchedAt: Math.floor(Date.now() / 1000),
      };
      this.lastError = null;
    } catch (err) {
      this.lastError = errorMessage(err);
    }
  }

  /** Throws when no successful onchain read has ever completed — CoreDO treats that as a reason
   * to skip the tick entirely rather than sign against a view it never actually observed. */
  async getView(): Promise<ChainView> {
    if (this.cached === null) {
      throw new Error(`chain_view_unavailable: ${this.lastError ?? "no successful read yet"}`);
    }
    return this.cached;
  }

  async getHealth(): Promise<{ fetchedAt: number | null; lastError: string | null }> {
    return { fetchedAt: this.cached?.fetchedAt ?? null, lastError: this.lastError };
  }
}
