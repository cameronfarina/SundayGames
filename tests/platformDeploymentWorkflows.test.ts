import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const workflow = async (name: string): Promise<string> =>
  await readFile(`.github/workflows/${name}`, "utf8");

describe("production deployment workflows", () => {
  it("binds deployed credentials to a protected, fixed production target", async () => {
    const content = await workflow("deployed-smoke.yml");

    expect(content).toContain("environment: production");
    expect(content).toContain("MOCKD_E2E_BASE_URL: ${{ vars.MOCKD_PRODUCTION_BASE_URL }}");
    expect(content).not.toContain("inputs.base_url");
    expect(content).not.toContain("upload-artifact");
  });

  it("keeps the repeatable deployed smoke away from real draft mutations", async () => {
    const content = await readFile("e2e/platform-readiness.spec.ts", "utf8");
    const deployedSmoke = content.slice(
      content.indexOf("const exerciseDeployedWorkspace"),
      content.indexOf("const exerciseReadyWorkspace"),
    );

    expect(deployedSmoke).toContain("#setup-season-id-input");
    expect(deployedSmoke).not.toContain("createLiveRoomFromSetup");
    expect(deployedSmoke).not.toContain('method: "POST"');
    expect(deployedSmoke).not.toContain("#draft-start");
    expect(deployedSmoke).not.toContain("#draft-log-sale");
    expect(deployedSmoke).not.toContain("#draft-end");
  });

  it("fails closed when production monitoring or alert routing is missing", async () => {
    const content = await workflow("production-health.yml");

    expect(content).toContain('["MOCKD_PRODUCTION_BASE_URL", process.env.BASE_URL]');
    expect(content).toContain('["MOCKD_PRODUCTION_ALERT_WEBHOOK_URL", process.env.ALERT_WEBHOOK_URL]');
    expect(content).toContain('throw new Error(`${name} is required.`)');
    expect(content).toContain("Notify production owner");
    expect(content).not.toContain("if: ${{ vars.MOCKD_PRODUCTION_BASE_URL != '' }}");
  });

  it("builds and boots the production image with Postgres in CI", async () => {
    const content = await workflow("ci.yml");

    expect(content).toContain("image: postgres:17-bookworm");
    expect(content).toContain("docker build --tag mockd-ci .");
    expect(content).toContain("Serialize concurrent first-deploy migrations");
    expect(content).toContain("http://127.0.0.1:4319/readyz");
    expect(content).toContain("--env MOCKD_SCREENSHOT_IMPORT_MODE=openai");
    expect(content).toContain("--env OPENAI_API_KEY=ci-placeholder-not-used");
    expect(content).toContain("--env MOCKD_ALLOW_PUBLIC_SIGNUP=true");
    expect(content).toContain("--env MOCKD_AUTH_EMAIL_MODE=resend");
    expect(content).toContain("--env RESEND_API_KEY=ci-placeholder-not-used");
    expect(content).toContain("--env MOCKD_EMAIL_FROM=accounts@mockd.example.com");
    expect(content).toContain("--env MOCKD_PUBLIC_BASE_URL=https://mockd.example.com");
    expect(content).toContain(
      "--env MOCKD_INVITATION_TOKEN_SECRET=ci-placeholder-invitation-token-secret-at-least-32-characters",
    );
    expect(content).toContain(".State.Running}}' mockd-ci-web");
    expect(content).not.toContain("mockd-ci-worker");
    expect(content).not.toContain("MOCKD_SIMULATION_DATA_MODE=local-fixtures");
    expect(content).not.toContain(".State.Health.Status");
    expect(content).toContain("platform:render:validate");
  });
});
