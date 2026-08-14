import { describe, expect, it } from "vitest";
import { CliArguments } from "../src/cli/arguments.js";
import { ownerOption, scenarioListOption, scenarioOption } from "../src/cli/options/commonOptions.js";
import {
  draftPlanEngineModeOption,
  draftPlanStrategyModeOption,
  draftPlanStrategyOption,
} from "../src/cli/options/draftPlanOptions.js";
import { evidenceSourceAdapterOption } from "../src/cli/options/evidenceOptions.js";
import { strategyLabScenariosOption } from "../src/cli/options/strategyLabOptions.js";
import { buildAroundPrices } from "../src/cli/options/strategyLabPrices.js";

describe("CLI arguments", () => {
  it("reads commands, flags, repeated options, and positive integers", () => {
    const arguments_ = new CliArguments([
      "strategy-lab",
      "--custom-weights",
      "--force=Puka Nacua:75",
      "--force=Kenneth Walker III:36",
      "--runs=2",
    ]);

    expect(arguments_.command).toBe("strategy-lab");
    expect(arguments_.has("--custom-weights")).toBe(true);
    expect(arguments_.options("--force")).toEqual(["Puka Nacua:75", "Kenneth Walker III:36"]);
    expect(arguments_.positiveInteger("--runs", 50)).toBe(2);
    expect(arguments_.positiveInteger("--limit", 40)).toBe(40);
  });

  it("requires named options and positive integers", () => {
    expect(() => new CliArguments(["audit"]).required("--player"))
      .toThrow("--player is required.");
    expect(() => new CliArguments(["smoke", "--runs=1.5"]).positiveInteger("--runs", 2))
      .toThrow("--runs must be a positive integer.");
  });
});

describe("CLI common options", () => {
  it("uses expected scenario and the primary owner by default", () => {
    const arguments_ = new CliArguments(["mock"]);
    expect(scenarioOption(arguments_)).toBe("expected");
    expect(scenarioListOption(arguments_)).toEqual(["expected"]);
    expect(ownerOption(arguments_)).toBe("Owner11");
  });

  it("parses valid scenario lists and rejects unknown values", () => {
    expect(scenarioListOption(new CliArguments([
      "mocks",
      "--scenarios=confirmedOnly,highRetention",
    ]))).toEqual(["confirmedOnly", "highRetention"]);
    expect(() => scenarioOption(new CliArguments(["mock", "--scenario=other"])))
      .toThrow('Unknown keeper scenario "other"');
    expect(() => ownerOption(new CliArguments(["teams", "--owner=other"])))
      .toThrow('Unknown owner "other"');
  });
});

describe("CLI strategy options", () => {
  it("parses draft plan controls and rejects unknown choices", () => {
    const arguments_ = new CliArguments([
      "teams",
      "--strategy=wr-heavy",
      "--strategy-mode=filter",
      "--engine-mode=full",
    ]);
    expect(draftPlanStrategyOption(arguments_)).toBe("wr-heavy");
    expect(draftPlanStrategyModeOption(arguments_)).toBe("filter");
    expect(draftPlanEngineModeOption(arguments_)).toBe("full");
    expect(() => draftPlanStrategyOption(new CliArguments(["teams", "--strategy=other"])))
      .toThrow('Unknown draft plan strategy "other"');
    expect(() => draftPlanStrategyModeOption(new CliArguments(["teams", "--strategy-mode=other"])))
      .toThrow('Unknown draft plan strategy mode "other"');
    expect(() => draftPlanEngineModeOption(new CliArguments(["teams", "--engine-mode=other"])))
      .toThrow('Unknown draft plan engine mode "other"');
  });

  it("builds forced, capped, and build-around strategy scenarios", () => {
    const scenarios = strategyLabScenariosOption(new CliArguments([
      "strategy-lab",
      "--strategy=three-rb",
      "--force=Puka Nacua:75",
      "--target=Zay Flowers:31",
      "--build-around=Omarion Hampton:46-50:2",
    ]));
    expect(scenarios?.map(scenario => scenario.key)).toEqual([
      "build-around-omarion-hampton-46",
      "build-around-omarion-hampton-48",
      "build-around-omarion-hampton-50",
    ]);
    expect(scenarios?.[0]?.forcedSales).toEqual([
      { owner: "Owner11", player: "Puka Nacua", price: 75 },
      { owner: "Owner11", player: "Omarion Hampton", price: 46 },
    ]);
    expect(scenarios?.[0]?.targetMaxBids).toEqual([
      { owner: "Owner11", player: "Zay Flowers", maxBid: 31 },
    ]);
  });

  it("validates adapters, price lists, ranges, and strategy names", () => {
    expect(evidenceSourceAdapterOption(new CliArguments(["evidence-adapt"]))).toBe("scored-local");
    expect(buildAroundPrices("46,48,50")).toEqual([46, 48, 50]);
    expect(() => buildAroundPrices("50-46")).toThrow('Invalid build-around range "50-46"');
    expect(() => evidenceSourceAdapterOption(new CliArguments([
      "evidence-adapt",
      "--adapter=other",
    ]))).toThrow('Unknown evidence source adapter "other"');
    expect(() => strategyLabScenariosOption(new CliArguments([
      "strategy-lab",
      "--strategy=other",
      "--build-around=Puka Nacua:75",
    ]))).toThrow('Unknown strategy lab strategy "other"');
  });
});
