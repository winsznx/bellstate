import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { Watcher } from "./watcher.js";

/** PRD §10.5's `oraclewatch.flagged` event, published to the real `bellstate-events` queue. */
export interface OracleWatchQueueMessage {
  id: string;
  type: "oraclewatch.flagged";
  createdAt: string;
  data: {
    name: string;
    dex: string;
    flag: string;
    movePct: number;
    windowStart: string;
    windowEnd: string;
  };
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  WATCHER: DurableObjectNamespace<Watcher>;
  EVENTS_QUEUE: Queue<OracleWatchQueueMessage>;
}

/** One fixed Oracle Watch instance for the single dex this worker polls (§4.9/§8.6 scope it to
 * dex "xyz" only). */
const WATCHER_INSTANCE_NAME = "oracle-watch:xyz";

const app = new Hono<{ Bindings: Env }>();

/**
 * Not in the PRD's §10.2 endpoint table (that's apps/api's surface) — this app's own liveness
 * check, matching apps/api/src/worker.ts's `/health` pattern: proves the Worker can reach
 * Supabase. It also doubles as the Watcher DO's bootstrap ping — a Durable Object is only
 * constructed on its first access, so this is what arms its initial 5s alarm (src/watcher.ts's
 * constructor); every tick after that re-arms itself via ctx.storage.setAlarm, so no further
 * external pings are required to keep the poll loop running.
 */
app.get("/health", async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("perp_markets").select("name", { count: "exact", head: true });
  if (error) {
    return c.json({ ok: false, supabase: "unreachable", error: error.message }, 503);
  }

  const stub = c.env.WATCHER.getByName(WATCHER_INSTANCE_NAME);
  const watcher = await stub.ping();

  return c.json({ ok: true, supabase: "reachable", watcher });
});

export { Watcher };
export default app;
