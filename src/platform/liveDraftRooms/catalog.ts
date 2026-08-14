import {
  canonicalPlayerIdentityKey,
  cleanPlayerName,
  normalizePlayerName,
} from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "./contracts/core.js";
import type { LiveDraftRoomBoardPlayer } from "./contracts/players.js";
import { isPosition } from "./common.js";
import { LiveDraftRoomError } from "./error.js";

const teamAbbreviationPattern = /^[A-Z]{2,3}$/;
const minimumByeWeek = 1;
const maximumByeWeek = 18;

const assertMarketPrice = (name: string, marketPrice: unknown): void => {
  if (
    marketPrice !== undefined
    && (typeof marketPrice !== "number"
      || !Number.isFinite(marketPrice)
      || !Number.isInteger(marketPrice)
      || marketPrice < 1)
  ) {
    throw new LiveDraftRoomError(
      "invalid_sale_price",
      `Player catalog entry "${name}" must have a market price of at least $1 in whole dollars.`,
    );
  }
};

const assertTeamAbbreviation = (name: string, abbreviation: unknown): void => {
  if (
    abbreviation !== undefined
    && (typeof abbreviation !== "string" || !teamAbbreviationPattern.test(abbreviation))
  ) {
    throw new LiveDraftRoomError(
      "player_not_found",
      `Player catalog entry "${name}" must use a 2-3 letter uppercase team abbreviation.`,
    );
  }
};

const assertByeWeek = (name: string, byeWeek: unknown): void => {
  if (
    byeWeek !== undefined
    && (typeof byeWeek !== "number"
      || !Number.isFinite(byeWeek)
      || !Number.isInteger(byeWeek)
      || byeWeek < minimumByeWeek
      || byeWeek > maximumByeWeek)
  ) {
    throw new LiveDraftRoomError(
      "player_not_found",
      `Player catalog entry "${name}" must use a whole-number bye week from ${minimumByeWeek} through ${maximumByeWeek}.`,
    );
  }
};

export const normalizeCatalog = (
  catalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): readonly LiveDraftRoomBoardPlayer[] => {
  if (catalog.length === 0) {
    throw new LiveDraftRoomError("player_not_found", "Player catalog must contain at least one player.");
  }

  const playerIdentities = new Set<string>();
  return catalog.map((player, index) => {
    const rawName: unknown = player.name;
    if (typeof rawName !== "string" || cleanPlayerName(rawName).length === 0) {
      throw new LiveDraftRoomError(
        "player_not_found",
        `Player catalog entry ${index + 1} must include a non-blank player name.`,
      );
    }

    const name = cleanPlayerName(rawName);
    const normalizedPlayerName = normalizePlayerName(name);
    const playerIdentity = canonicalPlayerIdentityKey(name);
    if (playerIdentities.has(playerIdentity)) {
      throw new LiveDraftRoomError(
        "duplicate_player",
        `Player catalog contains duplicate player "${normalizedPlayerName}".`,
      );
    }
    playerIdentities.add(playerIdentity);

    const rawPosition: unknown = player.position;
    if (!isPosition(rawPosition)) {
      throw new LiveDraftRoomError(
        "position_limit",
        `Player catalog entry "${name}" has unsupported position "${String(rawPosition)}".`,
      );
    }
    const expectedPrice: unknown = player.expectedPrice;
    if (typeof expectedPrice !== "number" || !Number.isFinite(expectedPrice)
      || !Number.isInteger(expectedPrice) || expectedPrice < 1) {
      throw new LiveDraftRoomError(
        "invalid_sale_price",
        `Player catalog entry "${name}" must have an expected price of at least $1 in whole dollars.`,
      );
    }

    const marketPrice: unknown = player.marketPrice;
    const teamAbbreviation: unknown = player.teamAbbreviation;
    const byeWeek: unknown = player.byeWeek;
    assertMarketPrice(name, marketPrice);
    assertTeamAbbreviation(name, teamAbbreviation);
    assertByeWeek(name, byeWeek);

    return {
      name,
      normalizedPlayerName,
      position: rawPosition,
      expectedPrice,
      ...(typeof marketPrice === "number" ? { marketPrice } : {}),
      ...(typeof teamAbbreviation === "string" ? { teamAbbreviation } : {}),
      ...(typeof byeWeek === "number" ? { byeWeek } : {}),
    };
  });
};
