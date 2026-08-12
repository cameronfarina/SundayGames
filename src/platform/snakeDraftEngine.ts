export type SnakeDraftOrderType = "standard" | "third_round_reversal";
export type SnakeDraftStatus = "setup" | "active" | "completed";

export interface SnakeDraftOwnerTendency {
  rankWeight?: number | undefined;
  adpWeight?: number | undefined;
  rosterNeedWeight?: number | undefined;
  positionalRunWeight?: number | undefined;
  positionPreferences?: Readonly<Record<string, number>> | undefined;
}

export interface SnakeDraftTeamConfig {
  id: string;
  name: string;
  aiTendency?: SnakeDraftOwnerTendency | undefined;
}

export interface SnakeDraftRosterSlotConfig {
  slot: string;
  count: number;
  eligiblePositions: readonly string[];
}

export interface SnakeDraftPlayer {
  id: string;
  name: string;
  position: string;
  rank: number;
  adp: number;
  leagueExpectedPick?: number | undefined;
  personalRank?: number | undefined;
  reachLimit?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
}

export interface SnakeDraftKeeperPlacement {
  teamId: string;
  playerId: string;
  round: number;
  pickInRound: number;
}

export interface SnakeDraftAiConfig {
  rankWeight?: number | undefined;
  adpWeight?: number | undefined;
  rosterNeedWeight?: number | undefined;
  positionalRunWeight?: number | undefined;
  positionalRunWindow?: number | undefined;
  randomWeight?: number | undefined;
}

export interface SnakeDraftConfig {
  sessionId: string;
  seed: string;
  rounds: number;
  orderType: SnakeDraftOrderType;
  teamOrder: readonly string[];
  humanTeamId: string;
  teams: readonly SnakeDraftTeamConfig[];
  rosterSlots: readonly SnakeDraftRosterSlotConfig[];
  players: readonly SnakeDraftPlayer[];
  keepers?: readonly SnakeDraftKeeperPlacement[] | undefined;
  ai?: SnakeDraftAiConfig | undefined;
}

export interface SnakeDraftPickRef {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
}

export interface SnakeDraftSelection {
  playerId: string;
  source: "ai" | "human" | "keeper";
  rosterSlot: string;
}

export interface SnakeDraftBoardPick extends SnakeDraftPickRef {
  teamName: string;
  selection: SnakeDraftSelection | undefined;
}

export interface SnakeDraftBoardPlayer {
  id: string;
  name: string;
  position: string;
  rank: number;
  adp: number;
  leagueExpectedPick: number;
  personalRank: number | undefined;
  reachLimit: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  available: boolean;
}

export interface SnakeDraftTeamRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
  playerId: string | undefined;
}

export interface SnakeDraftTeamReadModel {
  id: string;
  name: string;
  roster: readonly SnakeDraftSelection[];
  slots: readonly SnakeDraftTeamRosterSlot[];
}

export interface SnakeDraftSessionReadModel {
  id: string;
  status: SnakeDraftStatus;
  revision: number;
  seed: string;
  rounds: number;
  orderType: SnakeDraftOrderType;
  teamOrder: readonly string[];
  humanTeamId: string;
  currentPick: SnakeDraftPickRef | undefined;
  canUndo: boolean;
  canComplete: boolean;
  commandLog: readonly SnakeDraftCommand[];
}

export interface SnakeDraftBoardReadModel {
  picks: readonly SnakeDraftBoardPick[];
  players: readonly SnakeDraftBoardPlayer[];
}

export interface SnakeDraftState {
  session: SnakeDraftSessionReadModel;
  board: SnakeDraftBoardReadModel;
  teams: readonly SnakeDraftTeamReadModel[];
  readonly configuration: SnakeDraftConfig;
}

export type SnakeDraftCommand =
  | {
    type: "start";
    expectedRevision: number;
  }
  | {
    type: "pick";
    expectedRevision: number;
    playerId: string;
  }
  | {
    type: "undo";
    expectedRevision: number;
  }
  | {
    type: "complete";
    expectedRevision: number;
  };

export type SnakeDraftErrorCode =
  | "draft_incomplete"
  | "duplicate_player"
  | "invalid_config"
  | "invalid_keeper"
  | "invalid_status"
  | "no_pick_to_undo"
  | "not_human_turn"
  | "player_not_found"
  | "roster_limit"
  | "stale_revision";

export class SnakeDraftError extends Error {
  readonly code: SnakeDraftErrorCode;

  constructor(code: SnakeDraftErrorCode, message: string) {
    super(message);
    this.name = "SnakeDraftError";
    this.code = code;
  }
}

const expandedRosterSlotName = (slot: SnakeDraftRosterSlotConfig, index: number): string =>
  slot.count === 1 ? slot.slot : `${slot.slot}${index + 1}`;

const assertConfiguration = (config: SnakeDraftConfig): void => {
  if (config.teams.length < 4 || config.teams.length > 20) {
    throw new SnakeDraftError("invalid_config", "Snake drafts require between 4 and 20 teams.");
  }

  const teamIds = config.teams.map(team => team.id);
  const uniqueTeamIds = new Set(teamIds);
  if (uniqueTeamIds.size !== teamIds.length) {
    throw new SnakeDraftError("invalid_config", "Every snake draft team must have a unique id.");
  }

  if (config.teamOrder.length !== config.teams.length) {
    throw new SnakeDraftError("invalid_config", "Team order must include every team exactly once.");
  }

  const uniqueOrderedTeamIds = new Set(config.teamOrder);
  if (
    uniqueOrderedTeamIds.size !== config.teamOrder.length
    || config.teamOrder.some(teamId => !uniqueTeamIds.has(teamId))
  ) {
    throw new SnakeDraftError("invalid_config", "Team order must include every team exactly once.");
  }

  if (!uniqueTeamIds.has(config.humanTeamId)) {
    throw new SnakeDraftError("invalid_config", "Human team id must identify a configured team.");
  }

  if (!Number.isInteger(config.rounds) || config.rounds <= 0) {
    throw new SnakeDraftError("invalid_config", "Rounds must be a positive whole number.");
  }

  if (config.rosterSlots.length === 0 || config.rosterSlots.some(slot =>
    slot.slot.trim().length === 0
    || !Number.isInteger(slot.count)
    || slot.count <= 0
    || slot.eligiblePositions.length === 0
  )) {
    throw new SnakeDraftError(
      "invalid_config",
      "Roster slots require a name, positive count, and at least one eligible position.",
    );
  }

  const rosterSlotNames = config.rosterSlots.map(slot => slot.slot);
  if (new Set(rosterSlotNames).size !== rosterSlotNames.length) {
    throw new SnakeDraftError("invalid_config", "Every roster slot type must have a unique name.");
  }

  const expandedRosterSlotNames = config.rosterSlots.flatMap(slot =>
    Array.from({ length: slot.count }, (_, index) => expandedRosterSlotName(slot, index)),
  );
  if (new Set(expandedRosterSlotNames).size !== expandedRosterSlotNames.length) {
    throw new SnakeDraftError("invalid_config", "Expanded roster slots must have unique names.");
  }

  const rosterCapacity = config.rosterSlots.reduce((total, slot) => total + slot.count, 0);
  if (config.rounds > rosterCapacity) {
    throw new SnakeDraftError("invalid_config", "Rounds cannot exceed each team's roster capacity.");
  }

  const playerIds = config.players.map(player => player.id);
  if (new Set(playerIds).size !== playerIds.length) {
    throw new SnakeDraftError("invalid_config", "Every player must have a unique id.");
  }

  if (config.players.length < config.teams.length * config.rounds) {
    throw new SnakeDraftError("invalid_config", "The player pool cannot fill every scheduled pick.");
  }
};

const isForwardRound = (round: number, orderType: SnakeDraftOrderType): boolean => {
  if (orderType === "standard") return round % 2 === 1;
  if (round === 1) return true;
  if (round === 2 || round === 3) return false;
  return round % 2 === 0;
};

const buildPicks = (config: SnakeDraftConfig): SnakeDraftBoardPick[] => {
  const teamsById = new Map(config.teams.map(team => [team.id, team]));
  const picks: SnakeDraftBoardPick[] = [];

  for (let round = 1; round <= config.rounds; round += 1) {
    const roundOrder = isForwardRound(round, config.orderType)
      ? [...config.teamOrder]
      : [...config.teamOrder].reverse();

    roundOrder.forEach((teamId, index) => {
      const team = teamsById.get(teamId);
      if (!team) {
        throw new SnakeDraftError("invalid_config", `Team order contains unknown team "${teamId}".`);
      }

      picks.push({
        overall: picks.length + 1,
        round,
        pickInRound: index + 1,
        teamId,
        teamName: team.name,
        selection: undefined,
      });
    });
  }

  return picks;
};

const buildRosterSlots = (
  rosterSlots: readonly SnakeDraftRosterSlotConfig[],
): SnakeDraftTeamRosterSlot[] => rosterSlots.flatMap(slot =>
  Array.from({ length: slot.count }, (_, index) => ({
    slot: expandedRosterSlotName(slot, index),
    eligiblePositions: [...slot.eligiblePositions],
    playerId: undefined,
  })),
);

const pickRefFor = (pick: SnakeDraftBoardPick): SnakeDraftPickRef => ({
  overall: pick.overall,
  round: pick.round,
  pickInRound: pick.pickInRound,
  teamId: pick.teamId,
});

const deterministicFraction = (value: string): number => {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_296;
};

const defaultAiWeights = {
  rank: 1,
  adp: 0.75,
  rosterNeed: 4,
  positionalRun: 1.5,
  positionalRunWindow: 6,
  random: 0.25,
} as const;

interface ResolvedAiSettings {
  rankWeight: number;
  adpWeight: number;
  rosterNeedWeight: number;
  positionalRunWeight: number;
  positionalRunWindow: number;
  randomWeight: number;
  positionPreferences: Readonly<Record<string, number>>;
}

const assignableSlot = (
  team: SnakeDraftTeamReadModel,
  player: SnakeDraftPlayer,
): SnakeDraftTeamRosterSlot | undefined => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(player.position))
  .sort((left, right) => left.eligiblePositions.length - right.eligiblePositions.length)[0];

const rosterNeedFor = (team: SnakeDraftTeamReadModel, position: string): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);

const aiSettingsFor = (
  state: SnakeDraftState,
  team: SnakeDraftTeamReadModel,
): ResolvedAiSettings => {
  const tendency = state.configuration.teams.find(candidate => candidate.id === team.id)?.aiTendency;
  const ai = state.configuration.ai;

  return {
    rankWeight: tendency?.rankWeight ?? ai?.rankWeight ?? defaultAiWeights.rank,
    adpWeight: tendency?.adpWeight ?? ai?.adpWeight ?? defaultAiWeights.adp,
    rosterNeedWeight: tendency?.rosterNeedWeight ?? ai?.rosterNeedWeight ?? defaultAiWeights.rosterNeed,
    positionalRunWeight: tendency?.positionalRunWeight
      ?? ai?.positionalRunWeight
      ?? defaultAiWeights.positionalRun,
    positionalRunWindow: ai?.positionalRunWindow ?? defaultAiWeights.positionalRunWindow,
    randomWeight: ai?.randomWeight ?? defaultAiWeights.random,
    positionPreferences: tendency?.positionPreferences ?? {},
  };
};

const positionalRunsFor = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
  window: number,
): ReadonlyMap<string, number> => {
  const playersById = new Map(state.configuration.players.map(player => [player.id, player]));
  const runsByPosition = new Map<string, number>();

  for (const previousPick of state.board.picks) {
    if (previousPick.overall >= pick.overall || previousPick.overall < pick.overall - window) continue;
    const playerId = previousPick.selection?.playerId;
    const position = playerId === undefined ? undefined : playersById.get(playerId)?.position;
    if (position !== undefined) {
      runsByPosition.set(position, (runsByPosition.get(position) ?? 0) + 1);
    }
  }

  return runsByPosition;
};

const aiScoreFor = ({
  state,
  team,
  pick,
  player,
  settings,
  positionalRuns,
}: {
  state: SnakeDraftState;
  team: SnakeDraftTeamReadModel;
  pick: SnakeDraftBoardPick;
  player: SnakeDraftPlayer;
  settings: ResolvedAiSettings;
  positionalRuns: ReadonlyMap<string, number>;
}): number => -(player.rank * settings.rankWeight)
  - (player.adp * settings.adpWeight)
  + (rosterNeedFor(team, player.position) * settings.rosterNeedWeight)
  + ((positionalRuns.get(player.position) ?? 0) * settings.positionalRunWeight)
  + (settings.positionPreferences[player.position] ?? 0)
  + (deterministicFraction(`${state.session.seed}:${pick.overall}:${team.id}:${player.id}`)
    * settings.randomWeight);

const selectAiPlayer = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
): SnakeDraftPlayer => {
  const team = state.teams.find(candidate => candidate.id === pick.teamId);
  if (!team) throw new SnakeDraftError("invalid_config", `Unknown team "${pick.teamId}".`);

  const availablePlayerIds = new Set(
    state.board.players.filter(player => player.available).map(player => player.id),
  );
  const settings = aiSettingsFor(state, team);
  const positionalRuns = positionalRunsFor(state, pick, settings.positionalRunWindow);
  const selected = state.configuration.players
    .filter(player => availablePlayerIds.has(player.id) && assignableSlot(team, player) !== undefined)
    .map(player => ({
      player,
      score: aiScoreFor({ state, team, pick, player, settings, positionalRuns }),
    }))
    .sort((left, right) =>
      right.score - left.score
      || left.player.rank - right.player.rank
      || left.player.id.localeCompare(right.player.id)
    )[0]?.player;

  if (!selected) {
    throw new SnakeDraftError("roster_limit", `${team.name} has no eligible player for an open roster slot.`);
  }

  return selected;
};

const addSelection = (
  state: SnakeDraftState,
  pick: SnakeDraftBoardPick,
  player: SnakeDraftPlayer,
  source: SnakeDraftSelection["source"],
): SnakeDraftState => {
  const team = state.teams.find(candidate => candidate.id === pick.teamId);
  if (!team) throw new SnakeDraftError("invalid_config", `Unknown team "${pick.teamId}".`);
  const slot = assignableSlot(team, player);
  if (!slot) throw new SnakeDraftError("roster_limit", `${team.name} cannot roster ${player.name}.`);

  const selection: SnakeDraftSelection = {
    playerId: player.id,
    source,
    rosterSlot: slot.slot,
  };

  return {
    ...state,
    board: {
      players: state.board.players.map(candidate =>
        candidate.id === player.id ? { ...candidate, available: false } : candidate,
      ),
      picks: state.board.picks.map(candidate =>
        candidate.overall === pick.overall ? { ...candidate, selection } : candidate,
      ),
    },
    teams: state.teams.map(candidate => candidate.id === team.id ? {
      ...candidate,
      roster: [...candidate.roster, selection],
      slots: candidate.slots.map(candidateSlot =>
        candidateSlot.slot === slot.slot ? { ...candidateSlot, playerId: player.id } : candidateSlot,
      ),
    } : candidate),
  };
};

const applyKeepers = (state: SnakeDraftState): SnakeDraftState => {
  let nextState = state;

  for (const keeper of state.configuration.keepers ?? []) {
    const pick = nextState.board.picks.find(candidate =>
      candidate.round === keeper.round && candidate.pickInRound === keeper.pickInRound,
    );
    if (!pick || pick.teamId !== keeper.teamId) {
      throw new SnakeDraftError(
        "invalid_keeper",
        `Keeper ${keeper.playerId} is not assigned to a pick owned by ${keeper.teamId}.`,
      );
    }

    if (pick.selection !== undefined) {
      throw new SnakeDraftError("invalid_keeper", `Pick ${keeper.round}.${keeper.pickInRound} already has a keeper.`);
    }

    const player = state.configuration.players.find(candidate => candidate.id === keeper.playerId);
    if (!player) {
      throw new SnakeDraftError("player_not_found", `Keeper player "${keeper.playerId}" was not found.`);
    }

    const isAvailable = nextState.board.players.find(candidate => candidate.id === player.id)?.available;
    if (isAvailable !== true) {
      throw new SnakeDraftError("duplicate_player", `${player.name} is already unavailable.`);
    }

    nextState = addSelection(nextState, pick, player, "keeper");
  }

  return nextState;
};

const advanceAiToHuman = (state: SnakeDraftState): SnakeDraftState => {
  let nextState = state;

  while (true) {
    const nextPick = nextState.board.picks.find(pick => pick.selection === undefined);
    if (!nextPick || nextPick.teamId === nextState.session.humanTeamId) {
      return {
        ...nextState,
        session: {
          ...nextState.session,
          currentPick: nextPick === undefined ? undefined : pickRefFor(nextPick),
          canComplete: nextPick === undefined,
        },
      };
    }

    nextState = addSelection(nextState, nextPick, selectAiPlayer(nextState, nextPick), "ai");
  }
};

const appendCommand = (state: SnakeDraftState, command: SnakeDraftCommand): SnakeDraftState => ({
  ...state,
  session: {
    ...state.session,
    commandLog: [...state.session.commandLog, { ...command }],
  },
});

const undoLastHumanDecision = (state: SnakeDraftState): SnakeDraftState => {
  const lastHumanPick = [...state.board.picks]
    .reverse()
    .find(pick => pick.selection?.source === "human");
  if (!lastHumanPick) {
    throw new SnakeDraftError("no_pick_to_undo", "There is no confirmed human pick to undo.");
  }

  let rebuilt = applyKeepers({
    ...createSnakeDraftState(state.configuration),
    session: {
      ...state.session,
      status: "active",
      revision: state.session.revision + 1,
      currentPick: undefined,
      canUndo: false,
      canComplete: false,
    },
  });

  for (const previousPick of state.board.picks) {
    const selection = previousPick.selection;
    if (previousPick.overall >= lastHumanPick.overall || !selection || selection.source === "keeper") {
      continue;
    }

    const rebuiltPick = rebuilt.board.picks.find(pick => pick.overall === previousPick.overall);
    const player = state.configuration.players.find(candidate => candidate.id === selection.playerId);
    if (!rebuiltPick || !player) {
      throw new SnakeDraftError("invalid_config", "A prior snake draft selection cannot be rebuilt.");
    }

    rebuilt = addSelection(rebuilt, rebuiltPick, player, selection.source);
  }

  const currentPick = rebuilt.board.picks.find(pick => pick.overall === lastHumanPick.overall);
  if (!currentPick) {
    throw new SnakeDraftError("invalid_config", "The undone snake draft pick is no longer scheduled.");
  }

  return {
    ...rebuilt,
    session: {
      ...rebuilt.session,
      currentPick: pickRefFor(currentPick),
      canUndo: rebuilt.board.picks.some(pick => pick.selection?.source === "human"),
    },
  };
};

export const createSnakeDraftState = (config: SnakeDraftConfig): SnakeDraftState => {
  assertConfiguration(config);

  return {
    configuration: config,
    session: {
      id: config.sessionId,
      status: "setup",
      revision: 0,
      seed: config.seed,
      rounds: config.rounds,
      orderType: config.orderType,
      teamOrder: [...config.teamOrder],
      humanTeamId: config.humanTeamId,
      currentPick: undefined,
      canUndo: false,
      canComplete: false,
      commandLog: [],
    },
    board: {
      picks: buildPicks(config),
      players: config.players.map(player => ({
        ...player,
        leagueExpectedPick: player.leagueExpectedPick ?? player.adp,
        personalRank: player.personalRank,
        reachLimit: player.reachLimit,
        available: true,
      })),
    },
    teams: config.teams.map(team => ({
      id: team.id,
      name: team.name,
      roster: [],
      slots: buildRosterSlots(config.rosterSlots),
    })),
  };
};

export const applySnakeDraftCommand = (
  state: SnakeDraftState,
  command: SnakeDraftCommand,
): SnakeDraftState => {
  if (command.expectedRevision !== state.session.revision) {
    throw new SnakeDraftError(
      "stale_revision",
      `Expected revision ${command.expectedRevision}, but the snake draft is at revision ${state.session.revision}.`,
    );
  }

  if (command.type === "start") {
    if (state.session.status !== "setup") {
      throw new SnakeDraftError("invalid_status", "The snake draft has already started.");
    }

    return appendCommand(advanceAiToHuman(applyKeepers({
      ...state,
      session: {
        ...state.session,
        status: "active",
        revision: state.session.revision + 1,
      },
    })), command);
  }

  if (state.session.status !== "active") {
    throw new SnakeDraftError("invalid_status", "Picks require an active snake draft.");
  }

  if (command.type === "undo") {
    return appendCommand(undoLastHumanDecision(state), command);
  }

  if (command.type === "complete") {
    if (state.board.picks.some(pick => pick.selection === undefined)) {
      throw new SnakeDraftError("draft_incomplete", "Every scheduled pick must be filled before completion.");
    }

    return appendCommand({
      ...state,
      session: {
        ...state.session,
        status: "completed",
        revision: state.session.revision + 1,
        currentPick: undefined,
        canUndo: false,
        canComplete: false,
      },
    }, command);
  }

  const currentPick = state.board.picks.find(
    pick => pick.overall === state.session.currentPick?.overall,
  );
  if (!currentPick || currentPick.teamId !== state.session.humanTeamId) {
    throw new SnakeDraftError("not_human_turn", "The human team does not have the current pick.");
  }

  const player = state.configuration.players.find(candidate => candidate.id === command.playerId);
  if (!player) {
    throw new SnakeDraftError("player_not_found", `Player "${command.playerId}" was not found.`);
  }

  if (state.board.players.find(candidate => candidate.id === player.id)?.available !== true) {
    throw new SnakeDraftError("duplicate_player", `${player.name} is already unavailable.`);
  }

  const pickedState = addSelection(state, currentPick, player, "human");

  return appendCommand(advanceAiToHuman({
    ...pickedState,
    session: {
      ...pickedState.session,
      revision: state.session.revision + 1,
      canUndo: true,
    },
  }), command);
};

export const replaySnakeDraft = (
  config: SnakeDraftConfig,
  commands: readonly SnakeDraftCommand[],
): SnakeDraftState => commands.reduce(
  (state, command) => applySnakeDraftCommand(state, command),
  createSnakeDraftState(config),
);
