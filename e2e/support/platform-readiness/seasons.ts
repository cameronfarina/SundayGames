import type { Page } from "@playwright/test";
import { leagueConfig, ownerOrder } from "../../../config/league.js";
import type { AccountRecord } from "../../../src/platform/auth.js";
import { buildCurrentMockdLeagueSeason, type LeagueSeason } from "../../../src/platform/leagueSeason.js";
import "../../../src/platform/leagueSetup.js";
import { api, expectOk } from "./api.js";
import { cleanIdFragment, leagueName, provisioningToken } from "./environment.js";
import { namespacedSeasonForSmoke } from "./seasonNamespace.js";
import type { SeasonBody } from "./types.js";

export const teamByOwner = (
  season: LeagueSeason,
  ownerDisplayName: string,
): LeagueSeason["teams"][number] => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team.`);

  return team;
};

export const setupRowsFor = (camEmail: string): string =>
  [
    "owner,team,email,role",
    ...ownerOrder.map(owner => {
      const email = owner === "Owner11" ? camEmail : "";
      const role = owner === "Owner11" ? "admin" : "member";

      return `${owner},${owner},${email},${role}`;
    }),
  ].join("\n");

export const seedSeasonFromBrowser = async (
  page: Page,
  camAccount: AccountRecord,
  namespace?: string,
): Promise<LeagueSeason> => {
  const baseSeason = namespacedSeasonForSmoke(buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName,
    setupStatus: "draft",
  }));
  const namespaceSlug = namespace === undefined ? undefined : cleanIdFragment(namespace);
  const season = namespaceSlug === undefined
    ? baseSeason
    : (() => {
      const leagueId = `${baseSeason.leagueId}-${namespaceSlug}`;
      const seasonId = `${leagueId}-season-${baseSeason.seasonYear}`;

      return {
        ...baseSeason,
        id: seasonId,
        leagueId,
        league: {
          ...baseSeason.league,
          id: leagueId,
          externalLeagueId: `${baseSeason.league.externalLeagueId}-${namespaceSlug}`,
        },
        teams: baseSeason.teams.map((team, index) => ({
          ...team,
          id: `${seasonId}-team-${String(index + 1).padStart(2, "0")}`,
          leagueSeasonId: seasonId,
          ownerId: `${team.ownerId}-${namespaceSlug}`,
        })),
      };
    })();
  const camTeam = teamByOwner(season, "Owner11");

  return expectOk(await api<SeasonBody>(page, "/seasons", {
    method: "POST",
    headers: { "x-mockd-provisioning-token": provisioningToken },
    body: {
      season,
      memberships: [
        {
          userId: camAccount.id,
          leagueId: season.leagueId,
          role: "admin",
          ownerId: camTeam.ownerId,
          teamId: camTeam.id,
        },
      ],
    },
  })).season;
};
