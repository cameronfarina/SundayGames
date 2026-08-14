import type { ServerResponse } from "node:http";
import type { RetainedDraftToolsApp } from "./retainedApps/contracts.js";
import type { DraftToolsAppRegistry } from "./retainedApps/registry.js";

export const releaseDraftToolsAppOnResponse = (
  registry: DraftToolsAppRegistry,
  entry: RetainedDraftToolsApp,
  response: ServerResponse,
): (() => void) => {
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    response.off("finish", release);
    response.off("close", release);
    registry.release(entry);
  };
  response.once("finish", release);
  response.once("close", release);
  return release;
};
