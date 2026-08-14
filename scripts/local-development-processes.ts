import { spawn, type ChildProcess } from "node:child_process";

export const localPreviewPlatformCommand: readonly string[] = ["run", "platform:web:dev"];
export const localPreviewWebCommand: readonly string[] = ["run", "web:dev"];
export const localPreviewPlatformPort = 4320;
export const localPreviewWebPort = 4319;

interface LocalDevelopmentOptions {
  readonly dataFile: string;
  readonly draftToolsDirectory: string;
  readonly env: NodeJS.ProcessEnv;
}

const npmCommand = (): string => process.platform === "win32" ? "npm.cmd" : "npm";

const waitForExit = (child: ChildProcess): Promise<number> =>
  new Promise((resolveExit, reject) => {
    if (child.exitCode !== null) return resolveExit(child.exitCode);
    if (child.signalCode !== null) return resolveExit(1);
    child.once("error", reject);
    child.once("exit", code => resolveExit(code ?? 1));
  });

const terminate = (children: readonly ChildProcess[]): void => {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }
};

const stop = async (children: readonly ChildProcess[]): Promise<void> => {
  terminate(children);
  await Promise.allSettled(children.map(waitForExit));
};

const run = (args: readonly string[], env: NodeJS.ProcessEnv): ChildProcess =>
  spawn(npmCommand(), args, { env, stdio: "inherit" });

const sleep = async (milliseconds: number): Promise<void> =>
  await new Promise(resolve => setTimeout(resolve, milliseconds));

const waitForHttp = async (url: string): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // The child is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Local development server did not become ready at ${url}.`);
};

const waitForFrontendRuntime = async (url: string, runtimeId: string): Promise<void> => {
  const expected = JSON.stringify({ mode: "vite-hmr", runtimeId });
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (response.ok && await response.text() === expected) return;
    } catch {
      // The source-backed frontend is still starting.
    }
    await sleep(100);
  }
  throw new Error(`Expected frontend runtime ${runtimeId} did not become ready at ${url}.`);
};

const withoutDatabase = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const clean = { ...env };
  delete clean.DATABASE_URL;
  delete clean.MOCKD_DATABASE_URL;
  return clean;
};

export const startLocalDevelopmentProcesses = async ({
  dataFile,
  draftToolsDirectory,
  env,
}: LocalDevelopmentOptions): Promise<void> => {
  const baseEnv = withoutDatabase(env);
  const webPort = env.MOCKD_WEB_DEV_PORT ?? String(localPreviewWebPort);
  const platformPort = env.MOCKD_PLATFORM_DEV_PORT ?? String(localPreviewPlatformPort);
  const platformOrigin = `http://127.0.0.1:${platformPort}`;
  const frontendOrigin = `http://127.0.0.1:${webPort}`;
  const runtimeId = `vite-hmr-${String(process.pid)}-${String(Date.now())}`;
  const platformEnv = {
    ...baseEnv,
    HOST: "127.0.0.1",
    PORT: platformPort,
    NODE_ENV: "test",
    MOCKD_PLATFORM_DATA_FILE: dataFile,
    MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY: draftToolsDirectory,
    MOCKD_ALLOW_PUBLIC_SIGNUP: "true",
    MOCKD_LIVE_DRAFT_DATA_MODE: "local-fixtures",
    MOCKD_PROVISIONING_TOKEN: "local-preview-provisioning-token",
  };
  const webEnv = {
    ...baseEnv,
    NODE_ENV: "development",
    MOCKD_FRONTEND_RUNTIME_ID: runtimeId,
    MOCKD_PLATFORM_DEV_URL: platformOrigin,
    MOCKD_WEB_DEV_PORT: webPort,
  };

  const seed = run(["run", "platform:seed:e2e"], platformEnv);
  const seedExitCode = await waitForExit(seed);
  if (seedExitCode !== 0) throw new Error(`Local platform seed exited with code ${seedExitCode}.`);

  const children: ChildProcess[] = [];
  let stopping = false;
  const shutdown = (): void => {
    stopping = true;
    terminate(children);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    const platform = run(localPreviewPlatformCommand, platformEnv);
    children.push(platform);
    const platformExit = waitForExit(platform);
    await Promise.race([
      waitForHttp(`${platformOrigin}/readyz`),
      platformExit.then(code => Promise.reject(new Error(`Local platform exited with code ${code}.`))),
    ]);

    const web = run(localPreviewWebCommand, webEnv);
    children.push(web);
    const webExit = waitForExit(web);
    await Promise.race([
      waitForFrontendRuntime(`${frontendOrigin}/__mockd/frontend-runtime`, runtimeId),
      webExit.then(code => Promise.reject(new Error(`Local frontend exited with code ${code}.`))),
    ]);
    console.log(`Mockd React development: ${frontendOrigin}/login`);
    console.log(`Frontend runtime: ${runtimeId} (Vite HMR)`);
    console.log(`Platform API: ${platformOrigin}`);

    const exitCode = await Promise.race([platformExit, webExit]);
    process.exitCode = stopping ? 0 : exitCode;
  } finally {
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
    await stop(children);
  }
};
