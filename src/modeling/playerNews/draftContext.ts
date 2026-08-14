import type {
  PlayerNewsDraftEvent,
  PlayerNewsDraftState,
  PlayerNewsDraftTarget,
  PlayerNewsOwnerState,
  PlayerNewsPlayerMetadata,
  PlayerNewsRosterPlayer,
} from "./draftContracts.js";
import type { PlayerNewsDraftContext } from "./internalContracts.js";
import { playerNewsKeyFor } from "./normalization.js";

const targetMapFor = (
  targets: readonly PlayerNewsDraftTarget[],
): Map<string, PlayerNewsDraftTarget> =>
  new Map(targets.map(target => [
    playerNewsKeyFor(target.normalizedPlayerName ?? target.name),
    target,
  ]));

const eventMapFor = (
  events: readonly PlayerNewsDraftEvent[],
): Map<string, PlayerNewsDraftEvent> =>
  new Map(events.map(event => [
    playerNewsKeyFor(event.normalizedPlayerName ?? event.player),
    event,
  ]));

const rosterMapFor = (
  owners: readonly PlayerNewsOwnerState[],
): Map<string, { owner: string; player: PlayerNewsRosterPlayer }> => {
  const rosters = new Map<string, { owner: string; player: PlayerNewsRosterPlayer }>();
  for (const owner of owners) {
    for (const player of owner.roster) {
      rosters.set(playerNewsKeyFor(player.name), { owner: owner.owner, player });
    }
  }
  return rosters;
};

const metadataMapFor = (
  players: readonly PlayerNewsPlayerMetadata[],
): Map<string, PlayerNewsPlayerMetadata> =>
  new Map(players.map(player => [
    playerNewsKeyFor(player.normalizedPlayerName ?? player.name),
    player,
  ]));

export const playerNewsDraftContextFor = (
  draftState: PlayerNewsDraftState,
  playerMetadata: readonly PlayerNewsPlayerMetadata[] = [],
): PlayerNewsDraftContext => ({
  targetsByPlayer: targetMapFor(draftState.availableTargets),
  eventsByPlayer: eventMapFor(draftState.events),
  rosterByPlayer: rosterMapFor(draftState.owners),
  metadataByPlayer: metadataMapFor(playerMetadata),
});
