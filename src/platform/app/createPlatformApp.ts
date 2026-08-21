import type { PlatformAppOptions } from "./contracts/options.js";
import { createPlatformAppContext } from "./context.js";
import { createAuthOperations } from "./operations/authOperations.js";
import { createHistoricalImportOperations } from "./operations/historicalImportOperations.js";
import { createLeagueRegistrationOperations } from "./operations/leagueRegistrationOperations.js";
import { createLiveDraftExportOperations } from "./operations/liveDraftExportOperations.js";
import { createLiveDraftLifecycleOperations } from "./operations/liveDraftLifecycleOperations.js";
import { createLiveDraftRoomOperations } from "./operations/liveDraftRoomOperations.js";
import { createLiveDraftSaleOperations } from "./operations/liveDraftSaleOperations.js";
import { createMockDraftOperations } from "./operations/mockDraftOperations.js";
import { createPracticeOperations } from "./operations/practiceOperations.js";
import { createPricingOperations } from "./operations/pricingOperations.js";
import { createSimulationJobOperations } from "./operations/simulationJobOperations.js";
import { createSimulationRunOperations } from "./operations/simulationRunOperations.js";
import { createTeamClaimOperations } from "./operations/teamClaimOperations.js";

export const createPlatformApp = (options: PlatformAppOptions) => {
  const context = createPlatformAppContext(options);
  return {
    store: context.store,
    authRepository: context.authRepository,
    leagueSetupRepository: context.leagueSetup,
    ...createAuthOperations(context),
    ...createLeagueRegistrationOperations(context),
    ...createTeamClaimOperations(context),
    ...createPracticeOperations(context),
    ...createSimulationRunOperations(context),
    ...createSimulationJobOperations(context),
    ...createHistoricalImportOperations(context),
    ...createPricingOperations(context),
    ...createMockDraftOperations(context),
    ...createLiveDraftRoomOperations(context),
    ...createLiveDraftLifecycleOperations(context),
    ...createLiveDraftSaleOperations(context),
    ...createLiveDraftExportOperations(context),
  };
};
