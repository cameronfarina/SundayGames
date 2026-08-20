import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";

const envVarSchema = z.object({
  key: z.string(),
  value: z.string().optional(),
  sync: z.boolean().optional(),
  fromDatabase: z.object({ name: z.string(), property: z.string() }).optional(),
  fromService: z.object({
    type: z.string(),
    name: z.string(),
    envVarKey: z.string(),
  }).optional(),
});

const serviceSchema = z.object({
  type: z.string(),
  name: z.string(),
  runtime: z.string(),
  plan: z.string(),
  region: z.string(),
  autoDeployTrigger: z.string().optional(),
  preDeployCommand: z.string().optional(),
  dockerCommand: z.string().optional(),
  healthCheckPath: z.string().optional(),
  numInstances: z.number().optional(),
  disk: z.object({ name: z.string(), mountPath: z.string(), sizeGB: z.number() }).optional(),
  envVars: z.array(envVarSchema).optional(),
});

const blueprintSchema = z.object({
  databases: z.array(z.object({
    name: z.string(),
    plan: z.string(),
    region: z.string(),
    postgresMajorVersion: z.string(),
    diskSizeGB: z.number(),
    storageAutoscalingEnabled: z.boolean(),
    ipAllowList: z.array(z.unknown()),
  })),
  services: z.array(serviceSchema),
});

type BlueprintEnvVar = z.infer<typeof envVarSchema>;
type BlueprintService = z.infer<typeof serviceSchema>;
type RenderBlueprint = z.infer<typeof blueprintSchema>;

const loadBlueprint = async (): Promise<RenderBlueprint> =>
  blueprintSchema.parse(parse(await readFile("render.yaml", "utf8")));

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
    const web = blueprint.services.find(service => service.name === "sundaygames");
    if (web === undefined) throw new Error("Expected the Sunday Games web service.");

    expect(web).toEqual(expect.objectContaining({
      type: "web",
      runtime: "docker",
      plan: "starter",
      region: "virginia",
      autoDeployTrigger: "checksPass",
      preDeployCommand: "npm run platform:migrate",
      healthCheckPath: "/readyz",
      numInstances: 1,
    }));
    // A disk would pin the service to one instance and make Render stop the old
    // instance before starting the new one, so every deploy would drop traffic.
    expect(web.disk).toBeUndefined();
    // Render mis-parses a quoted compound dockerCommand (deploys fail with
    // exit 127), so the readiness-gated start chain lives in the image CMD.
    expect(web.dockerCommand).toBeUndefined();
    expect(envFor(web, "DATABASE_URL")?.fromDatabase).toEqual({
      name: "mockd-postgres",
      property: "connectionString",
    });
    expect(envFor(web, "NODE_ENV")?.value).toBe("production");
    expect(envFor(web, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY")?.value)
      .toBe("/var/lib/mockd/draft-tools");
    expect(envFor(web, "MOCKD_LIVE_DRAFT_DATA_MODE")?.value).toBe("postgres");
    expect(envFor(web, "MOCKD_ALLOW_PUBLIC_SIGNUP")?.value).toBe("true");
    expect(envFor(web, "MOCKD_AUTH_EMAIL_MODE")?.value).toBe("resend");
    expect(envFor(web, "RESEND_API_KEY")).toEqual({ key: "RESEND_API_KEY", sync: false });
    expect(envFor(web, "MOCKD_EMAIL_FROM")).toEqual({ key: "MOCKD_EMAIL_FROM", sync: false });
    expect(envFor(web, "MOCKD_PUBLIC_BASE_URL")).toEqual({
      key: "MOCKD_PUBLIC_BASE_URL",
      fromService: {
        type: "web",
        name: "sundaygames",
        envVarKey: "RENDER_EXTERNAL_URL",
      },
    });
    expect(envFor(web, "MOCKD_TRUST_PROXY")?.value).toBe("true");
    expect(envFor(web, "MOCKD_INITIALIZE_POSTGRES_SCHEMA")?.value).toBe("false");
    expect(envFor(web, "MOCKD_SCREENSHOT_IMPORT_MODE")?.value).toBe("disabled");
    expect(envFor(web, "MOCKD_SCREENSHOT_IMPORT_MODEL")).toBeUndefined();
    expect(envFor(web, "OPENAI_API_KEY")).toBeUndefined();
    expect(envFor(web, "FANTASYPROS_API_KEY"))
      .toEqual({ key: "FANTASYPROS_API_KEY", sync: false });
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

  it("boots through the readiness check via the image CMD", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");

    expect(dockerfile).toContain(
      'CMD ["/bin/sh", "-c", "node dist/src/platform/checkPlatformProductionReadiness.js && exec node dist/src/platform/startPlatformWeb.js"]',
    );
  });
});
