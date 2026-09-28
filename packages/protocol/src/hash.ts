import { hashTypedData, type TypedDataDomain } from "viem";
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

export function digestFor<T extends Eip712TypeName>(
  primaryType: T,
  domain: TypedDataDomain,
  message: MessageByType[T],
): `0x${string}` {
  // viem's hashTypedData wants `primaryType` narrowed to a literal key of `types`; T is already
  // constrained to Eip712TypeName (keyof EIP712_TYPES), so this pass-through is sound but
  // unprovable to the structural checker without unknown-casting the whole params object.
  return hashTypedData(
    { domain, types: EIP712_TYPES, primaryType, message } as unknown as Parameters<typeof hashTypedData>[0],
  );
}
