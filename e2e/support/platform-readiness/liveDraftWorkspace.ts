import { expect, type Dialog } from "@playwright/test";
import { api, expectOk } from "./api.js";
import { waitForSaleEvent } from "./liveEvents.js";
import type {
  EventsBody,
  LiveDraftRoomBody,
  ReadySmokeWorkspace,
} from "./types.js";

export const exerciseLiveDraft = async (
  workspace: ReadySmokeWorkspace,
): Promise<void> => {
  const {
    commissionerPage: camPage,
    memberPage: sethPage,
    room: createdRoom,
    commissionerOwnerName,
    salePlayerName,
    salePrice,
  } = workspace;
  const roomId = createdRoom.roomId;

  await expect(
    camPage.getByRole("heading", { name: "Live auction draft" }),
  ).toBeVisible();
  await expect(
    sethPage.getByRole("heading", { name: "Live auction draft" }),
  ).toBeVisible();
  await expect(
    camPage.getByRole("region", { name: "Draft command" }),
  ).toBeVisible();
  await expect(
    sethPage.getByText(
      "League members can follow the live board, sales, budgets, and rosters here.",
    ),
  ).toBeVisible();
  const commissionerPlayerRow = camPage
    .getByRole("row")
    .filter({ hasText: salePlayerName })
    .first();
  const memberPlayerRow = sethPage
    .getByRole("row")
    .filter({ hasText: salePlayerName })
    .first();
  await expect(commissionerPlayerRow).toBeVisible();
  await expect(memberPlayerRow).toBeVisible();

  await camPage.getByRole("button", { name: "Start draft" }).click();
  const commissionerStatus = camPage.getByRole("region", {
    name: "Draft status",
  });
  const memberStatus = sethPage.getByRole("region", { name: "Draft status" });
  await expect(
    commissionerStatus.getByText("Live", { exact: true }),
  ).toBeVisible();
  await expect(memberStatus.getByText("Live", { exact: true })).toBeVisible();
  const startedRoom = expectOk(
    await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`),
  ).room;
  expect(startedRoom).toMatchObject({
    status: "live",
    revision: createdRoom.revision + 1,
  });

  const saleEventPromise = waitForSaleEvent(
    sethPage,
    roomId,
    startedRoom.revision,
  );
  await commissionerPlayerRow
    .getByRole("button", { name: `Use ${salePlayerName} in sale command` })
    .click();
  const saleCommand = camPage.getByRole("textbox", { name: "Sale command" });
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.getByRole("button", { name: "Log sale" }).click();
  const commissionerSales = camPage.getByRole("region", { name: "All sales" });
  const memberSales = sethPage.getByRole("region", { name: "All sales" });
  await expect(commissionerSales).toContainText(salePlayerName);
  await expect(memberSales).toContainText(salePlayerName);
  const soldRoom = expectOk(
    await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`),
  ).room;
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
      salesLog: [
        expect.objectContaining({
          ownerDisplayName: commissionerOwnerName,
          playerName: salePlayerName,
          price: salePrice,
        }),
      ],
    }),
  });

  const polledEvents = expectOk(
    await api<EventsBody>(
      sethPage,
      `/live-rooms/${roomId}/events?afterRevision=${startedRoom.revision}`,
    ),
  ).events;
  expect(polledEvents.currentRevision).toBe(soldRoom.revision);
  expect(polledEvents.events).toEqual([
    expect.objectContaining({
      event: "room.sale",
      revision: soldRoom.revision,
    }),
  ]);

  camPage.once("dialog", (dialog) => dialog.accept());
  await camPage.getByRole("button", { name: "Undo latest sale" }).click();
  await expect(commissionerSales).not.toContainText(salePlayerName);
  await expect(memberSales).not.toContainText(salePlayerName);

  await commissionerPlayerRow
    .getByRole("button", { name: `Use ${salePlayerName} in sale command` })
    .click();
  await saleCommand.fill(`${await saleCommand.inputValue()}${salePrice}`);
  await camPage.getByRole("button", { name: "Log sale" }).click();
  await expect(commissionerSales).toContainText(salePlayerName);

  let endConfirmationCount = 0;
  const acceptEndConfirmation = (dialog: Dialog): void => {
    endConfirmationCount += 1;
    void dialog.accept();
  };
  camPage.on("dialog", acceptEndConfirmation);
  await camPage.getByRole("button", { name: "End draft" }).click();
  await expect(
    commissionerStatus.getByText("Complete", { exact: true }),
  ).toBeVisible();
  camPage.off("dialog", acceptEndConfirmation);
  expect(endConfirmationCount).toBe(2);
  await expect(
    memberStatus.getByText("Complete", { exact: true }),
  ).toBeVisible();
  const endedRoom = expectOk(
    await api<LiveDraftRoomBody>(camPage, `/live-rooms/${roomId}`),
  ).room;
  expect(endedRoom).toMatchObject({
    status: "ended",
    exportReadiness: {
      status: "blocked",
      blockers: expect.arrayContaining([
        expect.stringContaining("open roster slots"),
      ]),
    },
  });
  await expect(
    camPage.getByRole("button", { name: "Prepare final CSV" }),
  ).toBeDisabled();
  const blockedExport = await api<{ error: { code: string; message: string } }>(
    camPage,
    `/live-rooms/${roomId}/export-artifacts`,
    {
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
