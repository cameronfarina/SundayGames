import { describe, expect, it } from "vitest";
import { keepers } from "../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../src/data/parseHistoricalBoards.js";
import {
  buildInteractiveMockDraftState,
  resolveInteractiveMockDraftAction,
  type InteractiveMockDraftState,
} from "../src/modeling/interactiveMockDraft.js";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const commandsBeforeAffordableRb3Decision = [
  "Beaton drafted Jahmyr Gibbs for 74",
  "Mello drafted Puka Nacua for 74",
  "Beaton drafted Bijan Robinson for 74",
  "Mello drafted Ja'Marr Chase for 74",
  "Martins drafted Christian McCaffrey for 69",
  "Martins drafted Jonathan Taylor for 69",
  "PJ drafted Amon-Ra St. Brown for 69",
  "PJ drafted CeeDee Lamb for 69",
  "Russ drafted Saquon Barkley for 69",
  "Cam drafted Derrick Henry for 62",
  "Hoody drafted Justin Jefferson for 66",
  "Hoody drafted Rashee Rice for 58",
  "CJ drafted Ashton Jeanty for 59",
  "CJ drafted Jeremiyah Love for 55",
  "Seth drafted Nico Collins for 55",
  "Chip drafted Garrett Wilson for 58",
  "Cam drafted Omarion Hampton for 54",
  "Seth drafted Drake London for 56",
  "Chip drafted James Cook III for 51",
  "Kenny drafted A.J. Brown for 49",
  "Sam drafted Josh Jacobs for 46",
  "Sam drafted Josh Allen for 37",
  "Sam drafted Brock Bowers for 39",
  "Jakub drafted Trey McBride for 39",
];

describe("interactive mock draft", () => {
  it("uses real auction nominations and pauses when Cam can enter the bidding", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: [],
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-test",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nominator).toBe("Beaton");
    expect(state.nomination?.player).toBe("Jahmyr Gibbs");
    expect(state.aiSaleCommand).toMatch(/^\w+ drafted Jahmyr Gibbs for \d+$/);
    expect(state.camDecision?.recommendedBid).toBe(state.auction?.nextCamBid);
    expect(state.auction?.feed.map(event => event.text)).toContain("Beaton nominated Jahmyr Gibbs for $70");
    expect(state.aiBids[0]).toMatchObject({
      player: "Jahmyr Gibbs",
      owner: expect.not.stringMatching(/^Cam$/),
    });
    expect(state.topTargets[0]).toMatchObject({
      name: "Jahmyr Gibbs",
      position: "RB",
    });
  });

  it("keeps AI sale previews open until the advance action logs the sale", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: ["Cam drafted Jahmyr Gibbs for 80"],
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "y",
    });

    expect(state.phase).toBe("ai-sale");
    expect(state.auction?.status).toBe("ai-sale");
    expect(state.auction?.resolution?.command).toBe(state.aiSaleCommand);
    expect(state.auction?.feed.map(event => event.type)).toEqual([
      "nomination",
      "bid",
      "bid",
      "bid",
      "bid",
    ]);

    const resolved = resolveInteractiveMockDraftAction(state, "advance");
    expect(resolved.command).toBe(state.aiSaleCommand);
  });

  it("does not pause for Cam when the strategy path max cannot beat the room price", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: [],
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "y",
    });

    expect(state.nomination?.player).toBe("Puka Nacua");
    expect(state.phase).toBe("ai-sale");
    expect(state.auction).toMatchObject({
      status: "ai-sale",
      currentBid: 74,
    });
    expect(state.camDecision).toBeUndefined();
  });

  it("stops for Cam when his strategy max beats the AI price", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const commandsBeforeCamNomination = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-test",
      nominatedPlayer: "Breece Hall",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.nomination?.player).toBe("Breece Hall");
    expect(state.camDecision).toMatchObject({
      maxBid: 44,
      recommendedBid: 40,
    });
    expect(state.camDecision?.topAiBid).toBeGreaterThanOrEqual(state.auction?.currentBid ?? 0);
    expect(state.camDecision?.topAiBidOwner).toEqual(expect.any(String));
    expect(state.auction).toMatchObject({
      currentBid: 39,
      nextCamBid: 40,
    });
    expect(state.auction?.currentBidOwner).toEqual(expect.any(String));
    expect(state.camDecision?.maxBid).toBeGreaterThanOrEqual(state.auction?.nextCamBid ?? 0);

    const camBid = resolveInteractiveMockDraftAction(state, "cam-bid");
    const pass = resolveInteractiveMockDraftAction(state, "pass");
    expect(camBid.command).toBeUndefined();
    expect(camBid.mockDraft?.auction?.currentBid).toBe(41);
    expect(camBid.mockDraft?.auction?.nextCamBid).toBe(42);
    expect(pass.command).toBe(state.aiSaleCommand);
  });

  it("exposes the current auction bid and lets AI continue after Cam raises", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const commandsBeforeCamNomination = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "interactive-auction-test",
      nominatedPlayer: "Breece Hall",
    });

    expect(state.phase).toBe("human-decision");
    expect(state.auction).toMatchObject({
      status: "cam-decision",
      player: "Breece Hall",
      currentBid: state.camDecision?.aiSalePrice,
      nextCamBid: (state.camDecision?.aiSalePrice ?? 0) + 1,
    });
    expect(state.camDecision?.recommendedBid).toBe(state.auction?.nextCamBid);
    expect(state.auction?.feed[0]?.text).toBe(
      `${state.nominator} nominated Breece Hall for $${state.auction?.openingBid}`,
    );

    const contestedState = {
      ...state,
      aiBids: [
        { owner: "Russ", player: "Breece Hall", amount: 45, maxBid: 45, marketPrice: 37 },
        { owner: "Chip", player: "Breece Hall", amount: 43, maxBid: 43, marketPrice: 37 },
      ],
      camDecision: {
        maxBid: 46,
        recommendedBid: 42,
        topAiBid: 45,
        topAiBidOwner: "Russ",
        aiSalePrice: 41,
        valueGap: 8,
      },
      auction: {
        ...state.auction!,
        status: "cam-decision",
        currentBid: 41,
        currentBidOwner: "Russ",
        nextCamBid: 42,
        feed: [
          { type: "nomination", text: "Cam nominated Breece Hall for $37" },
          { type: "bid", owner: "Russ", amount: 41, text: "Russ bid $41" },
        ],
      },
    } satisfies InteractiveMockDraftState;

    const aiRaise = resolveInteractiveMockDraftAction(contestedState, "cam-bid") as {
      command?: string;
      mockDraft?: InteractiveMockDraftState;
    };
    expect(aiRaise.command).toBeUndefined();
    expect(aiRaise.mockDraft?.phase).toBe("human-decision");
    expect(aiRaise.mockDraft?.auction?.currentBid).toBe(43);
    expect(aiRaise.mockDraft?.auction?.currentBidOwner).toBe("Russ");
    expect(aiRaise.mockDraft?.auction?.nextCamBid).toBe(44);
    expect(aiRaise.mockDraft?.auction?.feed.map(event => event.text)).toEqual([
      "Cam nominated Breece Hall for $37",
      "Russ bid $41",
      "Cam bid $42",
      "Russ bid $43",
    ]);
  });

  it("lets Cam explicitly nominate a selected player on his snake turn", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const commandsBeforeCamNomination = commandsBeforeAffordableRb3Decision.slice(0, 10);
    const nominationTurn = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "cam-nomination-test",
    });
    const nominated = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commandsBeforeCamNomination,
      watchOwner: "Cam",
      strategyKey: "three-rb",
      seed: "cam-nomination-test",
      nominatedPlayer: "Breece Hall",
      nominatedPrice: 3,
    });

    expect(nominationTurn).toMatchObject({
      phase: "human-nomination",
      nominator: "Cam",
    });
    expect(nominated.nominator).toBe("Cam");
    expect(nominated.nomination?.player).toBe("Breece Hall");
    expect(nominated.auction?.openingBid).toBe(3);
    expect(nominated.auction?.feed[0]?.text).toBe("Cam nominated Breece Hall for $3");
    expect(nominated.aiBids.length).toBeGreaterThan(0);
    expect(nominated.aiSaleCommand).toContain("Breece Hall");
    expect(["human-decision", "ai-sale"]).toContain(nominated.phase);

    const resolved = resolveInteractiveMockDraftAction(
      nominated,
      nominated.phase === "human-decision" ? "pass" : "advance",
    );
    expect(resolved.command).toBe(nominated.aiSaleCommand);
  });

  it("uses the selected owner in user-facing auction errors", async () => {
    const projections = await loadEspnWeeksOneToFour(projectionPath);
    const historicalRecords = await loadHistoricalAuctionRecords();
    const state = buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: [],
      watchOwner: "Hoody",
      strategyKey: "three-rb",
      seed: "owner-error-test",
    });

    const stateWithoutDecision = { ...state };
    delete stateWithoutDecision.nomination;
    delete stateWithoutDecision.camDecision;

    expect(() => resolveInteractiveMockDraftAction(
      stateWithoutDecision,
      "cam-bid",
    )).toThrow("Hoody does not have a live decision to win.");
  });
});
