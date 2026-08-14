import { z } from "zod";
import { auctionPlayerSchema, auctionTeamSchema } from "./auctionBoardSchemas.js";

export const auctionCommandSchema = z.discriminatedUnion("type", [
  z.object({ expectedRevision: z.number().int(), type: z.literal("start") }),
  z.object({
    expectedRevision: z.number().int(),
    openingBid: z.number().int().positive().optional(),
    playerId: z.string().min(1),
    type: z.literal("nominate"),
  }),
  z.object({
    expectedRevision: z.number().int(),
    price: z.number().int().positive(),
    type: z.literal("buy"),
  }),
  z.object({ expectedRevision: z.number().int(), type: z.literal("pass") }),
  z.object({ expectedRevision: z.number().int(), type: z.literal("undo") }),
  z.object({ expectedRevision: z.number().int(), type: z.literal("complete") }),
]);

export const auctionEventSchema = z.object({
  countdown: z.number().int().positive().optional(),
  nominationNumber: z.number().int().positive(),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  price: z.number().int().nonnegative().optional(),
  sequence: z.number().int().positive(),
  teamId: z.string().min(1).optional(),
  teamName: z.string().min(1).optional(),
  text: z.string(),
  type: z.enum(["nomination", "bid", "countdown", "sold"]),
});

const nominationSchema = z.object({
  currentPrice: z.number().int().nonnegative(),
  expectedPrice: z.number().nonnegative(),
  highestBidderTeamId: z.string().min(1),
  highestBidderTeamName: z.string().min(1),
  humanCanBuy: z.boolean(),
  humanCanPass: z.boolean(),
  humanPassed: z.boolean(),
  nextBid: z.number().int().positive(),
  nominatedByTeamId: z.string().min(1),
  nominatedByTeamName: z.string().min(1),
  number: z.number().int().positive(),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  position: z.string().min(1),
});

export const auctionStateSchema = z.object({
  auctionEvents: z.array(auctionEventSchema),
  board: z.object({ players: z.array(auctionPlayerSchema) }),
  configuration: z.object({
    budgetDollars: z.number().int().positive(),
    humanTeamId: z.string().min(1),
    minimumBidDollars: z.number().int().positive(),
    positionMaximums: z.record(z.string(), z.number().int().nonnegative()),
  }),
  sales: z.array(z.object({
    number: z.number().int().positive(),
    playerName: z.string().min(1),
    price: z.number().int().nonnegative(),
    teamName: z.string().min(1),
  })),
  session: z.object({
    canComplete: z.boolean(),
    canUndo: z.boolean(),
    currentNomination: nominationSchema.optional(),
    humanTeamId: z.string().min(1),
    id: z.string().min(1),
    nominationsCompleted: z.number().int().nonnegative(),
    phase: z.enum([
      "not_started",
      "awaiting_human_nomination",
      "awaiting_human_bid",
      "ready_to_complete",
      "completed",
    ]),
    revision: z.number().int().nonnegative(),
    status: z.enum(["setup", "active", "completed"]),
  }),
  teams: z.array(auctionTeamSchema),
});

export type AuctionCommand = z.infer<typeof auctionCommandSchema>;
export type AuctionEvent = z.infer<typeof auctionEventSchema>;
export type AuctionNomination = z.infer<typeof nominationSchema>;
export type AuctionState = z.infer<typeof auctionStateSchema>;
