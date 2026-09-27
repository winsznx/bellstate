import { createPublicClient, http, parseAbi } from "viem";

const XLAYER_RPC = "https://rpc.xlayer.tech";

const client = createPublicClient({
  chain: { id: 196, name: "X Layer", nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 }, rpcUrls: { default: { http: [XLAYER_RPC] } } },
  transport: http(XLAYER_RPC),
});

// PRD §7.5: Chainlink L2 Sequencer Uptime feed
const SEQUENCER_FEED = "0x45c2b8C204568A03Dc7A2E32B71D67Fe97F908A9" as `0x${string}`;

const abi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

async function main() {
  const result = await client.readContract({ address: SEQUENCER_FEED, abi, functionName: "latestRoundData" });
  const [roundId, answer, startedAt, updatedAt, answeredInRound] = result;
  const pass = answer === 0n || answer === 1n;
  console.log(
    JSON.stringify(
      {
        address: SEQUENCER_FEED,
        roundId: roundId.toString(),
        answer: answer.toString(),
        startedAt: startedAt.toString(),
        updatedAt: updatedAt.toString(),
        answeredInRound: answeredInRound.toString(),
        pass,
      },
      null,
      2
    )
  );
  console.log(pass ? "\nGATE G17: PASS" : "\nGATE G17: FAIL");
  process.exit(pass ? 0 : 1);
}

main();
