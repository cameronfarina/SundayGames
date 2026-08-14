import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { GenericAuctionMockPlayer } from "../genericAuctionMockEngine.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups.js";
import {
  isProtectedStarterPosition,
  starterEligiblePlayerIdsFor,
} from "../seasonStarterEligibility.js";

export const auctionPlayersFor = (
  setup: LiveDraftRoomSetup,
  expectedPrices: Readonly<Record<string, number>>,
  humanValues: Readonly<Record<string, number>>,
): readonly GenericAuctionMockPlayer[] => {
  const starterEligiblePlayerIds = starterEligiblePlayerIdsFor(setup.playerCatalog);
  return setup.playerCatalog.map(player => {
    const id = canonicalPlayerIdentityKey(player.name);
    const protectsStarterSlot = isProtectedStarterPosition(player.position);
    const starterEligible = protectsStarterSlot && starterEligiblePlayerIds.has(id);
    return {
      id,
      name: player.name,
      position: player.position,
      expectedPrice: expectedPrices[id] ?? player.expectedPrice,
      humanValue: humanValues[id] ?? expectedPrices[id] ?? player.expectedPrice,
      ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
      ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
      ...(player.week1Projection === undefined ? {} : { week1Projection: player.week1Projection }),
      ...(player.weeks1To4Projection === undefined
        ? {}
        : { weeks1To4Projection: player.weeks1To4Projection }),
      ...(player.seasonProjection === undefined ? {} : { seasonProjection: player.seasonProjection }),
      ...(protectsStarterSlot ? { starterEligible } : {}),
      ...(starterEligible ? { projectedStarter: true } : {}),
    };
  });
};
