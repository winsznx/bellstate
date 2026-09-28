import type { ProgramSnapshot, ProgramState, UnixSeconds } from "./types.js";

const CATALOG_MAX_AGE_SECONDS = 24 * 60 * 60;

/** PRD §3.4. */
export function deriveProgram(_programId: `0x${string}`, _t: UnixSeconds, snapshot: ProgramSnapshot): ProgramState {
  const { override, catalog, bothTokensHaveCode, registeredInHub, pause } = snapshot;

  let lifecycle: ProgramState["lifecycle"];
  if (override) {
    lifecycle = override.lifecycle;
  } else {
    const catalogFresh = catalog.ageSeconds <= CATALOG_MAX_AGE_SECONDS;
    const active = catalogFresh && catalog.hasXLayerDeployment && bothTokensHaveCode && registeredInHub;
    lifecycle = active ? "ACTIVE" : "UNKNOWN";
  }

  let programStatus: ProgramState["programStatus"];
  let programReason: ProgramState["programReason"];
  if (pause.rawPaused === null || pause.wrappedPaused === null) {
    programStatus = "UNKNOWN";
    programReason = "TOKEN_READ_FAILED";
  } else if (pause.rawPaused || pause.wrappedPaused) {
    programStatus = "SUSPENDED";
    programReason = "ISSUER_PAUSED";
  } else {
    programStatus = "NORMAL";
    programReason = "NONE";
  }

  return {
    lifecycle,
    lifecycleOverride: override,
    programStatus,
    programReason,
  };
}
