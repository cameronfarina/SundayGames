import { z } from "zod";
import { auctionStateSchema } from "./auctionStateSchemas.js";

export const mockSessionSchema = z.object({
  draftMode: z.object({ format: z.literal("auction") }),
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  seasonId: z.string().min(1),
  status: z.enum(["setup", "active", "completed", "abandoned"]),
  teamId: z.string().min(1),
});

export const resultPlayerSchema = z.object({
  overallPick: z.number().int().positive().optional(),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
  position: z.string().min(1),
  price: z.number().int().nonnegative().optional(),
  rosterSlot: z.string().min(1),
  source: z.enum(["keeper", "human", "ai"]),
  starter: z.boolean(),
  week1Points: z.number().nonnegative(),
});

export const resultTeamSchema = z.object({
  budgetRemaining: z.number().int().nonnegative().optional(),
  isUserTeam: z.boolean(),
  rank: z.number().int().positive(),
  roster: z.array(resultPlayerSchema),
  spent: z.number().int().nonnegative().optional(),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
  week1Points: z.number().nonnegative(),
});

export const mockResultsSchema = z.object({
  projectedPlayerCount: z.number().int().nonnegative(),
  rosteredPlayerCount: z.number().int().nonnegative(),
  teams: z.array(resultTeamSchema),
});

export const auctionMockResponseSchema = z.object({
  mockSession: mockSessionSchema,
  results: mockResultsSchema.optional(),
  state: auctionStateSchema,
});

export const abandonedMockResponseSchema = z.object({
  mockSession: mockSessionSchema,
});

export type AuctionMockResponse = z.infer<typeof auctionMockResponseSchema>;
export type MockResults = z.infer<typeof mockResultsSchema>;
export type MockResultTeam = z.infer<typeof resultTeamSchema>;
