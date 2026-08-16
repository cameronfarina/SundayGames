import { QueryClient } from "@tanstack/react-query";
import { matchRoutes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { createAppRoutes } from "./appRoutes";

const appRoutes = createAppRoutes(new QueryClient());

describe("application routes", () => {
  it.each([
    "/login",
    "/signup",
    "/practice",
    "/mock-drafts",
    "/draft-room",
    "/league",
    "/my-team",
    "/player-news",
    "/commissioner",
    "/invite",
  ])(
    "owns the %s browser route",
    path => {
      expect(matchRoutes(appRoutes, path)).not.toBeNull();
    },
  );

  it("does not hide unknown URLs behind the application shell", () => {
    expect(matchRoutes(appRoutes, "/not-a-real-page")).toBeNull();
  });

  it.each([
    "/practice",
    "/mock-drafts",
    "/draft-room",
    "/league",
    "/my-team",
    "/player-news",
    "/commissioner",
    "/invite",
  ])("loads the %s feature module on demand", async path => {
    const matches = matchRoutes(appRoutes, path);
    const lazy = matches?.at(-1)?.route.lazy;
    if (typeof lazy !== "function") throw new Error(`Expected ${path} to be lazy-loaded.`);

    const routeModule = await lazy();
    expect(routeModule.Component).toBeTypeOf("function");
  });
});
