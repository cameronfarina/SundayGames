import { createHash } from "node:crypto";
import type { Position } from "../../config/league.js";

export type JsonSnapshotValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonSnapshotValue[]
  | { readonly [key: string]: JsonSnapshotValue };

export interface PricingInputSnapshot {
  id: string;
  hash: string;
}

export interface PricingModelRunIdentityInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  inputHash: string;
}

export interface PricingSourcePrice {
  name: string;
  normalizedName: string;
  position: Position;
  price: number;
  scenarioPrice?: number;
  livePrice?: number;
  liveExpectedPrice?: number;
  personalValue?: number;
  recommendedMaxBid?: number;
  confidence?: number;
  tier?: string;
  warnings?: readonly string[];
}

export interface PricingExplanationRef {
  modelRunId: string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshotId: string;
  playerKey: string;
}

export interface PlayerPriceSnapshotRow {
  playerKey: string;
  playerName: string;
  normalizedName: string;
  position: Position;
  marketPrice: number;
  scenarioPrice: number;
  livePrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  warnings: readonly string[];
  explanationRef: PricingExplanationRef;
  confidence?: number;
  tier?: string;
  strategyOverlayId?: string;
}

export interface PricingSnapshot {
  snapshotId: string;
  modelRunId: string;
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshot: PricingInputSnapshot;
  rows: readonly PlayerPriceSnapshotRow[];
  createdAt?: string;
  strategyOverlayId?: string;
}

export interface CreatePricingSnapshotInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshot: PricingInputSnapshot;
  prices: readonly PricingSourcePrice[];
  createdAt?: string;
}

export interface PricingStrategyOverlay {
  strategyId: string;
  personalValueDeltas?: Readonly<Record<string, number>>;
  recommendedMaxBidDeltas?: Readonly<Record<string, number>>;
}

export interface PricingSnapshotRepository {
  save(snapshot: PricingSnapshot): PricingSnapshot;
  get(modelRunId: string, scenarioId?: string): PricingSnapshot | undefined;
  list(): readonly PricingSnapshot[];
}

export type PricingSnapshotErrorCode = "pricing_snapshot_conflict";

export class PricingSnapshotError extends Error {
  readonly code: PricingSnapshotErrorCode;

  constructor(code: PricingSnapshotErrorCode, message: string) {
    super(message);
    this.name = "PricingSnapshotError";
    this.code = code;
  }
}

type NormalizedSnapshotValue = JsonSnapshotValue | undefined;

const slugify = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const normalizeSnapshotValue = (value: unknown): NormalizedSnapshotValue => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Pricing snapshot inputs must contain only finite numbers.");
    }

    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(item => normalizeSnapshotValue(item) ?? null);
  }
  if (!isPlainRecord(value)) {
    throw new TypeError("Pricing snapshot inputs must be plain JSON-compatible values.");
  }

  const normalized: Record<string, JsonSnapshotValue> = {};
  for (const key of Object.keys(value).sort()) {
    const childValue = normalizeSnapshotValue(value[key]);
    if (childValue !== undefined) {
      normalized[key] = childValue;
    }
  }

  return normalized;
};

const canonicalSnapshotString = (value: unknown): string =>
  JSON.stringify(normalizeSnapshotValue(value) ?? null);

export const hashPricingSnapshotInputs = (inputs: unknown): string =>
  createHash("sha256").update(canonicalSnapshotString(inputs)).digest("hex");

export const createPricingInputSnapshot = (
  inputs: unknown,
  id?: string,
): PricingInputSnapshot => {
  const hash = hashPricingSnapshotInputs(inputs);

  return {
    id: id ?? `input-snapshot:${hash}`,
    hash,
  };
};

export const generatePricingModelRunId = ({
  leagueId,
  seasonYear,
  modelVersion,
  inputHash,
}: PricingModelRunIdentityInput): string =>
  [
    "pricing-model-run",
    slugify(leagueId),
    slugify(String(seasonYear)),
    slugify(modelVersion),
    inputHash,
  ].join(":");

const rowFromSourcePrice = (
  sourcePrice: PricingSourcePrice,
  snapshot: Pick<
    PricingSnapshot,
    "modelRunId" | "modelVersion" | "scenarioId" | "inputSnapshot"
  >,
): PlayerPriceSnapshotRow => {
  const scenarioPrice = sourcePrice.scenarioPrice ?? sourcePrice.price;
  const livePrice = sourcePrice.livePrice ?? sourcePrice.liveExpectedPrice ?? scenarioPrice;
  const personalValue = sourcePrice.personalValue ?? livePrice;
  const recommendedMaxBid = sourcePrice.recommendedMaxBid ?? personalValue;
  const playerKey = slugify(sourcePrice.normalizedName);

  return {
    playerKey,
    playerName: sourcePrice.name,
    normalizedName: sourcePrice.normalizedName,
    position: sourcePrice.position,
    marketPrice: sourcePrice.price,
    scenarioPrice,
    livePrice,
    personalValue,
    recommendedMaxBid,
    warnings: [...(sourcePrice.warnings ?? [])],
    explanationRef: {
      modelRunId: snapshot.modelRunId,
      modelVersion: snapshot.modelVersion,
      scenarioId: snapshot.scenarioId,
      inputSnapshotId: snapshot.inputSnapshot.id,
      playerKey,
    },
    ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
    ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
  };
};

export const createPricingSnapshot = ({
  leagueId,
  seasonYear,
  modelVersion,
  scenarioId,
  inputSnapshot,
  prices,
  createdAt,
}: CreatePricingSnapshotInput): PricingSnapshot => {
  const modelRunId = generatePricingModelRunId({
    leagueId,
    seasonYear,
    modelVersion,
    inputHash: inputSnapshot.hash,
  });
  const snapshotRef = {
    modelRunId,
    modelVersion,
    scenarioId,
    inputSnapshot,
  };

  return {
    snapshotId: `pricing-snapshot:${modelRunId}:${slugify(scenarioId)}`,
    modelRunId,
    leagueId,
    seasonYear,
    modelVersion,
    scenarioId,
    inputSnapshot,
    rows: prices.map(price => rowFromSourcePrice(price, snapshotRef)),
    ...(createdAt === undefined ? {} : { createdAt }),
  };
};

const deltaFor = (
  deltas: Readonly<Record<string, number>> | undefined,
  row: PlayerPriceSnapshotRow,
): number =>
  deltas?.[row.playerKey] ?? deltas?.[row.normalizedName] ?? 0;

export const applyStrategyOverlay = (
  snapshot: PricingSnapshot,
  overlay: PricingStrategyOverlay,
): PricingSnapshot => ({
  ...snapshot,
  strategyOverlayId: overlay.strategyId,
  rows: snapshot.rows.map(row => ({
    ...row,
    personalValue: row.personalValue + deltaFor(overlay.personalValueDeltas, row),
    recommendedMaxBid: row.recommendedMaxBid + deltaFor(overlay.recommendedMaxBidDeltas, row),
    strategyOverlayId: overlay.strategyId,
  })),
});

const freezeDeep = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;

  for (const child of Object.values(value)) {
    freezeDeep(child);
  }

  return Object.freeze(value);
};

const immutableSnapshot = (snapshot: PricingSnapshot): PricingSnapshot =>
  freezeDeep(structuredClone(snapshot));

const snapshotPayloadHash = (snapshot: PricingSnapshot): string => {
  const { createdAt: _createdAt, ...immutablePayload } = snapshot;

  return hashPricingSnapshotInputs(immutablePayload);
};

const snapshotStorageKey = (modelRunId: string, scenarioId: string): string =>
  `${modelRunId}\0${scenarioId}`;

export const assertPricingSnapshotCanBeSaved = (
  repository: PricingSnapshotRepository,
  snapshot: PricingSnapshot,
): void => {
  const existing = repository.get(snapshot.modelRunId, snapshot.scenarioId);
  if (existing !== undefined && snapshotPayloadHash(existing) !== snapshotPayloadHash(snapshot)) {
    throw new PricingSnapshotError(
      "pricing_snapshot_conflict",
      `Cannot overwrite pricing snapshot for modelRunId ${snapshot.modelRunId} and scenarioId ${snapshot.scenarioId} with a different payload.`,
    );
  }
};

export const createInMemoryPricingSnapshotRepository = (): PricingSnapshotRepository => {
  const snapshots = new Map<string, { readonly hash: string; readonly snapshot: PricingSnapshot }>();

  return {
    save(snapshot) {
      const key = snapshotStorageKey(snapshot.modelRunId, snapshot.scenarioId);
      const existing = snapshots.get(key);
      if (existing) {
        assertPricingSnapshotCanBeSaved(this, snapshot);

        return immutableSnapshot(existing.snapshot);
      }

      const hash = snapshotPayloadHash(snapshot);
      const immutable = immutableSnapshot(snapshot);
      snapshots.set(key, {
        hash,
        snapshot: immutable,
      });

      return immutableSnapshot(immutable);
    },
    get(modelRunId, scenarioId) {
      const existing = scenarioId === undefined
        ? [...snapshots.values()].find(entry => entry.snapshot.modelRunId === modelRunId)
        : snapshots.get(snapshotStorageKey(modelRunId, scenarioId));

      return existing ? immutableSnapshot(existing.snapshot) : undefined;
    },
    list() {
      return [...snapshots.values()].map(entry => immutableSnapshot(entry.snapshot));
    },
  };
};
