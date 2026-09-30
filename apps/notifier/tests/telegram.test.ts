import { describe, expect, it, vi } from "vitest";
import {
  buildGenericEventMessage,
  buildHaltOpenedMessage,
  buildHaltResumedMessage,
  escapeMarkdownV2,
  sendTelegramMessage,
} from "../src/telegram.js";

describe("escapeMarkdownV2 — Telegram's MarkdownV2 special-character rule", () => {
  it("escapes every character in Telegram's documented special set", () => {
    // #given
    const input = "_*[]()~`>#+-=|{}.!";
    // #when
    const result = escapeMarkdownV2(input);
    // #then
    expect(result).toBe("\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!");
  });

  it("leaves ordinary text untouched", () => {
    // #given
    const input = "NVDA halted on Nasdaq";
    // #when / #then
    expect(escapeMarkdownV2(input)).toBe(input);
  });

  it("escapes the punctuation inside a real illustrative message", () => {
    // #given
    const input = "surge fee 3.00% decaying to 0 by 12:03 ET";
    // #when
    const result = escapeMarkdownV2(input);
    // #then
    expect(result).toBe("surge fee 3\\.00% decaying to 0 by 12:03 ET");
  });
});

describe("buildHaltOpenedMessage — PRD §10.6 illustrative template", () => {
  it("formats the exact illustrative NVDA halt example", () => {
    // #given
    const params = {
      symbol: "NVDA",
      venueName: "Nasdaq",
      reasonText: "news pending",
      reasonCode: "T1",
      haltAtEt: "11:02:07 ET",
      onchainAtEt: "11:02:31 ET",
      latencySeconds: 24,
      poolsText: "pools blocked",
      eventUrl: "https://bellstate.example/event/evt_1",
    };
    // #when
    const result = buildHaltOpenedMessage(params);
    // #then
    expect(result).toBe(
      "⛔ NVDA halted on Nasdaq — news pending (T1) · 11:02:07 ET · onchain 11:02:31 ET (24 s) · pools blocked · https://bellstate.example/event/evt_1",
    );
  });
});

describe("buildHaltResumedMessage — PRD §10.6 illustrative template", () => {
  it("formats the exact illustrative NVDA resume example", () => {
    // #given
    const params = {
      symbol: "NVDA",
      venueName: "Nasdaq",
      resumedAtEt: "11:48:00 ET",
      surgeFeePercent: 3,
      surgeDecayByEt: "12:03 ET",
    };
    // #when
    const result = buildHaltResumedMessage(params);
    // #then
    expect(result).toBe("✅ NVDA resumed on Nasdaq · 11:48:00 ET · surge fee 3.00% decaying to 0 by 12:03 ET");
  });
});

describe("buildGenericEventMessage — fallback for event types the PRD gives no bespoke copy for", () => {
  it("includes the listing and event link when present", () => {
    // #given
    const params = { type: "status.market.changed", listing: "XNAS:NVDA", eventUrl: "https://bellstate.example/e/1" };
    // #when
    const result = buildGenericEventMessage(params);
    // #then
    expect(result).toBe("Bellstate event: status.market.changed for XNAS:NVDA · https://bellstate.example/e/1");
  });

  it("omits listing and link segments when absent", () => {
    // #given
    const params = { type: "network.degraded" };
    // #when
    const result = buildGenericEventMessage(params);
    // #then
    expect(result).toBe("Bellstate event: network.degraded");
  });
});

describe("sendTelegramMessage — PRD §8.5: sendMessage, MarkdownV2 escaped, respects 429 retry_after", () => {
  it("escapes the text and posts to the real sendMessage endpoint shape on success", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    // #when
    const result = await sendTelegramMessage("test-token", "12345", "NVDA halted (T1).", fetchFn);
    // #then
    expect(result).toEqual({ ok: true, httpStatus: 200 });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { chat_id: string; text: string; parse_mode: string };
    expect(body).toEqual({ chat_id: "12345", text: "NVDA halted \\(T1\\)\\.", parse_mode: "MarkdownV2" });
  });

  it("surfaces retry_after when #given a 429 response", async () => {
    // #given
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Too Many Requests", parameters: { retry_after: 7 } }), {
        status: 429,
      }),
    );
    // #when
    const result = await sendTelegramMessage("test-token", "12345", "hello", fetchFn);
    // #then
    expect(result.ok).toBe(false);
    expect(result.retryAfterSeconds).toBe(7);
  });

  it("reports failure when #given a non-2xx, non-429 response", async () => {
    // #given
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: false, description: "chat not found" }), { status: 400 }));
    // #when
    const result = await sendTelegramMessage("test-token", "12345", "hello", fetchFn);
    // #then
    expect(result.ok).toBe(false);
    expect(result.error).toBe("chat not found");
  });
});
