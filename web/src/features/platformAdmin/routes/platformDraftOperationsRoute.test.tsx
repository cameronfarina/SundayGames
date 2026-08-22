import { describe, expect, it } from "vitest";
import { Component } from "./platformDraftOperationsRoute";

describe("platformDraftOperationsRoute", () => {
  it("exports the creator operations page", () => {
    expect(Component).toBeTypeOf("function");
  });
});
