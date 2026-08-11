import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

type BlueprintEnvVar = {
  key: string;
  value?: string;
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
    expect(envFor(web!, "MOCKD_ALLOW_PUBLIC_SIGNUP")?.value).toBe("false");
    expect(envFor(web!, "MOCKD_TRUST_PROXY")?.value).toBe("true");
    expect(envFor(web!, "MOCKD_INITIALIZE_POSTGRES_SCHEMA")?.value).toBe("false");
  });

  it("deploys the simulation worker against the same database", async () => {
    const blueprint = await loadBlueprint();
    const worker = blueprint.services.find(service => service.name === "mockd-worker");

    expect(worker).toEqual(expect.objectContaining({
      type: "worker",
      runtime: "docker",
      plan: "starter",
      region: "virginia",
      autoDeployTrigger: "off",
      preDeployCommand: "npm run platform:migrate",
      dockerCommand: "node dist/src/platform/startPlatformWorker.js",
    }));
    expect(envFor(worker!, "DATABASE_URL")?.fromDatabase).toEqual({
      name: "mockd-postgres",
      property: "connectionString",
    });
    expect(envFor(worker!, "MOCKD_WORKER_JOB_KINDS")?.value).toBe("simulation");
    expect(envFor(worker!, "MOCKD_SIMULATION_DATA_MODE")?.value).toBe("local-fixtures");
    expect(envFor(worker!, "MOCKD_INITIALIZE_POSTGRES_SCHEMA")?.value).toBe("false");
  });

  it("contains no provisioning secret or public-signup escape hatch", async () => {
    const blueprintText = await readFile("render.yaml", "utf8");

    expect(blueprintText).not.toMatch(/PROVISIONING_TOKEN|PASSWORD_HASH|ALLOW_PUBLIC_SIGNUP:\s*true/i);
  });
});
