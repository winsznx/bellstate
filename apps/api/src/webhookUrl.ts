import dns from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";

export type WebhookUrlRejection =
  | "NOT_HTTPS"
  | "WRONG_PORT"
  | "PRIVATE_IP"
  | "DNS_FAILED"
  | "INVALID_URL";

export interface WebhookUrlCheck {
  ok: boolean;
  rejection?: WebhookUrlRejection;
  resolvedIps?: string[];
}

/** PRD §10.5's private/reserved IPv4 ranges: RFC 1918, loopback, link-local (incl. the cloud
 * metadata IP), CGNAT. */
const PRIVATE_IPV4_RANGES: [string, number][] = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["100.64.0.0", 10],
  ["0.0.0.0", 8],
];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  return PRIVATE_IPV4_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (ipInt & mask) === (baseInt & mask);
  });
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
  if (lower.startsWith("::ffff:")) {
    // IPv4-mapped IPv6 — check the embedded v4 address too.
    const v4 = lower.slice("::ffff:".length);
    if (isIPv4(v4)) return isPrivateIpv4(v4);
  }
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (isIPv4(ip)) return isPrivateIpv4(ip);
  if (isIPv6(ip)) return isPrivateIpv6(ip);
  return true; // unrecognized — fail closed
}

/**
 * PRD §10.5: "https only, port 443. The hostname must resolve to public IPs. Reject RFC 1918,
 * loopback, link-local, CGNAT and metadata IPs, re-checked at every delivery. No redirects
 * followed." This checks the static URL rules and DNS resolution; "no redirects followed" is
 * the HTTP client's job at actual delivery time (fetch with redirect: "manual"), not this
 * function's.
 */
export async function checkWebhookUrl(rawUrl: string, resolver: typeof dns = dns): Promise<WebhookUrlCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, rejection: "INVALID_URL" };
  }

  if (url.protocol !== "https:") return { ok: false, rejection: "NOT_HTTPS" };
  if (url.port && url.port !== "443") return { ok: false, rejection: "WRONG_PORT" };

  let addresses: { address: string }[];
  try {
    addresses = await resolver.lookup(url.hostname, { all: true });
  } catch {
    return { ok: false, rejection: "DNS_FAILED" };
  }

  const resolvedIps = addresses.map((a) => a.address);
  if (resolvedIps.length === 0 || resolvedIps.some(isPrivateIp)) {
    return { ok: false, rejection: "PRIVATE_IP", resolvedIps };
  }

  return { ok: true, resolvedIps };
}
