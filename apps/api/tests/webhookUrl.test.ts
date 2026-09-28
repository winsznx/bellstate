import { describe, expect, it } from "vitest";
import { checkWebhookUrl } from "../src/webhookUrl.js";

function fakeResolver(ips: string[]) {
  return { lookup: async () => ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })) } as any;
}

describe("checkWebhookUrl — PRD §10.5's URL rules", () => {
  it("rejects non-https", async () => {
    const result = await checkWebhookUrl("http://example.com/hook");
    expect(result).toEqual({ ok: false, rejection: "NOT_HTTPS" });
  });

  it("rejects a non-443 port", async () => {
    const result = await checkWebhookUrl("https://example.com:8443/hook");
    expect(result.ok).toBe(false);
    expect(result.rejection).toBe("WRONG_PORT");
  });

  it("rejects an unparseable URL", async () => {
    const result = await checkWebhookUrl("not a url");
    expect(result).toEqual({ ok: false, rejection: "INVALID_URL" });
  });

  it("rejects a hostname resolving to an RFC 1918 address", async () => {
    const result = await checkWebhookUrl("https://internal.example.com/hook", fakeResolver(["10.0.5.1"]));
    expect(result.ok).toBe(false);
    expect(result.rejection).toBe("PRIVATE_IP");
  });

  it("rejects loopback", async () => {
    const result = await checkWebhookUrl("https://localhost.example.com/hook", fakeResolver(["127.0.0.1"]));
    expect(result.rejection).toBe("PRIVATE_IP");
  });

  it("rejects the cloud metadata IP (link-local range)", async () => {
    const result = await checkWebhookUrl("https://metadata.example.com/hook", fakeResolver(["169.254.169.254"]));
    expect(result.rejection).toBe("PRIVATE_IP");
  });

  it("rejects CGNAT addresses", async () => {
    const result = await checkWebhookUrl("https://cgnat.example.com/hook", fakeResolver(["100.64.1.1"]));
    expect(result.rejection).toBe("PRIVATE_IP");
  });

  it("rejects IPv6 loopback and unique-local", async () => {
    expect((await checkWebhookUrl("https://x.example.com/h", fakeResolver(["::1"]))).rejection).toBe("PRIVATE_IP");
    expect((await checkWebhookUrl("https://x.example.com/h", fakeResolver(["fd12:3456::1"]))).rejection).toBe(
      "PRIVATE_IP",
    );
  });

  it("rejects if ANY resolved IP is private, even when another is public", async () => {
    const result = await checkWebhookUrl("https://mixed.example.com/hook", fakeResolver(["8.8.8.8", "10.0.0.1"]));
    expect(result.rejection).toBe("PRIVATE_IP");
  });

  it("accepts a genuinely public IP on the default port (443 implied)", async () => {
    const result = await checkWebhookUrl("https://real.example.com/hook", fakeResolver(["8.8.8.8"]));
    expect(result.ok).toBe(true);
    expect(result.resolvedIps).toEqual(["8.8.8.8"]);
  });

  it("accepts an explicit :443", async () => {
    const result = await checkWebhookUrl("https://real.example.com:443/hook", fakeResolver(["1.1.1.1"]));
    expect(result.ok).toBe(true);
  });

  it("fails closed on a DNS resolution failure", async () => {
    const resolver = { lookup: async () => { throw new Error("ENOTFOUND"); } } as any;
    const result = await checkWebhookUrl("https://doesnotresolve.invalid/hook", resolver);
    expect(result).toEqual({ ok: false, rejection: "DNS_FAILED" });
  });
});
