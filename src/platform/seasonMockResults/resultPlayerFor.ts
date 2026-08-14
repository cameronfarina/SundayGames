import type {
  ResultAcquisition,
  ResultBoardPlayer,
  SeasonMockResultPlayer,
} from "./types.js";
import { rounded } from "./format.js";

export const resultPlayerFor = (
  playerId: string,
  rosterSlot: string,
  starter: boolean,
  playersById: ReadonlyMap<string, ResultBoardPlayer>,
  acquisitionsByPlayerId: ReadonlyMap<string, ResultAcquisition>,
): SeasonMockResultPlayer | undefined => {
  const player = playersById.get(playerId);
  const acquisition = acquisitionsByPlayerId.get(playerId);
  if (player === undefined || acquisition === undefined) return undefined;
  return {
    playerId,
    playerName: player.name,
    position: player.position,
    rosterSlot,
    week1Points: rounded(player.week1Projection ?? 0),
    starter,
    source: acquisition.source,
    ...(acquisition.price === undefined ? {} : { price: acquisition.price }),
    ...(acquisition.overallPick === undefined ? {} : { overallPick: acquisition.overallPick }),
  };
};
