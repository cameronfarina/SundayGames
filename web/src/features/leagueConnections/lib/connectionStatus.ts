import type { NoticeVariant } from "../../../shared/ui";
import type { LeagueConnectionStatus } from "../api/leagueConnectionsSchema";

interface StatusPresentation {
  readonly label: string;
  readonly summary: string;
  readonly variant: NoticeVariant;
}

/**
 * Every connection shows a status even when nothing is wrong, so the owner
 * never has to guess whether a quiet league synced or simply never ran.
 */
const presentations: Record<LeagueConnectionStatus, StatusPresentation> = {
  pending: {
    label: "Not synced yet",
    summary: "This league has not been pulled in yet. Choose Sync now to fetch it.",
    variant: "info",
  },
  ok: {
    label: "Synced",
    summary: "Rosters, matchups, and settings are up to date.",
    variant: "success",
  },
  needs_attention: {
    label: "Needs attention",
    summary: "This league needs something from you before it can sync again.",
    variant: "warning",
  },
  error: {
    label: "Sync failed",
    summary: "The provider could not be reached. Try syncing again in a few minutes.",
    variant: "error",
  },
};

export const statusPresentation = (status: LeagueConnectionStatus): StatusPresentation =>
  presentations[status];

export interface StatusLegendEntry extends StatusPresentation {
  readonly status: LeagueConnectionStatus;
}

/**
 * The legend and every dot read the same map, so a colour can never come to
 * mean one thing on a tile and another in the key beside it.
 */
const legendOrder: readonly LeagueConnectionStatus[] = [
  "ok",
  "needs_attention",
  "error",
  "pending",
];

export const statusLegend: readonly StatusLegendEntry[] =
  legendOrder.map(status => ({ status, ...presentations[status] }));

export const statusMessage = (
  status: LeagueConnectionStatus,
  statusDetail: string | undefined,
): string => statusDetail ?? presentations[status].summary;

export const formatSyncedAt = (value: string | undefined): string => {
  if (value === undefined) return "Never synced";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Never synced";
  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `Last synced ${day} at ${time}`;
};

export const formatRecord = (
  team: { readonly wins: number; readonly losses: number; readonly ties: number },
): string => team.ties === 0
  ? `${String(team.wins)}-${String(team.losses)}`
  : `${String(team.wins)}-${String(team.losses)}-${String(team.ties)}`;

export const formatPoints = (value: number): string => value.toFixed(2);
