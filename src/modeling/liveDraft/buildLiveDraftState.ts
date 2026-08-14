import { keepers as defaultKeepers } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import { buildInitialRostersFromKeepers } from "../auctionEngine.js";
import { buildBasePrices, defaultPricingConfig } from "../basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../keeperInflation.js";
import {
  defaultLiveDraftStrategyKey,
  liveDraftStrategyFor,
} from "../liveDraftStrategies.js";
import type { BuildLiveDraftStateOptions, LiveDraftState } from "./contracts.js";
import {
  defaultScenarioKey,
  defaultTargetLimit,
  defaultWatchOwner,
} from "./constants.js";
import { buildDraftPath } from "./draftPath.js";
import { buildKeeperTargets } from "./keeperTargets.js";
import { startingLiveInflationFactorFor } from "./initialRoom.js";
import { buildLivePlayerUniverse } from "./playerUniverse.js";
import { buildPositionContexts } from "./positionContexts.js";
import { buildReadiness } from "./readiness.js";
import { replayCommands } from "./replayCommands.js";
import {
  buildOwnerStates,
  rostersFromKeepers,
  totalKeeperSpend,
} from "./rosters.js";
import { buildRoomState } from "./roomState.js";
import { buildShortlist } from "./shortlist.js";
import { buildTargets } from "./targets.js";

const scenarioFor = (
  scenarioKey: NonNullable<BuildLiveDraftStateOptions["scenarioKey"]>,
  keepers: NonNullable<BuildLiveDraftStateOptions["keepers"]>,
) => {
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  return scenario;
};

export const buildLiveDraftState = ({
  projections,
  historicalRecords,
  keepers = defaultKeepers,
  scenarioKey = defaultScenarioKey,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = defaultWatchOwner,
  commands = [],
  pricingConfig = defaultPricingConfig,
  targetLimit = defaultTargetLimit,
  draftRoomRankings = [],
}: BuildLiveDraftStateOptions): LiveDraftState => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = scenarioFor(scenarioKey, keepers);
  const strategy = liveDraftStrategyFor(strategyKey);
  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const keeperTargets = buildKeeperTargets({
    keepers: appliedScenario.unavailableKeepers,
    prices,
    projections,
    scenario,
  });
  const unavailableKeeperNames = new Set(
    appliedScenario.unavailableKeepers.map(keeper => normalizePlayerName(keeper.player)),
  );
  const records = buildLivePlayerUniverse({
    projections,
    prices: appliedScenario.availablePrices,
    scenario,
    unavailableKeeperNames,
    draftRoomRankingsByName: new Map(
      draftRoomRankings.map(ranking => [ranking.normalizedName, ranking]),
    ),
  });
  const rostersByOwner = rostersFromKeepers(buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  ));
  const initialKeeperSpend = totalKeeperSpend(rostersByOwner);
  const soldNames = new Set(unavailableKeeperNames);
  const startingLiveInflationFactor = startingLiveInflationFactorFor({
    records,
    soldNames,
    rostersByOwner,
  });
  const replayed = replayCommands({
    commands,
    records,
    rostersByOwner,
    soldNames,
    watchOwner,
    scenario,
    initialKeeperSpend,
    startingLiveInflationFactor,
    strategy,
    pricingConfig,
  });
  const owners = buildOwnerStates(rostersByOwner);
  const room = buildRoomState({
    scenario,
    owners,
    events: replayed.events,
    records,
    soldNames,
    initialKeeperSpend,
    startingLiveInflationFactor,
  });
  const currentWatchOwner = owners.find(owner => owner.owner === watchOwner);
  if (!currentWatchOwner) throw new Error(`Unknown watch owner "${watchOwner}".`);
  const availableTargets = buildTargets({
    records,
    soldNames,
    watchOwner: currentWatchOwner,
    room,
    targetLimit,
    strategy,
    pricingConfig,
  });
  const draftPath = buildDraftPath(strategy, currentWatchOwner, availableTargets);

  return {
    strategy,
    scenario,
    room,
    watchOwner: currentWatchOwner,
    owners,
    events: replayed.events,
    errors: replayed.errors,
    postDraftAudit: replayed.postDraftAudit,
    availableTargets,
    keeperTargets,
    draftPath,
    shortlist: buildShortlist(availableTargets),
    positionContexts: buildPositionContexts(owners, currentWatchOwner),
    readiness: buildReadiness({
      errors: replayed.errors,
      availableTargets,
      owners,
      draftPath,
      keepers,
    }),
  };
};
