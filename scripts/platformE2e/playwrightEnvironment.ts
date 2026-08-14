import {
  deployedSmokeEnvironment,
  localFixtureEnvironment,
  type PlatformE2eRunConfig,
} from "./contracts.js";

export const playwrightEnvironment = (
  config: PlatformE2eRunConfig,
  dataFilePath?: string,
): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, MOCKD_E2E_TARGET: config.target };
  for (const key of Object.values(deployedSmokeEnvironment)) delete env[key];
  if (config.target === "deployed") {
    for (const key of localFixtureEnvironment) delete env[key];
    delete env["MOCKD_ALLOW_PUBLIC_SIGNUP"];
    delete env["MOCKD_PROVISIONING_TOKEN"];
  }
  if (config.baseUrl !== undefined) env["PLAYWRIGHT_BASE_URL"] = config.baseUrl;
  if (config.smokeRunId !== undefined) env["MOCKD_E2E_RUN_ID"] = config.smokeRunId;
  if (dataFilePath !== undefined) env["MOCKD_E2E_DATA_FILE"] = dataFilePath;
  const smoke = config.deployedSmoke;
  if (smoke !== undefined) {
    env["MOCKD_E2E_DEPLOYED_COMMISSIONER_EMAIL"] = smoke.commissionerEmail;
    env["MOCKD_E2E_DEPLOYED_COMMISSIONER_PASSWORD"] = smoke.commissionerPassword;
    env["MOCKD_E2E_DEPLOYED_MEMBER_EMAIL"] = smoke.memberEmail;
    env["MOCKD_E2E_DEPLOYED_MEMBER_PASSWORD"] = smoke.memberPassword;
    env["MOCKD_E2E_DEPLOYED_SEASON_ID"] = smoke.seasonId;
  }
  return env;
};
