import { localE2eFixturePatterns } from "./constants.js";
import { fail, isJsonObject } from "./validation.js";

export const assertNoLocalE2eFixtureMarkers = (value: unknown, path = "$"): void => {
  if (typeof value === "string") {
    if (localE2eFixturePatterns.some(pattern => pattern.test(value))) {
      fail(path, "local E2E fixture marker is not allowed in production provisioning.");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoLocalE2eFixtureMarkers(entry, `${path}[${index}]`));
    return;
  }
  if (!isJsonObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    assertNoLocalE2eFixtureMarkers(entry, `${path}.${key}`);
  }
};
