import { z } from "zod";

export const auctionPlayerSchema = z.object({
  available: z.boolean(),
  byeWeek: z.number().int().optional(),
  expectedPrice: z.number().nonnegative(),
  humanValue: z.number().nonnegative().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.string().min(1),
  status: z.enum(["available", "nominated", "sold"]),
  teamAbbreviation: z.string().min(1).optional(),
  week1Projection: z.number().nonnegative().optional(),
});

export const rosterPlayerSchema = z.object({
  expectedPrice: z.number().nonnegative(),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  position: z.string().min(1),
  price: z.number().int().nonnegative(),
  rosterSlot: z.string().min(1),
  source: z.enum(["keeper", "human", "ai"]),
});

export const rosterSlotSchema = z.object({
  eligiblePositions: z.array(z.string().min(1)),
  playerId: z.string().min(1).optional(),
  slot: z.string().min(1),
});

export const auctionTeamSchema = z.object({
  budgetDollars: z.number().int().nonnegative(),
  budgetRemaining: z.number().int().nonnegative(),
  id: z.string().min(1),
  isHuman: z.boolean(),
  maxBid: z.number().int().nonnegative(),
  name: z.string().min(1),
  positionCounts: z.record(z.string(), z.number().int().nonnegative()),
  roster: z.array(rosterPlayerSchema),
  rosterSlotsRemaining: z.number().int().nonnegative(),
  slots: z.array(rosterSlotSchema),
  spent: z.number().int().nonnegative(),
});

export type AuctionPlayer = z.infer<typeof auctionPlayerSchema>;
export type AuctionTeam = z.infer<typeof auctionTeamSchema>;
export type RosterPlayer = z.infer<typeof rosterPlayerSchema>;
