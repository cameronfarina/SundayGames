import type { KeeperDeclaration } from "../../../config/keepers.js";
import { leagueConfig, type Owner } from "../../../config/league.js";
import type { DraftRoomRanking } from "../../data/draftRoomRankings.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import {
  buildAuctionPlayerPool,
  buildInitialRostersFromKeepers,
} from "../auctionEngine.js";
import { buildBasePrices, type PricingConfig } from "../basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenarioKey,
} from "../keeperInflation.js";
import { buildLiveDraftState } from "../liveDraft.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import { buildInteractiveAuctionConfig } from "./auctionConfiguration.js";
import { replacementDepthBuffer, topTargetLimit } from "./defaults.js";
import {
  normalizePlayerSet,
  ownerStatesFromLiveState,
  playerMetadataByName,
} from "./playerMetadata.js";
import type { PreparedInteractiveMockDraft } from "./preparedContract.js";

export interface PrepareInteractiveMockDraftOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey: KeeperScenarioKey;
  strategyKey: LiveDraftStrategyKey;
  watchOwner: Owner;
  commands: readonly string[];
  pricingConfig: PricingConfig;
  seed: string;
  draftRoomRankings: readonly DraftRoomRanking[];
}

export const prepareInteractiveMockDraft = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey,
  strategyKey,
  watchOwner,
  commands,
  pricingConfig,
  seed,
  draftRoomRankings,
}: PrepareInteractiveMockDraftOptions): PreparedInteractiveMockDraft => {
  const liveState = buildLiveDraftState({
    projections,
    historicalRecords,
    keepers,
    scenarioKey,
    strategyKey,
    watchOwner,
    commands,
    pricingConfig,
    targetLimit: topTargetLimit,
    draftRoomRankings,
  });
  const scenario = buildKeeperScenarios(keepers)
    .find(candidate => candidate.key === scenarioKey);
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const adjustedPrices = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const initialRosters = buildInitialRostersFromKeepers(
    keepers,
    projections,
    scenario.includedKeeperStatuses,
  );
  const lockedKeeperCount = Object.values(initialRosters)
    .reduce((count, roster) => count + (roster?.length ?? 0), 0);
  const auctionPlayers = buildAuctionPlayerPool({
    pricedPlayers: adjustedPrices.availablePrices,
    projections,
    excludedNames: adjustedPrices.unavailableKeepers.map(keeper => keeper.player),
    targetCount: leagueConfig.teams * leagueConfig.rosterSize
      - lockedKeeperCount
      + replacementDepthBuffer,
  });
  const config = buildInteractiveAuctionConfig({
    historicalRecords,
    seed,
    watchOwner,
    strategyKey,
  });
  const metadata = playerMetadataByName(auctionPlayers, projections);
  const ownerStates = ownerStatesFromLiveState(liveState, metadata, config);
  const unavailableNames = normalizePlayerSet(ownerStates.flatMap(state => state.roster));

  return {
    scenario,
    liveState,
    auctionPlayers: auctionPlayers.filter(player =>
      !unavailableNames.has(normalizePlayerName(player.name))
    ),
    ownerStates,
    config,
  };
};
