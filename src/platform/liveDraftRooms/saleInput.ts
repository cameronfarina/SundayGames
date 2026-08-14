import { cleanPlayerName } from "../../data/normalizePlayerName.js";
import { parseLiveDraftSaleCommand } from "../../modeling/liveDraft.js";
import type {
  LiveDraftRoomSaleCommandInput,
  ParsedLiveDraftRoomSaleInput,
} from "./contracts/players.js";
import { assertPositiveWholeDollar } from "./common.js";
import { LiveDraftRoomError } from "./error.js";

export const parseSaleInput = (
  sale: LiveDraftRoomSaleCommandInput,
): ParsedLiveDraftRoomSaleInput => {
  if (typeof sale === "string") {
    try {
      const parsed = parseLiveDraftSaleCommand(sale);
      return {
        ownerText: parsed.ownerText,
        playerName: parsed.playerText,
        price: parsed.price,
      };
    } catch (error) {
      throw new LiveDraftRoomError(
        "player_not_found",
        error instanceof Error ? error.message : "Could not parse live draft sale command.",
      );
    }
  }

  const playerName = cleanPlayerName(sale.playerName);
  assertPositiveWholeDollar(
    sale.price,
    `Sale price must be a positive whole-dollar amount for ${playerName}.`,
  );
  return {
    ...(sale.ownerText === undefined ? {} : { ownerText: sale.ownerText }),
    ...(sale.ownerId === undefined ? {} : { ownerId: sale.ownerId }),
    ...(sale.teamId === undefined ? {} : { teamId: sale.teamId }),
    ...(sale.teamName === undefined ? {} : { teamName: sale.teamName }),
    playerName,
    price: sale.price,
  };
};

export const sourceInputLabelFor = (sale: LiveDraftRoomSaleCommandInput): string =>
  typeof sale === "string"
    ? sale
    : [
      sale.ownerText ?? sale.teamName ?? sale.teamId ?? sale.ownerId ?? "unknown",
      sale.playerName,
      String(sale.price),
    ].join(" ");
