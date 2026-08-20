/**
 * Sample rows for the marketing previews. They are deliberately fixed: the
 * landing page renders before anyone signs in, so it has no league to read.
 * The numbers agree across the three previews, which is what makes the story
 * on the page hold together.
 */
export type PreviewPosition = "QB" | "RB" | "TE" | "WR";

export interface BoardPreviewRow {
  readonly market: number;
  readonly mine: number;
  readonly name: string;
  readonly position: PreviewPosition;
  readonly rank: number;
  readonly simulation: number;
  readonly targeted: boolean;
}

export interface TargetPreviewRow {
  readonly highlighted: boolean;
  readonly maximumBid: number;
  readonly name: string;
  readonly position: PreviewPosition;
}

export const boardPreviewRows: readonly BoardPreviewRow[] = [
  { market: 57, mine: 64, name: "Jahmyr Gibbs", position: "RB", rank: 1, simulation: 61, targeted: true },
  { market: 56, mine: 58, name: "Bijan Robinson", position: "RB", rank: 2, simulation: 58, targeted: false },
  { market: 56, mine: 49, name: "Ja'Marr Chase", position: "WR", rank: 3, simulation: 52, targeted: false },
  { market: 55, mine: 61, name: "Puka Nacua", position: "WR", rank: 4, simulation: 59, targeted: true },
  { market: 54, mine: 47, name: "Jaxon Smith-Njigba", position: "WR", rank: 5, simulation: 50, targeted: false },
  { market: 53, mine: 41, name: "Christian McCaffrey", position: "RB", rank: 6, simulation: 44, targeted: false },
];

export const targetPreviewRows: readonly TargetPreviewRow[] = [
  { highlighted: false, maximumBid: 64, name: "Jahmyr Gibbs", position: "RB" },
  { highlighted: true, maximumBid: 61, name: "Puka Nacua", position: "WR" },
  { highlighted: false, maximumBid: 34, name: "Trey McBride", position: "TE" },
];

export const auctionPreviewEvents: readonly string[] = [
  "Barn Formal nominated Puka Nacua for $1",
  "Sunday Funday bid $38",
  "Average Joes bid $47",
  "Sunday Funday bid $52",
  "Average Joes bid $54",
];

export const positionFilters: readonly string[] = ["All", "QB", "RB", "WR", "TE", "DST", "K"];
