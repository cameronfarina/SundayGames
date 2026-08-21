import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SignupWizard styles", () => {
  it("centers each radio against its title and description", async () => {
    const css = await readFile(resolve(
      process.cwd(),
      "web/src/features/accountOnboarding/components/SignupWizard/SignupWizard.css",
    ), "utf8");

    expect(css).toMatch(
      /\.signup-wizard__option input\s*\{[^}]*align-self:\s*center;[^}]*margin:\s*0;/u,
    );
  });
});
