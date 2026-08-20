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
  { market: 57, mine: 75, name: "Jahmyr Gibbs", position: "RB", rank: 1, simulation: 72, targeted: true },
  { market: 58, mine: 72, name: "Bijan Robinson", position: "RB", rank: 2, simulation: 69, targeted: false },
  { market: 56, mine: 69, name: "Ja'Marr Chase", position: "WR", rank: 3, simulation: 67, targeted: false },
  { market: 56, mine: 67, name: "Puka Nacua", position: "WR", rank: 4, simulation: 65, targeted: true },
  { market: 54, mine: 67, name: "Jaxon Smith-Njigba", position: "WR", rank: 5, simulation: 65, targeted: false },
  { market: 53, mine: 65, name: "Christian McCaffrey", position: "RB", rank: 6, simulation: 62, targeted: false },
];

export const targetPreviewRows: readonly TargetPreviewRow[] = [
  { highlighted: false, maximumBid: 75, name: "Jahmyr Gibbs", position: "RB" },
  { highlighted: true, maximumBid: 67, name: "Puka Nacua", position: "WR" },
  { highlighted: false, maximumBid: 34, name: "Trey McBride", position: "TE" },
];

export const auctionPreviewEvents: readonly string[] = [
  "Turf Toe Tigers nominated Puka Nacua for $1",
  "Waiver Wire Kings bid $38",
  "Red Zone Rebels bid $47",
  "Waiver Wire Kings bid $52",
  "Red Zone Rebels bid $54",
];

export const positionFilters: readonly string[] = ["All", "QB", "RB", "WR", "TE", "DST", "K"];
