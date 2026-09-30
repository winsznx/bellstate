import { createHmac, createHash } from "node:crypto";

// Source: GET https://api.dataengine.chain.link/api/v1/discovery?base_asset=NVDA (public, no
// auth), queried live 2026-09-30. Three regular/extended/overnight NVDA/USD equity feeds exist,
// all status "live", schema V11. We use the regular-hours feed for the valuation facet since
// that's what PRD's "NVDAx v10 feed" reference maps to (v10 schema superseded by V11 upstream).
const NVDA_REGULAR_FEED_ID = "0x000b6aa036224454037bab103184565f6aa9ea589c3b349f6d8471ee753524b9";

const API_BASE = "https://api.dataengine.chain.link";
const API_KEY = process.env.CHAINLINK_DS_API_KEY;
const API_SECRET = process.env.CHAINLINK_DS_API_SECRET;

// Docs: docs.chain.link/data-streams/reference/data-streams-api/authentication. String to sign
// is "METHOD FULL_PATH BODY_HASH API_KEY TIMESTAMP" joined with single spaces, HMAC-SHA256'd
// with the secret, hex-encoded. FULL_PATH includes the query string.
function signRequest(method: string, path: string, apiKey: string, secret: string, timestamp: number) {
  const bodyHash = createHash("sha256").update("").digest("hex");
  const toSign = `${method} ${path} ${bodyHash} ${apiKey} ${timestamp}`;
  const signature = createHmac("sha256", secret).update(toSign).digest("hex");
  return signature;
}

async function main() {
  if (!API_KEY || !API_SECRET) {
    console.error("Missing CHAINLINK_DS_API_KEY / CHAINLINK_DS_API_SECRET in env.");
    process.exit(1);
  }

  const path = `/api/v1/reports/latest?feedID=${NVDA_REGULAR_FEED_ID}`;
  const timestamp = Date.now();
  const signature = signRequest("GET", path, API_KEY, API_SECRET, timestamp);

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: API_KEY,
      "X-Authorization-Timestamp": String(timestamp),
      "X-Authorization-Signature-SHA256": signature,
    },
  });

  const body = await res.text();
  console.log(`HTTP ${res.status}`);
  console.log(body);

  const pass = res.status === 200;
  console.log(pass ? "\nGATE G1: PASS" : "\nGATE G1: FAIL");
  process.exit(pass ? 0 : 1);
}

main();
