import type { AccountRecord } from "../../auth.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type { PlatformLeagueMembership } from "../../leagueSetup.js";
import { canMutateLeague, type PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";

const assertMembershipTeams = (
  season: LeagueSeason,
  memberships: readonly PlatformLeagueMembership[],
): void => {
  for (const membership of memberships) {
    if (membership.leagueId !== season.leagueId) {
      throw new PlatformAppError("league_not_found", "Membership does not match this league season.");
    }
    if (membership.ownerId === undefined && membership.teamId === undefined) continue;
    const team = season.teams.find(candidate =>
      candidate.id === membership.teamId && candidate.ownerId === membership.ownerId
    );
    if (team === undefined) {
      throw new PlatformAppError("team_not_found", "Membership team was not found in this league season.");
    }
  }
};

// Legacy seasons predate the explicit field but were always auction leagues.
const draftFormatOf = (season: LeagueSeason): "auction" | "snake" =>
  season.settings.draftFormat ?? "auction";

const assertDraftFormatUnchanged = async (
  context: PlatformAppContext,
  season: LeagueSeason,
): Promise<void> => {
  const existing = await context.leagueSetup.findLeagueSeason(season.id);
  if (existing === null || existing.setupStatus === "draft") return;
  if (draftFormatOf(existing) === draftFormatOf(season)) return;
  throw new PlatformAppError(
    "draft_format_locked",
    "Draft format cannot change after the league is published. Create a new season to switch formats.",
  );
};

const snakeRoundsOf = (season: LeagueSeason): number | undefined =>
  season.settings.draftFormat === "snake" ? season.settings.snake.rounds : undefined;

/**
 * A started draft has a board built from the round count, so changing it would
 * orphan picks already made. Before the first pick the commissioner is free to
 * leave the room and fix it.
 */
const assertSnakeRoundsUnlocked = async (
  context: PlatformAppContext,
  season: LeagueSeason,
): Promise<void> => {
  const existing = await context.leagueSetup.findLeagueSeason(season.id);
  if (existing === null) return;
  const before = snakeRoundsOf(existing);
  if (before === undefined || before === snakeRoundsOf(season)) return;
  if (!await context.liveDraftRooms.hasStartedRoomForSeason(season.id)) return;
  throw new PlatformAppError(
    "draft_rounds_locked",
    "Draft rounds cannot change once the live draft has started.",
  );
};

export const assertRegistrationAllowed = async (
  context: PlatformAppContext,
  account: AccountRecord,
  season: LeagueSeason,
  memberships: readonly PlatformLeagueMembership[],
): Promise<void> => {
  const existing = await context.leagueSetup.findMembership(account.id, season.leagueId);
  const registered = await context.leagueSetup.hasLeagueSeasonForLeague(season.leagueId);
  const submitted = memberships.find(membership =>
    membership.userId === account.id && membership.leagueId === season.leagueId
  );
  const allowedByExisting = existing !== null && canMutateLeague(existing.role);
  const allowedBySubmitted = submitted !== undefined && canMutateLeague(submitted.role);
  if (!allowedByExisting && (registered || !allowedBySubmitted)) {
    throw new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can change shared draft data.",
    );
  }
  assertMembershipTeams(season, memberships);
  await assertDraftFormatUnchanged(context, season);
  await assertSnakeRoundsUnlocked(context, season);
};
