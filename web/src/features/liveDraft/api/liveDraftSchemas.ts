import { z } from "zod";
import { liveDraftPickSchema } from "./pickSchema";

export const liveDraftPositionSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DST"]);

export const liveDraftBoardPlayerSchema = z.object({
  name: z.string().min(1),
  normalizedPlayerName: z.string().min(1),
  position: liveDraftPositionSchema,
  expectedPrice: z.number().nonnegative(),
  marketPrice: z.number().nonnegative().optional(),
  teamAbbreviation: z.string().min(1).optional(),
  byeWeek: z.number().int().positive().optional(),
});

const rosterPlayerSchema = z.object({
  name: z.string().min(1),
  normalizedPlayerName: z.string().min(1),
  position: liveDraftPositionSchema,
  price: z.number().int().nonnegative().optional(),
  expectedPrice: z.number().nonnegative(),
  source: z.enum(["keeper", "imported", "sale"]),
  saleEventId: z.string().min(1).optional(),
  teamAbbreviation: z.string().min(1).optional(),
  byeWeek: z.number().int().positive().optional(),
});

const rosterSlotSchema = z.object({
  slot: z.string().min(1),
  player: rosterPlayerSchema.optional(),
});

export const liveDraftTeamSchema = z.object({
  teamId: z.string().min(1),
  ownerId: z.string().min(1),
  ownerDisplayName: z.string().min(1),
  teamDisplayName: z.string().min(1),
  draftOrderPosition: z.number().int().positive(),
  rosterSlotsRemaining: z.number().int().nonnegative(),
  budgetDollars: z.number().int().nonnegative().optional(),
  spent: z.number().int().nonnegative().optional(),
  budgetRemaining: z.number().int().optional(),
  maxBid: z.number().int().nonnegative().optional(),
  positionCounts: z.record(z.string(), z.number().int().nonnegative()),
  roster: z.array(rosterPlayerSchema),
  slots: z.array(rosterSlotSchema),
});

export const liveDraftSaleSchema = z.object({
  saleEventId: z.string().min(1),
  revision: z.number().int().positive(),
  occurredAt: z.string().min(1),
  teamId: z.string().min(1),
  ownerId: z.string().min(1),
  ownerDisplayName: z.string().min(1),
  teamDisplayName: z.string().min(1),
  playerName: z.string().min(1),
  position: liveDraftPositionSchema,
  price: z.number().int().nonnegative().optional(),
  expectedPrice: z.number().nonnegative(),
  teamAbbreviation: z.string().min(1).optional(),
  byeWeek: z.number().int().positive().optional(),
});

export const liveDraftRoomSchema = z.object({
  roomId: z.string().min(1),
  leagueId: z.string().min(1),
  seasonId: z.string().min(1),
  status: z.enum(["setup", "countdown", "live", "paused", "ended"]),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().min(1),
  role: z.enum(["commissioner", "member", "observer"]),
  canMutateRoom: z.boolean(),
  canLogPick: z.boolean().default(false),
  canExportDraft: z.boolean(),
  board: z.array(liveDraftBoardPlayerSchema),
  picks: z.array(liveDraftPickSchema).optional(),
  onTheClock: liveDraftPickSchema.optional(),
  selectedTeam: liveDraftTeamSchema.optional(),
  viewedTeam: liveDraftTeamSchema.optional(),
  teamSummaries: z.array(liveDraftTeamSchema),
  salesLog: z.array(liveDraftSaleSchema),
  connection: z.object({
    state: z.literal("synchronized"),
    transport: z.literal("sse"),
    cursor: z.string().min(1),
    revision: z.number().int().nonnegative(),
    retryMilliseconds: z.number().int().positive(),
    pollingFallback: z.literal(true),
  }),
  exportReadiness: z.object({
    status: z.enum(["pending", "ready", "blocked"]),
    completedRevision: z.number().int().nonnegative().optional(),
    blockers: z.array(z.string()),
  }),
});

export const liveDraftRoomResponseSchema = z.object({ room: liveDraftRoomSchema });

const eventEnvelopeSchema = z.object({
  id: z.string().optional(),
  event: z.enum([
    "room.snapshot",
    "room.sale",
    "room.started",
    "room.paused",
    "room.resumed",
    "room.ended",
    "room.error",
  ]),
  revision: z.number().int().nonnegative(),
});

export const liveDraftEventsResponseSchema = z.object({
  events: z.object({
    currentRevision: z.number().int().nonnegative(),
    isStale: z.boolean(),
    requiresSnapshot: z.boolean(),
    events: z.array(eventEnvelopeSchema),
  }),
});

export const liveDraftExportSchema = z.object({
  artifact: z.object({
    id: z.string().min(1),
    leagueId: z.string().min(1),
    seasonId: z.string().min(1),
    roomId: z.string().min(1),
    format: z.literal("csv"),
    sourceRevision: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
    storageKey: z.string().min(1),
    sha256: z.string().min(1),
    byteLength: z.number().int().nonnegative(),
    contentType: z.string().min(1),
  }),
  content: z.string(),
});

export type LiveDraftBoardPlayer = z.infer<typeof liveDraftBoardPlayerSchema>;
export type LiveDraftExport = z.infer<typeof liveDraftExportSchema>;
export type LiveDraftRoom = z.infer<typeof liveDraftRoomSchema>;
export type LiveDraftSale = z.infer<typeof liveDraftSaleSchema>;
export type LiveDraftTeam = z.infer<typeof liveDraftTeamSchema>;
export { liveDraftPickSchema } from "./pickSchema";
export type { LiveDraftPick } from "./pickSchema";
