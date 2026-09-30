import { digestFor, type Eip712TypeName } from "@winsznx/bellstate-protocol";
import type {
  HeartbeatMessage,
  MarketUpdateMessage,
  PrimaryUpdateMessage,
  ProgramUpdateMessage,
  ValuationUpdateMessage,
} from "@winsznx/bellstate-protocol";
import type { TypedDataDomain } from "viem";

/** PRD §6.5: the POST /v1/attestations body's "kind" is one of the EIP-712 primaryType names. */
export type AttestationKind = Eip712TypeName;

export const ATTESTATION_KINDS: readonly AttestationKind[] = [
  "MarketUpdate",
  "ProgramUpdate",
  "PrimaryUpdate",
  "ValuationUpdate",
  "Heartbeat",
];

/** Wire (JSON-transport) shapes: identical to the protocol package's typed messages except every
 * bigint field travels as a decimal string, since JSON has no bigint. */
export interface MarketUpdateWire {
  listingId: string;
  seq: number;
  epoch: string;
  session: number;
  interruption: number;
  reasonCategory: number;
  reasonCode: string;
  sessionSince: string;
  interruptionSince: string;
  nextScheduledTransition: string;
  expectedResumption: string;
  calendarVersion: number;
}

export interface ProgramUpdateWire {
  programId: string;
  seq: number;
  epoch: string;
  lifecycle: number;
  programStatus: number;
  programReason: number;
}

export interface PrimaryUpdateWire {
  programId: string;
  seq: number;
  epoch: string;
  issuance: number;
  redemption: number;
  nextScheduledChange: string;
  nextCutoff: string;
  primaryReason: number;
}

export interface ValuationUpdateWire {
  programId: string;
  seq: number;
  epoch: string;
  condition: number;
  conditionSince: string;
  valueAsOf: string;
  nextExpectedUpdate: string;
  sourceMarketStatus: number;
}

export interface HeartbeatWire {
  domain: number;
  version: string;
  epoch: string;
  calendarVersion: number;
}

export type AttestationBody =
  | { kind: "MarketUpdate"; message: MarketUpdateWire; signature: `0x${string}` }
  | { kind: "ProgramUpdate"; message: ProgramUpdateWire; signature: `0x${string}` }
  | { kind: "PrimaryUpdate"; message: PrimaryUpdateWire; signature: `0x${string}` }
  | { kind: "ValuationUpdate"; message: ValuationUpdateWire; signature: `0x${string}` }
  | { kind: "Heartbeat"; message: HeartbeatWire; signature: `0x${string}` };

/** The wire-message half of `AttestationBody`, for call sites that store or forward a message
 * without needing to narrow on `kind` first (Durable Object ingest params, Supabase records). */
export type WireMessage = AttestationBody["message"];

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBytes(value: unknown, byteLength: number): value is string {
  if (typeof value !== "string") return false;
  const re = new RegExp(`^0x[0-9a-fA-F]{${byteLength * 2}}$`);
  return re.test(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isUint(value: unknown, maxExclusive: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < maxExclusive;
}

export function parseMarketUpdateWire(raw: unknown): MarketUpdateWire | null {
  if (!isRecord(raw)) return null;
  if (!isBytes(raw.listingId, 32)) return null;
  if (!isUint(raw.seq, 2 ** 32)) return null;
  if (!isDecimalString(raw.epoch)) return null;
  if (!isUint(raw.session, 256)) return null;
  if (!isUint(raw.interruption, 256)) return null;
  if (!isUint(raw.reasonCategory, 256)) return null;
  if (!isBytes(raw.reasonCode, 8)) return null;
  if (!isDecimalString(raw.sessionSince)) return null;
  if (!isDecimalString(raw.interruptionSince)) return null;
  if (!isDecimalString(raw.nextScheduledTransition)) return null;
  if (!isDecimalString(raw.expectedResumption)) return null;
  if (!isUint(raw.calendarVersion, 2 ** 32)) return null;
  return {
    listingId: raw.listingId,
    seq: raw.seq,
    epoch: raw.epoch,
    session: raw.session,
    interruption: raw.interruption,
    reasonCategory: raw.reasonCategory,
    reasonCode: raw.reasonCode,
    sessionSince: raw.sessionSince,
    interruptionSince: raw.interruptionSince,
    nextScheduledTransition: raw.nextScheduledTransition,
    expectedResumption: raw.expectedResumption,
    calendarVersion: raw.calendarVersion,
  };
}

export function parseProgramUpdateWire(raw: unknown): ProgramUpdateWire | null {
  if (!isRecord(raw)) return null;
  if (!isBytes(raw.programId, 32)) return null;
  if (!isUint(raw.seq, 2 ** 32)) return null;
  if (!isDecimalString(raw.epoch)) return null;
  if (!isUint(raw.lifecycle, 256)) return null;
  if (!isUint(raw.programStatus, 256)) return null;
  if (!isUint(raw.programReason, 256)) return null;
  return {
    programId: raw.programId,
    seq: raw.seq,
    epoch: raw.epoch,
    lifecycle: raw.lifecycle,
    programStatus: raw.programStatus,
    programReason: raw.programReason,
  };
}

export function parsePrimaryUpdateWire(raw: unknown): PrimaryUpdateWire | null {
  if (!isRecord(raw)) return null;
  if (!isBytes(raw.programId, 32)) return null;
  if (!isUint(raw.seq, 2 ** 32)) return null;
  if (!isDecimalString(raw.epoch)) return null;
  if (!isUint(raw.issuance, 256)) return null;
  if (!isUint(raw.redemption, 256)) return null;
  if (!isDecimalString(raw.nextScheduledChange)) return null;
  if (!isDecimalString(raw.nextCutoff)) return null;
  if (!isUint(raw.primaryReason, 256)) return null;
  return {
    programId: raw.programId,
    seq: raw.seq,
    epoch: raw.epoch,
    issuance: raw.issuance,
    redemption: raw.redemption,
    nextScheduledChange: raw.nextScheduledChange,
    nextCutoff: raw.nextCutoff,
    primaryReason: raw.primaryReason,
  };
}

export function parseValuationUpdateWire(raw: unknown): ValuationUpdateWire | null {
  if (!isRecord(raw)) return null;
  if (!isBytes(raw.programId, 32)) return null;
  if (!isUint(raw.seq, 2 ** 32)) return null;
  if (!isDecimalString(raw.epoch)) return null;
  if (!isUint(raw.condition, 256)) return null;
  if (!isDecimalString(raw.conditionSince)) return null;
  if (!isDecimalString(raw.valueAsOf)) return null;
  if (!isDecimalString(raw.nextExpectedUpdate)) return null;
  if (!isUint(raw.sourceMarketStatus, 256)) return null;
  return {
    programId: raw.programId,
    seq: raw.seq,
    epoch: raw.epoch,
    condition: raw.condition,
    conditionSince: raw.conditionSince,
    valueAsOf: raw.valueAsOf,
    nextExpectedUpdate: raw.nextExpectedUpdate,
    sourceMarketStatus: raw.sourceMarketStatus,
  };
}

export function parseHeartbeatWire(raw: unknown): HeartbeatWire | null {
  if (!isRecord(raw)) return null;
  if (!isUint(raw.domain, 256)) return null;
  if (!isDecimalString(raw.version)) return null;
  if (!isDecimalString(raw.epoch)) return null;
  if (!isUint(raw.calendarVersion, 2 ** 32)) return null;
  return { domain: raw.domain, version: raw.version, epoch: raw.epoch, calendarVersion: raw.calendarVersion };
}

/** Re-validates a kind+message pair. Used both for the untrusted POST body and, defensively, when
 * a stored row is read back out of Durable Object SQLite at batch time. */
export function parseMessageForKind(kind: AttestationKind, raw: unknown): AttestationBody["message"] | null {
  switch (kind) {
    case "MarketUpdate":
      return parseMarketUpdateWire(raw);
    case "ProgramUpdate":
      return parseProgramUpdateWire(raw);
    case "PrimaryUpdate":
      return parsePrimaryUpdateWire(raw);
    case "ValuationUpdate":
      return parseValuationUpdateWire(raw);
    case "Heartbeat":
      return parseHeartbeatWire(raw);
  }
}

export function parseAttestationBody(raw: unknown): ParseResult<AttestationBody> {
  if (!isRecord(raw)) return { ok: false, error: "body must be a JSON object" };
  const { kind, message, signature } = raw;
  if (typeof kind !== "string" || !ATTESTATION_KINDS.includes(kind as AttestationKind)) {
    return { ok: false, error: `kind must be one of ${ATTESTATION_KINDS.join(", ")}` };
  }
  if (!isBytes(signature, 65)) {
    return { ok: false, error: "signature must be a 65-byte hex string" };
  }
  const parsedMessage = parseMessageForKind(kind as AttestationKind, message);
  if (parsedMessage === null) {
    return { ok: false, error: `message does not match the ${kind} shape` };
  }
  // Safe: `kind` gates `parsedMessage`'s shape via parseMessageForKind's exhaustive switch above,
  // so this pairing always matches one arm of the AttestationBody union.
  return { ok: true, value: { kind, message: parsedMessage, signature } as AttestationBody };
}

export function messageSubject(body: AttestationBody): string {
  switch (body.kind) {
    case "MarketUpdate":
      return body.message.listingId.toLowerCase();
    case "ProgramUpdate":
    case "PrimaryUpdate":
    case "ValuationUpdate":
      return body.message.programId.toLowerCase();
    case "Heartbeat":
      return String(body.message.domain);
  }
}

/** PRD's `attestations.subject_id` column is `hex32`; Heartbeat has no natural bytes32 subject,
 * so its domain id (1-6) is left-padded into a bytes32 slot for that column only. */
export function subjectHex32(body: AttestationBody): `0x${string}` {
  if (body.kind === "Heartbeat") {
    return `0x${body.message.domain.toString(16).padStart(64, "0")}` as `0x${string}`;
  }
  return messageSubject(body) as `0x${string}`;
}

export function messageSeq(body: AttestationBody): number | null {
  return body.kind === "Heartbeat" ? null : body.message.seq;
}

export function messageEpoch(body: AttestationBody): bigint {
  return BigInt(body.message.epoch);
}

export function toMarketUpdateMessage(w: MarketUpdateWire): MarketUpdateMessage {
  return {
    listingId: w.listingId as `0x${string}`,
    seq: w.seq,
    epoch: BigInt(w.epoch),
    session: w.session,
    interruption: w.interruption,
    reasonCategory: w.reasonCategory,
    reasonCode: w.reasonCode as `0x${string}`,
    sessionSince: BigInt(w.sessionSince),
    interruptionSince: BigInt(w.interruptionSince),
    nextScheduledTransition: BigInt(w.nextScheduledTransition),
    expectedResumption: BigInt(w.expectedResumption),
    calendarVersion: w.calendarVersion,
  };
}

export function toProgramUpdateMessage(w: ProgramUpdateWire): ProgramUpdateMessage {
  return {
    programId: w.programId as `0x${string}`,
    seq: w.seq,
    epoch: BigInt(w.epoch),
    lifecycle: w.lifecycle,
    programStatus: w.programStatus,
    programReason: w.programReason,
  };
}

export function toPrimaryUpdateMessage(w: PrimaryUpdateWire): PrimaryUpdateMessage {
  return {
    programId: w.programId as `0x${string}`,
    seq: w.seq,
    epoch: BigInt(w.epoch),
    issuance: w.issuance,
    redemption: w.redemption,
    nextScheduledChange: BigInt(w.nextScheduledChange),
    nextCutoff: BigInt(w.nextCutoff),
    primaryReason: w.primaryReason,
  };
}

export function toValuationUpdateMessage(w: ValuationUpdateWire): ValuationUpdateMessage {
  return {
    programId: w.programId as `0x${string}`,
    seq: w.seq,
    epoch: BigInt(w.epoch),
    condition: w.condition,
    conditionSince: BigInt(w.conditionSince),
    valueAsOf: BigInt(w.valueAsOf),
    nextExpectedUpdate: BigInt(w.nextExpectedUpdate),
    sourceMarketStatus: w.sourceMarketStatus,
  };
}

export function toHeartbeatMessage(w: HeartbeatWire): HeartbeatMessage {
  return { domain: w.domain, version: BigInt(w.version), epoch: BigInt(w.epoch), calendarVersion: w.calendarVersion };
}

export function digestForBody(domain: TypedDataDomain, body: AttestationBody): `0x${string}` {
  switch (body.kind) {
    case "MarketUpdate":
      return digestFor("MarketUpdate", domain, toMarketUpdateMessage(body.message));
    case "ProgramUpdate":
      return digestFor("ProgramUpdate", domain, toProgramUpdateMessage(body.message));
    case "PrimaryUpdate":
      return digestFor("PrimaryUpdate", domain, toPrimaryUpdateMessage(body.message));
    case "ValuationUpdate":
      return digestFor("ValuationUpdate", domain, toValuationUpdateMessage(body.message));
    case "Heartbeat":
      return digestFor("Heartbeat", domain, toHeartbeatMessage(body.message));
  }
}

/** Supabase's `attestations.kind` check constraint uses lowercase singular words, distinct from
 * the EIP-712 primaryType names used everywhere else. */
export function dbKindOf(kind: AttestationKind): "market" | "program" | "primary" | "valuation" | "heartbeat" {
  switch (kind) {
    case "MarketUpdate":
      return "market";
    case "ProgramUpdate":
      return "program";
    case "PrimaryUpdate":
      return "primary";
    case "ValuationUpdate":
      return "valuation";
    case "Heartbeat":
      return "heartbeat";
  }
}
