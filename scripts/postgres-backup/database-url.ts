const libpqQueryEnvironmentKeys: Readonly<Record<string, string>> = {
  application_name: "PGAPPNAME",
  channel_binding: "PGCHANNELBINDING",
  connect_timeout: "PGCONNECT_TIMEOUT",
  options: "PGOPTIONS",
  sslcert: "PGSSLCERT",
  sslcrl: "PGSSLCRL",
  sslkey: "PGSSLKEY",
  sslmode: "PGSSLMODE",
  sslpassword: "PGSSLPASSWORD",
  sslrootcert: "PGSSLROOTCERT",
};

const clearedEnvironmentKeys: readonly string[] = [
  "DATABASE_URL",
  "MOCKD_DATABASE_URL",
  "PGAPPNAME",
  "PGCHANNELBINDING",
  "PGCONNECT_TIMEOUT",
  "PGDATABASE",
  "PGHOST",
  "PGOPTIONS",
  "PGPASSWORD",
  "PGPORT",
  "PGSSLCERT",
  "PGSSLCRL",
  "PGSSLKEY",
  "PGSSLMODE",
  "PGSSLPASSWORD",
  "PGSSLROOTCERT",
  "PGUSER",
];

const parsePostgresUrl = (databaseUrl: string): URL => {
  if (databaseUrl.trim().length === 0) throw new Error("DATABASE_URL is required.");

  try {
    const parsed = new URL(databaseUrl);
    const hasPostgresProtocol = parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (hasPostgresProtocol && parsed.hostname.length > 0 && databaseName.length > 0) return parsed;
  } catch {
    // Use one stable validation message without echoing the connection string.
  }

  throw new Error("DATABASE_URL must be a postgres:// or postgresql:// URL.");
};

export const databaseNameFromPostgresUrl = (databaseUrl: string): string =>
  decodeURIComponent(parsePostgresUrl(databaseUrl).pathname.replace(/^\//, ""));

export const postgresCommandEnvironment = (
  databaseUrl: string,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv => {
  const parsed = parsePostgresUrl(databaseUrl);
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  for (const key of clearedEnvironmentKeys) delete env[key];

  env.PGHOST = parsed.hostname;
  env.PGPORT = parsed.port || "5432";
  env.PGDATABASE = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.username.length > 0) env.PGUSER = decodeURIComponent(parsed.username);
  if (parsed.password.length > 0) env.PGPASSWORD = decodeURIComponent(parsed.password);
  for (const [queryKey, envKey] of Object.entries(libpqQueryEnvironmentKeys)) {
    const value = parsed.searchParams.get(queryKey);
    if (value !== null && value.length > 0) env[envKey] = value;
  }

  return env;
};
