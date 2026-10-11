import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPublicClient, http, type Log } from "viem";
import deployment from "../../../deployments/xlayer-mainnet.json" with { type: "json" };
import { decodeHubLog } from "../src/decodeHubLog.js";
import { toStatusHistoryRow } from "../src/rows.js";

const rpc = process.env.XLAYER_RPC_URL ?? "https://rpc.xlayer.tech";
const client = createPublicClient({ transport: http(rpc, { timeout: 15_000, retryCount: 2 }) });
const output = process.env.BELLSTATE_SCAN_FILE
  ? resolve(process.env.BELLSTATE_SCAN_FILE)
  : new URL("../../../internal/hub-history-scan.json", import.meta.url).pathname;
const firstTransaction = deployment.firstAttestation.txHash as `0x${string}`;
const hub = deployment.contracts.BellstateHub as `0x${string}`;
const BLOCKS_PER_QUERY = 100n;
// Both public X Layer RPCs cap eth_getLogs at 100 blocks and can rate-limit bursts.
const CONCURRENCY = 8;

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
  firstBlock: string;
  nextBlock: string;
  logs: StoredLog[];
}

const serializeLog = (log: Log): StoredLog => {
  if (log.blockHash === null || log.blockNumber === null || log.logIndex === null || log.transactionHash === null) {
    throw new Error("Unmined log in finalized range");
  }
  return {
    address: log.address,
    blockHash: log.blockHash,
    blockNumber: String(log.blockNumber),
    data: log.data,
    logIndex: log.logIndex,
    topics: log.topics,
    transactionHash: log.transactionHash,
  };
};

async function save(checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  await writeFile(temporary, JSON.stringify(checkpoint));
  await rename(temporary, output);
}

async function main(): Promise<void> {
  const [chainId, receipt, head] = await Promise.all([
    client.getChainId(),
    client.getTransactionReceipt({ hash: firstTransaction }),
    client.getBlockNumber(),
  ]);
  if (chainId !== deployment.chainId) throw new Error(`Wrong chain: ${chainId}`);
  const firstBlock = receipt.blockNumber;
  const finalizedHead = head - 20n;
  const end = process.env.BELLSTATE_SCAN_TO ? BigInt(process.env.BELLSTATE_SCAN_TO) : finalizedHead;
  if (end > finalizedHead) throw new Error("Scan end is not finalized");
  let checkpoint: Checkpoint;
  try {
    checkpoint = JSON.parse(await readFile(output, "utf8")) as Checkpoint;
    if (checkpoint.chainId !== chainId || checkpoint.hub.toLowerCase() !== hub.toLowerCase() || checkpoint.firstBlock !== String(firstBlock)) {
      throw new Error("Checkpoint belongs to another deployment");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      checkpoint = { chainId, hub, firstBlock: String(firstBlock), nextBlock: String(firstBlock), logs: [] };
    } else throw error;
  }

  while (BigInt(checkpoint.nextBlock) <= end) {
    const ranges: { from: bigint; to: bigint }[] = [];
    for (let n = 0; n < CONCURRENCY && BigInt(checkpoint.nextBlock) + BigInt(n) * BLOCKS_PER_QUERY <= end; n++) {
      const from = BigInt(checkpoint.nextBlock) + BigInt(n) * BLOCKS_PER_QUERY;
      ranges.push({ from, to: from + BLOCKS_PER_QUERY - 1n < end ? from + BLOCKS_PER_QUERY - 1n : end });
    }
    const pages = await Promise.all(ranges.map(async ({ from, to }) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try { return await client.getLogs({ address: hub, fromBlock: from, toBlock: to }); }
        catch (error) {
          if (attempt === 3) throw error;
          await new Promise((done) => setTimeout(done, (attempt + 1) * 1000));
        }
      }
      throw new Error("Unreachable retry state");
    }));
    checkpoint.logs.push(...pages.flat().map(serializeLog));
    checkpoint.nextBlock = String(ranges.at(-1)!.to + 1n);
    await save(checkpoint);
    if (BigInt(checkpoint.nextBlock) % 100_000n < BigInt(CONCURRENCY) * BLOCKS_PER_QUERY) {
      process.stdout.write(`Scanned through block ${checkpoint.nextBlock}; ${checkpoint.logs.length} hub logs\n`);
    }
  }
  const status = checkpoint.logs.flatMap((stored) => {
    const log = { ...stored, blockNumber: BigInt(stored.blockNumber) } as Log;
    const decoded = decodeHubLog(log);
    return decoded && decoded.facet ? [toStatusHistoryRow(decoded, log)] : [];
  });
  const facets = status.reduce<Record<string, number>>((result, row) => {
    result[row.facet] = (result[row.facet] ?? 0) + 1;
    return result;
  }, {});
  process.stdout.write(JSON.stringify({ output, firstBlock: String(firstBlock), throughBlock: String(BigInt(checkpoint.nextBlock) - 1n), hubLogs: checkpoint.logs.length, statusEvents: status.length, facets }) + "\n");
}

await main();
