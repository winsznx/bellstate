import { resolveSessionWindow, type Mic } from "@winsznx/bellstate-calendars";
import { createClient } from "@supabase/supabase-js";
import { Hono } from "hono";
import type { Env } from "../worker.js";

export const venuesRoute = new Hono<{ Bindings: Env }>();

interface VenueRow {
  mic: string;
  name: string;
  tz: string;
  family: string;
  currency: string;
}

/** PRD §10.2: "GET /venues | free | Venues with current session and next transition." Session/
 * next-transition are computed live from packages/calendars (real, not stored) against the
 * venues Supabase table (real seed data, scripts/seed/venues.sql) — the only two live data
 * sources that exist right now. */
venuesRoute.get("/venues", async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from("venues")
    .select("mic, name, tz, family, currency")
    .order("mic")
    .returns<VenueRow[]>();

  if (error) {
    return c.json({ error: { code: "SUPABASE_ERROR", message: error.message } }, 502);
  }

  const now = Math.floor(Date.now() / 1000);
  const venues = (data ?? []).map((venue) => {
    const window = resolveSessionWindow(venue.mic as Mic, now);
    return {
      mic: venue.mic,
      name: venue.name,
      tz: venue.tz,
      family: venue.family,
      currency: venue.currency,
      session: window.session,
      nextScheduledTransition: new Date(window.nextScheduledTransition * 1000).toISOString(),
      nextScheduledTransitionUnix: window.nextScheduledTransition,
    };
  });

  // PRD §10.1: "status endpoints send Cache-Control: public, max-age=5 and an ETag."
  c.header("Cache-Control", "public, max-age=5");
  c.header("ETag", `"venues-${now - (now % 5)}"`);
  return c.json({ venues });
});
