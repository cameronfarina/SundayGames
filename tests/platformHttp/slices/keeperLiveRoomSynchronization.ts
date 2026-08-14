import { expect, now, vi } from "../support/index.js";
import type {
  InMemoryLiveDraftRoomSetupRepository,
  LeagueSeason,
  LoggedInAccount,
  PlatformApp,
  PlatformHttpHandler,
} from "../support/index.js";

interface KeeperLiveRoomContext {
  app: PlatformApp;
  handle: PlatformHttpHandler;
  liveDraftRoomSetupRepository: InMemoryLiveDraftRoomSetupRepository;
  owner11: LoggedInAccount;
  season: LeagueSeason;
  camTeam: LeagueSeason["teams"][number];
}

export const verifyKeeperLiveRoomSynchronization = async ({
  app,
  handle,
  liveDraftRoomSetupRepository,
  owner11,
  season,
  camTeam,
}: KeeperLiveRoomContext): Promise<void> => {
  const synchronizeInitialRosters = vi.spyOn(app, "synchronizeLiveDraftRoomInitialRosters")
    .mockRejectedValueOnce(new Error("The draft started while the keeper was being saved."));
  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/keepers/apply`,
    sessionToken: owner11.sessionToken,
    body: { command: "owner11 keeping achane 49", confirmed: true },
  })).resolves.toMatchObject({ status: 500 });
  await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
    initialRosters: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 50 }],
  });
  synchronizeInitialRosters.mockRestore();

  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/keepers/apply`,
    sessionToken: owner11.sessionToken,
    body: { command: "owner11 keeping achane 48", confirmed: true },
  })).resolves.toMatchObject({
    status: 200,
    body: { keepers: [{ teamId: camTeam.id, playerName: "De'Von Achane", price: 48 }] },
  });
  const roomId = `room-${season.id}-real`;
  await expect(app.getLiveDraftRoomState({
    actorSessionToken: owner11.sessionToken,
    roomId,
  })).resolves.toMatchObject({
    selectedTeam: {
      teamId: camTeam.id,
      spent: 48,
      budgetRemaining: 152,
      rosterSlotsRemaining: 15,
      roster: [expect.objectContaining({ name: "De'Von Achane", source: "keeper", price: 48 })],
    },
  });
  const roomAfterKeeperUpdate = await app.getLiveDraftRoom({
    actorSessionToken: owner11.sessionToken,
    roomId,
  });
  const latestPricing = (await app.listLeaguePricingSnapshots({
    actorSessionToken: owner11.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    scenarioId: "expected",
  })).at(-1);
  const pukaPrice = latestPricing?.rows.find(row => row.playerName === "Puka Nacua");
  const pukaRoomPlayer = roomAfterKeeperUpdate.playerCatalog.find(player => player.name === "Puka Nacua");
  expect(pukaRoomPlayer?.expectedPrice).toBe(Math.round(pukaPrice?.scenarioPrice ?? Number.NaN));
  expect(pukaRoomPlayer?.marketPrice).toBe(73);

  const pukaRoomPriceBeforeFailure = roomAfterKeeperUpdate.playerCatalog
    .find(player => player.name === "Puka Nacua")?.expectedPrice;
  const rebuildPricing = vi.spyOn(app, "rebuildLeaguePricing")
    .mockRejectedValueOnce(new Error("Pricing persistence failed."));
  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/keepers/apply`,
    sessionToken: owner11.sessionToken,
    body: { command: "owner11 keeping achane 47", confirmed: true },
  })).resolves.toMatchObject({ status: 500 });
  rebuildPricing.mockRestore();
  await expect(liveDraftRoomSetupRepository.findForSeason(season.id)).resolves.toMatchObject({
    initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
  });
  await expect(app.getLiveDraftRoom({
    actorSessionToken: owner11.sessionToken,
    roomId,
  })).resolves.toMatchObject({
    initialRosters: [{ playerName: "De'Von Achane", price: 48 }],
    playerCatalog: expect.arrayContaining([
      expect.objectContaining({ name: "Puka Nacua", expectedPrice: pukaRoomPriceBeforeFailure }),
    ]),
  });

  await expect(handle({
    method: "DELETE",
    path: `/seasons/${season.id}/keepers`,
    sessionToken: owner11.sessionToken,
    body: { teamId: camTeam.id, playerId: "devon achane" },
    now: new Date(now.getTime() + 1_000),
  })).resolves.toMatchObject({ status: 200, body: { keepers: [] } });
  await expect(app.getLiveDraftRoomState({
    actorSessionToken: owner11.sessionToken,
    roomId,
  })).resolves.toMatchObject({
    selectedTeam: {
      teamId: camTeam.id,
      spent: 0,
      budgetRemaining: 200,
      rosterSlotsRemaining: 16,
      roster: [],
    },
  });
  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/keepers/apply`,
    sessionToken: owner11.sessionToken,
    body: { command: "owner11 keeping achane 48", confirmed: true },
    now: new Date(now.getTime() + 2_000),
  })).resolves.toMatchObject({ status: 200 });

  const synchronizedRoom = await app.getLiveDraftRoom({
    actorSessionToken: owner11.sessionToken,
    roomId,
  });
  await app.startLiveDraftRoom({
    actorSessionToken: owner11.sessionToken,
    roomId,
    expectedRevision: synchronizedRoom.revision,
    idempotencyKey: "start:keeper-lock",
  });
  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/keepers/apply`,
    sessionToken: owner11.sessionToken,
    body: { command: "owner11 keeping achane 47", confirmed: true },
  })).resolves.toMatchObject({
    status: 409,
    body: {
      error: {
        code: "keeper_setup_locked",
        message: "Keepers are locked after the live draft starts.",
      },
    },
  });
  await expect(handle({
    method: "POST",
    path: `/seasons/${season.id}/historical-imports/upload-preview`,
    sessionToken: owner11.sessionToken,
    body: {
      fileName: "2025-results.csv",
      mimeType: "text/csv",
      base64: Buffer.from("owner,player,position,price\nOwner11,Puka Nacua,WR,$60").toString("base64"),
      seasonYear: 2025,
    },
  })).resolves.toMatchObject({
    status: 409,
    body: { error: { code: "historical_import_locked" } },
  });
};
