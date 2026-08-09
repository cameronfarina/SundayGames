import { createHash } from "node:crypto";
import type { Owner, Position } from "../../config/league.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";

export type StrategyCoachMessageRole = "system" | "user" | "assistant";
export type StrategyCoachGuardrailSeverity = "info" | "warn" | "block";
export type StrategyCoachGuardrailCode =
  | "ambiguous_player"
  | "global_cap_conflict"
  | "missing_player"
  | "missing_price"
  | "price_capped"
  | "unresolved_wr_targets";
export type StrategyCoachConstraintIntent = "draft" | "target";
export type StrategyCoachPriceSource =
  | "expectedPrice"
  | "fallbackPrice"
  | "marketPrice"
  | "maxBid"
  | "price"
  | "prompt"
  | "recommendedMaxBid";

export interface StrategyCoachOwnerIdentity {
  ownerId: string;
  ownerName: Owner | string;
  teamId?: string;
  teamName?: string;
}

export interface StrategyCoachMessage {
  id: string;
  conversationId: string;
  role: StrategyCoachMessageRole;
  content: string;
  createdAt: Date;
  planId?: string;
}

export interface StrategyCoachConversation {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  messages: readonly StrategyCoachMessage[];
  planIds: readonly string[];
  createdAt: Date;
}

export interface StrategyCoachPlayerCatalogEntry {
  playerId?: string;
  name: string;
  normalizedName?: string;
  position: Position;
  price?: number;
  expectedPrice?: number;
  marketPrice?: number;
  recommendedMaxBid?: number;
  maxBid?: number;
  fallbackPrice?: number;
  aliases?: readonly string[];
}

export interface StrategyCoachPlayerConstraint {
  intent: StrategyCoachConstraintIntent;
  rawMention: string;
  playerName: string;
  normalizedName: string;
  position: Position;
  playerId?: string;
  slot?: string;
  price?: number;
  maxBid?: number;
  priceSource?: StrategyCoachPriceSource;
}

export interface StrategyCoachGuardrail {
  code: StrategyCoachGuardrailCode;
  severity: StrategyCoachGuardrailSeverity;
  message: string;
  rawMention?: string;
  playerName?: string;
  candidates?: readonly string[];
}

export interface StrategyCoachExtractedConstraints {
  hardLocks: readonly StrategyCoachPlayerConstraint[];
  rb2Alternatives: readonly StrategyCoachPlayerConstraint[];
  wrCandidates: readonly StrategyCoachPlayerConstraint[];
  desiredWrCount?: number;
  globalMaxPrice?: number;
  globalMaxExcludesKeeper: boolean;
  avoidElite: boolean;
  valueIntent: boolean;
}

export interface StrategyCoachVariant {
  id: string;
  name: string;
  summary: string;
  runnable: boolean;
  commands: readonly string[];
  hardLocks: readonly StrategyCoachPlayerConstraint[];
  rb2Selection?: StrategyCoachPlayerConstraint;
  wrTargets: readonly StrategyCoachPlayerConstraint[];
  guardrails: readonly StrategyCoachGuardrail[];
}

export interface StrategyCoachPlan {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  extractedConstraints: StrategyCoachExtractedConstraints;
  variants: readonly StrategyCoachVariant[];
  guardrails: readonly StrategyCoachGuardrail[];
  createdAt: Date;
  conversationId?: string;
}

export interface BuildStrategyCoachPlanInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  privateOwnerUserId: string;
  owner: StrategyCoachOwnerIdentity;
  promptText: string;
  playerCatalog: readonly StrategyCoachPlayerCatalogEntry[];
  createdAt?: Date;
  conversationId?: string;
}

export interface StrategyCoachService {
  createPlanFromPrompt(input: BuildStrategyCoachPlanInput): {
    conversation: StrategyCoachConversation;
    plan: StrategyCoachPlan;
  };
  getConversationForUser(userId: string, conversationId: string): StrategyCoachConversation | null;
  getPlanForUser(userId: string, planId: string): StrategyCoachPlan | null;
  listConversationsForUser(
    userId: string,
    leagueId?: string,
    seasonId?: string,
  ): readonly StrategyCoachConversation[];
  listPlansForUser(userId: string, leagueId?: string, seasonId?: string): readonly StrategyCoachPlan[];
}

interface CatalogCandidate {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
  aliases: readonly string[];
}

interface ResolvedPlayer {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
}

interface PlayerMention {
  entry: StrategyCoachPlayerCatalogEntry;
  normalizedName: string;
  rawMention: string;
  index: number;
}

interface PriceValue {
  value: number;
  source: StrategyCoachPriceSource;
}

type PricePreference = "draft" | "target";

const suffixPattern = /\b(?:jr|sr|ii|iii|iv)\.?$/i;
const generatedLastNameStopWords = new Set(["price"]);

const now = (): Date => new Date();

const clone = <T>(value: T): T => structuredClone(value);

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);

  return `{${serializedEntries.join(",")}}`;
};

const stableId = (prefix: string, value: unknown): string => {
  const hash = createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 20);

  return `${prefix}_${hash}`;
};

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

const normalizeSearchText = (value: string): string =>
  normalizePlayerName(value)
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const cleanMention = (value: string): string =>
  value
    .replace(/[’‘]/g, "'")
    .replace(/\betc\.?\b/gi, "")
    .replace(/^[\s,.:;()[\]-]+|[\s,.:;()[\]-]+$/g, "")
    .trim()
    .replace(/\s+/g, " ");

const nameWithoutSuffix = (name: string): string =>
  name.replace(suffixPattern, "").trim();

const catalogCandidatesFor = (
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

    return {
      entry,
      normalizedName,
      aliases,
    };
  });

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const aliasPattern = (alias: string): RegExp => {
  const pattern = alias
    .split(/\s+/)
    .map(escapeRegExp)
    .join("\\s+");

  return new RegExp(`(^|[^a-z0-9'])(${pattern})(?=$|[^a-z0-9'])`, "i");
};

const mentionIndexFor = (candidate: CatalogCandidate, text: string): { index: number; raw: string } | undefined => {
  const searchableText = normalizeSearchText(text);
  const aliases = [...candidate.aliases].sort((leftAlias, rightAlias) => rightAlias.length - leftAlias.length);

  for (const alias of aliases) {
    const match = aliasPattern(alias).exec(searchableText);
    if (match?.[2] !== undefined && match.index !== undefined) {
      const prefix = match[1] ?? "";
      return {
        index: match.index + prefix.length,
        raw: match[2],
      };
    }
  }

  return undefined;
};

const resolvePlayer = (
  rawMention: string,
  candidates: readonly CatalogCandidate[],
): { resolved?: ResolvedPlayer; guardrail?: StrategyCoachGuardrail } => {
  const mention = normalizeSearchText(cleanMention(rawMention));
  if (!mention) {
    return {
      guardrail: {
        code: "missing_player",
        severity: "block",
        message: "The coach could not find a player name in that part of the prompt.",
        rawMention,
      },
    };
  }

  const matches = candidates.filter(candidate =>
    candidate.aliases.some(alias => alias === mention) ||
    normalizeSearchText(candidate.normalizedName).includes(mention),
  );

  if (matches.length === 0) {
    return {
      guardrail: {
        code: "missing_player",
        severity: "block",
        message: `No catalog player matched "${cleanMention(rawMention)}".`,
        rawMention,
      },
    };
  }

  if (matches.length > 1) {
    return {
      guardrail: {
        code: "ambiguous_player",
        severity: "block",
        message: `"${cleanMention(rawMention)}" matched multiple players. Use the full player name.`,
        rawMention,
        candidates: matches.map(match => match.entry.name),
      },
    };
  }

  const [match] = matches;
  if (match === undefined) {
    throw new Error("Expected one resolved player match.");
  }

  return {
    resolved: {
      entry: match.entry,
      normalizedName: match.normalizedName,
    },
  };
};

const priceValueFor = (
  entry: StrategyCoachPlayerCatalogEntry,
  preference: PricePreference,
): PriceValue | undefined => {
  const fields: readonly Exclude<StrategyCoachPriceSource, "prompt">[] = preference === "draft"
    ? ["price", "expectedPrice", "marketPrice", "recommendedMaxBid", "maxBid", "fallbackPrice"]
    : ["recommendedMaxBid", "maxBid", "price", "expectedPrice", "marketPrice", "fallbackPrice"];

  for (const field of fields) {
    const value = entry[field];
    if (value !== undefined && Number.isFinite(value) && value >= 0) {
      return { value, source: field };
    }
  }

  return undefined;
};

const constraintFor = (
  resolved: ResolvedPlayer,
  intent: StrategyCoachConstraintIntent,
  rawMention: string,
  options: {
    pricePreference: PricePreference;
    slot?: string;
    promptMaxBid?: number;
  },
): StrategyCoachPlayerConstraint => {
  const price = options.promptMaxBid === undefined
    ? priceValueFor(resolved.entry, options.pricePreference)
    : { value: options.promptMaxBid, source: "prompt" as const };

  return {
    intent,
    rawMention: cleanMention(rawMention),
    playerName: resolved.entry.name,
    normalizedName: resolved.normalizedName,
    position: resolved.entry.position,
    ...(resolved.entry.playerId === undefined ? {} : { playerId: resolved.entry.playerId }),
    ...(options.slot === undefined ? {} : { slot: options.slot.toUpperCase() }),
    ...(intent === "draft" && price !== undefined ? { price: price.value } : {}),
    ...(intent === "target" && price !== undefined ? { maxBid: price.value } : {}),
    ...(price === undefined ? {} : { priceSource: price.source }),
  };
};

const desiredWrCountFrom = (promptText: string): number | undefined => {
  const match = /\b(?:i\s+)?(?:want|need|draft|get)\s+(\d+)\s+(?:(?:good|starting|value|high[-\s]floor|solid)\s+)*wrs?\b/i
    .exec(promptText);
  if (!match?.[1]) return undefined;

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : undefined;
};

const globalMaxPriceFrom = (promptText: string): number | undefined => {
  const match = /\b(?:no|without|avoid)\s+(?:players?|one|anyone)\s+(?:over|above)\s*\$?(\d+)\b/i.exec(promptText);
  if (!match?.[1]) return undefined;

  const price = Number(match[1]);
  return Number.isInteger(price) && price >= 0 ? price : undefined;
};

const hasAvoidEliteIntent = (promptText: string): boolean =>
  /\b(?:nothing\s+elite|not\s+(?:looking\s+for\s+)?elite|avoid\s+elite|no\s+elite|good\s+but\s+not\s+great)\b/i
    .test(promptText);

const hasValueIntent = (promptText: string): boolean =>
  /\b(?:balanced|value|wait\s+later|high[-\s]floor|good\s+wrs?|spend\s+their\s+money)\b/i
    .test(promptText);

const extractHardLocks = (
  promptText: string,
  candidates: readonly CatalogCandidate[],
  guardrails: StrategyCoachGuardrail[],
): StrategyCoachPlayerConstraint[] => {
  const hardLocks: StrategyCoachPlayerConstraint[] = [];
  const hardLockPattern = /\bdraft\s+([^,.;\n]+?)\s+as\s+((?:RB|WR)\d|QB|TE|FLEX|K|DST)\b/gi;

  for (const match of promptText.matchAll(hardLockPattern)) {
    const rawMention = match[1];
    const slot = match[2];
    if (rawMention === undefined || slot === undefined) continue;

    const resolved = resolvePlayer(rawMention, candidates);
    if (resolved.guardrail) {
      guardrails.push(resolved.guardrail);
      continue;
    }
    if (resolved.resolved === undefined) continue;

    hardLocks.push(constraintFor(resolved.resolved, "draft", rawMention, {
      pricePreference: "draft",
      slot,
    }));
  }

  return uniqueConstraints(hardLocks);
};

const mentionedPlayersIn = (
  text: string,
  candidates: readonly CatalogCandidate[],
  position: Position,
): PlayerMention[] =>
  candidates
    .filter(candidate => candidate.entry.position === position)
    .map(candidate => {
      const mention = mentionIndexFor(candidate, text);
      return mention === undefined
        ? undefined
        : {
          entry: candidate.entry,
          normalizedName: candidate.normalizedName,
          rawMention: mention.raw,
          index: mention.index,
        };
    })
    .filter((mention): mention is PlayerMention => mention !== undefined)
    .sort((left, right) => left.index - right.index);

const rb2WindowFrom = (promptText: string): string => {
  const lowerPrompt = promptText.toLowerCase();
  const rb2Index = lowerPrompt.indexOf("rb2");
  if (rb2Index === -1) return "";

  const wrIndex = lowerPrompt.indexOf("for wr", rb2Index);
  const endIndex = wrIndex === -1 ? Math.min(promptText.length, rb2Index + 320) : wrIndex;

  return promptText.slice(rb2Index, endIndex);
};

const constraintsFromMentions = (
  mentions: readonly PlayerMention[],
  intent: StrategyCoachConstraintIntent,
  options: {
    pricePreference: PricePreference;
    slot?: string;
    promptMaxBidByName?: ReadonlyMap<string, number>;
  },
): StrategyCoachPlayerConstraint[] =>
  uniqueConstraints(mentions.map(mention => {
    const promptMaxBid = options.promptMaxBidByName?.get(mention.normalizedName);

    return constraintFor(
      {
        entry: mention.entry,
        normalizedName: mention.normalizedName,
      },
      intent,
      mention.rawMention,
      {
        pricePreference: options.pricePreference,
        ...(options.slot === undefined ? {} : { slot: options.slot }),
        ...(promptMaxBid === undefined ? {} : { promptMaxBid }),
      },
    );
  }));

const extractExplicitTargetMentions = (
  promptText: string,
  candidates: readonly CatalogCandidate[],
  guardrails: StrategyCoachGuardrail[],
): StrategyCoachPlayerConstraint[] => {
  const targetPattern = /\btarget\s+([^,.;\n]+?)(?:\s+(?:max|maximum|up\s+to|under|<=)\s*\$?(\d+))?(?=$|[,.;\n])/gi;
  const constraints: StrategyCoachPlayerConstraint[] = [];

  for (const match of promptText.matchAll(targetPattern)) {
    const rawMention = match[1];
    if (rawMention === undefined) continue;

    const promptMaxBid = match[2] === undefined ? undefined : Number(match[2]);
    const resolved = resolvePlayer(rawMention, candidates);
    if (resolved.guardrail) {
      guardrails.push(resolved.guardrail);
      continue;
    }
    if (resolved.resolved === undefined) continue;

    constraints.push(constraintFor(resolved.resolved, "target", rawMention, {
      pricePreference: "target",
      ...(promptMaxBid !== undefined && Number.isInteger(promptMaxBid) && promptMaxBid >= 0 ? { promptMaxBid } : {}),
    }));
  }

  return uniqueConstraints(constraints);
};

const uniqueConstraints = (
  constraints: readonly StrategyCoachPlayerConstraint[],
): StrategyCoachPlayerConstraint[] => {
  const seen = new Set<string>();
  const uniqueValues: StrategyCoachPlayerConstraint[] = [];

  for (const constraint of constraints) {
    const key = `${constraint.intent}:${constraint.slot ?? ""}:${constraint.normalizedName}`;
    if (seen.has(key)) continue;

    seen.add(key);
    uniqueValues.push(constraint);
  }

  return uniqueValues;
};

const missingPriceGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
): StrategyCoachGuardrail => ({
  code: "missing_price",
  severity: "block",
  message: `No catalog price or cap was supplied for ${constraint.playerName}.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

const globalCapConflictGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number,
): StrategyCoachGuardrail => ({
  code: "global_cap_conflict",
  severity: "block",
  message: `${constraint.playerName} is priced at $${constraint.price ?? constraint.maxBid}, above the $${globalMaxPrice} cap.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

const priceCappedGuardrailFor = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number,
): StrategyCoachGuardrail => ({
  code: "price_capped",
  severity: "warn",
  message: `${constraint.playerName} is above the $${globalMaxPrice} cap, so the runnable command caps the target at $${globalMaxPrice}.`,
  rawMention: constraint.rawMention,
  playerName: constraint.playerName,
});

const dedupeGuardrails = (
  guardrails: readonly StrategyCoachGuardrail[],
): StrategyCoachGuardrail[] => {
  const seen = new Set<string>();
  const deduped: StrategyCoachGuardrail[] = [];

  for (const guardrail of guardrails) {
    const key = `${guardrail.code}:${guardrail.severity}:${guardrail.playerName ?? ""}:${guardrail.rawMention ?? ""}`;
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(guardrail);
  }

  return deduped;
};

const commandForDraft = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number | undefined,
  guardrails: StrategyCoachGuardrail[],
): string => {
  if (constraint.price === undefined) {
    guardrails.push(missingPriceGuardrailFor(constraint));
    return `draft ${constraint.playerName}`;
  }

  if (globalMaxPrice !== undefined && constraint.price > globalMaxPrice) {
    guardrails.push(globalCapConflictGuardrailFor(constraint, globalMaxPrice));
  }

  return `draft ${constraint.playerName} for $${constraint.price}`;
};

const commandForTarget = (
  constraint: StrategyCoachPlayerConstraint,
  globalMaxPrice: number | undefined,
  guardrails: StrategyCoachGuardrail[],
): string => {
  if (constraint.maxBid === undefined) {
    guardrails.push(missingPriceGuardrailFor(constraint));
    return `target ${constraint.playerName}`;
  }

  const maxBid = globalMaxPrice === undefined ? constraint.maxBid : Math.min(constraint.maxBid, globalMaxPrice);
  if (globalMaxPrice !== undefined && constraint.maxBid > globalMaxPrice) {
    guardrails.push(priceCappedGuardrailFor(constraint, globalMaxPrice));
  }

  return `target ${constraint.playerName} max $${maxBid}`;
};

const variantNameFor = (
  rb2Selection: StrategyCoachPlayerConstraint | undefined,
  wrTargets: readonly StrategyCoachPlayerConstraint[],
): string => {
  if (rb2Selection !== undefined) {
    return `${rb2Selection.playerName} RB2 + ${wrTargets.length > 0 ? "value WRs" : "open build"}`;
  }

  return wrTargets.length > 0 ? "Value WR targets" : "Base locks";
};

const buildVariants = (
  input: {
    hardLocks: readonly StrategyCoachPlayerConstraint[];
    rb2Alternatives: readonly StrategyCoachPlayerConstraint[];
    wrCandidates: readonly StrategyCoachPlayerConstraint[];
    desiredWrCount?: number;
    globalMaxPrice?: number;
    planSeed: unknown;
  },
): { variants: StrategyCoachVariant[]; guardrails: StrategyCoachGuardrail[] } => {
  const wrTargets = input.desiredWrCount === undefined
    ? input.wrCandidates
    : input.wrCandidates.slice(0, input.desiredWrCount);
  const rb2Selections = input.rb2Alternatives.length > 0 ? input.rb2Alternatives : [undefined];
  const planGuardrails: StrategyCoachGuardrail[] = [];

  if (input.desiredWrCount !== undefined && input.wrCandidates.length === 0) {
    planGuardrails.push({
      code: "unresolved_wr_targets",
      severity: "warn",
      message: `The prompt asks for ${input.desiredWrCount} WRs but does not resolve exact WR targets from the catalog.`,
    });
  }

  const variants = rb2Selections.map((rb2Selection, index) => {
    const variantGuardrails: StrategyCoachGuardrail[] = [];
    const commands = [
      ...input.hardLocks.map(lock => commandForDraft(lock, input.globalMaxPrice, variantGuardrails)),
      ...(rb2Selection === undefined ? [] : [commandForDraft(rb2Selection, input.globalMaxPrice, variantGuardrails)]),
      ...wrTargets.map(target => commandForTarget(target, input.globalMaxPrice, variantGuardrails)),
    ];
    const guardrails = dedupeGuardrails(variantGuardrails);
    const name = variantNameFor(rb2Selection, wrTargets);

    return {
      id: stableId("strategy_variant", { planSeed: input.planSeed, index, name, commands }),
      name,
      summary: commands.length > 0 ? commands.join("; ") : "No runnable commands were resolved.",
      runnable: !guardrails.some(guardrail => guardrail.severity === "block"),
      commands,
      hardLocks: input.hardLocks,
      ...(rb2Selection === undefined ? {} : { rb2Selection }),
      wrTargets,
      guardrails,
    };
  });

  return {
    variants,
    guardrails: dedupeGuardrails([
      ...planGuardrails,
      ...variants.flatMap(variant => variant.guardrails),
    ]),
  };
};

export const buildStrategyCoachPlan = (
  input: BuildStrategyCoachPlanInput,
): StrategyCoachPlan => {
  const createdAt = input.createdAt ?? now();
  const candidates = catalogCandidatesFor(input.playerCatalog);
  const extractionGuardrails: StrategyCoachGuardrail[] = [];
  const hardLocks = extractHardLocks(input.promptText, candidates, extractionGuardrails);
  const hardLockNames = new Set(hardLocks.map(lock => lock.normalizedName));
  const rb2Mentions = mentionedPlayersIn(rb2WindowFrom(input.promptText), candidates, "RB")
    .filter(mention => !hardLockNames.has(mention.normalizedName));
  const rb2Alternatives = constraintsFromMentions(rb2Mentions, "draft", {
    pricePreference: "draft",
    slot: "RB2",
  });
  const explicitTargets = extractExplicitTargetMentions(input.promptText, candidates, extractionGuardrails);
  const explicitTargetNames = new Set(explicitTargets.map(target => target.normalizedName));
  const mentionedWrTargets = constraintsFromMentions(mentionedPlayersIn(input.promptText, candidates, "WR"), "target", {
    pricePreference: "target",
  }).filter(target => !explicitTargetNames.has(target.normalizedName));
  const wrCandidates = uniqueConstraints([...explicitTargets, ...mentionedWrTargets]
    .filter(target => target.position === "WR"));
  const desiredWrCount = desiredWrCountFrom(input.promptText);
  const globalMaxPrice = globalMaxPriceFrom(input.promptText);
  const extractedConstraints: StrategyCoachExtractedConstraints = {
    hardLocks,
    rb2Alternatives,
    wrCandidates,
    ...(desiredWrCount === undefined ? {} : { desiredWrCount }),
    ...(globalMaxPrice === undefined ? {} : { globalMaxPrice }),
    globalMaxExcludesKeeper: /\b(?:besides|except)\s+(?:my\s+)?keeper\b/i.test(input.promptText),
    avoidElite: hasAvoidEliteIntent(input.promptText),
    valueIntent: hasValueIntent(input.promptText),
  };
  const planSeed = {
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    privateOwnerUserId: input.privateOwnerUserId,
    owner: input.owner,
    promptText: input.promptText,
    createdAt: createdAt.toISOString(),
  };
  const { variants, guardrails: variantGuardrails } = buildVariants({
    hardLocks,
    rb2Alternatives,
    wrCandidates,
    ...(desiredWrCount === undefined ? {} : { desiredWrCount }),
    ...(globalMaxPrice === undefined ? {} : { globalMaxPrice }),
    planSeed,
  });
  const guardrails = dedupeGuardrails([...extractionGuardrails, ...variantGuardrails]);

  return {
    id: stableId("strategy_plan", planSeed),
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    privateOwnerUserId: input.privateOwnerUserId,
    owner: input.owner,
    promptText: input.promptText,
    extractedConstraints,
    variants,
    guardrails,
    createdAt,
    ...(input.conversationId === undefined ? {} : { conversationId: input.conversationId }),
  };
};

export class InMemoryStrategyCoachRepository {
  readonly #conversationsById = new Map<string, StrategyCoachConversation>();
  readonly #plansById = new Map<string, StrategyCoachPlan>();

  saveConversation(conversation: StrategyCoachConversation): StrategyCoachConversation {
    const stored = clone(conversation);
    this.#conversationsById.set(stored.id, stored);

    return clone(stored);
  }

  savePlan(plan: StrategyCoachPlan): StrategyCoachPlan {
    const stored = clone(plan);
    this.#plansById.set(stored.id, stored);

    return clone(stored);
  }

  getConversationForUser(userId: string, conversationId: string): StrategyCoachConversation | null {
    const conversation = this.#conversationsById.get(conversationId);
    if (conversation === undefined || conversation.privateOwnerUserId !== userId) return null;

    return clone(conversation);
  }

  getPlanForUser(userId: string, planId: string): StrategyCoachPlan | null {
    const plan = this.#plansById.get(planId);
    if (plan === undefined || plan.privateOwnerUserId !== userId) return null;

    return clone(plan);
  }

  listConversationsForUser(
    userId: string,
    leagueId?: string,
    seasonId?: string,
  ): StrategyCoachConversation[] {
    return [...this.#conversationsById.values()]
      .filter(conversation =>
        conversation.privateOwnerUserId === userId &&
        (leagueId === undefined || conversation.leagueId === leagueId) &&
        (seasonId === undefined || conversation.seasonId === seasonId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  listPlansForUser(userId: string, leagueId?: string, seasonId?: string): StrategyCoachPlan[] {
    return [...this.#plansById.values()]
      .filter(plan =>
        plan.privateOwnerUserId === userId &&
        (leagueId === undefined || plan.leagueId === leagueId) &&
        (seasonId === undefined || plan.seasonId === seasonId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }
}

export const createStrategyCoachService = (
  repository = new InMemoryStrategyCoachRepository(),
): StrategyCoachService => ({
  createPlanFromPrompt(input) {
    const createdAt = input.createdAt ?? now();
    const conversationId = input.conversationId ?? stableId("coach_conversation", {
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      privateOwnerUserId: input.privateOwnerUserId,
      promptText: input.promptText,
      createdAt: createdAt.toISOString(),
    });
    const plan = buildStrategyCoachPlan({
      ...input,
      createdAt,
      conversationId,
    });
    const conversation: StrategyCoachConversation = {
      id: conversationId,
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      privateOwnerUserId: input.privateOwnerUserId,
      owner: input.owner,
      promptText: input.promptText,
      messages: [
        {
          id: stableId("coach_message", { conversationId, role: "user", content: input.promptText, createdAt }),
          conversationId,
          role: "user",
          content: input.promptText,
          createdAt,
        },
        {
          id: stableId("coach_message", { conversationId, role: "assistant", planId: plan.id, createdAt }),
          conversationId,
          role: "assistant",
          content: `Built ${plan.variants.length} deterministic strategy plan variant${plan.variants.length === 1 ? "" : "s"}.`,
          createdAt,
          planId: plan.id,
        },
      ],
      planIds: [plan.id],
      createdAt,
    };

    return {
      conversation: repository.saveConversation(conversation),
      plan: repository.savePlan(plan),
    };
  },
  getConversationForUser(userId, conversationId) {
    return repository.getConversationForUser(userId, conversationId);
  },
  getPlanForUser(userId, planId) {
    return repository.getPlanForUser(userId, planId);
  },
  listConversationsForUser(userId, leagueId, seasonId) {
    return repository.listConversationsForUser(userId, leagueId, seasonId);
  },
  listPlansForUser(userId, leagueId, seasonId) {
    return repository.listPlansForUser(userId, leagueId, seasonId);
  },
});
