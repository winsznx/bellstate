import { Hono } from "hono";
import { CALENDAR_VERSION } from "@winsznx/bellstate-calendars";
import { privateKeyToAccount } from "@winsznx/bellstate-protocol";
import { MIC, SYMBOL } from "./constants.js";
import { ChainDO } from "./durableObjects/chainDO.js";
import { CoreDO } from "./durableObjects/coreDO.js";
import { UsHaltsDO } from "./durableObjects/usHaltsDO.js";
import type { Env } from "./env.js";

export { ChainDO, CoreDO, UsHaltsDO };

const app = new Hono<{ Bindings: Env }>();

/** PRD §8.1: "GET /health returns public JSON: signer address, last tick, per-source health,
 * calendar version, build SHA, epoch." Never returns SIGNER_PRIVATE_KEY — only its derived
 * address. */
app.get("/health", async (c) => {
  const account = privateKeyToAccount(c.env.SIGNER_PRIVATE_KEY as `0x${string}`);

  const [core, chain, sources] = await Promise.all([
    c.env.CORE.getByName("core").getStatus(),
    c.env.CHAIN.getByName("chain")
      .getHealth()
      .catch((err: unknown) => ({ fetchedAt: null, lastError: err instanceof Error ? err.message : String(err) })),
    c.env.US_HALTS.getByName("us-halts")
      .getSnapshot(SYMBOL, MIC)
      .then((s) => ({ nasdaqLastSuccessAt: s.nasdaqLastSuccessAt, nyseLastSuccessAt: s.nyseLastSuccessAt, lastError: s.lastError }))
      .catch((err: unknown) => ({ nasdaqLastSuccessAt: null, nyseLastSuccessAt: null, lastError: err instanceof Error ? err.message : String(err) })),
  ]);

  return c.json({
    signerAddress: account.address,
    calendarVersion: CALENDAR_VERSION,
    epoch: core.epoch,
    lastTickAt: core.lastTickAt,
    lastTickOk: core.lastTickOk,
    refusalReasons: core.refusalReasons,
    lastError: core.lastError,
    updatesSent: core.updatesSent,
    heartbeatsSent: core.heartbeatsSent,
    postResults: core.postResults,
    chain,
    sources,
    buildSha: c.env.BUILD_SHA ?? null,
  });
});

export default {
  fetch: app.fetch,

  /** PRD §8.1's watchdog: "A Cron (* * * * *) re-arms any DO without a pending alarm." Each DO
   * also self-arms in its own constructor, so this is a safety net for the case an alarm handler
   * ran without rescheduling (a bug) rather than the only thing keeping the loops alive. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      Promise.all([
        env.US_HALTS.getByName("us-halts").ensureAlarm(),
        env.CHAIN.getByName("chain").ensureAlarm(),
        env.CORE.getByName("core").ensureAlarm(),
      ]),
    );
  },
};
