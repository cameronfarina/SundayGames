import type { RetainedDraftToolsApp } from "./contracts.js";

const canDispose = async (entry: RetainedDraftToolsApp): Promise<boolean> => {
  try {
    const app = await entry.appPromise;
    return app.canDispose?.() !== false;
  } catch {
    return true;
  }
};

export const disposableDraftToolsApps = async (
  entries: Iterable<RetainedDraftToolsApp>,
): Promise<RetainedDraftToolsApp[]> => {
  const idleEntries = [...entries]
    .filter(entry => entry.activeRequests === 0)
    .sort((left, right) => left.lastUsedAt - right.lastUsedAt);
  const disposableEntries: RetainedDraftToolsApp[] = [];
  for (const entry of idleEntries) {
    if (await canDispose(entry)) disposableEntries.push(entry);
  }
  return disposableEntries;
};
