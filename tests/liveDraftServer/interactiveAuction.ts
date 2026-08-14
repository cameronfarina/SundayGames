import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerInteractiveAuctionTests = (): void => {
  it("previews Owner11-selected mock nominations before appending the sale command", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nominationPreview = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-owner11-nomination",
        action: "cam-nominate",
        nominatedPlayer: "Breece Hall",
        nominatedPrice: 9,
      });
      expect(nominationPreview.status).toBe(200);
      expect(nominationPreview.data.session.commandCount).toBe(0);
      expect(nominationPreview.data.mockDraft.nominatedPlayer).toBe("Breece Hall");
      expect(nominationPreview.data.mockDraft.auction.openingBid).toBe(9);
      expect(nominationPreview.data.mockDraft.auction.feed[0].text).toBe("Owner11 nominated Breece Hall for $9");

      const camBid = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-owner11-nomination",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
      });
      expect(camBid.status).toBe(200);
      expect(camBid.data.session.commandCount).toBe(1);
      expect(camBid.data.events.map((event: { input: string }) => event.input)).toEqual([
        "Owner11 drafted Breece Hall for 42",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns an updated mock auction when AI keeps bidding after Owner11 raises", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const aiRaise = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-auction-bid",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
        mockAuction: {
          currentBid: 41,
          feed: [
            { type: "nomination", text: "Owner11 nominated Breece Hall for $37" },
            { type: "bid", owner: "Owner07", amount: 41, text: "Owner07 bid $41" },
          ],
        },
      });

      expect(aiRaise.status).toBe(200);
      expect(aiRaise.data.session.commandCount).toBe(0);
      expect(aiRaise.data.events).toHaveLength(0);
      expect(aiRaise.data.mockDraft.auction).toMatchObject({
        currentBid: 43,
        currentBidOwner: "Owner07",
        nextCamBid: 44,
      });
      expect(aiRaise.data.mockDraft.auction.feed.map((event: { text: string }) => event.text)).toEqual([
        "Owner11 nominated Breece Hall for $37",
        "Owner07 bid $41",
        "Owner11 bid $42",
        "Owner07 bid $43",
      ]);

      const camWin = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-auction-bid",
        action: "cam-bid",
        mockAuction: aiRaise.data.mockDraft.auction,
      });

      expect(camWin.status).toBe(200);
      expect(camWin.data.session.commandCount).toBe(1);
      expect(camWin.data.events.map((event: { input: string }) => event.input)).toEqual([
        "Owner11 drafted Breece Hall for 42",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
