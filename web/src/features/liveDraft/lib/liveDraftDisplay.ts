import type {
  LiveDraftBoardPlayer,
  LiveDraftRoom,
  LiveDraftSale,
} from "../api/liveDraftSchemas";

export type LiveDraftPositionFilter = LiveDraftBoardPlayer["position"] | "ALL";

const normalized = (value: string): string => value.trim().toLowerCase();
const displayedMarketValue = (player: LiveDraftBoardPlayer): number =>
  player.marketPrice ?? player.expectedPrice;

const compareBoardPlayers = (
  left: LiveDraftBoardPlayer,
  right: LiveDraftBoardPlayer,
): number =>
  displayedMarketValue(right) - displayedMarketValue(left)
  || right.expectedPrice - left.expectedPrice
  || left.name.localeCompare(right.name);

/** A snake pick has no price, so there is nothing to show but a dash. */
export const formatDollars = (value: number | undefined): string =>
  value === undefined ? "-" : `$${value.toLocaleString("en-US")}`;

export const liveDraftStatusLabel = (status: LiveDraftRoom["status"]): string => {
  switch (status) {
    case "setup": return "Not started";
    case "countdown": return "Starting soon";
    case "live": return "Live";
    case "paused": return "Paused";
    case "ended": return "Complete";
  }
};

export const draftProgress = (room: LiveDraftRoom): string => {
  const total = room.teamSummaries.reduce(
    (count, team) => count + team.roster.length + team.rosterSlotsRemaining,
    0,
  );
  const filled = room.teamSummaries.reduce((count, team) => count + team.roster.length, 0);
  const sales = room.salesLog.length;
  const saleLabel = sales === 1 ? "sale" : "sales";
  return `${String(sales)} ${saleLabel} · ${String(filled)} of ${String(total)} spots filled`;
};

export const filterBoard = (
  players: readonly LiveDraftBoardPlayer[],
  search: string,
  position: LiveDraftPositionFilter,
): readonly LiveDraftBoardPlayer[] => {
  const needle = normalized(search);
  return players.filter(player => {
    if (position !== "ALL" && player.position !== position) return false;
    if (needle.length === 0) return true;
    return normalized([
      player.name,
      player.position,
      player.teamAbbreviation ?? "",
    ].join(" ")).includes(needle);
  }).sort(compareBoardPlayers);
};

export const filterSales = (
  sales: readonly LiveDraftSale[],
  search: string,
): readonly LiveDraftSale[] => {
  const needle = normalized(search);
  return [...sales].reverse().filter(sale => normalized([
    sale.playerName,
    sale.ownerDisplayName,
    sale.teamDisplayName,
    String(sale.price),
  ].join(" ")).includes(needle));
};

export const selectedTeamId = (room: LiveDraftRoom): string | undefined =>
  room.selectedTeam?.teamId ?? room.viewedTeam?.teamId ?? room.teamSummaries[0]?.teamId;

/** A snake pick names the team on the clock and carries no price. */
export const saleCommandFor = (
  room: LiveDraftRoom,
  viewedTeamId: string | undefined,
  playerName: string,
): string => {
  const onTheClock = room.onTheClock;
  if (onTheClock !== undefined) return `${onTheClock.ownerDisplayName} drafted ${playerName}`;
  const team = room.teamSummaries.find(candidate => candidate.teamId === viewedTeamId);
  return team === undefined
    ? `${playerName} `
    : `${team.ownerDisplayName} drafted ${playerName} for `;
};
