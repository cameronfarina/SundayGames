import type { InteractiveMockDraftModule } from "./contracts.js";
import { unknownField } from "./unknownRecord.js";

const moduleSpecifier = "../modeling/interactiveMockDraft.js";

const hasInteractiveMockDraftModule = (value: unknown): value is InteractiveMockDraftModule =>
  typeof unknownField(value, "buildInteractiveMockDraftState") === "function" &&
  typeof unknownField(value, "resolveInteractiveMockDraftAction") === "function";

export const loadInteractiveMockDraftModule = async (
  providedModule: InteractiveMockDraftModule | undefined,
): Promise<InteractiveMockDraftModule> => {
  if (providedModule) return providedModule;
  const moduleExports: unknown = await import(moduleSpecifier);
  if (!hasInteractiveMockDraftModule(moduleExports)) {
    throw new Error("Interactive mock draft module is missing required exports.");
  }
  return moduleExports;
};
