import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  CreateLiveDraftServerOptions,
  LiveDraftServerApp,
} from "../../liveDraftServer.js";
import type { MockBatchResourceLimits } from "../../mockBatchResourceManager.js";

type MaybePromise<T> = T | Promise<T>;

export interface PlatformDraftToolsAccount {
  id: string;
}

export type PlatformDraftToolsAccountResolver = (
  request: IncomingMessage,
) => MaybePromise<PlatformDraftToolsAccount | null>;

export type PlatformDraftToolsSeasonAuthorizer = (
  account: PlatformDraftToolsAccount,
  seasonId: string,
  request: IncomingMessage,
) => MaybePromise<boolean>;

export type PlatformDraftToolsServerFactory = (
  options: CreateLiveDraftServerOptions,
) => Promise<LiveDraftServerApp>;

export type PlatformDraftToolsSeasonOptionsResolver = (
  seasonId: string,
) => MaybePromise<CreateLiveDraftServerOptions | null>;

export interface CreatePlatformDraftToolsAdapterOptions {
  authorizeSeason: PlatformDraftToolsSeasonAuthorizer;
  baseSessionDirectory: string;
  resolveAccount: PlatformDraftToolsAccountResolver;
  createLiveDraftServer?: PlatformDraftToolsServerFactory | undefined;
  idleTimeoutMs?: number | undefined;
  importMaxBodyBytes?: number | undefined;
  legacyMockBatchEnabled?: boolean | undefined;
  maxBodyBytes?: number | undefined;
  maxRetainedApps?: number | undefined;
  mockBatchResourceLimits?: MockBatchResourceLimits | undefined;
  now?: (() => number) | undefined;
  resolveSeasonOptions?: PlatformDraftToolsSeasonOptionsResolver | undefined;
}

export interface PlatformDraftToolsAdapter {
  (request: IncomingMessage, response: ServerResponse): Promise<boolean>;
  clearAccount(accountId: string): Promise<void>;
  close(): Promise<void>;
}
