import { describe, expect, it } from "vitest";
import { eventToContext, isBellstateEvent, type BellstateEvent } from "../src/worker.js";

const validEvent: BellstateEvent = {
  id: "evt_1",
  type: "halt.opened",
  createdAt: "2026-09-30T15:02:07.000Z",
  data: { listing: "XNAS:NVDA", programs: ["NVDAx"] },
};

describe("isBellstateEvent — runtime guard for the PRD §10.5 event envelope", () => {
  it("accepts a well-formed event", () => {
    // #given / #when
    const result = isBellstateEvent(validEvent);
    // #then
    expect(result).toBe(true);
  });

  it("rejects a payload with an unknown type", () => {
    // #given
    const payload = { ...validEvent, type: "not.a.real.type" };
    // #when
    const result = isBellstateEvent(payload);
    // #then
    expect(result).toBe(false);
  });

  it("rejects a payload missing required fields", () => {
    // #given / #when / #then
    expect(isBellstateEvent({ type: "halt.opened" })).toBe(false);
    expect(isBellstateEvent(null)).toBe(false);
    expect(isBellstateEvent("evt_1")).toBe(false);
    expect(isBellstateEvent(undefined)).toBe(false);
  });

  it("rejects a payload whose data field is missing", () => {
    // #given
    const { data: _data, ...withoutData } = validEvent;
    // #when
    const result = isBellstateEvent(withoutData);
    // #then
    expect(result).toBe(false);
  });
});

describe("eventToContext — maps the PRD §10.5 envelope to a filterable context", () => {
  it("splits `listing` into mic and symbol", () => {
    // #given / #when
    const context = eventToContext(validEvent);
    // #then
    expect(context).toEqual({ type: "halt.opened", mic: "XNAS", symbol: "NVDA", families: ["NVDAx"] });
  });

  it("leaves mic and symbol undefined when listing is absent", () => {
    // #given
    const event: BellstateEvent = { ...validEvent, data: { programs: ["NVDAx"] } };
    // #when
    const context = eventToContext(event);
    // #then
    expect(context.mic).toBeUndefined();
    expect(context.symbol).toBeUndefined();
  });
});
