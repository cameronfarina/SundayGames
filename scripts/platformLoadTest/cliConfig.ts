export interface PlatformLoadCliConfig {
  readonly allowRemote: boolean;
  readonly holdMs: number;
  readonly leagueCount: 30 | 50;
  readonly manifestPath: string;
  readonly target: string;
}

export const platformLoadCliConfigFrom = (
  arguments_: readonly string[],
): PlatformLoadCliConfig => {
  const supported = new Set([
    "--allow-remote",
    "--hold-seconds",
    "--leagues",
    "--manifest",
    "--target",
  ]);
  for (const argument of arguments_) {
    const name = argument.split("=", 1)[0] ?? argument;
    if (!supported.has(name)) throw new Error(`Unknown load-test argument: ${name}.`);
  }
  const valueFor = (name: string): string | undefined =>
    arguments_.find(argument => argument.startsWith(`${name}=`))?.slice(name.length + 1);
  const target = valueFor("--target");
  const manifestPath = valueFor("--manifest");
  if (target === undefined || target === "") throw new Error("--target is required.");
  if (manifestPath === undefined || manifestPath === "") throw new Error("--manifest is required.");
  const rawLeagueCount = Number(valueFor("--leagues") ?? "30");
  if (rawLeagueCount !== 30 && rawLeagueCount !== 50) {
    throw new Error("--leagues must be either 30 or 50.");
  }
  const holdSeconds = Number(valueFor("--hold-seconds") ?? "30");
  if (!Number.isFinite(holdSeconds) || holdSeconds < 0) {
    throw new Error("--hold-seconds must be zero or greater.");
  }
  return {
    allowRemote: arguments_.includes("--allow-remote"),
    holdMs: holdSeconds * 1_000,
    leagueCount: rawLeagueCount,
    manifestPath,
    target,
  };
};
