import { canonicalPlayerIdentityKey } from "../normalizePlayerName.js";
import type { EspnPpr300AuctionBaselineValue } from "./contracts.js";
import { parseEspnPpr300AuctionBaselineRow } from "./parser.js";
import { rawEspnPpr300AuctionBaseline2026Part1 } from "./rawPart1.js";
import { rawEspnPpr300AuctionBaseline2026Part2 } from "./rawPart2.js";
import { rawEspnPpr300AuctionBaseline2026Part3 } from "./rawPart3.js";

const rawBaseline = [
  rawEspnPpr300AuctionBaseline2026Part1,
  rawEspnPpr300AuctionBaseline2026Part2,
  rawEspnPpr300AuctionBaseline2026Part3,
].join("\n");

export const espnPpr300AuctionBaseline2026 = Object.freeze(
  rawBaseline.split("\n").map(parseEspnPpr300AuctionBaselineRow),
);

const baselineByName = new Map(
  espnPpr300AuctionBaseline2026.map(player => [player.normalizedName, player]),
);

export const espnPpr300AuctionBaselineValueFor = (
  name: string,
): EspnPpr300AuctionBaselineValue | undefined =>
  baselineByName.get(canonicalPlayerIdentityKey(name));
