interface PostgresEndpoint {
  host: string;
  port: string;
  databaseName: string;
}

const parsePostgresEndpoint = (databaseUrl: string, label: string): PostgresEndpoint => {
  if (databaseUrl.trim().length === 0) throw new Error(`${label} is required.`);

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(`${label} must be a postgres:// or postgresql:// URL.`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${label} must be a postgres:// or postgresql:// URL.`);
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (parsed.hostname.length === 0 || databaseName.length === 0) {
    throw new Error(`${label} must include a host and database name.`);
  }

  return {
    host: parsed.hostname.toLowerCase(),
    port: parsed.port || "5432",
    databaseName,
  };
};

export const restoreTargetEndpoint = (
  sourceDatabaseUrl: string,
  targetDatabaseUrl: string,
): PostgresEndpoint => {
  const source = parsePostgresEndpoint(sourceDatabaseUrl, "DATABASE_URL");
  const target = parsePostgresEndpoint(
    targetDatabaseUrl,
    "MOCKD_RESTORE_TARGET_DATABASE_URL",
  );
  const sameEndpoint = source.host === target.host &&
    source.port === target.port &&
    source.databaseName === target.databaseName;
  if (sameEndpoint || source.databaseName === target.databaseName) {
    throw new Error(
      "Restore target must use a different host, port, or database name than DATABASE_URL; "
      + "the target database name must be dedicated to the rehearsal.",
    );
  }

  return target;
};
