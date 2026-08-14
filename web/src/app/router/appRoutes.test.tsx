import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { appRoutes } from "./appRoutes";

describe("application routes", () => {
  it.each(["/practice", "/league", "/my-team", "/invite"])(
    "owns the %s browser route",
    path => {
      expect(matchRoutes(appRoutes, path)).not.toBeNull();
    },
  );

  it("does not hide unknown URLs behind the application shell", () => {
    expect(matchRoutes(appRoutes, "/not-a-real-page")).toBeNull();
  });
});
