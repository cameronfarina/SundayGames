import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type BlueprintEnvVar = {
  key: string;
  value?: string;
  sync?: boolean;
  fromDatabase?: {
    name: string;
    property: string;
  };
};

type BlueprintService = {
  type: string;
  name: string;
  runtime: string;
  plan: string;
  region: string;
  autoDeployTrigger?: string;
  preDeployCommand?: string;
  dockerCommand?: string;
  healthCheckPath?: string;
  numInstances?: number;
  disk?: {
    name: string;
    mountPath: string;
    sizeGB: number;
  };
  envVars?: BlueprintEnvVar[];
};

type RenderBlueprint = {
  databases: Array<{
    name: string;
    plan: string;
    region: string;
    postgresMajorVersion: string;
    diskSizeGB: number;
    storageAutoscalingEnabled: boolean;
    ipAllowList: unknown[];
  }>;
  services: BlueprintService[];
};

const loadBlueprint = async (): Promise<RenderBlueprint> =>
  parse(await readFile("render.yaml", "utf8")) as RenderBlueprint;

const envFor = (service: BlueprintService, key: string): BlueprintEnvVar | undefined =>
  service.envVars?.find(envVar => envVar.key === key);

describe("Render production blueprint", () => {
  it("provisions a private paid Postgres database with recovery-capable storage", async () => {
    const blueprint = await loadBlueprint();

    expect(blueprint.databases).toEqual([
      expect.objectContaining({
        name: "mockd-postgres",
        plan: "basic-256mb",
        region: "virginia",
        postgresMajorVersion: "17",
        diskSizeGB: 15,
        storageAutoscalingEnabled: true,
        ipAllowList: [],
      }),
    ]);
  });

  it("deploys one health-checked web process with durable draft-session storage", async () => {
    const blueprint = await loadBlueprint();
    const web = blueprint.services.find(service => service.name === "mockd-web");

    expect(web).toEqual(expect.objectContaining({
      type: "web",
      runtime: "docker",
      plan: "starter",
      region: "virginia",
      autoDeployTrigger: "off",
      preDeployCommand: "npm run platform:migrate",
      dockerCommand: "/bin/sh -c 'node dist/src/platform/checkPlatformProductionReadiness.js && exec node dist/src/platform/startPlatformWeb.js'",
      healthCheckPath: "/readyz",
      numInstances: 1,
      disk: {
        name: "draft-tools",
        mountPath: "/var/lib/mockd/draft-tools",
        sizeGB: 1,
      },
    }));
    expect(envFor(web!, "DATABASE_URL")?.fromDatabase).toEqual({
      name: "mockd-postgres",
      property: "connectionString",
    });
    expect(envFor(web!, "NODE_ENV")?.value).toBe("production");
    expect(envFor(web!, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY")?.value)
      .toBe("/var/lib/mockd/draft-tools");
    expect(envFor(web!, "MOCKD_LIVE_DRAFT_DATA_MODE")?.value).toBe("postgres");
    expect(envFor(web!, "MOCKD_ALLOW_PUBLIC_SIGNUP")?.value).toBe("true");
    expect(envFor(web!, "MOCKD_AUTH_EMAIL_MODE")?.value).toBe("resend");
    expect(envFor(web!, "RESEND_API_KEY")).toEqual({ key: "RESEND_API_KEY", sync: false });
    expect(envFor(web!, "MOCKD_EMAIL_FROM")).toEqual({ key: "MOCKD_EMAIL_FROM", sync: false });
    expect(envFor(web!, "MOCKD_PUBLIC_BASE_URL")).toEqual({ key: "MOCKD_PUBLIC_BASE_URL", sync: false });
    expect(envFor(web!, "MOCKD_TRUST_PROXY")?.value).toBe("true");
    expect(envFor(web!, "MOCKD_INITIALIZE_POSTGRES_SCHEMA")?.value).toBe("false");
    expect(envFor(web!, "MOCKD_SCREENSHOT_IMPORT_MODE")?.value).toBe("openai");
    expect(envFor(web!, "OPENAI_API_KEY")).toEqual({ key: "OPENAI_API_KEY", sync: false });
  });

  it("does not deploy the legacy fixture-backed simulation worker", async () => {
    const blueprint = await loadBlueprint();
    const worker = blueprint.services.find(service => service.name === "mockd-worker");

    expect(worker).toBeUndefined();
    expect(blueprint.services).toHaveLength(1);
  });

  it("contains no provisioning or password secrets", async () => {
    const blueprintText = await readFile("render.yaml", "utf8");

    expect(blueprintText).not.toMatch(/PROVISIONING_TOKEN|PASSWORD_HASH/i);
  });
});
