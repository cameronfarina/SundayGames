import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { waitForQueuedLoadJobs } from "../scripts/platformLoadTest/jobCompletion.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async server =>
    await new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("platform queued-job completion gate", () => {
  it("waits until every submitted simulation job reaches completed", async () => {
    const reads = new Map<string, number>();
    const server = createServer((request, response) => {
      const jobId = request.url?.split("/").at(-1) ?? "";
      const count = (reads.get(jobId) ?? 0) + 1;
      reads.set(jobId, count);
      const status = count === 1 ? "queued" : count === 2 ? "running" : "completed";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        job: { id: jobId, status },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const measurements = await waitForQueuedLoadJobs(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      [
        { jobId: "job-1", sessionToken: "secret-1" },
        { jobId: "job-2", sessionToken: "secret-2" },
      ],
      { pollIntervalMs: 1, timeoutMs: 1_000 },
    );

    expect(measurements).toHaveLength(2);
    expect(measurements.every(measurement => measurement.ok)).toBe(true);
    expect(measurements.map(measurement => measurement.diagnostic)).toEqual(["ok", "ok"]);
    expect(reads).toEqual(new Map([["job-1", 3], ["job-2", 3]]));
  });

  it("fails when a queued job reaches a non-success terminal state", async () => {
    const server = createServer((request, response) => {
      const jobId = request.url?.split("/").at(-1) ?? "";
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        job: { id: jobId, status: "failed" },
      }));
    });
    servers.push(server);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (typeof address !== "object" || address === null) throw new Error("Expected test port.");

    const [measurement] = await waitForQueuedLoadJobs(
      new URL(`http://127.0.0.1:${String(address.port)}`),
      [{ jobId: "job-1", sessionToken: "secret" }],
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(measurement).toMatchObject({ diagnostic: "job_failed", ok: false });
  });
});
