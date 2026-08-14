import type { LiveDraftServerApp } from "../../../liveDraftServer.js";

export interface RetainedDraftToolsApp {
  accountId: string;
  activeRequests: number;
  appPromise: Promise<LiveDraftServerApp>;
  key: string;
  lastUsedAt: number;
}

export interface AcquiredDraftToolsApp {
  app: LiveDraftServerApp;
  entry: RetainedDraftToolsApp;
}
