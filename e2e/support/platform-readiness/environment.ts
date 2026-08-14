import type { DeployedSmokeEnvironment } from "./types.js";

export const isDeployedSmoke = process.env.MOCKD_E2E_TARGET?.trim().toLowerCase() === "deployed";

export const requiredDeployedEnvironment = (): DeployedSmokeEnvironment => {
  const required = (key: string): string => {
    const value = process.env[key]?.trim();
    if (value === undefined || value.length === 0) {
      throw new Error(`Deployed platform smoke requires ${key}. Provision the smoke records before running Playwright.`);
    }
    return value;
  };

  return {
    commissionerEmail: required("MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL"),
    commissionerPassword: required("MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD"),
    memberEmail: required("MOCKD_E2E_DEPLOYED_MEMBER_EMAIL"),
    memberPassword: required("MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD"),
    seasonId: required("MOCKD_E2E_DEPLOYED_SEASON_ID"),
  };
};

const smokeRunIdFromEnv = (): string | undefined => {
  const rawSmokeRunId = process.env.MOCKD_E2E_RUN_ID?.trim();
  if (rawSmokeRunId === undefined || rawSmokeRunId.length === 0) return undefined;

  const normalizedSmokeRunId = rawSmokeRunId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalizedSmokeRunId.length === 0) {
    throw new Error("MOCKD_E2E_RUN_ID must contain at least one letter or number.");
  }

  return normalizedSmokeRunId;
};

export const smokeRunId = smokeRunIdFromEnv();
export const password = process.env.MOCKD_E2E_PASSWORD?.trim() || "e2e-secure-password";
export const emailDomain = process.env.MOCKD_E2E_EMAIL_DOMAIN?.trim() || "example.com";
const baseLeagueName = "E2E League 100001";
export const leagueName = smokeRunId === undefined ? baseLeagueName : `${baseLeagueName} ${smokeRunId}`;
export const provisioningToken = process.env.MOCKD_E2E_PROVISIONING_TOKEN?.trim()
  || "local-e2e-provisioning-token";

export const cleanIdFragment = (value: string): string => {
  const cleanValue = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleanValue.length === 0 ? "smoke" : cleanValue;
};

export const emailFor = (name: "owner11" | "owner04" | "owner02"): string =>
  smokeRunId === undefined
    ? `${name}.e2e@example.com`
    : `${name}.e2e+${smokeRunId}@${emailDomain}`;
