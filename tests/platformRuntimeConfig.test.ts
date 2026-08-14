import { expect, test } from "vitest";
import { architectureProblems, behaviorNames } from "./platformRuntimeConfig/architecture.js";
import { runtimeConfigBehaviorNames } from "./platformRuntimeConfig/behaviorNames.js";

test("keeps runtime-config tests focused and behaviorally complete", () => {
  const problems = architectureProblems();
  expect(problems, problems.join("\n")).toEqual([]);
  expect(behaviorNames()).toEqual([...runtimeConfigBehaviorNames].sort());
});
