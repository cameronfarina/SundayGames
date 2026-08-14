import { describe, expect, it } from "vitest";
import { MyTeamPage } from "../pages/MyTeamPage/MyTeamPage";
import { Component } from "./myTeamRoute";

describe("myTeamRoute", () => {
  it("exports the My Team page for lazy parent integration", () => {
    expect(Component).toBe(MyTeamPage);
  });
});
