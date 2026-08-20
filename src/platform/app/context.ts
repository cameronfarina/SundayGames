import type { PlatformAppOptions } from "./contracts/options.js";
import { createAccountAccess } from "./context/accountAccess.js";
import { resolvePlatformAppDependencies } from "./context/dependencies.js";
import { createLeagueSetupMirror } from "./context/leagueSetupMirror.js";
import { createMembershipAccess } from "./context/membershipAccess.js";
import { createMockResultAccess } from "./context/mockResultAccess.js";
import { createPrivateTeamAccess } from "./context/privateTeamAccess.js";
import { addSeasonReadAccess, createSeasonAccess } from "./context/seasonAccess.js";
import type { PlatformAppContext } from "./context/types.js";

export type { PlatformAppContext } from "./context/types.js";
export { canMutateLeague } from "./context/authorization.js";

export const createPlatformAppContext = (options: PlatformAppOptions): PlatformAppContext => {
  const dependencies = resolvePlatformAppDependencies(options);
  const mirror = createLeagueSetupMirror(dependencies);
  const membershipAccess = createMembershipAccess(dependencies.leagueSetup, mirror);
  const seasonAccess = addSeasonReadAccess(
    createSeasonAccess(dependencies.leagueSetup, mirror),
    membershipAccess,
  );
  const privateTeamAccess = createPrivateTeamAccess(seasonAccess, membershipAccess);
  const mockResultAccess = createMockResultAccess(dependencies.simulations, privateTeamAccess);

  return {
    ...dependencies,
    ...createAccountAccess(dependencies.auth),
    ...seasonAccess,
    ...membershipAccess,
    ...privateTeamAccess,
    ...mockResultAccess,
    simulationRunner: options.simulationRunner,
    seasonSimulationRunner: options.seasonSimulationRunner,
  };
};
