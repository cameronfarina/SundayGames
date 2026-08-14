import { describe, expect, it } from "vitest";
import { invitationAuthPaths, leaguePathForInvitation } from "./invitationPaths";

describe("invitation paths", () => {
  it("encodes tokens inside same-origin return paths", () => {
    expect(invitationAuthPaths("secret&token")).toEqual({
      login: "/login?returnTo=%2Finvite%3Ftoken%3Dsecret%2526token",
      signup: "/signup?returnTo=%2Finvite%3Ftoken%3Dsecret%2526token",
    });
  });

  it("opens the claimed season without retaining its invitation token", () => {
    expect(leaguePathForInvitation("season/1")).toBe("/league?seasonId=season%2F1");
  });
});
