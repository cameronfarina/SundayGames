import { exerciseLiveDraft } from "./liveDraftWorkspace.js";
import type { ReadySmokeWorkspace } from "./types.js";
import { exerciseWorkspaceBrowsing } from "./workspaceBrowsing.js";

export const exerciseReadyWorkspace = async (workspace: ReadySmokeWorkspace): Promise<void> => {
  await exerciseWorkspaceBrowsing(workspace);
  await exerciseLiveDraft(workspace);
};
