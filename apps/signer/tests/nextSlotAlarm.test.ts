import { describe, expect, it } from "vitest";
import { nextSlotAlarmMs, parseSignerSlot } from "../src/scheduling/nextSlotAlarm.js";

describe("nextSlotAlarmMs — §4.1 signer slotting", () => {
  it("schedules later in the same period when the slot hasn't passed yet", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 5); // 12:00:05
    expect(nextSlotAlarmMs(now, 20, 60)).toBe(Date.UTC(2026, 0, 1, 12, 0, 20));
  });

  it("rolls over to the next period once the slot has already passed", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 25); // 12:00:25, slot 20 already passed
    expect(nextSlotAlarmMs(now, 20, 60)).toBe(Date.UTC(2026, 0, 1, 12, 1, 20));
  });

  it("rolls over exactly on the slot boundary itself (never returns `now`)", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 20); // exactly on slot 20
    expect(nextSlotAlarmMs(now, 20, 60)).toBe(Date.UTC(2026, 0, 1, 12, 1, 20));
  });

  it("slot 0 behaves like any other slot, not a special case", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 1);
    expect(nextSlotAlarmMs(now, 0, 60)).toBe(Date.UTC(2026, 0, 1, 12, 1, 0));
  });

  it("rejects a slot outside [0, periodSeconds)", () => {
    expect(() => nextSlotAlarmMs(Date.now(), 60, 60)).toThrow();
    expect(() => nextSlotAlarmMs(Date.now(), -1, 60)).toThrow();
  });
});

describe("parseSignerSlot", () => {
  it("parses a valid SIGNER_SLOT string", () => {
    expect(parseSignerSlot("40", 60)).toBe(40);
  });

  it("rejects an unset, non-numeric, or out-of-range SIGNER_SLOT", () => {
    expect(() => parseSignerSlot(undefined, 60)).toThrow();
    expect(() => parseSignerSlot("not-a-number", 60)).toThrow();
    expect(() => parseSignerSlot("60", 60)).toThrow();
    expect(() => parseSignerSlot("-5", 60)).toThrow();
  });
});
