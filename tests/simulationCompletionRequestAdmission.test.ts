import { describe, expect, it } from "vitest";
import { createSimulationCompletionRequestAdmission } from
  "../src/platform/simulationCompletionRequestAdmission.js";

describe("simulation completion request admission", () => {
  it("bounds large authenticated bodies per account and releases permits idempotently", () => {
    const admission = createSimulationCompletionRequestAdmission({
      maxConcurrentPerAccount: 1,
      maxConcurrentPerClient: 2,
    });
    const first = admission.acquire({ accountId: "account-1", clientAddress: "client-1" });
    expect(first.allowed).toBe(true);
    expect(admission.acquire({ accountId: "account-1", clientAddress: "client-2" }))
      .toEqual({ allowed: false, retryAfterMs: 1_000 });
    if (!first.allowed) throw new Error("Expected the first completion permit.");
    first.permit.release();
    first.permit.release();
    expect(admission.acquire({ accountId: "account-1", clientAddress: "client-2" }).allowed)
      .toBe(true);
  });

  it("bounds concurrent large bodies from one client across accounts", () => {
    const admission = createSimulationCompletionRequestAdmission({
      maxConcurrentPerAccount: 2,
      maxConcurrentPerClient: 1,
    });
    expect(admission.acquire({ accountId: "account-1", clientAddress: "client-1" }).allowed)
      .toBe(true);
    expect(admission.acquire({ accountId: "account-2", clientAddress: "client-1" }))
      .toEqual({ allowed: false, retryAfterMs: 1_000 });
  });
});
