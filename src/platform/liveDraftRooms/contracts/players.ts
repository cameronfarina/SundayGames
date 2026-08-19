import type { Position } from "../../../../config/league.js";
import type { LiveDraftRoomStatus } from "./core.js";

export interface ParsedLiveDraftRoomSaleInput {
  ownerText?: string | undefined;
  ownerId?: string | undefined;
  teamId?: string | undefined;
  teamName?: string | undefined;
  playerName: string;
  price: number;
}

export type LiveDraftRoomSaleCommandInput = string | ParsedLiveDraftRoomSaleInput;

export interface ParsedLiveDraftRoomPickInput {
  playerName: string;
}

export type LiveDraftRoomPickCommandInput = string | ParsedLiveDraftRoomPickInput;

export interface LiveDraftRoomSale {
  saleEventId: string;
  input: string;
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomPickSelection {
  pickEventId: string;
  input: string;
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName: string;
  normalizedPlayerName: string;
  position: Position;
  expectedPrice: number;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomRosterPlayer {
  name: string;
  normalizedPlayerName: string;
  position: Position;
  price: number;
  expectedPrice: number;
  source: "keeper" | "imported" | "sale" | "pick";
  saleEventId?: string | undefined;
  pickEventId?: string | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomRosterSlot {
  slot: string;
  player?: LiveDraftRoomRosterPlayer | undefined;
}

export interface LiveDraftRoomTeamState {
  teamId: string;
  ownerId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  draftOrderPosition: number;
  rosterSlotsRemaining: number;
  positionCounts: Record<Position, number>;
  roster: readonly LiveDraftRoomRosterPlayer[];
  slots: readonly LiveDraftRoomRosterSlot[];
  budgetDollars?: number | undefined;
  spent?: number | undefined;
  budgetRemaining?: number | undefined;
  maxBid?: number | undefined;
}

export interface LiveDraftRoomBoardPlayer {
  name: string;
  normalizedPlayerName: string;
  position: Position;
  expectedPrice: number;
  marketPrice?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
}

export interface LiveDraftRoomPick {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  playerName?: string | undefined;
  source?: "keeper" | "imported" | "pick" | undefined;
  pickEventId?: string | undefined;
}

export interface LiveDraftRoomProjection {
  roomId: string;
  leagueId: string;
  seasonId: string;
  status: LiveDraftRoomStatus;
  revision: number;
  updatedAt: Date;
  teams: readonly LiveDraftRoomTeamState[];
  board: readonly LiveDraftRoomBoardPlayer[];
  sales: readonly LiveDraftRoomSale[];
  picks?: readonly LiveDraftRoomPick[] | undefined;
  onTheClock?: LiveDraftRoomPick | undefined;
}

export interface LiveDraftRoomIncompleteTeam {
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  openRosterSlots: number;
}
