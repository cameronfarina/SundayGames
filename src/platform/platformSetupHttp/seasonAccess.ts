import type { LeagueSeason } from "../leagueSeason.js";
import type { PlatformSetupApp } from "./app.js";

interface SeasonScopedSetupInput {
  actorSessionToken: string;
  seasonId?: string;
  now?: Date | undefined;
}

export const existingSeasonFor = async (
  app: PlatformSetupApp,
  input: SeasonScopedSetupInput,
): Promise<LeagueSeason | null> => {
  if (input.seasonId === undefined || input.seasonId.trim().length === 0) return null;

  return await app.getLeagueSeason({
    actorSessionToken: input.actorSessionToken,
    seasonId: input.seasonId,
    now: input.now,
  });
};
