import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const app = new Hono<{ Bindings: Env }>();

// PRD §10.1: "CORS: * for GET."
app.use("*", cors({ origin: "*", allowMethods: ["GET"] }));

/**
 * Not in the PRD's §10.2 endpoint table — a minimal liveness/readiness check for this first real
 * deploy, proving the Worker is reachable and can actually reach Supabase with the configured
 * service-role key. The real §10.2 endpoints (GET /status, /venues, etc.) aren't built yet.
 */
app.get("/health", async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { error } = await supabase.from("venues").select("mic", { count: "exact", head: true });

  if (error) {
    return c.json({ ok: false, supabase: "unreachable", error: error.message }, 503);
  }
  return c.json({ ok: true, supabase: "reachable" });
});

export default app;
