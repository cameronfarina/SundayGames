import { expect, it, liveDraftRoomRevisionNotificationFor } from "./helpers/index.js";
import { describePlatformServer } from "./helpers/suite.js";

describePlatformServer(({  }) => {
  it("publishes live-room revisions produced by reopen mutations", () => {
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/live-rooms/room_2026/reopen",
      body: {},
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 7 } },
    })).toEqual({ roomId: "room_2026", revision: 7 });
  });

  it("publishes live-room revisions produced by keeper mutations", () => {
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/seasons/season_2026/keepers/apply",
      body: {},
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 3 } },
    })).toEqual({ roomId: "room_2026", revision: 3 });
    expect(liveDraftRoomRevisionNotificationFor({
      method: "POST",
      path: "/historical-imports/batch_2025/commit",
      body: { seasonId: "season_2026" },
    }, {
      status: 200,
      body: { room: { roomId: "room_2026", revision: 4 } },
    })).toEqual({ roomId: "room_2026", revision: 4 });
  });
});
