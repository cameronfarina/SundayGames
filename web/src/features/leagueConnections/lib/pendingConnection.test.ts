import { describe, expect, it } from "vitest";
import { pendingConnectionId } from "./pendingConnection";

const idle = { isPending: false, variables: undefined };

describe("pendingConnectionId", () => {
  it("names no card while nothing is in flight", () => {
    expect(pendingConnectionId(idle, idle)).toBeUndefined();
  });

  it("names the card being synced", () => {
    expect(pendingConnectionId({ isPending: true, variables: "connection-1" }, idle))
      .toBe("connection-1");
  });

  it("names the card being disconnected when no sync is running", () => {
    expect(pendingConnectionId(idle, { isPending: true, variables: "connection-2" }))
      .toBe("connection-2");
  });

  it("prefers the sync in flight when both are running", () => {
    expect(pendingConnectionId(
      { isPending: true, variables: "connection-1" },
      { isPending: true, variables: "connection-2" },
    )).toBe("connection-1");
  });
});
