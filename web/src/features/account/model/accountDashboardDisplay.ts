import type { AccountDashboardLeague } from "../api/accountDashboardSchema";

type Draft = AccountDashboardLeague["draft"];
type Readiness = AccountDashboardLeague["readiness"]["leagueSetup"];
export type ScheduledDashboardLeague = AccountDashboardLeague & {
  readonly draft: AccountDashboardLeague["draft"] & { readonly startsAt: string };
};

export const draftStatus = (draft: Draft): string => {
  switch (draft.status) {
    case "countdown": return "Draft scheduled";
    case "ended": return "Draft complete";
    case "live": return "Draft live";
    case "paused": return "Draft paused";
    case "setup": return "Draft room ready";
    default: return draft.startsAt === undefined ? "Not scheduled" : "Draft scheduled";
  }
};

export const readinessStatus = (state: Readiness): string =>
  state === "ready" ? "Ready" : "Needs attention";

export const roleLabel = (role: AccountDashboardLeague["membershipRole"]): string => {
  switch (role) {
    case "admin": return "League admin";
    case "member": return "Manager";
    case "observer": return "Observer";
    case "owner": return "League owner";
  }
};

export const providerLabel = (provider: AccountDashboardLeague["provider"]): string => {
  switch (provider) {
    case "espn": return "ESPN";
    case "mockd": return "Sunday Games";
    case "sleeper": return "Sleeper";
    case "yahoo": return "Yahoo";
  }
};

export const formatCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${String(count)} ${count === 1 ? singular : plural}`;

export const upcomingDrafts = (
  leagues: readonly AccountDashboardLeague[],
  now = Date.now(),
): readonly ScheduledDashboardLeague[] => [...leagues]
  .filter((league): league is ScheduledDashboardLeague =>
    league.draft.startsAt !== undefined && Date.parse(league.draft.startsAt) > now
      && league.draft.status !== "live"
      && league.draft.status !== "paused"
      && league.draft.status !== "ended"
  )
  .sort((left, right) => {
    const difference = Date.parse(left.draft.startsAt) - Date.parse(right.draft.startsAt);
    return difference === 0 ? left.leagueName.localeCompare(right.leagueName) : difference;
  });

export const formatDraftDate = (instant: string): string => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(instant));
