import { describe, expect, it } from "vitest";
import { createAppRouter } from "./createAppRouter";

describe("createAppRouter", () => {
  it("creates an independently disposable browser router", () => {
    window.history.replaceState(null, "", "/practice");
    const router = createAppRouter();

    expect(router.state.location.pathname).toBe("/practice");

    router.dispose();
  });
});
