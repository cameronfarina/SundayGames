import { platformJobTypes, type PlatformJobHandlers } from "../platformJobOrchestrator.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import type { PlatformPersistence } from "./persistence.js";

export const createDelegatingJobHandlers = (
  runtimeHolder: PlatformRuntimeHolder,
  persistence: PlatformPersistence,
): PlatformJobHandlers => ({
  [platformJobTypes.simulationRunExecution]: (payload, context) =>
      runtimeHolder.current().rawJobHandlers[platformJobTypes.simulationRunExecution](payload, context),
  [platformJobTypes.seasonSimulationExecution]: (payload, context) =>
    runtimeHolder.current().rawJobHandlers[platformJobTypes.seasonSimulationExecution](payload, context),
  [platformJobTypes.historicalImportParse]: (payload, context) =>
    persistence.runInSnapshotCriticalSection(() => Promise.resolve(
      runtimeHolder.current().rawJobHandlers[platformJobTypes.historicalImportParse](payload, context),
    )),
  [platformJobTypes.pricingRebuild]: (payload, context) =>
    persistence.runInSnapshotCriticalSection(() => Promise.resolve(
      runtimeHolder.current().rawJobHandlers[platformJobTypes.pricingRebuild](payload, context),
    )),
  [platformJobTypes.draftRoomExport]: (payload, context) =>
    persistence.runInSnapshotCriticalSection(() => Promise.resolve(
      runtimeHolder.current().rawJobHandlers[platformJobTypes.draftRoomExport](payload, context),
    )),
});
