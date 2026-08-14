import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { buildPreview } from "./buildPreview.js";
import { matchesFor } from "./matches.js";
import { normalizedIdentity } from "./normalization.js";
import { parseCommand } from "./parseCommand.js";
import { playerCandidatesFor } from "./playerCandidates.js";
import { resolutionError } from "./resolutionError.js";
import { teamCandidatesFor } from "./teamCandidates.js";
import type { KeeperCommandImportResult, ParseKeeperCommandInput } from "./types.js";
import { validateValue } from "./validateValue.js";

export const parseKeeperCommand = (
  input: ParseKeeperCommandInput,
): KeeperCommandImportResult => {
  const parsed = parseCommand(input.command);
  if ("kind" in parsed) return parsed;

  const valueError = validateValue(input, parsed);
  if (valueError !== undefined) return valueError;

  const teamMatches = matchesFor(
    parsed.teamMention,
    teamCandidatesFor(input.teams),
    normalizedIdentity,
    { allowPrefix: true },
  );
  const team = teamMatches[0];
  if (team === undefined || teamMatches.length !== 1) {
    return resolutionError("team", parsed.teamMention, teamMatches);
  }

  const playerMatches = matchesFor(
    parsed.playerMention,
    playerCandidatesFor(input.players),
    canonicalPlayerIdentityKey,
    { allowPrefix: true },
  );
  const player = playerMatches[0];
  if (player === undefined || playerMatches.length !== 1) {
    return resolutionError("player", parsed.playerMention, playerMatches);
  }

  return buildPreview(input, parsed, team, player);
};
