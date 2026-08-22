import { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NodePostgresPoolAdapter } from "../src/platform/postgresClient/nodePostgresPoolAdapter.js";

describe("Node Postgres pool adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("contains and reports idle pool connection errors", async () => {
    const pool = new Pool();
    const adapter = new NodePostgresPoolAdapter(pool);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => pool.emit("error", new Error("Connection terminated unexpectedly")))
      .not.toThrow();
    expect(errorLog).toHaveBeenCalledWith(JSON.stringify({
      event: "postgres_pool_error",
      message: "Connection terminated unexpectedly",
    }));

    expect(pool.listenerCount("error")).toBe(1);
    await adapter.end();
    expect(pool.listenerCount("error")).toBe(0);
  });
});
