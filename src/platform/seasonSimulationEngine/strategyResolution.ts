import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type { LiveDraftRoomSetup } from "../liveDraftRoomSetups/contracts.js";
import {
  targetKeeperInfeasibilityFor,
  targetResolutionInfeasibilityFor,
  type SeasonSimulationTargetConstraint,
  type ResolvedSeasonSimulationTarget,
} from "../seasonSimulationTargets.js";
import type { ParsedSeasonSimulationStrategy } from "./contracts.js";
import { targetsFor } from "./auctionTargets.js";
import { summaryFor } from "./strategySupport.js";

const hasContiguousTokenPrefixMatch = (
  catalogId: string,
  queryTokens: readonly string[],
): boolean => catalogId.split(" ").some((_, startIndex, catalogTokens) =>
  queryTokens.every((queryToken, queryIndex) =>
    catalogTokens[startIndex + queryIndex]?.startsWith(queryToken) === true
  )
);

const mergeTargetConstraints = (
  primary: SeasonSimulationTargetConstraint,
  fallback: SeasonSimulationTargetConstraint,
): SeasonSimulationTargetConstraint => ({
  playerName: primary.playerName,
  ...((primary.maxAuctionPrice ?? fallback.maxAuctionPrice) === undefined ? {} : {
    maxAuctionPrice: primary.maxAuctionPrice ?? fallback.maxAuctionPrice,
  }),
  ...((primary.maxSnakeRound ?? fallback.maxSnakeRound) === undefined ? {} : {
    maxSnakeRound: primary.maxSnakeRound ?? fallback.maxSnakeRound,
  }),
  ...((primary.maxSnakeOverallPick ?? fallback.maxSnakeOverallPick) === undefined ? {} : {
    maxSnakeOverallPick: primary.maxSnakeOverallPick ?? fallback.maxSnakeOverallPick,
  }),
});

export const resolvedStrategy = (
  strategy: ParsedSeasonSimulationStrategy,
  setup: LiveDraftRoomSetup,
  humanTeamId: string,
  teams: readonly { id: string; displayName: string }[],
  draftFormat: "auction" | "snake" | undefined,
): {
  strategy: ParsedSeasonSimulationStrategy;
  resolvedTargets: readonly ResolvedSeasonSimulationTarget[];
  pairPlayerId: string | undefined;
} => {
  const catalogNamesById = new Map(setup.playerCatalog.map(player => [
    canonicalPlayerIdentityKey(player.name),
    player.name,
  ]));
  const catalogIds = new Set(catalogNamesById.keys());
  const resolveCatalogId = (name: string | undefined): {
    id: string | undefined;
    ambiguous: boolean;
  } => {
    if (name === undefined) return { id: undefined, ambiguous: false };
    const query = canonicalPlayerIdentityKey(name);
    if (catalogIds.has(query)) return { id: query, ambiguous: false };
    const queryTokens = query.split(" ");
    const matches = [...catalogIds].filter(id =>
      id.startsWith(`${query} `)
      || id.endsWith(` ${query}`)
      || id.includes(` ${query} `)
      || hasContiguousTokenPrefixMatch(id, queryTokens)
      || (
        id.split(" ").length === queryTokens.length
        && id.split(" ").every((token, index) =>
          token.startsWith(queryTokens[index] ?? "")
          || (queryTokens[index] ?? "").startsWith(token)
        )
      )
    );
    return matches.length === 1
      ? { id: matches[0], ambiguous: false }
      : { id: undefined, ambiguous: matches.length > 1 };
  };
  const resolvedTargets = targetsFor(strategy).map(target => {
    const resolution = resolveCatalogId(target.playerName);
    return {
      target: {
        ...target,
        playerName: resolution.id === undefined
          ? target.playerName
          : catalogNamesById.get(resolution.id) ?? target.playerName,
      },
      resolution,
      playerId: resolution.id ?? canonicalPlayerIdentityKey(target.playerName),
    };
  }).reduce<{
    target: SeasonSimulationTargetConstraint;
    resolution: { id: string | undefined; ambiguous: boolean };
    playerId: string;
  }[]>((merged, candidate) => {
    const existingIndex = merged.findIndex(existing => existing.playerId === candidate.playerId);
    if (existingIndex === -1) return [...merged, candidate];
    return merged.map((existing, index) => index === existingIndex
      ? { ...existing, target: mergeTargetConstraints(existing.target, candidate.target) }
      : existing);
  }, []);
  const pairResolution = resolveCatalogId(strategy.pairWithPlayerName);
  const pairPlayerId = pairResolution.id;
  const warnings = [...strategy.warnings];
  const classifiedTargets = resolvedTargets.map(({ target, resolution, playerId }) => {
    const infeasibility = resolution.id === undefined
      ? targetResolutionInfeasibilityFor({ target, ambiguous: resolution.ambiguous })
      : targetKeeperInfeasibilityFor({
        playerId,
        target,
        humanTeamId,
        draftFormat,
        initialRosters: setup.initialRosters,
        teams,
      });
    if (infeasibility !== undefined) warnings.push(infeasibility.message);
    return {
      playerId,
      target,
      ...(infeasibility === undefined ? {} : { infeasibility }),
    };
  });
  if (strategy.pairWithPlayerName !== undefined && pairPlayerId === undefined) {
    warnings.push(pairResolution.ambiguous
      ? `Pair-with player ${strategy.pairWithPlayerName} matches multiple players; use the full name.`
      : `Pair-with player ${strategy.pairWithPlayerName} was not found in the player catalog.`);
  }
  const ownedPair = pairPlayerId === undefined || setup.initialRosters.some(player =>
    player.teamId === humanTeamId
    && (player.playerId ?? canonicalPlayerIdentityKey(player.playerName)) === pairPlayerId
  );
  if (pairPlayerId !== undefined && !ownedPair) {
    warnings.push(`Pair-with player ${strategy.pairWithPlayerName ?? pairPlayerId} is not a keeper; the simulation will also prioritize acquiring that player.`);
  }

  const targets = resolvedTargets.map(({ target }) => target);
  const target = targets[0];
  return {
    strategy: {
      ...strategy,
      ...(strategy.targets === undefined && strategy.target === undefined ? {} : {
        targets,
        ...(target === undefined ? {} : { target }),
        summary: summaryFor(
          targets,
          strategy.preferredPositions,
          strategy.positionCaps ?? [],
          strategy.pairWithPlayerName,
        ),
      }),
      warnings,
    },
    resolvedTargets: classifiedTargets,
    pairPlayerId,
  };
};
