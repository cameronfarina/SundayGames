import type { ResolutionCandidate } from "./internalTypes.js";

export interface MatchOptions {
  allowPrefix?: boolean;
}

export const matchesFor = <T>(
  mention: string,
  candidates: readonly ResolutionCandidate<T>[],
  normalize: (value: string) => string,
  options: MatchOptions = {},
): ResolutionCandidate<T>[] => {
  const mentionKey = normalize(mention);
  const matchesById = new Map<string, ResolutionCandidate<T>>();

  for (const candidate of candidates) {
    if (candidate.aliases.has(mentionKey)) matchesById.set(candidate.id, candidate);
  }

  if (matchesById.size > 0 || options.allowPrefix !== true || mentionKey.length < 3) {
    return [...matchesById.values()];
  }

  for (const candidate of candidates) {
    if ([...candidate.aliases].some(alias => alias.startsWith(mentionKey))) {
      matchesById.set(candidate.id, candidate);
    }
  }

  return [...matchesById.values()];
};
