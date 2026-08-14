import type { PlatformAppContext } from "../context.js";
import { createMockDraftCommandOperations } from "./mockDraftOperations/commands.js";
import { createMockDraftLifecycleOperations } from "./mockDraftOperations/lifecycle.js";
import { createMockDraftSessionOperations } from "./mockDraftOperations/sessions.js";

export const createMockDraftOperations = (context: PlatformAppContext) => ({
  ...createMockDraftSessionOperations(context),
  ...createMockDraftCommandOperations(context),
  ...createMockDraftLifecycleOperations(context),
});
