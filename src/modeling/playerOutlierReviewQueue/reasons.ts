import type {
  TopPlayerSanityReport,
  TopPlayerSanityRow,
} from "../topPlayerSanity.js";
import { additionalReasonsFor } from "./additionalReasons.js";
import type { PlayerOutlierReason } from "./contracts.js";
import { reasonForFlag } from "./flagReason.js";

export const reasonsFor = (
  player: TopPlayerSanityRow,
  report: TopPlayerSanityReport,
): PlayerOutlierReason[] => [
  ...player.flags.map(flag => reasonForFlag(flag, player)),
  ...additionalReasonsFor(player, report),
];
