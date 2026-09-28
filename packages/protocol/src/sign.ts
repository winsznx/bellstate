import type { LocalAccount, TypedDataDomain } from "viem";
import { EIP712_TYPES, type Eip712TypeName } from "./eip712Types.js";
import type {
  HeartbeatMessage,
  MarketUpdateMessage,
  PrimaryUpdateMessage,
  ProgramUpdateMessage,
  ValuationUpdateMessage,
} from "./messages.js";

interface MessageByType {
  MarketUpdate: MarketUpdateMessage;
  ProgramUpdate: ProgramUpdateMessage;
  PrimaryUpdate: PrimaryUpdateMessage;
  ValuationUpdate: ValuationUpdateMessage;
  Heartbeat: HeartbeatMessage;
}

/** PRD §6.1: keys live only as Worker secrets, so `account` should come from a per-signer secret
 * (e.g. viem's `privateKeyToAccount`), never a value persisted anywhere. */
export async function signMessage<T extends Eip712TypeName>(
  account: LocalAccount,
  primaryType: T,
  domain: TypedDataDomain,
  message: MessageByType[T],
): Promise<`0x${string}`> {
  // See hash.ts for why the params object is unknown-cast rather than the message alone.
  return account.signTypedData(
    { domain, types: EIP712_TYPES, primaryType, message } as unknown as Parameters<
      typeof account.signTypedData
    >[0],
  );
}
