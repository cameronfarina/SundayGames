import type { PricingModelRunIdentityInput } from "./contracts.js";
import { slugify } from "./slug.js";

export const generatePricingModelRunId = ({
  leagueId,
  seasonYear,
  modelVersion,
  inputHash,
}: PricingModelRunIdentityInput): string => [
  "pricing-model-run",
  slugify(leagueId),
  slugify(String(seasonYear)),
  slugify(modelVersion),
  inputHash,
].join(":");
