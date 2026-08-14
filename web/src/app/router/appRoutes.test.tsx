import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createAppRoutes } from "./appRoutes";

const appRoutes = createAppRoutes(new QueryClient());

describe("application routes", () => {
  it.each(["/login", "/signup", "/practice", "/league", "/my-team", "/invite"])(
    "owns the %s browser route",
    path => {
      expect(matchRoutes(appRoutes, path)).not.toBeNull();
    },
  );

  it("does not hide unknown URLs behind the application shell", () => {
    expect(matchRoutes(appRoutes, "/not-a-real-page")).toBeNull();
  });
});
import { QueryClient } from "@tanstack/react-query";
