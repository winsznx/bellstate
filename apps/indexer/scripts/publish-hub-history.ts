import { readFile } from "node:fs/promises";
import { createPublicClient, http, type Log } from "viem";
import deployment from "../../../deployments/xlayer-mainnet.json" with { type: "json" };
import { decodeHubLog } from "../src/decodeHubLog.js";
import { toStatusCurrentRow, toStatusHistoryRow } from "../src/rows.js";

const apply = process.argv.includes("--apply");
const input = new URL("../../../internal/hub-history-okx.json", import.meta.url);
const hub = deployment.contracts.BellstateHub as `0x${string}`;
const listingId = deployment.assets.NVDAx.listingId;
const client = createPublicClient({ transport: http(process.env.XLAYER_RPC_URL ?? "https://rpc.xlayer.tech", { timeout: 15_000, retryCount: 2 }) });
const abi = (JSON.parse(await readFile(new URL("../../../packages/contracts/out/BellstateHub.sol/BellstateHub.json", import.meta.url), "utf8")) as { abi: readonly unknown[] }).abi;

interface StoredLog {
  address: `0x${string}`;
  blockHash: `0x${string}`;
  blockNumber: string;
  data: `0x${string}`;
  logIndex: number;
  topics: readonly `0x${string}`[];
  transactionHash: `0x${string}`;
}
interface Checkpoint {
  chainId: number;
  hub: string;
  processed: string[];
  logs: StoredLog[];
}

function jsonRecord(record: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record, (_, value: unknown) => typeof value === "bigint" ? Number(value) : value)) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const checkpoint = JSON.parse(await readFile(input, "utf8")) as Checkpoint;
  if (checkpoint.chainId !== deployment.chainId || checkpoint.hub.toLowerCase() !== hub.toLowerCase() || checkpoint.processed.length < 200) {
    throw new Error("The recovered hub checkpoint is incomplete or belongs to another deployment");
  }
  const events = checkpoint.logs.flatMap((stored) => {
    const log = { ...stored, blockNumber: BigInt(stored.blockNumber) } as Log;
    const decoded = decodeHubLog(log);
    return decoded?.facet === "market" && decoded.args.listingId.toLowerCase() === listingId.toLowerCase()
      ? [{ log, decoded }]
      : [];
  }).sort((a, b) => a.decoded.args.seq - b.decoded.args.seq);
  if (events.length === 0 || events.some((entry, index) => entry.decoded.args.seq !== index + 1)) {
    throw new Error("Market history is not a contiguous sequence from one");
  }
  const [chainId, view, digest] = await Promise.all([
    client.getChainId(),
    client.readContract({ address: hub, abi, functionName: "marketView", args: [listingId] }),
    client.readContract({ address: hub, abi, functionName: "recordDigest", args: [1, listingId] }),
  ]);
  const current = view as { seq: number; writtenAt: bigint; effectiveAsOf: bigint };
  if (chainId !== deployment.chainId || current.seq !== events.length) {
    throw new Error(`Chain has seq ${current.seq}; recovered history has ${events.length}. Rescan before publishing.`);
  }
  const latest = events.at(-1)!;
  const latestRow = toStatusCurrentRow(latest.decoded, latest.log);
  const currentRow = {
    ...latestRow,
    subject_id: latestRow.subject_id.toLowerCase(),
    record: jsonRecord(latestRow.record),
    written_at: new Date(Number(current.writtenAt) * 1000).toISOString(),
    effective_as_of: new Date(Number(current.effectiveAsOf) * 1000).toISOString(),
    digest,
  };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase URL and service role key are required");
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const [historyResponse, currentResponse] = await Promise.all([
    fetch(`${base}/rest/v1/status_history?select=tx_hash,log_index&subject_id=eq.${listingId.toLowerCase()}&limit=1000`, { headers }),
    fetch(`${base}/rest/v1/status_current?select=seq&facet=eq.market&subject_id=eq.${listingId.toLowerCase()}`, { headers }),
  ]);
  if (!historyResponse.ok || !currentResponse.ok) throw new Error("Could not check existing status rows");
  const existing = await historyResponse.json() as { tx_hash: string | null; log_index: number | null }[];
  const existingCurrent = await currentResponse.json() as { seq: number }[];
  if (existingCurrent.some((row) => row.seq > current.seq)) throw new Error("Database status is ahead of recovered history");
  const keys = new Set(existing.map((row) => `${row.tx_hash?.toLowerCase()}:${row.log_index}`));
  const missing = events.filter(({ log }) => !keys.has(`${log.transactionHash?.toLowerCase()}:${log.logIndex}`));
  process.stdout.write(JSON.stringify({ mode: apply ? "apply" : "dry-run", recovered: events.length, existing: existing.length, missing: missing.length, latestSeq: current.seq, currentDatabaseSeq: existingCurrent[0]?.seq ?? null, latestTx: latest.log.transactionHash }) + "\n");
  if (!apply) return;
  const blockTimes = new Map<string, string>();
  const blockNumbers = [...new Set(missing.map(({ log }) => String(log.blockNumber)))];
  for (let start = 0; start < blockNumbers.length; start += 8) {
    const batch = blockNumbers.slice(start, start + 8);
    const blocks = await Promise.all(batch.map((number) => client.getBlock({ blockNumber: BigInt(number) })));
    blocks.forEach((block, index) => blockTimes.set(batch[index]!, new Date(Number(block.timestamp) * 1000).toISOString()));
  }
  const rows = missing.map(({ decoded, log }) => {
    const row = toStatusHistoryRow(decoded, log);
    return {
      ...row,
      subject_id: row.subject_id.toLowerCase(),
      record: jsonRecord(row.record),
      block_number: Number(row.block_number),
      t_included: blockTimes.get(String(log.blockNumber)),
    };
  });
  if (rows.length) {
    const written = await fetch(`${base}/rest/v1/status_history`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!written.ok) throw new Error(`History insert HTTP ${written.status}: ${await written.text()}`);
  }
  const upsert = await fetch(`${base}/rest/v1/status_current?on_conflict=facet,subject_id`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(currentRow),
  });
  if (!upsert.ok) throw new Error(`Current upsert HTTP ${upsert.status}: ${await upsert.text()}`);
  process.stdout.write(`Published ${rows.length} history rows and current seq ${current.seq}\n`);
}

await main();
