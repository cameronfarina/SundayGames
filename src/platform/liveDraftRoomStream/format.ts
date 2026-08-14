import type { FormattableLiveDraftRoomSsePayload } from "./contracts/sse.js";

export const formatLiveDraftRoomSsePayloads = (
  events: readonly FormattableLiveDraftRoomSsePayload[],
): string => {
  if (events.length === 0) return ": keep-alive\n\n";

  return events.map(event => {
    const lines = [
      `id: ${event.id}`,
      `event: ${event.event}`,
      ...("retry" in event ? [`retry: ${event.retry}`] : []),
      `data: ${JSON.stringify(event.data)}`,
    ];

    return `${lines.join("\n")}\n\n`;
  }).join("");
};
