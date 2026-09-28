export interface ReplaySummary {
  slug: string;
  title: string;
  date: string;
  venues: string[];
  summary: string;
  keyFigure: string;
  published: boolean;
}

/** PRD §11.5 S08/S09. Replays need a real incident data pipeline (scripts/replays, per §14
 * doesn't exist yet) — this is a fixture standing in for the published-replays table. */
export const REPLAYS: ReplaySummary[] = [
  {
    slug: "jul-28-skhynix",
    title: "SK hynix: NXTE trades while KRX is still closed",
    date: "2026-07-28",
    venues: ["XKRX", "NXTE"],
    summary: "NXTE opened pre-market while KRX had not yet begun its opening call, producing a real primary/secondary session divergence.",
    keyFigure: "08:00:02 KST",
    published: true,
  },
  {
    slug: "aug-6-skhynix",
    title: "SK hynix: a second Nextrade pre-market print",
    date: "2026-08-06",
    venues: ["XKRX", "NXTE"],
    summary: "A second real print during the same divergence window, used as the Print Check console's second preset.",
    keyFigure: "₩1,168,000",
    published: true,
  },
];

export function getReplay(slug: string): ReplaySummary | null {
  const replay = REPLAYS.find((r) => r.slug === slug);
  return replay && replay.published ? replay : null;
}
