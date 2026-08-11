import { analyzeRosterSlots, LeagueCreationError } from "./leagueCreation.js";

export interface EspnLeagueSettingsHttpRequest {
  method: "GET";
  url: string;
}

export interface EspnLeagueSettingsHttpResponse {
  code: number;
  body: unknown;
}

export type EspnLeagueSettingsHttpTransport = (
  request: EspnLeagueSettingsHttpRequest,
) => Promise<EspnLeagueSettingsHttpResponse>;

export interface EspnLeagueSettingsImportInput {
  leagueIdOrUrl: number | string;
  season: number;
}

export interface EspnLeagueSettingsImportWarning {
  code: "minimum_bid_defaulted" | "rounds_derived_from_roster";
  message: string;
}

export interface EspnLeagueSettingsReviewTeam {
  externalTeamId: string;
  displayName: string;
  abbreviation: string | null;
  draftOrderPosition: number | null;
}

export interface EspnAuctionDraftSettingsReview {
  type: "auction";
  budgetDollars: number;
  minimumBidDollars: number;
}

export interface EspnSnakeDraftSettingsReview {
  type: "snake";
  rounds: number;
  order: readonly string[];
}

export type EspnDraftSettingsReview = EspnAuctionDraftSettingsReview | EspnSnakeDraftSettingsReview;

export interface EspnLeagueSettingsReview {
  externalLeagueId: string;
  season: number;
  leagueName: string | null;
  teamCount: number;
  draft: EspnDraftSettingsReview;
  scoring: {
    pointsPerPassingYard: number;
    pointsPerPassingTouchdown: number;
    pointsPerRushingYard: number;
    pointsPerRushingTouchdown: number;
    pointsPerReceivingYard: number;
    pointsPerReceivingTouchdown: number;
    pointsPerReception: number;
  };
  rosterSlots: Readonly<Record<string, number>>;
  teams: readonly EspnLeagueSettingsReviewTeam[];
}

export interface EspnLeagueSettingsReviewOutcome {
  kind: "review";
  provider: "espn";
  confirmationRequired: true;
  review: EspnLeagueSettingsReview;
  warnings: readonly EspnLeagueSettingsImportWarning[];
}

export interface EspnLeagueSettingsManualReviewOutcome {
  kind: "manual-review-required";
  provider: "espn";
  confirmationRequired: true;
  reason: "private_or_unauthorized" | "settings_need_review";
  externalLeagueId: string;
  season: number;
  confirmationMethods: readonly ["screenshot", "manual"];
  message: string;
}

export type EspnLeagueSettingsImportOutcome =
  | EspnLeagueSettingsReviewOutcome
  | EspnLeagueSettingsManualReviewOutcome;

type JsonObject = Record<string, unknown>;

const espnApiOrigin = "https://lm-api-reads.fantasy.espn.com";
const receptionStatId = 53;
const passingYardStatId = 3;
const passingTouchdownStatId = 4;
const rushingYardStatId = 24;
const rushingTouchdownStatId = 25;
const receivingYardStatId = 42;
const receivingTouchdownStatId = 43;
const espnMinimumBidDollars = 1;

const rosterSlotNames: Readonly<Record<string, string>> = {
  "0": "QB",
  "2": "RB",
  "3": "RB_WR",
  "4": "WR",
  "5": "WR_TE",
  "6": "TE",
  "7": "OP",
  "16": "DST",
  "17": "K",
  "20": "BENCH",
  "21": "IR",
  "23": "FLEX",
};

const objectValue = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const positiveInteger = (value: unknown): number | null => {
  const number = finiteNumber(value);
  return number !== null && Number.isSafeInteger(number) && number > 0 ? number : null;
};

const normalizedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const requiredObject = (value: unknown, path: string): JsonObject => {
  const object = objectValue(value);
  if (object === null) throw new Error(`ESPN response is missing ${path}.`);
  return object;
};

const requiredNumber = (value: unknown, path: string): number => {
  const number = finiteNumber(value);
  if (number === null) throw new Error(`ESPN response is missing ${path}.`);
  return number;
};

const optionalPositiveInteger = (value: unknown, path: string): number | null => {
  if (value === undefined || value === null) return null;
  const number = positiveInteger(value);
  if (number === null) throw new Error(`ESPN response has an invalid ${path}.`);
  return number;
};

const leagueIdFor = (leagueIdOrUrl: number | string): string => {
  const rawValue = String(leagueIdOrUrl).trim();
  const directId = /^\d+$/u.test(rawValue) ? rawValue : null;
  if (directId !== null && Number(directId) > 0) return directId;

  let url: URL;
  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("Enter a positive ESPN league ID or an ESPN fantasy-football league URL.");
  }

  if (!/(^|\.)espn\.com$/iu.test(url.hostname)) {
    throw new Error("Enter an ESPN fantasy-football league URL.");
  }

  const leagueId = [...url.searchParams.entries()]
    .find(([key]) => key.toLowerCase() === "leagueid")?.[1]
    ?.trim();
  if (leagueId === undefined || !/^\d+$/u.test(leagueId) || Number(leagueId) <= 0) {
    throw new Error("The ESPN URL does not contain a positive leagueId.");
  }

  return leagueId;
};

const requestUrlFor = (leagueId: string, season: number): string => {
  if (!Number.isSafeInteger(season) || season <= 0) {
    throw new Error("ESPN season must be a positive whole number.");
  }

  const url = new URL(`/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}`, espnApiOrigin);
  url.searchParams.append("view", "mSettings");
  url.searchParams.append("view", "mTeam");
  return url.toString();
};

const rosterSlotsFor = (rosterSettings: JsonObject): Readonly<Record<string, number>> => {
  const counts = requiredObject(rosterSettings.lineupSlotCounts, "settings.rosterSettings.lineupSlotCounts");
  const slots: Record<string, number> = {};

  for (const [slotId, rawCount] of Object.entries(counts)) {
    const count = finiteNumber(rawCount);
    if (count === null || count <= 0) continue;
    const slotName = rosterSlotNames[slotId];
    if (slotName === undefined) {
      throw new LeagueCreationError(
        `ESPN roster slot ${slotId} is not supported. Review the league roster settings manually before continuing.`,
      );
    }
    slots[slotName] = count;
  }

  return slots;
};

const scoringPointsFor = (scoringSettings: JsonObject, statId: number, label: string): number => {
  if (!Array.isArray(scoringSettings.scoringItems)) {
    throw new Error("ESPN response is missing settings.scoringSettings.scoringItems.");
  }

  const item = scoringSettings.scoringItems
    .map(objectValue)
    .find(candidate => candidate !== null && finiteNumber(candidate.statId) === statId);
  if (item === undefined || item === null) {
    throw new LeagueCreationError(
      `ESPN response is missing ${label}. Review scoring manually before continuing.`,
    );
  }
  return requiredNumber(item.points, label);
};

const pickOrderFor = (draftSettings: JsonObject): string[] => {
  if (!Array.isArray(draftSettings.pickOrder)) return [];

  return draftSettings.pickOrder.flatMap(value => {
    const id = positiveInteger(value);
    return id === null ? [] : [String(id)];
  });
};

const displayNameFor = (team: JsonObject): string => {
  const name = normalizedString(team.name);
  if (name !== null) return name;

  const location = normalizedString(team.location);
  const nickname = normalizedString(team.nickname);
  const displayName = [location, nickname].filter((value): value is string => value !== null).join(" ");
  return displayName.length > 0 ? displayName : `ESPN Team ${String(team.id)}`;
};

const teamsFor = (body: JsonObject, pickOrder: readonly string[]): EspnLeagueSettingsReviewTeam[] => {
  if (!Array.isArray(body.teams)) throw new Error("ESPN response is missing teams.");

  const orderByTeamId = new Map(pickOrder.map((teamId, index) => [teamId, index + 1]));
  const teams = body.teams.map((value): EspnLeagueSettingsReviewTeam => {
    const team = requiredObject(value, "teams[]");
    const externalTeamId = String(positiveInteger(team.id) ?? "");
    if (externalTeamId.length === 0) throw new Error("ESPN response contains a team without an id.");

    return {
      externalTeamId,
      displayName: displayNameFor(team),
      abbreviation: normalizedString(team.abbrev),
      draftOrderPosition: orderByTeamId.get(externalTeamId) ?? null,
    };
  });

  return [...teams].sort((left, right) =>
    (left.draftOrderPosition ?? Number.MAX_SAFE_INTEGER) -
      (right.draftOrderPosition ?? Number.MAX_SAFE_INTEGER) ||
    Number(left.externalTeamId) - Number(right.externalTeamId)
  );
};

const draftFor = (
  draftSettings: JsonObject,
  pickOrder: readonly string[],
  rosterSlotCount: number,
): { draft: EspnDraftSettingsReview; warnings: EspnLeagueSettingsImportWarning[] } => {
  const draftType = normalizedString(draftSettings.type)?.toUpperCase();

  if (draftType === "AUCTION") {
    const minimumBid = optionalPositiveInteger(
      draftSettings.minimumBid,
      "settings.draftSettings.minimumBid",
    );

    return {
      draft: {
        type: "auction",
        budgetDollars: requiredNumber(draftSettings.auctionBudget, "settings.draftSettings.auctionBudget"),
        minimumBidDollars: minimumBid ?? espnMinimumBidDollars,
      },
      warnings: minimumBid === null
        ? [{
            code: "minimum_bid_defaulted",
            message: "ESPN did not provide a minimum bid, so the review uses ESPN's $1 minimum.",
          }]
        : [],
    };
  }

  if (draftType === "SNAKE") {
    const rounds = optionalPositiveInteger(draftSettings.rounds, "settings.draftSettings.rounds");

    return {
      draft: {
        type: "snake",
        rounds: rounds ?? rosterSlotCount,
        order: [...pickOrder],
      },
      warnings: rounds === null
        ? [{
            code: "rounds_derived_from_roster",
            message: `ESPN did not provide snake rounds, so the review uses the ${rosterSlotCount} imported roster slots.`,
          }]
        : [],
    };
  }

  throw new Error(`Unsupported ESPN draft type "${draftType ?? "unknown"}".`);
};

const reviewFor = (
  bodyValue: unknown,
  leagueId: string,
  season: number,
): EspnLeagueSettingsReviewOutcome => {
  const body = requiredObject(bodyValue, "response body");
  const settings = requiredObject(body.settings, "settings");
  const draftSettings = requiredObject(settings.draftSettings, "settings.draftSettings");
  const scoringSettings = requiredObject(settings.scoringSettings, "settings.scoringSettings");
  const rosterSettings = requiredObject(settings.rosterSettings, "settings.rosterSettings");
  const pickOrder = pickOrderFor(draftSettings);
  const teams = teamsFor(body, pickOrder);
  const rosterSlots = rosterSlotsFor(rosterSettings);
  const rosterSlotCount = analyzeRosterSlots(rosterSlots).draftCapacity;
  const draft = draftFor(draftSettings, pickOrder, rosterSlotCount);

  return {
    kind: "review",
    provider: "espn",
    confirmationRequired: true,
    review: {
      externalLeagueId: leagueId,
      season,
      leagueName: normalizedString(settings.name),
      teamCount: positiveInteger(settings.size) ?? teams.length,
      draft: draft.draft,
      scoring: {
        pointsPerPassingYard: scoringPointsFor(scoringSettings, passingYardStatId, "passing yard points"),
        pointsPerPassingTouchdown: scoringPointsFor(
          scoringSettings,
          passingTouchdownStatId,
          "passing touchdown points",
        ),
        pointsPerRushingYard: scoringPointsFor(scoringSettings, rushingYardStatId, "rushing yard points"),
        pointsPerRushingTouchdown: scoringPointsFor(
          scoringSettings,
          rushingTouchdownStatId,
          "rushing touchdown points",
        ),
        pointsPerReceivingYard: scoringPointsFor(
          scoringSettings,
          receivingYardStatId,
          "receiving yard points",
        ),
        pointsPerReceivingTouchdown: scoringPointsFor(
          scoringSettings,
          receivingTouchdownStatId,
          "receiving touchdown points",
        ),
        pointsPerReception: scoringPointsFor(scoringSettings, receptionStatId, "reception points"),
      },
      rosterSlots,
      teams,
    },
    warnings: draft.warnings,
  };
};

export const importEspnLeagueSettings = async (
  input: EspnLeagueSettingsImportInput,
  transport: EspnLeagueSettingsHttpTransport,
): Promise<EspnLeagueSettingsImportOutcome> => {
  const leagueId = leagueIdFor(input.leagueIdOrUrl);
  const response = await transport({
    method: "GET",
    url: requestUrlFor(leagueId, input.season),
  });

  if (response.code === 401 || response.code === 403) {
    return {
      kind: "manual-review-required",
      provider: "espn",
      confirmationRequired: true,
      reason: "private_or_unauthorized",
      externalLeagueId: leagueId,
      season: input.season,
      confirmationMethods: ["screenshot", "manual"],
      message: "This ESPN league is private. Confirm its settings from screenshots or enter them manually.",
    };
  }

  try {
    return reviewFor(response.body, leagueId, input.season);
  } catch (error) {
    if (error instanceof LeagueCreationError) {
      return {
        kind: "manual-review-required",
        provider: "espn",
        confirmationRequired: true,
        reason: "settings_need_review",
        externalLeagueId: leagueId,
        season: input.season,
        confirmationMethods: ["screenshot", "manual"],
        message: error.message,
      };
    }
    throw error;
  }
};
