import { describe, expect, it } from "vitest";
import { PlayerNewsPage } from "../pages/PlayerNewsPage/PlayerNewsPage";
import { Component } from "./playerNewsRoute";

describe("playerNewsRoute", () => {
  it("loads the player news page", () => {
    expect(Component).toBe(PlayerNewsPage);
  });
});
