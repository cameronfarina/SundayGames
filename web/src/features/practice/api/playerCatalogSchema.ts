import { z } from "zod";

export const practicePlayerSchema = z.object({
  byeWeek: z.number().int().optional(),
  expectedPrice: z.number().nonnegative(),
  isKeeper: z.boolean().optional(),
  keeperPrice: z.number().nonnegative().optional(),
  keeperRound: z.number().int().positive().optional(),
  keeperTeamId: z.string().optional(),
  leagueRank: z.number().int().positive().optional(),
  leagueValue: z.number().nonnegative().optional(),
  marketPrice: z.number().nonnegative().optional(),
  marketRank: z.number().int().positive().optional(),
  myValue: z.number().nonnegative().optional(),
  name: z.string().min(1),
  position: z.string().min(1),
  pricingWarnings: z.array(z.string()).optional(),
  recommendedMaxBid: z.number().nonnegative().optional(),
  seasonProjection: z.number().optional(),
  teamAbbreviation: z.string().optional(),
  week1Projection: z.number().optional(),
  weeks1To4Projection: z.number().optional(),
});

export const playerCatalogSchema = z.object({
  draftFormat: z.enum(["auction", "snake"]).optional(),
  flexPositions: z.array(z.string()).optional(),
  personalized: z.boolean().optional(),
  players: z.array(practicePlayerSchema),
  pricingModelRunId: z.string().optional(),
  strategyKey: z.string().optional(),
  strategyLabel: z.string().optional(),
});

export type PlayerCatalog = z.infer<typeof playerCatalogSchema>;
export type PracticePlayer = z.infer<typeof practicePlayerSchema>;
