export type PlatformE2eTarget = "local" | "deployed";

export interface PlatformE2eEnv {
  readonly [key: string]: string | undefined;
}

export interface DeployedPlatformSmokeConfig {
  commissionerEmail: string;
  commissionerPassword: string;
  memberEmail: string;
  memberPassword: string;
  seasonId: string;
}

export interface PlatformE2eRunConfig {
  target: PlatformE2eTarget;
  baseUrl: string | undefined;
  smokeRunId: string | undefined;
  deployedSmoke: DeployedPlatformSmokeConfig | undefined;
  playwrightArgs: readonly string[];
  serverStartupTimeoutMs: number;
  deployedPreflightTimeoutMs: number;
  helpRequested: boolean;
}

export type PlatformE2eFetch = (input: URL, init?: RequestInit) => Promise<Response>;

export interface ParsedRunnerArgs {
  target: PlatformE2eTarget | undefined;
  baseUrl: string | undefined;
  smokeRunId: string | undefined;
  serverStartupTimeoutMs: number | undefined;
  deployedPreflightTimeoutMs: number | undefined;
  playwrightArgs: readonly string[];
  helpRequested: boolean;
}

export interface ParsedOptionValue {
  value: string;
  nextIndex: number;
}

export const defaultServerStartupTimeoutMs = 30_000;
export const defaultDeployedPreflightTimeoutMs = 15_000;
export const shutdownTimeoutMs = 5_000;

export const deployedSmokeEnvironment: Readonly<
  Record<keyof DeployedPlatformSmokeConfig, string>
> = {
  commissionerEmail: "MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL",
  commissionerPassword: "MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD",
  memberEmail: "MOCKD_E2E_DEPLOYED_MEMBER_EMAIL",
  memberPassword: "MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD",
  seasonId: "MOCKD_E2E_DEPLOYED_SEASON_ID",
};

export const deployedSmokeFields: readonly (keyof DeployedPlatformSmokeConfig)[] = [
  "commissionerEmail",
  "commissionerPassword",
  "memberEmail",
  "memberPassword",
  "seasonId",
];

export const localFixtureEnvironment: readonly string[] = [
  "MOCKD_E2E_DATA_FILE",
  "MOCKD_E2E_EMAIL_DOMAIN",
  "MOCKD_E2E_PASSWORD",
  "MOCKD_E2E_PROVISIONING_TOKEN",
  "MOCKD_E2E_RUN_ID",
];
