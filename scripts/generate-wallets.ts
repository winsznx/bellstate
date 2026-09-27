import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { mkdirSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROLES = [
  "deployer",
  "operator",
  "submitter",
  "signer-a",
  "signer-b",
  "signer-c",
  "safe-owner-1",
  "safe-owner-2",
  "safe-owner-3",
  "e2e",
] as const;

const outPath = resolve(import.meta.dirname, "..", "internal", "secrets", "wallets.env");

if (existsSync(outPath)) {
  console.error(`refusing to overwrite existing ${outPath}`);
  process.exit(1);
}

const lines: string[] = [];
const addresses: Record<string, string> = {};

for (const role of ROLES) {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  const envKey = role.toUpperCase().replace(/-/g, "_");
  lines.push(`${envKey}_PRIVATE_KEY=${key}`);
  lines.push(`${envKey}_ADDRESS=${account.address}`);
  addresses[role] = account.address;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join("\n") + "\n", { mode: 0o600 });
chmodSync(outPath, 0o600);

console.log("Wallets generated. Addresses only (keys stay in wallets.env, chmod 600):\n");
for (const [role, address] of Object.entries(addresses)) {
  console.log(`${role.padEnd(14)} ${address}`);
}
