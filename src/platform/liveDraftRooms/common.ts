import type { Position } from "../../../config/league.js";
import { cleanPlayerName, normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomEvent } from "./contracts/events.js";
import { LiveDraftRoomError } from "./error.js";

const positions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const isPosition = (value: unknown): value is Position =>
  typeof value === "string" && positions.some(position => position === value);

export const searchKeyFor = (value: string): string =>
  normalizePlayerName(cleanPlayerName(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

export const assertPositiveWholeDollar = (price: number, message: string): void => {
  if (!Number.isInteger(price) || price < 1) {
    throw new LiveDraftRoomError("invalid_sale_price", message);
  }
};

export const eventIdFor = (
  roomId: string,
  revision: number,
  type: LiveDraftRoomEvent["type"],
): string => `${roomId}-rev-${revision}-${type}`;

export const pluralPosition = (position: Position): string => `${position}s`;
