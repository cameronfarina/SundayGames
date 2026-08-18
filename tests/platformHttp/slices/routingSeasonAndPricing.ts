import { expect, expectBodyRecord, expectString, now } from "../support/index.js";
import type { RoutingContext } from "./routingContext.js";

export const verifyRoutingSeasonAndPricing = async ({ handle, owner11, owner04, season, camTeam, sethTeam }: RoutingContext): Promise<void> => {
    const registered = await handle({
      method: "PUT",
      path: `/seasons/${season.id}`,
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: owner11.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
          {
            userId: owner04.account.id,
            leagueId: season.leagueId,
            role: "member",
            ownerId: sethTeam.ownerId,
            teamId: sethTeam.id,
          },
        ],
        now: now.toISOString(),
      },
    });

    expect(registered.status).toBe(200);
    expect(registered.body).toMatchObject({ season });

    const fetchedSeason = await handle({
      method: "GET",
      path: `/seasons/${season.id}`,
      headers: {
        "x-session-token": owner04.sessionToken,
      },
    });

    expect(fetchedSeason.status).toBe(200);
    expect(fetchedSeason.body).toMatchObject({ season });

    const mismatchedSeason = await handle({
      method: "PUT",
      path: "/seasons/another-season",
      sessionToken: owner11.sessionToken,
      body: {
        season,
        memberships: [
          {
            userId: owner11.account.id,
            leagueId: season.leagueId,
            role: "owner",
            ownerId: camTeam.ownerId,
            teamId: camTeam.id,
          },
        ],
        now,
      },
    });

    expect(mismatchedSeason).toEqual({
      status: 400,
      body: {
        error: {
          code: "season_id_mismatch",
          message: "Season body must match the route season id.",
        },
      },
    });

    const importPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/upload-preview`,
      sessionToken: owner11.sessionToken,
      body: {
        fileName: "draft-2025.csv",
        mimeType: "text/csv",
        base64: Buffer.from(
          "owner,player,position,price,espn value,year\nOwner11,Puka Nacua,WR,70,50,2025",
        ).toString("base64"),
        seasonYear: 2025,
        now,
      },
    });
    const previewBody = expectBodyRecord(importPreview.body);
    const previewBatch = expectBodyRecord(previewBody.batch);
    const previewBatchId = expectString(previewBatch.id);

    expect(importPreview.status).toBe(200);
    expect(importPreview.body).toMatchObject({
      source: {
        fileHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
        sourceRowCount: 2,
      },
      batch: expect.objectContaining({ status: "previewed" }),
    });

    const committedImport = await handle({
      method: "POST",
      path: `/historical-imports/${previewBatchId}/commit`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        seasonYear: 2025,
        now: new Date(now.getTime() + 250).toISOString(),
      },
    });

    expect(committedImport.body).toMatchObject({
      committedRecords: [expect.objectContaining({ playerName: "Puka Nacua", priceDollars: 70 })],
      batch: expect.objectContaining({ seasonYear: 2025, leagueSeasonId: season.id }),
      pricing: expect.objectContaining({ snapshots: [expect.objectContaining({ scenarioId: "expected" })] }),
    });

    const secondImportPreview = await handle({
      method: "POST",
      path: `/seasons/${season.id}/historical-imports/preview`,
      sessionToken: owner11.sessionToken,
      body: {
        sourceText: "owner,player,position,price,year\nOwner11,Jahmyr Gibbs,RB,72,2025",
        seasonYear: 2025,
        now: new Date(now.getTime() + 300).toISOString(),
      },
    });
    const secondPreviewBody = expectBodyRecord(secondImportPreview.body);
    const secondPreviewBatch = expectBodyRecord(secondPreviewBody.batch);
    const secondPreviewBatchId = expectString(secondPreviewBatch.id);
    const conflictingImportCommit = await handle({
      method: "POST",
      path: `/historical-imports/${secondPreviewBatchId}/commit`,
      sessionToken: owner11.sessionToken,
      body: {
        seasonId: season.id,
        seasonYear: 2025,
        now: new Date(now.getTime() + 350).toISOString(),
      },
    });

    expect(conflictingImportCommit).toEqual({
      status: 409,
      body: {
        error: {
          code: "season_import_conflict",
          message: "Historical import batch already exists for this league season. Request replacement to supersede it.",
        },
      },
    });

    const pricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 500),
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
      },
    });
    const pricingBody = expectBodyRecord(pricingRebuild.body);
    const modelRunId = expectString(pricingBody.modelRunId);

    expect(pricingRebuild.status).toBe(201);
    expect(pricingRebuild.body).toMatchObject({
      snapshots: [
        expect.objectContaining({
          scenarioId: "balanced",
          rows: [expect.objectContaining({ playerName: "Puka Nacua", marketPrice: 50, scenarioPrice: 70 })],
        }),
      ],
    });

    const conflictingPricingRebuild = await handle({
      method: "POST",
      path: `/seasons/${season.id}/pricing/rebuild`,
      sessionToken: owner11.sessionToken,
      now: new Date(now.getTime() + 550),
      body: {
        modelVersion: "league-calibration-v1",
        scenarioIds: ["balanced"],
        baselinePrices: [
          { name: "Puka Nacua", normalizedName: "puka nacua", position: "WR", price: 50 },
        ],
      },
    });

    expect(conflictingPricingRebuild).toMatchObject({
      status: 201,
      body: {
        modelRunId,
        snapshots: [expect.objectContaining({
          modelRunId,
          scenarioId: "balanced",
          createdAt: new Date(now.getTime() + 500).toISOString(),
        })],
      },
    });

    const listedPricing = await handle({
      method: "GET",
      path: `/seasons/${season.id}/pricing-snapshots?scenarioId=balanced`,
      sessionToken: owner04.sessionToken,
    });
    const fetchedPricing = await handle({
      method: "GET",
      path: `/pricing-snapshots/${encodeURIComponent(modelRunId)}?scenarioId=balanced`,
      sessionToken: owner04.sessionToken,
    });

    expect(listedPricing.body).toMatchObject({
      pricingSnapshots: [expect.objectContaining({ modelRunId })],
    });
    expect(fetchedPricing.body).toMatchObject({
      pricingSnapshot: expect.objectContaining({ modelRunId, scenarioId: "balanced" }),
    });
};
