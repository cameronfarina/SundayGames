import type { Owner, Position } from "../../../../config/league.js";
import type { Player } from "../../../types.js";

export type PositionAmounts = Record<Position, number>;

export type InitialRostersByOwner = Partial<Record<Owner, readonly Player[]>>;

export type AuctionDiagnosticsMode = "full" | "summary";
