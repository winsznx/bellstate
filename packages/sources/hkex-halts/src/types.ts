export interface HkexAnnouncement {
  releaseAt: number;
  stockCodes: string[];
  stockShortName: string;
  documentTitle: string;
  classification: "HALT" | "RESUME" | "OTHER";
}
