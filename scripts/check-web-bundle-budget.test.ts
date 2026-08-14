import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { webBundleBudgetViolations } from "./check-web-bundle-budget.js";

const writeBundle = async (entrySource: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "mockd-web-budget-"));
  await mkdir(join(directory, ".vite"));
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "assets", "entry.js"), entrySource);
  await writeFile(join(directory, "assets", "route.js"), "route");
  await writeFile(join(directory, "assets", "app.css"), "body{}");
  await writeFile(join(directory, ".vite", "manifest.json"), JSON.stringify({
    "src/main.tsx": {
      file: "assets/entry.js",
      isEntry: true,
      css: ["assets/app.css"],
    },
    "src/features/practice/routes/practiceRoute.ts": {
      file: "assets/route.js",
      isDynamicEntry: true,
    },
  }));

  return directory;
};

describe("web bundle budget", () => {
  it("accepts entry, route, and stylesheet assets within budget", async () => {
    const directory = await writeBundle("entry");

    await expect(webBundleBudgetViolations(directory)).resolves.toEqual([]);
  });

  it("reports compressed entry assets above the hard budget", async () => {
    const noisySource = Array.from(
      { length: 20_000 },
      (_, index) => `${index}-${Math.random()}-unique`,
    ).join("\n");
    const directory = await writeBundle(noisySource);

    await expect(webBundleBudgetViolations(directory)).resolves.toEqual([
      expect.stringContaining("entry.js"),
    ]);
  });
});
