import { leagueConfig } from "../../config/league.js";
import { fetchRotowireRssNews, type RawPlayerNewsItem } from "../data/playerNewsProviderAdapters.js";
import { loadPlayerEvidenceSourceRows } from "../data/playerEvidenceSourceAdapters.js";
import { liveDraftCommandsCsv, liveDraftCommandsJson } from "../liveDraftSessionStore.js";
import { leagueSyncProviderStatuses } from "../modeling/leagueSync.js";
import { buildMyExpertAdvice, type MyExpertPlayer } from "../modeling/myExpert.js";
import { buildPlayerNewsFeed, type PlayerNewsFeed } from "../modeling/playerNews.js";
import type { CreateLiveDraftServerOptions, MyExpertResponse } from "./contracts.js";
import {
  myExpertAvailablePlayerFrom,
  myExpertIdFor,
  myExpertRosterPlayerFrom,
  ownerSummary,
  playerNewsMetadataFor,
  projectionLookupFor,
  projectionLookupKeyFor,
  recommendationFrom,
  rosterRoleByPlayerId,
} from "./expertHelpers.js";
import { readJsonFileIfPresent, readTextFileIfPresent } from "./http.js";
import { playerNewsEvidencePath } from "./constants.js";
import { playerNewsFiltersFromQuery } from "./playerNewsInput.js";
import type { LiveDraftData, StateService, StoreService } from "./runtimeContracts.js";
import {
  currentWeekFromQuery,
  sessionModeFromQuery,
  watchOwnerFromQuery,
} from "./sessionInput.js";
import type { StateFor } from "./stateCore.js";

export const createStateAdvice = ({
  data,
  options,
  stores,
  stateFor,
  enabledDraftSessionKeyFromQuery,
  strategyKeyFromQuery,
}: {
  data: LiveDraftData;
  options: CreateLiveDraftServerOptions;
  stores: StoreService;
  stateFor: StateFor;
  enabledDraftSessionKeyFromQuery(url: URL): string;
  strategyKeyFromQuery(url: URL): import("../modeling/liveDraftStrategies.js").LiveDraftStrategyKey;
}): Pick<StateService, "myExpertFor" | "playerNewsFor" | "exportBundleFor"> => {
  let evidenceRowsPromise: ReturnType<typeof loadPlayerEvidenceSourceRows> | undefined;
  const myExpertFor = async (url: URL): Promise<MyExpertResponse> => {
    const currentWeek = currentWeekFromQuery(url);
    const watchOwner = watchOwnerFromQuery(url);
    const draftState = await stateFor({
      draftSessionKey: enabledDraftSessionKeyFromQuery(url),
      mode: sessionModeFromQuery(url),
      strategyKey: strategyKeyFromQuery(url),
      watchOwner,
    });
    const projectionsByPlayer = projectionLookupFor(data.projections);
    const roles = rosterRoleByPlayerId(draftState.watchOwner.slots);
    const roster = draftState.watchOwner.roster.map(player => myExpertRosterPlayerFrom(
      player,
      roles.get(myExpertIdFor(player.name)) ?? "bench",
      projectionsByPlayer.get(projectionLookupKeyFor(player.name, player.position)),
      currentWeek,
    ));
    const rosterIds = new Set(roster.map(player => player.id));
    const availablePlayers = draftState.availableTargets
      .filter(target => !rosterIds.has(myExpertIdFor(target.name)))
      .slice(0, 120)
      .map(myExpertAvailablePlayerFrom);
    const advice = buildMyExpertAdvice({
      currentWeek,
      leagueSettings: { lineup: leagueConfig.lineup, rosterMaximums: leagueConfig.rosterMaximums },
      roster,
      availablePlayers,
      matchups: [],
      news: [],
      tradeCandidates: [],
    });
    const playersById = new Map<string, MyExpertPlayer>(
      [...roster, ...availablePlayers].map(player => [player.id, player]),
    );
    const recommendations = advice.cards.map(card =>
      recommendationFrom({ card, playersById, rosterIds }));
    return {
      mode: "advice-only",
      readOnly: true,
      generatedAt: new Date().toISOString(),
      source: { key: "mockd-draft", label: "Draft room", readOnly: true, detail: "Current draft room state." },
      team: ownerSummary(watchOwner, draftState.watchOwner.spent, roster),
      summary: {
        currentWeek,
        recommendationCount: recommendations.length,
        highPriorityCount: recommendations.filter(item => item.priority === "high").length,
      },
      recommendations,
      integrations: leagueSyncProviderStatuses(),
      policy: advice.policy,
    };
  };

  const playerNewsFor = async (url: URL): Promise<PlayerNewsFeed> => {
    const filters = playerNewsFiltersFromQuery(url);
    const sourceMode = filters.source ?? "all";
    const evidenceRows = sourceMode === "rotowire-rss"
      ? []
      : await (evidenceRowsPromise ??= loadPlayerEvidenceSourceRows({ path: playerNewsEvidencePath }));
    let rawNewsItems: readonly RawPlayerNewsItem[] = [];
    if (sourceMode !== "local") {
      try {
        rawNewsItems = await (options.playerNewsProvider ?? fetchRotowireRssNews)();
      } catch (error) {
        if (sourceMode === "rotowire-rss") throw error;
      }
    }
    return buildPlayerNewsFeed({
      evidenceRows,
      rawNewsItems,
      playerMetadata: playerNewsMetadataFor(data.projections),
      draftState: await stateFor({
        draftSessionKey: enabledDraftSessionKeyFromQuery(url),
        mode: sessionModeFromQuery(url),
        strategyKey: strategyKeyFromQuery(url),
      }),
      filters,
      localEvidencePath: playerNewsEvidencePath,
    });
  };

  const exportBundleFor: StateService["exportBundleFor"] = async request => {
    const store = await stores.storeFor(request.draftSessionKey, request.mode);
    const state = await stateFor(request);
    const commands = store.currentCommands();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeDraftSession: state.activeDraftSession,
      draftMode: state.draftMode,
      session: state.session,
      readiness: state.readiness,
      currentSnapshot: await readJsonFileIfPresent(state.session.paths.currentPath),
      backupSnapshot: await readJsonFileIfPresent(state.session.paths.backupPath),
      auditLogJsonl: await readTextFileIfPresent(state.session.paths.logPath),
      commandsJson: liveDraftCommandsJson(commands),
      commandsCsv: liveDraftCommandsCsv(commands),
    };
  };
  return { myExpertFor, playerNewsFor, exportBundleFor };
};
