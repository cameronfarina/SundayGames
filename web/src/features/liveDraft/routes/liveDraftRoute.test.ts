import { describe, expect, it } from "vitest";
import { LiveDraftPage } from "../pages/LiveDraftPage/LiveDraftPage";
import { Component } from "./liveDraftRoute";

describe("liveDraftRoute", () => {
  it("routes draft-room URLs to the live draft page", () => {
    expect(Component).toBe(LiveDraftPage);
  });
});
