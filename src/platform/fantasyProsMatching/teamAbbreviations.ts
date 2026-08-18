// FantasyPros speaks JAC/WAS/LAR; ESPN-derived catalogs in this repo speak
// JAX/WSH/LA. Both dialects fold to the FantasyPros spelling before comparison.
const canonicalTeamAbbreviations: ReadonlyMap<string, string> = new Map([
  ["JAX", "JAC"],
  ["WSH", "WAS"],
  ["LA", "LAR"],
]);

export const normalizeTeamAbbreviation = (
  value: string | undefined,
): string | undefined => {
  const upper = value?.trim().toUpperCase();
  if (upper === undefined || upper.length === 0) return undefined;
  return canonicalTeamAbbreviations.get(upper) ?? upper;
};

export const freeAgentTeamAbbreviation = "FA";
