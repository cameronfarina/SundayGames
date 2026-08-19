import { z } from "zod";

const sourceModeSchema = z.enum(["all", "local", "rotowire-rss"]);
const auctionSchema = z.object({
  status: z.enum(["available", "drafted", "keeper", "unavailable"]),
  expectedPrice: z.number().optional(),
  liveExpectedPrice: z.number().optional(),
  personalValue: z.number().optional(),
  recommendedMaxBid: z.number().optional(),
  valueScore: z.number().optional(),
  tags: z.array(z.string()),
});

export const playerNewsFeedSchema = z.object({
  sourceMode: sourceModeSchema,
  generatedAt: z.string(),
  summary: z.object({
    totalCount: z.number().int().nonnegative(),
    filteredCount: z.number().int().nonnegative(),
    moveUpCount: z.number().int().nonnegative(),
    watchCount: z.number().int().nonnegative(),
    fadeCount: z.number().int().nonnegative(),
    noChangeCount: z.number().int().nonnegative(),
  }),
  providers: z.array(z.object({
    key: z.string(),
    label: z.string(),
    status: z.enum(["active", "available", "candidate"]),
    detail: z.string(),
  })),
  items: z.array(z.object({
    id: z.string(),
    providerItemId: z.string(),
    player: z.string(),
    normalizedPlayerName: z.string(),
    position: z.string().optional(),
    teamAbbreviation: z.string().optional(),
    category: z.string(),
    categories: z.array(z.string()).optional(),
    headline: z.string(),
    fantasyImpact: z.string(),
    analystImpact: z.string().optional(),
    sourceDate: z.string().optional(),
    fetchedAt: z.string().optional(),
    source: z.object({
      provider: z.string(),
      url: z.string().optional(),
      quality: z.string().optional(),
    }),
    draftAction: z.enum(["Move up", "Watch", "Fade", "No model change"]),
    impactScore: z.number(),
    auction: auctionSchema,
    availability: z.object({ status: auctionSchema.shape.status, detail: z.string() }),
  })),
});

export type PlayerNewsFeed = z.output<typeof playerNewsFeedSchema>;
export type PlayerNewsItem = PlayerNewsFeed["items"][number];
export type PlayerNewsSource = z.output<typeof sourceModeSchema>;
