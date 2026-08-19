import type { InSeasonPlayer, InSeasonTeam } from "../api/inSeasonSchema";

type RankView = InSeasonPlayer["weekly"];

/** Shown wherever FantasyPros published nothing, so a gap never reads as zero. */
export const missingValue = "—";

export const rankLabel = (rank: RankView): string =>
  rank === undefined ? "Not ranked" : `#${String(rank.rankEcr)}`;

export const positionRankLabel = (rank: RankView): string =>
  rank?.positionRank ?? missingValue;

export const tierLabel = (rank: RankView): string =>
  rank?.tier === undefined ? missingValue : `Tier ${String(rank.tier)}`;

/**
 * How far apart the experts are. A wide range on a high rank is the signal a
 * reader wants before trusting it.
 */
export const spreadLabel = (rank: RankView): string => {
  if (rank?.rankMin === undefined || rank.rankMax === undefined) return missingValue;
  const deviation = rank.rankStandardDeviation;
  const range = `${String(rank.rankMin)}–${String(rank.rankMax)}`;
  return deviation === undefined ? range : `${range} (±${deviation.toFixed(1)})`;
};

/**
 * FantasyPros does not document which sign means improvement. Positive reads
 * as rising, inferred from evidence rather than documentation: over an
 * eight-hour window six ranked players carrying a delta moved in the direction
 * its sign predicts, including three negative deltas that did fall. The draft
 * overlay reads the field the same way, so the two surfaces agree.
 */
export const momentumLabel = (rank: RankView): string => {
  const delta = rank?.ecrDelta;
  if (delta === undefined || delta === 0) return missingValue;
  const spots = Math.abs(delta);
  return delta > 0 ? `+${String(spots)} rising` : `-${String(spots)} falling`;
};

export const pointsLabel = (points: number | undefined): string =>
  points === undefined ? missingValue : points.toFixed(1);

export const byeLabel = (week: number | undefined): string =>
  week === undefined ? missingValue : `Week ${String(week)}`;

export const ownedLabel = (owned: number | undefined): string =>
  owned === undefined ? missingValue : `${owned.toFixed(0)}%`;

export const lineupBasisLabel = (basis: NonNullable<InSeasonTeam["lineup"]>["basis"]): string =>
  basis === "weekly_projection"
    ? "Ordered by this week's FantasyPros projection"
    : "Ordered by rest-of-season FantasyPros projection";

export const waiverSourceLabel = (source: InSeasonTeam["waivers"]["source"]): string =>
  source === "waiver_rankings"
    ? "FantasyPros waiver rankings"
    : "Widely available players";
