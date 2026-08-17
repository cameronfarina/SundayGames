import { describe, expect, it } from "vitest";
import { reloadPage } from "./reloadPage";

describe("reload page", () => {
  it("asks the browser to reload without throwing", () => {
    expect(() => { reloadPage(); }).not.toThrow();
  });
});
