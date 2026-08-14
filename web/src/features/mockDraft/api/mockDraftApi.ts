import type { PlatformFetch } from "../../../shared/api/http/requestPlatformJson";
import { requestPlatformJson } from "../../../shared/api/http/requestPlatformJson";
import type { AuctionCommand } from "./auctionStateSchemas.js";
import {
  abandonedMockResponseSchema,
  auctionMockResponseSchema,
} from "./mockDraftSchemas.js";

interface CreateAuctionMockInput {
  readonly seasonId: string;
  readonly strategy: string;
}

interface SessionInput {
  readonly signal?: AbortSignal;
  readonly seasonId: string;
  readonly sessionId: string;
}

interface SendCommandInput extends SessionInput {
  readonly command: AuctionCommand;
}

interface AbandonInput extends SessionInput {
  readonly expectedRevision: number;
}

const jsonRequest = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

export const createAuctionMock = (
  input: CreateAuctionMockInput,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  fetcher,
  init: jsonRequest(input),
  path: "/season-mock-drafts",
  responseSchema: auctionMockResponseSchema,
});

export const loadAuctionMock = (
  input: SessionInput,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  fetcher,
  init: { method: "GET", ...(input.signal === undefined ? {} : { signal: input.signal }) },
  path: `/season-mock-drafts/${encodeURIComponent(input.sessionId)}?seasonId=${encodeURIComponent(input.seasonId)}`,
  responseSchema: auctionMockResponseSchema,
});

export const sendAuctionMockCommand = (
  input: SendCommandInput,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  fetcher,
  init: jsonRequest({
    command: input.command,
    commandId: `${input.command.type}:${crypto.randomUUID()}`,
    seasonId: input.seasonId,
  }),
  path: `/season-mock-drafts/${encodeURIComponent(input.sessionId)}/commands`,
  responseSchema: auctionMockResponseSchema,
});

export const abandonAuctionMock = (
  input: AbandonInput,
  fetcher: PlatformFetch = fetch,
) => requestPlatformJson({
  fetcher,
  init: jsonRequest({
    expectedRevision: input.expectedRevision,
    seasonId: input.seasonId,
  }),
  path: `/season-mock-drafts/${encodeURIComponent(input.sessionId)}/abandon`,
  responseSchema: abandonedMockResponseSchema,
});
