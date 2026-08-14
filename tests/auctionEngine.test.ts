import { expect, test } from "vitest";
import { collectBehaviorTestNames, findOwnedArchitectureProblems } from "./auctionEngine/architecture.js";
import { behaviorTestNames } from "./auctionEngine/behaviorTestNames.js";

test("keeps auction-engine test architecture and behavioral names stable", () => {
  const architectureProblems = findOwnedArchitectureProblems();

  expect(architectureProblems, architectureProblems.join("\n")).toEqual([]);
  expect(collectBehaviorTestNames()).toEqual(behaviorTestNames);
});
