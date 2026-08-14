import { describe, expect, it } from "vitest";
import type { SeasonSimulationResult } from "../src/platform/seasonSimulationEngine.js";
import { deserializePlatformStoreSnapshot } from "../src/platform/platformStoreSnapshotCodec.js";
import { persistedHistoricalImport } from "./platformStoreSnapshotFixtures/historicalImport.js";
import { persistedLiveDraftRooms } from "./platformStoreSnapshotFixtures/liveRooms.js";
import { persistedMockDraftSessions } from "./platformStoreSnapshotFixtures/mockSessions.js";
import { persistedSimulationRun } from "./platformStoreSnapshotFixtures/simulationRun.js";

const expectInvalid = (value: unknown, path: string): void => {
  expect(() => deserializePlatformStoreSnapshot(value)).toThrow(path);
};

const seasonSimulationSnapshot = (
  update: (season: SeasonSimulationResult) => unknown,
): unknown => {
  const run = persistedSimulationRun();
  const result = run.result;
  const season = result?.seasonSimulation;
  if (result === undefined || season === undefined) {
    throw new Error("Expected a complete season simulation fixture.");
  }
  return { simulationRuns: [{ ...run, result: { ...result, seasonSimulation: update(season) } }] };
};

describe("platform store snapshot domain validation", () => {
  it("rejects invalid league enums, schedules, and membership roles", () => {
    const sessions = persistedMockDraftSessions();
    const snake = sessions.find(session => session.draftMode.format === "snake");
    if (snake?.configurationSnapshot.status !== "ready") {
      throw new Error("Expected a ready snake snapshot.");
    }
    const season = snake.configurationSnapshot.payload.season;
    if (season.settings.draftFormat !== "snake") throw new Error("Expected snake settings.");

    expectInvalid({
      leagueSeasons: [{ ...season, league: { ...season.league, provider: "invalid" } }],
    }, "leagueSeasons[0].league.provider");
    expectInvalid({ leagueSeasons: [{ ...season, setupStatus: "invalid" }] }, "setupStatus");
    expectInvalid({
      leagueSeasons: [{ ...season, settings: { ...season.settings, draftFormat: "invalid" } }],
    }, "settings.draftFormat");
    expectInvalid({
      leagueSeasons: [{
        ...season,
        settings: { ...season.settings, snake: { ...season.settings.snake, reversal: "invalid" } },
      }],
    }, "settings.snake.reversal");
    expectInvalid({
      memberships: [{ userId: "u", leagueId: "l", role: "invalid" }],
    }, "memberships[0].role");
  });

  it("rejects invalid historical import discriminators", () => {
    const batch = persistedHistoricalImport();
    const blocker = batch.blockers[0];
    const readyRow = batch.rows[0];
    const record = readyRow?.record;
    const audit = readyRow?.identityAudit;
    if (blocker === undefined || record === undefined || record === null || audit === undefined) {
      throw new Error("Expected complete historical fixtures.");
    }

    expectInvalid({
      historicalImportBatches: [{ ...batch, blockers: [{ ...blocker, code: "invalid" }] }],
    }, "blockers[0].code");
    expectInvalid({
      historicalImportBatches: [{ ...batch, blockers: [{ ...blocker, severity: "invalid" }] }],
    }, "blockers[0].severity");
    expectInvalid({
      historicalImportBatches: [{
        ...batch,
        rows: [{ ...readyRow, identityAudit: { ...audit, resolution: "invalid" } }],
      }],
    }, "identityAudit.resolution");
    expectInvalid({
      historicalSaleRecords: [{ ...record, acquisitionType: "invalid" }],
    }, "historicalSaleRecords[0].acquisitionType");
  });

  it("rejects invalid mock session discriminators", () => {
    const session = persistedMockDraftSessions()[0];
    if (session === undefined || session.latestResultRef === undefined) {
      throw new Error("Expected a completed mock session.");
    }

    expectInvalid({
      mockDraftSessions: [{ ...session, draftMode: { ...session.draftMode, format: "invalid" } }],
    }, "draftMode.format");
    expectInvalid({
      mockDraftSessions: [{
        ...session,
        latestResultRef: { ...session.latestResultRef, kind: "invalid" },
      }],
    }, "latestResultRef.kind");
  });

  it("rejects invalid live room variants", () => {
    const room = persistedLiveDraftRooms()[0];
    const event = room?.events[0];
    const initialPlayer = room?.initialRosters[0];
    const team = room?.projection.teams[0];
    const rosterPlayer = team?.roster[0];
    if (room === undefined || event === undefined || initialPlayer === undefined
      || team === undefined || rosterPlayer === undefined) {
      throw new Error("Expected complete live room fixtures.");
    }

    expectInvalid({ liveDraftRooms: [{ ...room, status: "invalid" }] }, "liveDraftRooms[0].status");
    expectInvalid({
      liveDraftRooms: [{ ...room, events: [{ ...event, type: "invalid" }] }],
    }, "events[0].type");
    expectInvalid({
      liveDraftRooms: [{
        ...room,
        initialRosters: [{ ...initialPlayer, source: "invalid" }],
      }],
    }, "initialRosters[0].source");
    expectInvalid({
      liveDraftRooms: [{
        ...room,
        projection: {
          ...room.projection,
          teams: [{ ...team, roster: [{ ...rosterPlayer, source: "invalid" }] }],
        },
      }],
    }, "projection.teams[0].roster[0].source");
  });

  it("rejects invalid simulation result discriminators", () => {
    const run = persistedSimulationRun();
    expectInvalid({ simulationRuns: [{ ...run, status: "invalid" }] }, "simulationRuns[0].status");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      draftFormat: "invalid",
    })), "seasonSimulation.draftFormat");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      strategy: {
        ...season.strategy,
        preferredPositions: [{ position: "DST", tier: "elite" }],
      },
    })), "preferredPositions[0].position");

    const target = run.result?.seasonSimulation?.targetOutcomes?.[0];
    const preference = run.result?.seasonSimulation?.preferenceOutcomes?.[0];
    const rosterPlayer = run.result?.seasonSimulation?.runs[0]?.teams[0]?.roster[0];
    const scenario = run.result?.summary.scenarios[0];
    if (target === undefined || preference === undefined || rosterPlayer === undefined
      || scenario === undefined) throw new Error("Expected complete simulation fixtures.");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      targetOutcomes: [{ ...target, status: "invalid" }],
    })), "targetOutcomes[0].status");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      targetOutcomes: [{ ...target, reason: "invalid" }],
    })), "targetOutcomes[0].reason");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      preferenceOutcomes: [{ ...preference, position: "DST" }],
    })), "preferenceOutcomes[0].position");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      preferenceOutcomes: [{ ...preference, rule: { ...preference.rule, basis: "invalid" } }],
    })), "preferenceOutcomes[0].rule.basis");
    expectInvalid(seasonSimulationSnapshot(season => ({
      ...season,
      runs: [{
        ...season.runs[0],
        teams: [{ ...season.runs[0]?.teams[0], roster: [{ ...rosterPlayer, source: "invalid" }] }],
      }],
    })), "runs[0].teams[0].roster[0].source");
    expectInvalid({
      simulationRuns: [{
        ...run,
        result: { ...run.result, summary: { ...run.result?.summary, scenarios: [{ ...scenario, key: "invalid" }] } },
      }],
    }, "summary.scenarios[0].key");
  });

  it("rejects invalid primitive values at their exact paths", () => {
    expectInvalid(null, "root");
    expectInvalid({
      memberships: [{ userId: "u", leagueId: "l", role: "owner", ownerId: 1 }],
    }, "memberships[0].ownerId");
    expectInvalid({ exportArtifacts: [{ format: "csv", id: "id" }] }, "leagueId");
  });
});
