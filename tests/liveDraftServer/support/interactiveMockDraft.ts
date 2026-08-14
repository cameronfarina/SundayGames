import type { CreateLiveDraftServerOptions } from "../../../src/liveDraftServer.js";

export const mockSaleCommand = "Owner01 drafted Jahmyr Gibbs for 74";
export const realSaleCommand = "Owner05 drafted Christian McCaffrey for 80";
export const mockAiSaleCommands: readonly [string, string] = [
  mockSaleCommand,
  "Owner14 drafted Puka Nacua for 74",
];

const copyObject = (value: unknown): Record<string, unknown> => {
  const copy: Record<string, unknown> = {};
  if (typeof value !== "object" || value === null) return copy;

  for (const key of Object.keys(value)) copy[key] = Reflect.get(value, key);
  return copy;
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const interactiveMockPhase = (
  nominatedPlayer: string | undefined,
  commandCount: number,
): string => {
  if (nominatedPlayer) return "human-decision";
  if (commandCount >= 3) return "complete";
  if (commandCount >= 2) return "human-decision";
  return "ai-sale";
};

export const interactiveMockDraft: NonNullable<
  CreateLiveDraftServerOptions["interactiveMockDraft"]
> = {
  buildInteractiveMockDraftState: options => {
    const openingBid = options.nominatedPrice ?? 37;
    return {
      watchOwner: options.watchOwner,
      phase: interactiveMockPhase(options.nominatedPlayer, options.commands.length),
      pickNumber: options.commands.length + 1,
      aiSaleCommand: mockAiSaleCommands[options.commands.length] ?? mockAiSaleCommands[1],
      nomination: options.nominatedPlayer
        ? { player: options.nominatedPlayer }
        : { player: "Breece Hall" },
      auction: {
        status: "cam-decision",
        player: options.nominatedPlayer ?? "Breece Hall",
        currentBid: options.commands.length >= 2 ? 41 : 40,
        currentBidOwner: "Owner07",
        nextCamBid: options.commands.length >= 2 ? 42 : 41,
        openingBid,
        feed: [
          {
            type: "nomination",
            text: `Owner11 nominated ${options.nominatedPlayer ?? "Breece Hall"} for $${openingBid}`,
          },
          {
            type: "bid",
            owner: "Owner07",
            amount: options.commands.length >= 2 ? 41 : 40,
            text: `Owner07 bid $${options.commands.length >= 2 ? 41 : 40}`,
          },
        ],
      },
      camDecision: options.nominatedPlayer || options.commands.length >= 2
        ? { recommendedBid: 42, maxBid: 44, topAiBid: 41, topAiBidOwner: "Owner07" }
        : undefined,
      topTargets: [{ name: "Breece Hall" }],
      commandCount: options.commands.length,
      nominatedPlayer: options.nominatedPlayer,
      seed: options.seed,
      strategyKey: options.strategyKey,
    };
  },
  resolveInteractiveMockDraftAction: (mockDraft, action) => {
    const draft = copyObject(mockDraft);
    const nomination = copyObject(draft.nomination);
    const auction = copyObject(draft.auction);

    if (action === "cam-bid") {
      const nominatedPlayer = optionalString(draft.nominatedPlayer)
        ?? optionalString(nomination.player)
        ?? "Breece Hall";
      if (auction.currentBid === 41) {
        const auctionFeed = Array.isArray(auction.feed) ? auction.feed : [];
        return {
          mockDraft: {
            ...draft,
            phase: "human-decision",
            auction: {
              ...auction,
              currentBid: 43,
              currentBidOwner: "Owner07",
              nextCamBid: 44,
              feed: [
                ...auctionFeed,
                { type: "bid", owner: "Owner11", amount: 42, text: "Owner11 bid $42" },
                { type: "bid", owner: "Owner07", amount: 43, text: "Owner07 bid $43" },
              ],
            },
            camDecision: {
              recommendedBid: 44,
              maxBid: 44,
              topAiBid: 44,
              topAiBidOwner: "Owner07",
            },
          },
        };
      }
      return { command: `Owner11 drafted ${nominatedPlayer} for 42` };
    }
    if (action !== "advance" && action !== "pass") {
      throw new Error(`Unexpected test action: ${action}`);
    }

    return { command: optionalString(draft.aiSaleCommand) ?? mockSaleCommand };
  },
};
