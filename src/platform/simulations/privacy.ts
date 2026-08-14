import type { SimulationRun } from "./runContracts.js";

export const canReadSimulationRun = (userId: string, run: SimulationRun): boolean =>
  run.privacyOwnerUserId === userId;
