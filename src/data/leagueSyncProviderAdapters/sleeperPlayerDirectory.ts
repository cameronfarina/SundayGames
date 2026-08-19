import type { PlayerDirectory, PlayerDirectoryEntry } from "./contracts.js";
import { optionalText, recordValue } from "./decode.js";

/**
 * Sleeper's player dump is roughly 15 MB of scouting detail, and a roster only
 * needs a name, a position, and a team. Trimming here keeps the stored
 * directory small enough to read on every sync.
 */
const entryFor = (player: Record<string, unknown>): PlayerDirectoryEntry | undefined => {
  const name = optionalText(player.full_name) ??
    [optionalText(player.first_name), optionalText(player.last_name)]
      .filter(part => part !== undefined).join(" ");
  if (name.length === 0) return undefined;

  return {
    name,
    ...(optionalText(player.position) === undefined ? {} : { position: optionalText(player.position) }),
    ...(optionalText(player.team) === undefined
      ? {} : { teamAbbreviation: optionalText(player.team) }),
  };
};

export const sleeperPlayerDirectory = (payload: unknown): PlayerDirectory => {
  const directory: Record<string, PlayerDirectoryEntry> = {};
  for (const [playerId, player] of Object.entries(recordValue(payload))) {
    const entry = entryFor(recordValue(player));
    if (entry !== undefined) directory[playerId] = entry;
  }
  return directory;
};
