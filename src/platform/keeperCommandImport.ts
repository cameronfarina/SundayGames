import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";

export type KeeperCommandDraftType = "auction" | "snake";

export interface KeeperCommandTeamCatalogEntry {
  teamId: string;
  teamName: string;
  managerNames: readonly string[];
  aliases?: readonly string[];
}

export interface KeeperCommandPlayerCatalogEntry {
  playerId: string;
  name: string;
  aliases?: readonly string[];
}

export interface ParseKeeperCommandInput {
  command: string;
  draftType: KeeperCommandDraftType;
  auctionMinimumBidDollars?: number | undefined;
  snakeRoundCount?: number | undefined;
  teams: readonly KeeperCommandTeamCatalogEntry[];
  players: readonly KeeperCommandPlayerCatalogEntry[];
}

export interface KeeperCommandPreviewTeam {
  id: string;
  name: string;
}

export interface KeeperCommandPreviewPlayer {
  id: string;
  name: string;
}

export interface KeeperCommandAuctionValuePreview {
  draftType: "auction";
  auctionCostDollars: number;
}

export interface KeeperCommandSnakeValuePreview {
  draftType: "snake";
  keeperRound: number;
}

export type KeeperCommandValuePreview =
  | KeeperCommandAuctionValuePreview
  | KeeperCommandSnakeValuePreview;

export interface KeeperCommandPreview {
  kind: "preview";
  confirmationRequired: true;
  sourceCommand: string;
  team: KeeperCommandPreviewTeam;
  player: KeeperCommandPreviewPlayer;
  keeper: KeeperCommandValuePreview;
}

export type KeeperCommandImportErrorCode =
  | "invalid_format"
  | "invalid_value"
  | "unknown_team"
  | "ambiguous_team"
  | "unknown_player"
  | "ambiguous_player";

export interface KeeperCommandImportError {
  code: KeeperCommandImportErrorCode;
  message: string;
  mention?: string;
  candidates?: readonly string[];
}

export interface KeeperCommandErrorResult {
  kind: "error";
  error: KeeperCommandImportError;
}

export type KeeperCommandImportResult = KeeperCommandPreview | KeeperCommandErrorResult;

interface ParsedCommand {
  sourceCommand: string;
  teamMention: string;
  playerMention: string;
  rawTrailingValue: string;
  trailingValue: number;
}

interface ResolutionCandidate<T> {
  id: string;
  label: string;
  entry: T;
  aliases: ReadonlySet<string>;
}

const normalizedIdentity = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[.'’]/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");

const namePartAliases = (value: string): string[] => {
  const normalized = normalizedIdentity(value);
  const parts = normalized.split(" ").filter(Boolean);
  const first = parts[0];
  const last = parts[parts.length - 1];

  return [
    normalized,
    ...(first === undefined ? [] : [first]),
    ...(last === undefined || last === first ? [] : [last]),
  ];
};

const teamCandidatesFor = (
  catalog: readonly KeeperCommandTeamCatalogEntry[],
): ResolutionCandidate<KeeperCommandTeamCatalogEntry>[] =>
  catalog.map(team => ({
    id: team.teamId,
    label: team.teamName,
    entry: team,
    aliases: new Set([
      normalizedIdentity(team.teamName),
      ...team.managerNames.flatMap(namePartAliases),
      ...(team.aliases ?? []).map(normalizedIdentity),
    ].filter(Boolean)),
  }));

const playerCandidatesFor = (
  catalog: readonly KeeperCommandPlayerCatalogEntry[],
): ResolutionCandidate<KeeperCommandPlayerCatalogEntry>[] =>
  catalog.map(player => {
    const normalizedName = canonicalPlayerIdentityKey(player.name);
    const nameParts = normalizedName.split(" ").filter(Boolean);
    const firstName = nameParts[0];
    const surname = nameParts[nameParts.length - 1];

    return {
      id: player.playerId,
      label: player.name,
      entry: player,
      aliases: new Set([
        normalizedName,
        ...(firstName === undefined ? [] : [firstName]),
        ...(surname === undefined ? [] : [surname]),
        ...(player.aliases ?? []).map(canonicalPlayerIdentityKey),
      ].filter(Boolean)),
    };
  });

const matchesFor = <T>(
  mention: string,
  candidates: readonly ResolutionCandidate<T>[],
  normalize: (value: string) => string,
  options: { allowPrefix?: boolean } = {},
): ResolutionCandidate<T>[] => {
  const mentionKey = normalize(mention);
  const matchesById = new Map<string, ResolutionCandidate<T>>();

  for (const candidate of candidates) {
    if (candidate.aliases.has(mentionKey)) matchesById.set(candidate.id, candidate);
  }

  if (matchesById.size > 0 || options.allowPrefix !== true || mentionKey.length < 3) {
    return [...matchesById.values()];
  }

  for (const candidate of candidates) {
    if ([...candidate.aliases].some(alias => alias.startsWith(mentionKey))) {
      matchesById.set(candidate.id, candidate);
    }
  }

  return [...matchesById.values()];
};

const parseCommand = (command: string): ParsedCommand | KeeperCommandErrorResult => {
  const sourceCommand = command.trim().replace(/\s+/gu, " ");
  const match = /^(.*?)\s+keeping\s+(.+?)\s+(\S+)$/iu.exec(sourceCommand);
  if (match === null) {
    return {
      kind: "error",
      error: {
        code: "invalid_format",
        message: "Use '<team or manager> keeping <player> <number>'.",
      },
    };
  }

  const teamMention = match[1]?.trim() ?? "";
  const playerMention = match[2]?.trim() ?? "";
  const rawValue = match[3] ?? "";
  if (teamMention.length === 0 || playerMention.length === 0) {
    return {
      kind: "error",
      error: {
        code: "invalid_format",
        message: "Use '<team or manager> keeping <player> <number>'.",
      },
    };
  }

  if (!/^\d+$/u.test(rawValue)) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: `Keeper value "${rawValue}" must be a whole number.`,
        mention: rawValue,
      },
    };
  }

  return {
    sourceCommand,
    teamMention,
    playerMention,
    rawTrailingValue: rawValue,
    trailingValue: Number(rawValue),
  };
};

const resolutionError = (
  entity: "team" | "player",
  mention: string,
  matches: readonly ResolutionCandidate<unknown>[],
): KeeperCommandErrorResult => {
  if (matches.length === 0) {
    return {
      kind: "error",
      error: {
        code: entity === "team" ? "unknown_team" : "unknown_player",
        message: entity === "team"
          ? `No team or manager matched "${mention}".`
          : `No player matched "${mention}".`,
        mention,
      },
    };
  }

  return {
    kind: "error",
    error: {
      code: entity === "team" ? "ambiguous_team" : "ambiguous_player",
      message: entity === "team"
        ? `"${mention}" matched multiple teams or managers.`
        : `"${mention}" matched multiple players.`,
      mention,
      candidates: matches.map(match => match.label),
    },
  };
};

export const parseKeeperCommand = (
  input: ParseKeeperCommandInput,
): KeeperCommandImportResult => {
  const parsed = parseCommand(input.command);
  if ("kind" in parsed) return parsed;

  if (!Number.isSafeInteger(parsed.trailingValue)) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: input.draftType === "snake"
          ? "Snake keeper round must be a positive whole number."
          : "Auction keeper cost must be a non-negative whole number.",
        mention: parsed.rawTrailingValue,
      },
    };
  }

  if (input.draftType === "auction") {
    const minimumBidDollars = input.auctionMinimumBidDollars ?? 1;
    if (parsed.trailingValue < minimumBidDollars) {
      return {
        kind: "error",
        error: {
          code: "invalid_value",
          message: `Auction keeper cost must be at least $${minimumBidDollars}.`,
          mention: parsed.rawTrailingValue,
        },
      };
    }
  }

  if (
    input.draftType === "snake"
    && (
      parsed.trailingValue <= 0
      || (input.snakeRoundCount !== undefined && parsed.trailingValue > input.snakeRoundCount)
    )
  ) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: input.snakeRoundCount === undefined
          ? "Snake keeper round must be a positive whole number."
          : `Snake keeper round must be between 1 and ${input.snakeRoundCount}.`,
        mention: parsed.rawTrailingValue,
      },
    };
  }

  const teamMatches = matchesFor(
    parsed.teamMention,
    teamCandidatesFor(input.teams),
    normalizedIdentity,
    { allowPrefix: true },
  );
  if (teamMatches.length !== 1) return resolutionError("team", parsed.teamMention, teamMatches);

  const playerMatches = matchesFor(
    parsed.playerMention,
    playerCandidatesFor(input.players),
    canonicalPlayerIdentityKey,
    { allowPrefix: true },
  );
  if (playerMatches.length !== 1) return resolutionError("player", parsed.playerMention, playerMatches);

  const team = teamMatches[0];
  const player = playerMatches[0];
  if (team === undefined || player === undefined) {
    throw new Error("Expected exactly one keeper team and player match.");
  }

  return {
    kind: "preview",
    confirmationRequired: true,
    sourceCommand: parsed.sourceCommand,
    team: {
      id: team.entry.teamId,
      name: team.entry.teamName,
    },
    player: {
      id: player.entry.playerId,
      name: player.entry.name,
    },
    keeper: input.draftType === "auction"
      ? {
          draftType: "auction",
          auctionCostDollars: parsed.trailingValue,
        }
      : {
          draftType: "snake",
          keeperRound: parsed.trailingValue,
        },
  };
};
