import type { LeagueSeason } from "../../leagueSeason.js";
import type { PracticeShortlistItem } from "../../practiceShortlists.js";
import type { GetLeagueSeasonInput } from "../contracts/league.js";
import type {
  ListPracticeShortlistInput,
  RemovePracticeShortlistInput,
  SavePracticeShortlistInput,
} from "../contracts/practice.js";
import type { PlatformAppContext } from "../context.js";
import { cloneForRead } from "../shared.js";

export const createPracticeOperations = (context: PlatformAppContext) => ({
  getLeagueSeason: async (input: GetLeagueSeasonInput): Promise<LeagueSeason> =>
    cloneForRead(await context.requireSeasonRead(
      await context.requireAccount(input.actorSessionToken, input.now),
      input.seasonId,
    )),

  listPracticeShortlist: async (
    input: ListPracticeShortlistInput,
  ): Promise<readonly PracticeShortlistItem[]> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSeasonRead(account, input.seasonId);
    return cloneForRead(await context.practiceShortlists.listForUserSeason(account.id, input.seasonId));
  },

  savePracticeShortlistItem: async (
    input: SavePracticeShortlistInput,
  ): Promise<PracticeShortlistItem> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const season = await context.requireSeasonRead(account, input.seasonId);
    return cloneForRead(await context.practiceShortlists.save({
      leagueId: season.leagueId,
      seasonId: season.id,
      userId: account.id,
      playerName: input.playerName,
      position: input.position,
      ...(input.maxBid === undefined ? {} : { maxBid: input.maxBid }),
      now: input.now,
    }));
  },

  removePracticeShortlistItem: async (input: RemovePracticeShortlistInput): Promise<boolean> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSeasonRead(account, input.seasonId);
    return await context.practiceShortlists.remove(account.id, input.seasonId, input.playerName);
  },
});
