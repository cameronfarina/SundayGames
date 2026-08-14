import type { Owner } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionNominationScoreComponents } from "./auctionContracts.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { seasonProjectionForPlayer } from "./constants.js";
import { deterministicTieBreak } from "./deterministic.js";
import { nominationAffordabilityScoreFor, nominationContextCanBidOnPlayer, nominationFlushMoneyScoreFor, nominationOpponentNeedScoreFor, nominationScarcityScoreFor } from "./nominationContext.js";
import { NominationContext, UnrankedNominationCandidateDiagnostics } from "./nominationTypes.js";

export const nominationScoreFor = ({
  player,
  context,
  nominator,
  pickIndex,
  topMarketPrice,
  topProjectionTotal,
  config,
}: {
  player: Player;
  context: NominationContext;
  nominator: Owner;
  pickIndex: number;
  topMarketPrice: number;
  topProjectionTotal: number;
  config: AuctionEngineConfig;
}): UnrankedNominationCandidateDiagnostics | undefined => {
  const remainingPlayersAtPlayerPosition = Math.max(0, context.availablePositionCounts[player.position] - 1);
  const playerCanSell = context.ownerContexts.some(ownerContext =>
    nominationContextCanBidOnPlayer(
      ownerContext,
      player,
      remainingPlayersAtPlayerPosition,
      config,
    ),
  );
  if (!playerCanSell) return undefined;

  const nominatorContext = context.ownerContextByOwner.get(nominator);
  if (!nominatorContext) throw new Error(`Missing auction state for ${nominator}.`);

  const marketPriceScore = player.price / Math.max(1, topMarketPrice);
  const projectionTotal = seasonProjectionForPlayer(player);
  const projectionScore = projectionTotal / Math.max(1, topProjectionTotal);
  const ownerNeedScore = nominatorContext.needScore[player.position];
  const affordabilityScore = nominationAffordabilityScoreFor(
    nominatorContext,
    player,
    remainingPlayersAtPlayerPosition,
    config,
  );
  const scarcityScore = nominationScarcityScoreFor(
    player.position,
    context,
  );
  const opponentNeedScore = nominationOpponentNeedScoreFor(
    nominator,
    player,
    context,
    config,
  );
  const nominatorInterestScore = (ownerNeedScore + affordabilityScore) / 2;
  const flushMoneyScore = nominationFlushMoneyScoreFor(
    nominator,
    player,
    context,
    remainingPlayersAtPlayerPosition,
    config,
    marketPriceScore,
    nominatorInterestScore,
  );
  const marketPriceWeight = pickIndex < config.nomination.earlyEliteBiasPicks
    ? config.nomination.earlyMarketPriceWeight
    : config.nomination.marketPriceWeight;
  const tieBreakScore = 1 - deterministicTieBreak(config.seed, nominator, player.name);
  const scoreComponents = {
    marketPrice: marketPriceScore,
    projection: projectionScore,
    ownerNeed: ownerNeedScore,
    opponentNeed: opponentNeedScore,
    affordability: affordabilityScore,
    scarcity: scarcityScore,
    flushMoney: flushMoneyScore,
    tieBreak: tieBreakScore,
  } satisfies AuctionNominationScoreComponents;
  const weightedComponents = {
    marketPrice: marketPriceScore * marketPriceWeight,
    projection: projectionScore * config.nomination.projectionWeight,
    ownerNeed: ownerNeedScore * config.nomination.ownerNeedWeight,
    opponentNeed: opponentNeedScore * config.nomination.opponentNeedWeight,
    affordability: affordabilityScore * config.nomination.affordabilityWeight,
    scarcity: scarcityScore * config.nomination.scarcityWeight,
    flushMoney: flushMoneyScore * config.nomination.flushMoneyWeight,
    tieBreak: tieBreakScore * config.nomination.tieBreakWeight,
  } satisfies AuctionNominationScoreComponents;
  const score = Object.values(weightedComponents)
    .reduce((total, contribution) => total + contribution, 0);

  return {
    player: player.name,
    position: player.position,
    marketPrice: player.price,
    projectionTotal,
    score,
    scoreComponents,
    weightedComponents,
  };
};
