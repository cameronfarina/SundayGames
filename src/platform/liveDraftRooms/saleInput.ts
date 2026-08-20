import { cleanPlayerName } from "../../data/normalizePlayerName.js";
import { parseLiveDraftSaleCommand } from "../../modeling/liveDraft.js";
import type {
  LiveDraftRoomSaleCommandInput,
  ParsedLiveDraftRoomSaleInput,
} from "./contracts/players.js";
import { assertPositiveWholeDollar } from "./common.js";
import { LiveDraftRoomError } from "./error.js";

const parsePriceLessPickCommand = (
  input: string,
): Pick<ParsedLiveDraftRoomSaleInput, "ownerText" | "playerName"> => {
  const cleaned = input.trim().replace(/\s+/gu, " ");
  const command = cleaned.replace(/\s+(?:for|at|@)\s+\$?\d+$/iu, "");
  const match = command.match(/^(.+?)\s+(?:drafted|picked|took)\s+(.+)$/iu);
  if (match === null) {
    throw new Error(`Could not parse live draft pick command: "${input}".`);
  }
  const [, ownerText = "", playerText = ""] = match;
  return { ownerText, playerName: cleanPlayerName(playerText) };
};

const parsePricedSaleCommand = (input: string): ParsedLiveDraftRoomSaleInput => {
  const parsed = parseLiveDraftSaleCommand(input);
  return {
    ownerText: parsed.ownerText,
    playerName: parsed.playerText,
    price: parsed.price,
  };
};

export const parseSaleInput = (
  sale: LiveDraftRoomSaleCommandInput,
  allowPriceLess = false,
): ParsedLiveDraftRoomSaleInput => {
  if (typeof sale === "string") {
    if (allowPriceLess) {
      try {
        return parsePriceLessPickCommand(sale);
      } catch (pickError) {
        try {
          return parsePricedSaleCommand(sale);
        } catch {
          throw new LiveDraftRoomError(
            "player_not_found",
            pickError instanceof Error
              ? pickError.message
              : "Could not parse live draft pick command.",
          );
        }
      }
    }
    try {
      return parsePricedSaleCommand(sale);
    } catch (error) {
      throw new LiveDraftRoomError(
        "player_not_found",
        error instanceof Error ? error.message : "Could not parse live draft sale command.",
      );
    }
  }

  const playerName = cleanPlayerName(sale.playerName);
  if (sale.price !== undefined) {
    assertPositiveWholeDollar(
      sale.price,
      `Sale price must be a positive whole-dollar amount for ${playerName}.`,
    );
  }
  return {
    ...(sale.ownerText === undefined ? {} : { ownerText: sale.ownerText }),
    ...(sale.ownerId === undefined ? {} : { ownerId: sale.ownerId }),
    ...(sale.teamId === undefined ? {} : { teamId: sale.teamId }),
    ...(sale.teamName === undefined ? {} : { teamName: sale.teamName }),
    playerName,
    ...(sale.price === undefined ? {} : { price: sale.price }),
  };
};

export const sourceInputLabelFor = (sale: LiveDraftRoomSaleCommandInput): string =>
  typeof sale === "string"
    ? sale
    : [
      sale.ownerText ?? sale.teamName ?? sale.teamId ?? sale.ownerId ?? "unknown",
      sale.playerName,
      String(sale.price ?? ""),
    ].join(" ");
