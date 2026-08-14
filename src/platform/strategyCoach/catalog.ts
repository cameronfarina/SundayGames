import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerCatalogEntry,
} from "./contracts.js";
import type { CatalogCandidate, ResolvedPlayer } from "./internalTypes.js";
import {
  aliasPattern,
  cleanMention,
  nameWithoutSuffix,
  normalizeSearchText,
} from "./text.js";

const generatedLastNameStopWords = new Set(["price"]);

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const catalogCandidatesFor = (
  catalog: readonly StrategyCoachPlayerCatalogEntry[],
): CatalogCandidate[] =>
  catalog.map(entry => {
    const normalizedName = normalizePlayerName(entry.normalizedName ?? entry.name);
    const nameParts = normalizeSearchText(normalizedName).split(" ").filter(Boolean);
    const firstName = nameParts[0];
    const lastName = nameParts[nameParts.length - 1];
    const firstLast = nameParts.length >= 3 ? `${nameParts[0]} ${nameParts[1]}` : undefined;
    const aliases = unique([
      entry.name,
      normalizedName,
      nameWithoutSuffix(normalizedName),
      ...(firstLast === undefined ? [] : [firstLast]),
      ...(firstName !== undefined && firstName.length >= 4 ? [firstName] : []),
      ...(lastName !== undefined && lastName.length >= 4 && !generatedLastNameStopWords.has(lastName)
        ? [lastName]
        : []),
      ...(entry.aliases ?? []),
    ].map(normalizeSearchText).filter(Boolean));

    return { entry, normalizedName, aliases };
  });

export const mentionIndexFor = (
  candidate: CatalogCandidate,
  text: string,
): { index: number; raw: string } | undefined => {
  const searchableText = normalizeSearchText(text);
  const aliases = [...candidate.aliases].sort((left, right) => right.length - left.length);

  for (const alias of aliases) {
    const match = aliasPattern(alias).exec(searchableText);
    if (match?.[2] !== undefined && match.index !== undefined) {
      const prefix = match[1] ?? "";
      return { index: match.index + prefix.length, raw: match[2] };
    }
  }

  return undefined;
};

export const resolvePlayer = (
  rawMention: string,
  candidates: readonly CatalogCandidate[],
): { resolved?: ResolvedPlayer; guardrail?: StrategyCoachGuardrail } => {
  const mention = normalizeSearchText(cleanMention(rawMention));
  if (!mention) return missingMention(rawMention);

  const matches = candidates.filter(candidate =>
    candidate.aliases.some(alias => alias === mention) ||
    normalizeSearchText(candidate.normalizedName).includes(mention));

  if (matches.length === 0) return missingPlayer(rawMention);
  if (matches.length > 1) return ambiguousPlayer(rawMention, matches);

  const match = matches[0];
  if (match === undefined) throw new Error("Expected one resolved player match.");

  return { resolved: { entry: match.entry, normalizedName: match.normalizedName } };
};

const missingMention = (rawMention: string): { guardrail: StrategyCoachGuardrail } => ({
  guardrail: {
    code: "missing_player",
    severity: "block",
    message: "The coach could not find a player name in that part of the prompt.",
    rawMention,
  },
});

const missingPlayer = (rawMention: string): { guardrail: StrategyCoachGuardrail } => ({
  guardrail: {
    code: "missing_player",
    severity: "block",
    message: `No catalog player matched "${cleanMention(rawMention)}".`,
    rawMention,
  },
});

const ambiguousPlayer = (
  rawMention: string,
  matches: readonly CatalogCandidate[],
): { guardrail: StrategyCoachGuardrail } => ({
  guardrail: {
    code: "ambiguous_player",
    severity: "block",
    message: `"${cleanMention(rawMention)}" matched multiple players. Use the full player name.`,
    rawMention,
    candidates: matches.map(match => match.entry.name),
  },
});
