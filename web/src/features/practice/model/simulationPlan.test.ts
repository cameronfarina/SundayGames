import { describe, expect, it } from "vitest";
import { formText } from "./simulationPlan";

describe("simulation strategy plan", () => {
  it("reads trimmed text while rejecting absent and file form values", () => {
    const data = new FormData();
    data.set("text", "  hello  ");
    data.set("file", new File(["data"], "draft.csv"));
    expect(formText(data, "text")).toBe("hello");
    expect(formText(data, "missing")).toBe("");
    expect(formText(data, "file")).toBe("");
  });

});
