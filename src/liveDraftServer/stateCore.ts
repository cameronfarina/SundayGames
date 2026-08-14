import { primaryOwner, type Owner } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import { buildLiveDraftState, type LiveDraftSaleMockRange, type LiveDraftState } from "../modeling/liveDraft.js";
import { defaultLiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type { MockResultsReport } from "../modeling/mockResults.js";
import {
  defaultLiveDraftSessionKey,
  defaultLiveDraftSessionMode,
  liveDraftModes,
  liveTargetLimit,
} from "./constants.js";
import type { LiveDraftStateResponse } from "./contracts.js";
import { readinessWithSession } from "./readiness.js";
import type {
  BatchService,
  LiveDraftData,
  StateRequest,
  StoreService,
} from "./runtimeContracts.js";
import {
  activeDraftSessionDescriptorFor,
  canonicalSessionModeFor,
  draftNightLockFor,
  draftSessionDescriptorsFor,
} from "./sessionInput.js";

const mockRangesFor = (report: MockResultsReport): Map<string, LiveDraftSaleMockRange> =>
  new Map(report.summary.players.map(player => [
    normalizePlayerName(player.name),
    {
      draftedRate: player.draftedRate,
      averageSalePrice: player.averageSalePrice,
      minimumSalePrice: player.minimumSalePrice,
      maximumSalePrice: player.maximumSalePrice,
    },
  ]));

const stateWithMockRanges = (
  state: LiveDraftState,
  report: MockResultsReport | undefined,
): LiveDraftState => {
  if (!report || !state.postDraftAudit.length) return state;
  if (report.options.strategyKey !== state.strategy.key || report.script) return state;
  const ranges = mockRangesFor(report);
  return {
    ...state,
    postDraftAudit: state.postDraftAudit.map(audit => {
      const mockRange = ranges.get(audit.normalizedPlayerName);
      return mockRange ? { ...audit, mockRange } : audit;
    }),
  };
};

export const createStateFor = ({
  data,
  stores,
  batches,
}: {
  data: LiveDraftData;
  stores: StoreService;
  batches: BatchService;
}): ((request?: StateRequest) => Promise<LiveDraftStateResponse>) => async ({
  draftSessionKey = defaultLiveDraftSessionKey,
  mode = defaultLiveDraftSessionMode,
  commands,
  strategyKey = defaultLiveDraftStrategyKey,
  watchOwner = primaryOwner,
}: StateRequest = {}) => {
  const canonicalMode = canonicalSessionModeFor(draftSessionKey, mode);
  const store = await stores.storeFor(draftSessionKey, canonicalMode);
  const state = stateWithMockRanges(buildLiveDraftState({
    projections: data.projections,
    historicalRecords: data.historicalRecords,
    keepers: data.configuredKeepers,
    watchOwner,
    scenarioKey: "expected",
    strategyKey,
    pricingConfig: data.pricingConfig,
    draftRoomRankings: data.draftRoomRankings,
    commands: commands ?? store.currentCommands(),
    targetLimit: liveTargetLimit,
  }), batches.latestCompleteReport(draftSessionKey, watchOwner));
  const session = store.status();
  return {
    ...state,
    draftMode: canonicalMode,
    draftModes: liveDraftModes,
    activeDraftSession: activeDraftSessionDescriptorFor(draftSessionKey),
    draftSessions: draftSessionDescriptorsFor(draftSessionKey),
    draftNightLock: draftNightLockFor(draftSessionKey),
    session,
    readiness: readinessWithSession(state.readiness, session),
  };
};

export type StateFor = ReturnType<typeof createStateFor>;
export type StateOwner = Owner;
