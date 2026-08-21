import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("local E2E seed architecture", () => {
  it("keeps runtime, fixtures, and workflows focused", () => {
    const root = join(process.cwd(), "src/platform/seedLocalE2e");
    const facade = join(process.cwd(), "src/platform/seedLocalE2e.ts");
    const modules = readdirSync(root).map(entry => join(root, entry));
    for (const file of [facade, ...modules]) {
      expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(250);
    }
  });
});
