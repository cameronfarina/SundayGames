import { describe, expect, it } from "vitest";
import { parseKeeperCommand } from "../src/platform/keeperCommandImport.js";
import { auctionCommandInput, snakeCommandInput } from "./keeperCommandImportFixtures.js";

describe("keeper command previews", () => {
  it("previews an auction keeper and normalizes submit whitespace", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "  owner11   keeping   achane   50  ",
      [{
        teamId: "team-owner11",
        teamName: "Owner11's Heroes",
        managerNames: ["Owner11 Manager"],
      }],
      [{ playerId: "player-achane", name: "De'Von Achane" }],
    ));

    expect(result).toEqual({
      kind: "preview",
      confirmationRequired: true,
      sourceCommand: "owner11 keeping achane 50",
      team: { id: "team-owner11", name: "Owner11's Heroes" },
      player: { id: "player-achane", name: "De'Von Achane" },
      keeper: { draftType: "auction", auctionCostDollars: 50 },
    });
  });

  it("previews the trailing number as a snake keeper round", () => {
    expect(parseKeeperCommand(snakeCommandInput("owner01 keeping dart 2"))).toEqual({
      kind: "preview",
      confirmationRequired: true,
      sourceCommand: "owner01 keeping dart 2",
      team: { id: "team-owner01", name: "Sunday Beaters" },
      player: { id: "player-dart", name: "Jaxson Dart" },
      keeper: { draftType: "snake", keeperRound: 2 },
    });
  });

  it("resolves explicit team and player aliases", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "juice keeping mondre 7",
      [{
        teamId: "team-old-dogs",
        teamName: "Old Dogs",
        managerNames: ["Jacob Horwitz"],
        aliases: ["juice"],
      }],
      [{
        playerId: "player-rhamondre",
        name: "Rhamondre Stevenson",
        aliases: ["mondre"],
      }],
    ));

    expect(result).toMatchObject({
      kind: "preview",
      team: { id: "team-old-dogs" },
      player: { id: "player-rhamondre" },
    });
  });
});
