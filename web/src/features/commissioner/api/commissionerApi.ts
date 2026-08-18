import { z } from "zod";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import {
  historicalCommitResponseSchema,
  historicalImportListResponseSchema,
  historicalPreviewResponseSchema,
  setupApplyResponseSchema,
  setupPreviewResponseSchema,
} from "./importSchemas";
import { seasonResponseSchema, seasonSchema } from "./seasonSchemas";
import {
  invitationMutationResponseSchema,
  invitationsResponseSchema,
  keeperMutationResponseSchema,
  keepersResponseSchema,
  okResponseSchema,
  roomResponseSchema,
} from "./workspaceSchemas";

const jsonRequest = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const seasonPath = (seasonId: string, suffix = ""): string =>
  `/seasons/${encodeURIComponent(seasonId)}${suffix}`;

export const commissionerApi = {
  season: async (seasonId: string) => await requestPlatformJson({
    path: seasonPath(seasonId),
    responseSchema: seasonResponseSchema,
  }),
  keepers: async (seasonId: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/keepers"),
    responseSchema: keepersResponseSchema,
  }),
  addKeeper: async (seasonId: string, command: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/keepers/apply"),
    init: jsonRequest("POST", { command, confirmed: true }),
    responseSchema: keeperMutationResponseSchema,
  }),
  removeKeeper: async (seasonId: string, teamId: string, playerId: string) =>
    await requestPlatformJson({
      path: seasonPath(seasonId, "/keepers"),
      init: jsonRequest("DELETE", { teamId, playerId }),
      responseSchema: keeperMutationResponseSchema,
    }),
  invitations: async (seasonId: string) => await requestPlatformJson({
    path: `/invitations?seasonId=${encodeURIComponent(seasonId)}`,
    responseSchema: invitationsResponseSchema,
  }),
  createInvitation: async (seasonId: string) => await requestPlatformJson({
    path: "/invitations",
    init: jsonRequest("POST", { seasonId }),
    responseSchema: invitationMutationResponseSchema,
  }),
  previewTeams: async (seasonId: string, content: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/setup-import/preview"),
    init: jsonRequest("POST", { content }),
    responseSchema: setupPreviewResponseSchema,
  }),
  applyTeams: async (seasonId: string, content: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/setup-import/apply"),
    init: jsonRequest("POST", { content }),
    responseSchema: setupApplyResponseSchema,
  }),
  publish: async (seasonId: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/publish"),
    init: jsonRequest("POST", { confirmed: true }),
    responseSchema: z.object({ season: seasonSchema }),
  }),
  createRoom: async (seasonId: string, startsAt?: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/live-room"),
    init: jsonRequest("POST", startsAt === undefined ? {} : { startsAt }),
    responseSchema: roomResponseSchema,
  }),
  archiveRoom: async (seasonId: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/live-room"),
    init: jsonRequest("DELETE"),
    responseSchema: okResponseSchema,
  }),
  historicalImports: async (seasonId: string) => await requestPlatformJson({
    path: seasonPath(seasonId, "/historical-imports"),
    responseSchema: historicalImportListResponseSchema,
  }),
  previewHistory: async (input: HistoricalUploadInput) => await requestPlatformJson({
    path: seasonPath(input.seasonId, "/historical-imports/upload-preview"),
    init: jsonRequest("POST", input),
    responseSchema: historicalPreviewResponseSchema,
  }),
  commitHistory: async (batchId: string, seasonId: string, seasonYear: number) =>
    await requestPlatformJson({
      path: `/historical-imports/${encodeURIComponent(batchId)}/commit`,
      init: jsonRequest("POST", { seasonId, seasonYear }),
      responseSchema: historicalCommitResponseSchema,
    }),
};

export interface HistoricalUploadInput {
  readonly base64: string;
  readonly fileName: string;
  readonly inferFirstRosterRowAsKeeper: boolean;
  readonly mimeType: string;
  readonly ownerMappings: readonly { sourceOwnerOrTeamLabel: string; teamId: string }[];
  readonly replacementRequested: boolean;
  readonly seasonId: string;
  readonly seasonYear: number;
}
