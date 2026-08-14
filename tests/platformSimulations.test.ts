import { expect, test } from "vitest";
import { architectureProblems, behaviorNames } from "./platformSimulations/architecture.js";
import { simulationBehaviorNames } from "./platformSimulations/behaviorNames.js";

test("keeps private simulation tests focused and behaviorally complete", () => {
  const problems = architectureProblems();
  expect(problems, problems.join("\n")).toEqual([]);
  expect(behaviorNames()).toEqual([...simulationBehaviorNames].sort());
});
