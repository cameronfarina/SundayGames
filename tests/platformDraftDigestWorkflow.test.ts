import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("daily draft operations digest workflow", () => {
  it("uses a scheduled HTTPS trigger instead of a paid application worker", async () => {
    const source = await readFile(".github/workflows/draft-operations-digest.yml", "utf8");
    const workflow = parse(source) as Record<string, unknown>;

    expect(source).toContain("schedule:");
    expect(source).toContain("MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN");
    expect(source).toContain("/platform-admin/draft-digest");
    expect(source).toContain("x-sundaygames-draft-digest-token");
    expect(source).toContain("::notice::Daily draft digest is not configured");
    expect(source).toContain("steps.configuration.outputs.enabled == 'true'");
    expect(source).toContain("cancel-in-progress: false");
    expect(source).not.toContain("--retry");
    expect(source).not.toContain("platform:worker");
    expect(workflow).toHaveProperty("jobs.deliver.runs-on", "ubuntu-latest");
  });

  it("declares every creator-operations setting on the Render web service", async () => {
    const blueprint = parse(await readFile("render.yaml", "utf8")) as {
      services?: Array<{ name?: string; envVars?: Array<{ key?: string }> }>;
    };
    const webService = blueprint.services?.find(service => service.name === "sundaygames");
    const keys = webService?.envVars?.map(variable => variable.key);

    expect(keys).toEqual(expect.arrayContaining([
      "MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS",
      "MOCKD_PLATFORM_DRAFT_OPERATIONS_TIMEZONE",
      "MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN",
      "MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL",
    ]));
  });
});
