import type { ConfirmedLeagueDraftInput } from "../leagueCreation.js";
import {
  providerLabelFor,
  type LeagueImportDraftSetup,
  type LeagueImportSource,
} from "./contracts.js";

export interface ImportedDraft {
  issues: readonly string[];
  draft: ConfirmedLeagueDraftInput | null;
  draftSetup?: LeagueImportDraftSetup;
}

/** Sunday Games allows a dollar bid; providers that hide theirs start at one. */
const defaultMinimumBid = 1;

const importedAuction = (
  source: LeagueImportSource,
  draftCapacity: number,
  issues: string[],
): ConfirmedLeagueDraftInput | null => {
  const label = providerLabelFor(source.provider);
  const budgetDollars = source.settings.auctionBudget;
  const minimumBidDollars = source.settings.minimumBid ?? defaultMinimumBid;
  if (budgetDollars === undefined) {
    issues.push(`Could not read the auction budget from ${label}.`);
    return null;
  }
  if (budgetDollars < draftCapacity * minimumBidDollars) {
    issues.push(
      `The $${budgetDollars} auction budget cannot cover a $${minimumBidDollars} ` +
      `minimum bid for all ${draftCapacity} roster slots.`,
    );
    return null;
  }
  return { type: "auction", budgetDollars, minimumBidDollars };
};

/**
 * Providers that do not publish a round count draft the whole roster, which is
 * what the slot list already describes. Draft order is the snapshot's own team
 * order, so the league drafts in the order the provider lists it.
 */
const importedSnake = (
  source: LeagueImportSource,
  draftCapacity: number,
): ConfirmedLeagueDraftInput => ({
  type: "snake",
  rounds: source.settings.snakeRounds ?? draftCapacity,
  order: source.teams.map(team => team.providerTeamId),
});

export const importedDraft = (
  source: LeagueImportSource,
  draftCapacity: number,
): ImportedDraft => {
  const issues: string[] = [];
  const draftType = source.settings.draftType;
  if (draftType === undefined) {
    issues.push(`${providerLabelFor(source.provider)} did not include this league's draft format.`);
    return {
      issues,
      draft: null,
      draftSetup: {
        auctionBudgetDollars: source.settings.auctionBudget ?? 200,
        minimumBidDollars: source.settings.minimumBid ?? defaultMinimumBid,
        snakeRounds: source.settings.snakeRounds ?? draftCapacity,
      },
    };
  }
  const draft = draftType === "auction"
    ? importedAuction(source, draftCapacity, issues)
    : importedSnake(source, draftCapacity);

  return { issues, draft };
};
