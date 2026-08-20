import { createAsyncReadWriteLock } from "../../src/platform/platformServer/serialization.js";
import { createLeagueConnectionsHarness } from "./leagueConnections/harness.js";
import {
  connectImportableLeague,
  importLeague,
  importableRoutes,
} from "./leagueConnections/importFixtures.js";
import { expect, expectBodyRecord, expectString, it } from "./support/index.js";

const deferred = () => {
  let resolve = (): void => undefined;
  const promise = new Promise<void>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
};

it("rechecks create idempotency after waiting for season-write admission", async () => {
  const snapshotAccess = createAsyncReadWriteLock();
  const firstWriteEntered = deferred();
  const releaseFirstWrite = deferred();
  let seasonWriteAdmissions = 0;
  const harness = await createLeagueConnectionsHarness(importableRoutes, {
    runLeagueSyncSeasonRefresh: async operation => await snapshotAccess.write(async () => {
      seasonWriteAdmissions += 1;
      if (seasonWriteAdmissions === 1) {
        firstWriteEntered.resolve();
        await releaseFirstWrite.promise;
      }
      return await operation();
    }),
  });
  const connectionId = await connectImportableLeague(harness.handle, harness.sessionToken);

  const first = importLeague(harness.handle, harness.sessionToken, connectionId);
  await firstWriteEntered.promise;
  const second = importLeague(harness.handle, harness.sessionToken, connectionId);
  releaseFirstWrite.resolve();
  const responses = await Promise.all([first, second]);
  const seasonIds = responses.map(response => expectString(
    expectBodyRecord(expectBodyRecord(response.body).imported).seasonId,
  ));

  expect(responses.map(response => response.status)).toEqual([200, 200]);
  expect(new Set(seasonIds).size).toBe(1);
});
