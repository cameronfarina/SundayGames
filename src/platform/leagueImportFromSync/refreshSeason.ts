import type { ConfirmedLeagueCreationInput } from "../leagueCreation.js";
import type {
  ExplicitLeagueSeasonSettings,
  LeagueSeason,
  LeagueSeasonSettings,
} from "../leagueSeason.js";
import { seasonFromLeagueImport } from "./overwriteSeason.js";

export type LeagueSeasonRefresh =
  | { status: "refreshed"; season: LeagueSeason; detail?: string | undefined }
  | { status: "blocked"; detail: string };

/**
 * Keeps the draft the league already agreed on. Round counts, budgets, and the
 * format itself are settled once a season leaves draft — a live board is built
 * from them — so a re-sync refreshes everything around the draft and leaves the
 * draft alone. A legacy season with no named format has always been an auction.
 */
const preservedDraftSettings = (
  existing: LeagueSeasonSettings,
  next: ExplicitLeagueSeasonSettings,
): ExplicitLeagueSeasonSettings => {
  const shared = {
    expectedTeamCount: next.expectedTeamCount,
    scoring: next.scoring,
    roster: next.roster,
    keeperPolicy: next.keeperPolicy,
  };
  if (existing.draftFormat === "snake") {
    return { ...shared, draftFormat: "snake", snake: existing.snake };
  }
  return { ...shared, draftFormat: "auction", auction: existing.auction };
};

const draftFormatOf = (settings: LeagueSeasonSettings): "auction" | "snake" =>
  settings.draftFormat ?? "auction";

/**
 * A team leaving or joining at the provider is the owner's decision to carry
 * across, not the sync's. This is checked before anything else a snapshot might
 * be wrong about, because it is the specific thing they have to act on.
 */
export const teamCountMismatchDetail = (
  providerTeamCount: number,
  seasonTeamCount: number,
): string | null => providerTeamCount === seasonTeamCount
  ? null
  : `This league now has ${providerTeamCount} teams at the provider and ` +
    `${seasonTeamCount} in Sunday Games. Fix the teams in the league settings, ` +
    "then sync again.";

/**
 * Applies a fresh provider snapshot to the league it was imported into. A
 * re-sync only ever rewrites what is safe to rewrite: names, scoring, roster
 * rules, the keeper flag, and how teams are labelled. It never adds or removes
 * a team, because everything the league owns hangs off the team ids it has.
 */
export const refreshedSeasonFromImport = (
  season: LeagueSeason,
  input: ConfirmedLeagueCreationInput,
): LeagueSeasonRefresh => {
  const mismatch = teamCountMismatchDetail(input.teams.length, season.teams.length);
  if (mismatch !== null) return { status: "blocked", detail: mismatch };

  const refreshed = seasonFromLeagueImport(season, input);
  if (season.setupStatus === "draft") return { status: "refreshed", season: refreshed };

  const formatChanged = draftFormatOf(season.settings) !== input.draft.type;
  return {
    status: "refreshed",
    season: {
      ...refreshed,
      settings: preservedDraftSettings(season.settings, refreshed.settings),
    },
    ...(formatChanged
      ? {
        detail: `This league now runs a ${input.draft.type} draft at the provider. ` +
          "Sunday Games kept the draft this season was published with.",
      }
      : {}),
  };
};
