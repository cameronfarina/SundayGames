import { describe, expect, it } from "vitest";
import { ConnectionsPage } from "../pages/ConnectionsPage/ConnectionsPage";
import { Component } from "./connectionsRoute";

describe("connectionsRoute", () => {
  it("loads the connections page", () => {
    expect(Component).toBe(ConnectionsPage);
  });
});
