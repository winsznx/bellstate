import type { AttestationStore } from "./attestationStore.js";

/** Bindings and secrets declared in wrangler.jsonc / set via `wrangler secret put`. */
export interface Env {
  ATTESTATION_STORE: DurableObjectNamespace<AttestationStore>;
  SUBMITTER_PRIVATE_KEY: string;
  XLAYER_RPC_URLS: string;
  HUB_ADDRESS: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}
