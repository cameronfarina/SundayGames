import type {
  LiveDraftAdvisory,
  LiveDraftAdvisoryPlayer,
} from "../api/liveDraftAdvisorySchemas";

export type AdvisoryByPlayerName = ReadonlyMap<string, LiveDraftAdvisoryPlayer>;

export const advisoryByPlayerName = (
  advisory: LiveDraftAdvisory | undefined,
): AdvisoryByPlayerName => new Map(
  (advisory?.players ?? []).map(player => [player.normalizedPlayerName, player]),
);

export const advisoryBasisLabel = (advisory: LiveDraftAdvisory): string => {
  if (advisory.basis === "ros") return "rest-of-season ranks";
  if (advisory.week === null) return "weekly ranks";
  return `week ${String(advisory.week)} ranks`;
};

export const momentumLabel = (player: LiveDraftAdvisoryPlayer): string => {
  const direction = player.momentum === "rising" ? "up" : "down";
  return `consensus rank ${direction} ${String(Math.abs(player.ecrDelta ?? 0))}`;
};

export const advisorySummary = (player: LiveDraftAdvisoryPlayer): string => {
  const parts = [`Consensus rank ${String(player.rankEcr)}`];
  if (player.positionRank !== undefined) parts.push(player.positionRank);
  if (player.tier !== undefined) parts.push(`tier ${String(player.tier)}`);
  if (player.momentum !== "steady") parts.push(momentumLabel(player));
  return parts.join(" · ");
};
