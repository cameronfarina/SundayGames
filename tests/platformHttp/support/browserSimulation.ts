import {
  runSeasonSimulations,
  seasonSimulationInputValue,
} from "../../../src/platform/seasonSimulationEngine.js";
import type {
  PlatformHttpHandler,
  PlatformHttpResponse,
} from "../../../src/platform/platformHttp.js";
import { expectBodyRecord, expectString } from "./assertions.js";
import { expect } from "vitest";

export const browserSimulationResult = (launchResponse: PlatformHttpResponse) => {
  const launch = expectBodyRecord(launchResponse.body);
  return runSeasonSimulations(
    seasonSimulationInputValue(launch.input, "simulationLaunch.input"),
  );
};

export const completeBrowserSimulation = async (input: {
  handle: PlatformHttpHandler;
  launchResponse: PlatformHttpResponse;
  sessionToken: string;
  now?: Date | undefined;
  inputDigest?: string | undefined;
}): Promise<PlatformHttpResponse> => {
  const launch = expectBodyRecord(input.launchResponse.body);
  const historyId = expectString(launch.historyId);
  return await input.handle({
    method: "POST",
    path: `/season-simulations/${historyId}/complete`,
    sessionToken: input.sessionToken,
    now: input.now,
    body: {
      simulation: browserSimulationResult(input.launchResponse),
      inputDigest: input.inputDigest ?? launch.inputDigest,
      note: launch.note,
    },
  });
};

export const expectBrowserSimulationCancellation = async (input: {
  handle: PlatformHttpHandler;
  sessionToken: string;
  seasonId: string;
  now: Date;
}): Promise<void> => {
  const launch = await input.handle({
    method: "POST",
    path: "/season-simulations",
    sessionToken: input.sessionToken,
    now: new Date(input.now.getTime() + 2_000),
    body: { seasonId: input.seasonId, count: 2, strategy: "Draft Player 1 by round 1" },
  });
  const historyId = expectString(expectBodyRecord(launch.body).historyId);
  const requestId = expectString(expectBodyRecord(launch.body).requestId);
  await expect(input.handle({
    method: "DELETE",
    path: `/season-simulations/requests/${requestId}`,
    query: { seasonId: input.seasonId },
    sessionToken: input.sessionToken,
  })).resolves.toMatchObject({ status: 204 });
  await expect(input.handle({
    method: "POST",
    path: `/season-simulations/${historyId}/complete`,
    sessionToken: input.sessionToken,
    body: {
      simulation: browserSimulationResult(launch),
      inputDigest: expectBodyRecord(launch.body).inputDigest,
    },
  })).resolves.toMatchObject({
    status: 408,
    body: { error: { code: "simulation_canceled" } },
  });
  await expect(input.handle({
    method: "POST",
    path: "/season-simulations",
    sessionToken: input.sessionToken,
    now: new Date(input.now.getTime() + 3_000),
    body: { seasonId: input.seasonId, count: 2, strategy: "Draft Player 1 by round 1" },
  })).resolves.toMatchObject({
    status: 429,
    body: { error: { code: "rate_limited" } },
    headers: { "Retry-After": "57" },
  });
};
