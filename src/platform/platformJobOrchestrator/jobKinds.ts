import type { JobKind } from "../jobs.js";
import { platformJobTypes, type PlatformJobType } from "./platformJobTypes.js";

const platformJobKinds: Record<PlatformJobType, JobKind> = {
  [platformJobTypes.simulationRunExecution]: "simulation",
  [platformJobTypes.historicalImportParse]: "import",
  [platformJobTypes.pricingRebuild]: "model_run",
  [platformJobTypes.draftRoomExport]: "export",
};

export const jobKindFor = (type: PlatformJobType): JobKind => platformJobKinds[type];
