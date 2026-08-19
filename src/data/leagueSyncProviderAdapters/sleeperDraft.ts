import type {
  LeagueSyncRequestOptions,
  SyncedLeagueDraft,
} from "./contracts.js";
import {
  numberValue,
  optionalText,
  recordArray,
  recordValue,
} from "./decode.js";
import { fetchLeagueSyncJson } from "./httpJson.js";

const sleeperApiOrigin = "https://api.sleeper.app";

const sleeperJson = async (
  path: string,
  options: LeagueSyncRequestOptions,
): Promise<unknown> => await fetchLeagueSyncJson({
  ...options,
  providerLabel: "Sleeper",
  url: `${sleeperApiOrigin}${path}`,
});

const positiveInteger = (value: unknown): number | undefined => {
  const parsed = numberValue(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const snakeOrderFor = (draft: Record<string, unknown>): readonly string[] => {
  const slots = recordValue(draft.slot_to_roster_id);
  return Object.entries(slots)
    .map(([slot, rosterId]) => ({ slot: positiveInteger(slot), rosterId: optionalText(rosterId) }))
    .filter((entry): entry is { slot: number; rosterId: string } =>
      entry.slot !== undefined && entry.rosterId !== undefined
    )
    .sort((left, right) => left.slot - right.slot)
    .map(entry => entry.rosterId);
};

const draftFrom = (draft: Record<string, unknown>): SyncedLeagueDraft | undefined => {
  const type = optionalText(draft.type)?.toLowerCase();
  const settings = recordValue(draft.settings);
  if (type === "snake") {
    const rounds = positiveInteger(settings.rounds);
    const order = snakeOrderFor(draft);
    return rounds === undefined || order.length === 0
      ? undefined
      : { type: "snake", rounds, order };
  }
  if (type !== "auction") return undefined;
  const budgetDollars = positiveInteger(settings.auction_budget ?? settings.budget);
  if (budgetDollars === undefined) return undefined;
  return {
    type: "auction",
    budgetDollars,
    minimumBidDollars: positiveInteger(settings.minimum_bid) ?? 1,
  };
};

export const sleeperDraftForLeague = async (
  providerLeagueId: string,
  season: string,
  options: LeagueSyncRequestOptions,
): Promise<SyncedLeagueDraft | undefined> => {
  const leaguePath = `/v1/league/${encodeURIComponent(providerLeagueId)}`;
  const drafts = recordArray(await sleeperJson(`${leaguePath}/drafts`, options));
  const candidate = drafts.find(draft => optionalText(draft.season) === season) ?? drafts[0];
  const draftId = optionalText(candidate?.draft_id);
  if (candidate === undefined || draftId === undefined) return undefined;
  const detail = recordValue(await sleeperJson(`/v1/draft/${encodeURIComponent(draftId)}`, options));
  return draftFrom(detail);
};

export const sleeperKeeperLeague = (settings: Record<string, unknown>): boolean | undefined => {
  const type = numberValue(settings.type, Number.NaN);
  return Number.isInteger(type) && type >= 0 && type <= 2 ? type > 0 : undefined;
};
