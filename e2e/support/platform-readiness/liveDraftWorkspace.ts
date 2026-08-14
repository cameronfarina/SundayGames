import { expect, type Dialog } from "@playwright/test";
import { api, expectOk } from "./api.js";
import { waitForSaleEvent } from "./liveEvents.js";
import type {
  EventsBody,
  LiveDraftRoomBody,
  ReadySmokeWorkspace,
} from "./types.js";

export const exerciseLiveDraft = async (workspace: ReadySmokeWorkspace): Promise<void> => {
  const {
    commissionerPage: camPage,
    memberPage: sethPage,
    room: createdRoom,
    commissionerOwnerName,
    salePlayerName,
    salePrice,
  } = workspace;
  const roomId = createdRoom.roomId;

  await expect(camPage.locator("#draft-room-view")).toBeVisible();
  await expect(sethPage.locator("#draft-room-view")).toBeVisible();
  await expect(camPage.locator("#draft-commissioner-controls")).toBeVisible();
  await expect(sethPage.locator("#draft-member-note")).toBeVisible();
  const commissionerPlayerRow = camPage.locator("#draft-board-rows [data-player-name]")
    .filter({ hasText: salePlayerName })
    .first();
  const memberPlayerRow = sethPage.locator("#draft-board-rows [data-player-name]")
    .filter({ hasText: salePlayerName })
    .first();
  await expect(commissionerPlayerRow).toBeVisible();
  await expect(memberPlayerRow).toBeVisible();

  await camPage.locator("#draft-start").click();
  await expect(camPage.locator("#draft-room-status")).toHaveText("Live");
  await expect(sethPage.locator("#draft-room-status")).toHaveText("Live");
  const startedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  expect(startedRoom).toMatchObject({
    status: "live",
    revision: createdRoom.revision + 1,
  });

  const saleEventPromise = waitForSaleEvent(sethPage, roomId, startedRoom.revision);
  await commissionerPlayerRow.getByRole("button", { name: `Use ${salePlayerName} in sale command` }).click();
  const saleCommand = camPage.locator("#draft-sale-command");
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.locator("#draft-log-sale").click();
  await expect(camPage.locator("#draft-sales")).toContainText(salePlayerName);
  await expect(sethPage.locator("#draft-sales")).toContainText(salePlayerName);
  const soldRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  const saleEvent = await saleEventPromise;

  expect(soldRoom).toMatchObject({
    status: "live",
    revision: startedRoom.revision + 1,
    salesLog: [
      expect.objectContaining({
        ownerDisplayName: commissionerOwnerName,
        playerName: salePlayerName,
        price: salePrice,
      }),
    ],
  });
  expect(saleEvent).toMatchObject({
    type: "room.sale",
    lastEventId: `${roomId}:${soldRoom.revision}`,
    data: expect.objectContaining({
      revision: soldRoom.revision,
      sale: expect.objectContaining({
        ownerDisplayName: commissionerOwnerName,
        playerName: salePlayerName,
        price: salePrice,
      }),
    }),
  });

  const polledEvents = expectOk(await api<EventsBody>(
    sethPage,
    `/live-rooms/${roomId}/events?afterRevision=${startedRoom.revision}`,
  )).events;
  expect(polledEvents.currentRevision).toBe(soldRoom.revision);
  expect(polledEvents.events).toEqual([
    expect.objectContaining({
      event: "room.sale",
      revision: soldRoom.revision,
    }),
  ]);

  camPage.once("dialog", dialog => dialog.accept());
  await camPage.locator("#draft-undo").click();
  await expect(camPage.locator("#draft-sales")).not.toContainText(salePlayerName);
  await expect(sethPage.locator("#draft-sales")).not.toContainText(salePlayerName);

  await commissionerPlayerRow.getByRole("button", { name: `Use ${salePlayerName} in sale command` }).click();
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.locator("#draft-log-sale").click();
  await expect(camPage.locator("#draft-sales")).toContainText(salePlayerName);

  let endConfirmationCount = 0;
  const acceptEndConfirmation = (dialog: Dialog): void => {
    endConfirmationCount += 1;
    void dialog.accept();
  };
  camPage.on("dialog", acceptEndConfirmation);
  await camPage.locator("#draft-end").click();
  await expect(camPage.locator("#draft-room-status")).toHaveText("Complete");
  camPage.off("dialog", acceptEndConfirmation);
  expect(endConfirmationCount).toBe(2);
  await expect(sethPage.locator("#draft-room-status")).toHaveText("Complete");
  const endedRoom = expectOk(await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`)).room;
  expect(endedRoom).toMatchObject({
    status: "ended",
    exportReadiness: {
      status: "blocked",
      blockers: expect.arrayContaining([expect.stringContaining("open roster slots")]),
    },
  });
  await expect(camPage.locator("#draft-export")).toBeDisabled();
  const blockedExport = await api<{ error: { code: string; message: string } }>(
    camPage,
    `/live-rooms/${roomId}/export-artifacts`, {
      method: "POST",
      body: {},
    },
  );
  expect(blockedExport).toMatchObject({
    status: 409,
    body: {
      error: {
        code: "draft_room_not_final",
        message: "Final export requires every team to fill every roster slot.",
      },
    },
  });
};
