import { createHmac } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createPublicClient, http, type Log } from "viem";
import deployment from "../../../deployments/xlayer-mainnet.json" with { type: "json" };
import { decodeHubLog } from "../src/decodeHubLog.js";

const hub = deployment.contracts.BellstateHub as `0x${string}`;
const client = createPublicClient({ transport: http(process.env.XLAYER_RPC_URL ?? "https://rpc.xlayer.tech", { timeout: 15_000, retryCount: 2 }) });
const output = new URL("../../../internal/hub-history-okx.json", import.meta.url).pathname;
const key = process.env.OKX_API_KEY;
const secret = process.env.OKX_API_SECRET;
const passphrase = process.env.OKX_API_PASSPHRASE;
const okxHost = "web3.okx.com";

interface TransactionSummary {
  txId: `0x${string}`;
  height: string;
  state: string;
  to: string;
}
interface Page {
  totalPage: string;
  transactionList: TransactionSummary[];
}
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

async function okxPage(page: number): Promise<Page> {
  if (!key || !secret || !passphrase) throw new Error("OKX API credentials are required");
  const path = `/api/v5/xlayer/address/normal-transaction-list?chainShortName=xlayer&address=${hub}&limit=50&page=${page}&isFromOrTo=to`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const timestamp = new Date().toISOString();
    const signature = createHmac("sha256", secret).update(timestamp + "GET" + path).digest("base64");
    const response = await fetch(`https://${okxHost}${path}`, {
      headers: {
        "OK-ACCESS-KEY": key,
        "OK-ACCESS-SIGN": signature,
        "OK-ACCESS-PASSPHRASE": passphrase,
        "OK-ACCESS-TIMESTAMP": timestamp,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json() as { code: string; msg: string; data?: Page[] };
    if (response.ok && body.code === "0" && body.data?.[0]) return body.data[0];
    if (attempt === 3) throw new Error(`OKX transaction page ${page}: HTTP ${response.status}, code ${body.code}, ${body.msg}`);
    await new Promise((done) => setTimeout(done, (attempt + 1) * 1200));
  }
  throw new Error("Unreachable retry state");
}

function storeLog(log: Log): StoredLog {
  if (log.blockHash === null || log.blockNumber === null || log.logIndex === null || log.transactionHash === null) {
    throw new Error("Unmined receipt log");
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
}

async function save(checkpoint: Checkpoint): Promise<void> {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${output}.tmp`, JSON.stringify(checkpoint));
  await rename(`${output}.tmp`, output);
}

async function main(): Promise<void> {
  const [chainId, firstReceipt, head, firstPage] = await Promise.all([
    client.getChainId(),
    client.getTransactionReceipt({ hash: deployment.firstAttestation.txHash as `0x${string}` }),
    client.getBlockNumber(),
    okxPage(1),
  ]);
  if (chainId !== deployment.chainId) throw new Error(`Wrong chain ${chainId}`);
  const finalized = head - 20n;
  const totalPages = Number(firstPage.totalPage);
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 1000) throw new Error("Unexpected OKX pagination");
  const transactions = [...firstPage.transactionList];
  for (let page = 2; page <= totalPages; page++) {
    transactions.push(...(await okxPage(page)).transactionList);
  }
  const candidates = [...new Map(transactions
    .filter((tx) => tx.to.toLowerCase() === hub.toLowerCase() && tx.state === "success" &&
      BigInt(tx.height) >= firstReceipt.blockNumber && BigInt(tx.height) <= finalized)
    .map((tx) => [tx.txId.toLowerCase(), tx])).values()];
  let checkpoint: Checkpoint;
  try {
    checkpoint = JSON.parse(await readFile(output, "utf8")) as Checkpoint;
    if (checkpoint.chainId !== chainId || checkpoint.hub.toLowerCase() !== hub.toLowerCase()) {
      throw new Error("Checkpoint belongs to another deployment");
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      checkpoint = { chainId, hub, processed: [], logs: [] };
    } else throw error;
  }
  const processed = new Set(checkpoint.processed.map((hash) => hash.toLowerCase()));
  const pending = candidates.filter((tx) => !processed.has(tx.txId.toLowerCase()));
  for (let start = 0; start < pending.length; start += 12) {
    const batch = pending.slice(start, start + 12);
    const receipts = await Promise.all(batch.map(async (tx) => {
      for (let attempt = 0; attempt < 4; attempt++) {
        try { return await client.getTransactionReceipt({ hash: tx.txId }); }
        catch (error) {
          if (attempt === 3) throw error;
          await new Promise((done) => setTimeout(done, (attempt + 1) * 1000));
        }
      }
      throw new Error("Unreachable retry state");
    }));
    for (let index = 0; index < batch.length; index++) {
      const tx = batch[index]!;
      const receipt = receipts[index]!;
      if (receipt.blockNumber !== BigInt(tx.height) || receipt.status !== "success") throw new Error(`Explorer/RPC mismatch for ${tx.txId}`);
      checkpoint.logs.push(...receipt.logs.filter((log) => log.address.toLowerCase() === hub.toLowerCase()).map(storeLog));
      checkpoint.processed.push(tx.txId);
      processed.add(tx.txId.toLowerCase());
    }
    await save(checkpoint);
    if ((start + batch.length) % 120 < 12) process.stdout.write(`Verified ${checkpoint.processed.length}/${candidates.length} hub transactions\n`);
  }
  const decoded = checkpoint.logs.reduce<Record<string, number>>((counts, log) => {
    const event = decodeHubLog({ ...log, blockNumber: BigInt(log.blockNumber) } as Log);
    if (event) counts[event.eventName] = (counts[event.eventName] ?? 0) + 1;
    return counts;
  }, {});
  process.stdout.write(JSON.stringify({ output, totalPages, candidates: candidates.length, processed: checkpoint.processed.length, hubLogs: checkpoint.logs.length, decoded }) + "\n");
}

await main();
