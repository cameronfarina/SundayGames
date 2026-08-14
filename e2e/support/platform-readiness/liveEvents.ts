import type { Page } from "@playwright/test";
import type { BrowserSseEvent } from "./types.js";

interface SaleEventRequest {
  roomId: string;
  afterRevision: number;
}

export const waitForSaleEvent = async (
  page: Page,
  roomIdForStream: string,
  afterRevision: number,
): Promise<BrowserSseEvent> =>
  await page.evaluate<BrowserSseEvent, SaleEventRequest>(async ({
    roomId: currentRoomId,
    afterRevision: revision,
  }) => {
    return await new Promise<BrowserSseEvent>((resolve, reject) => {
      const source = new EventSource(
        `/live-rooms/${encodeURIComponent(currentRoomId)}/event-stream?afterRevision=${revision}`,
      );
      const timeout = window.setTimeout(() => {
        source.close();
        reject(new Error("Timed out waiting for room.sale SSE event."));
      }, 10_000);

      const finish = (event: MessageEvent<string>): void => {
        window.clearTimeout(timeout);
        source.close();
        resolve({
          type: event.type,
          lastEventId: event.lastEventId,
          data: JSON.parse(event.data),
        });
      };

      source.addEventListener("room.sale", finish);
      source.onerror = () => {
        window.clearTimeout(timeout);
        source.close();
        reject(new Error("Live room SSE connection failed."));
      };
    });
  }, {
    roomId: roomIdForStream,
    afterRevision,
  });
