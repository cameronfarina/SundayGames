import type { Position } from "../../../config/league.js";
import type { HistoricalAcquisitionType } from "./saleContracts.js";

export interface HistoricalImportPlayerCatalogEntry {
  playerId?: string;
  name: string;
  position: Position | string;
  aliases?: readonly string[];
}

export interface HistoricalPlayerResolutionCandidate {
  playerId: string;
  playerName: string;
  position: string;
}

export interface HistoricalOwnerResolutionCandidate {
  teamId: string;
  teamDisplayName: string;
  ownerDisplayName: string;
}

export type HistoricalImportReviewCandidate =
  | HistoricalPlayerResolutionCandidate
  | HistoricalOwnerResolutionCandidate;

export type PlayerResolution =
  | {
      status: "resolved";
      playerId: string;
      playerName?: string;
      position?: string;
    }
  | {
      status: "unresolved";
      required: true;
      candidates?: readonly (HistoricalPlayerResolutionCandidate | string)[];
    }
  | {
      status: "ambiguous";
      required: true;
      candidates: readonly HistoricalPlayerResolutionCandidate[];
    };

export interface NormalizedHistoricalImportRow {
  sourceRowNumber: number;
  seasonYear?: number;
  ownerDisplayName?: string;
  playerName?: string;
  playerId?: string;
  position?: string;
  priceDollars?: number;
  publicPriceDollars?: number;
  playerResolution?: PlayerResolution;
  keeper?: boolean;
  acquisitionType?: HistoricalAcquisitionType;
}

export interface ResolveHistoricalImportPlayersInput {
  rows: readonly NormalizedHistoricalImportRow[];
  playerCatalog: readonly HistoricalImportPlayerCatalogEntry[];
}
