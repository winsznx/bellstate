import type { HaltRecord } from "@winsznx/bellstate-engine";

export interface NyseHaltRow {
  symbol: string;
  issuerName: string;
  sourceExchange: string;
  reason: string;
  haltAt: number;
  resumeTradeAt: number | null;
}

export interface HaltRecordWithMeta extends HaltRecord {
  symbol: string;
  sourceExchange: string;
}

export interface NyseHaltFilterResponse {
  totalCount: number;
  results: Array<{
    formatedHaltDate: string;
    formatedHaltTime: string;
    symbol: string;
    issuerName: string;
    sourceExchange: string;
    reason: string;
    formatedResumptionDate: string | null;
    formatedResumptionTime: string | null;
  }>;
}
