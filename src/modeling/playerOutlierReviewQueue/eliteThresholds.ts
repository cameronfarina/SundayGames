import type {
  HighPriceVolumeSanity,
  TopPlayerSanityRow,
} from "../topPlayerSanity.js";

export const reviewedEliteThresholdsFor = (
  player: TopPlayerSanityRow,
  volumes: readonly HighPriceVolumeSanity[],
): HighPriceVolumeSanity[] =>
  volumes.filter(volume =>
    volume.status === "review"
    && (
      player.scenarioPrice >= volume.threshold
      || player.averageMockSalePrice >= volume.threshold
      || player.maxMockSalePrice >= volume.threshold
    ),
  );
