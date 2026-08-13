import { describe, expect, it, vi } from "vitest";
import {
  MockBatchCapacityError,
  MockBatchResourceManager,
} from "../src/mockBatchResourceManager.js";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });

  return { promise, resolve };
};

describe("mock batch resource manager", () => {
  it("bounds account queues while allowing another account to use global capacity", async () => {
    const manager = new MockBatchResourceManager({
      maxRunningGlobal: 2,
      maxRunningPerAccount: 1,
      maxRunningPerSeason: 1,
      maxQueuedGlobal: 2,
      maxQueuedPerAccount: 1,
      maxQueuedPerSeason: 1,
      retryAfterSeconds: 7,
    });
    const firstRelease = deferred();
    const otherRelease = deferred();
    const queuedWork = vi.fn(async () => undefined);

    expect(manager.submit(
      { accountId: "account-a", seasonId: "season-a" },
      () => firstRelease.promise,
    )).toEqual({ state: "running" });
    expect(manager.submit(
      { accountId: "account-a", seasonId: "season-b" },
      queuedWork,
    )).toEqual({ state: "queued" });
    expect(manager.submit(
      { accountId: "account-b", seasonId: "season-c" },
      () => otherRelease.promise,
    )).toEqual({ state: "running" });

    expect(() => manager.submit(
      { accountId: "account-a", seasonId: "season-c" },
      async () => undefined,
    )).toThrow(new MockBatchCapacityError(
      "account_queue_full",
      "Too many mock batches are already queued for this account.",
      429,
      7,
    ));

    firstRelease.resolve();
    await vi.waitFor(() => expect(queuedWork).toHaveBeenCalledTimes(1));
    otherRelease.resolve();
    await manager.whenIdle();
  });

  it("rejects work when the global queue is full and starts queued work after release", async () => {
    const manager = new MockBatchResourceManager({
      maxRunningGlobal: 1,
      maxRunningPerAccount: 1,
      maxRunningPerSeason: 1,
      maxQueuedGlobal: 1,
      maxQueuedPerAccount: 1,
      maxQueuedPerSeason: 1,
      retryAfterSeconds: 11,
    });
    const release = deferred();
    const queuedWork = vi.fn(async () => undefined);

    expect(manager.submit(
      { accountId: "account-a", seasonId: "season-a" },
      () => release.promise,
    )).toEqual({ state: "running" });
    expect(manager.submit(
      { accountId: "account-b", seasonId: "season-b" },
      queuedWork,
    )).toEqual({ state: "queued" });

    expect(() => manager.submit(
      { accountId: "account-c", seasonId: "season-c" },
      async () => undefined,
    )).toThrow(new MockBatchCapacityError(
      "global_queue_full",
      "Mock draft capacity is temporarily full.",
      503,
      11,
    ));

    release.resolve();
    await manager.whenIdle();
    expect(queuedWork).toHaveBeenCalledTimes(1);
  });

  it("bounds queued work for one account and season", async () => {
    const manager = new MockBatchResourceManager({
      maxRunningGlobal: 2,
      maxRunningPerAccount: 2,
      maxRunningPerSeason: 1,
      maxQueuedGlobal: 4,
      maxQueuedPerAccount: 4,
      maxQueuedPerSeason: 1,
      retryAfterSeconds: 5,
    });
    const release = deferred();

    manager.submit({ accountId: "account-a", seasonId: "season-a" }, () => release.promise);
    expect(manager.submit(
      { accountId: "account-a", seasonId: "season-a" },
      async () => undefined,
    )).toEqual({ state: "queued" });
    expect(() => manager.submit(
      { accountId: "account-a", seasonId: "season-a" },
      async () => undefined,
    )).toThrow(new MockBatchCapacityError(
      "season_queue_full",
      "Too many mock batches are already queued for this league season.",
      429,
      5,
    ));

    release.resolve();
    await manager.whenIdle();
  });

  it("shares season concurrency limits across accounts", async () => {
    const manager = new MockBatchResourceManager({
      maxRunningGlobal: 2,
      maxRunningPerAccount: 2,
      maxRunningPerSeason: 1,
      maxQueuedGlobal: 4,
      maxQueuedPerAccount: 4,
      maxQueuedPerSeason: 2,
      retryAfterSeconds: 5,
    });
    const release = deferred();
    const secondAccountWork = vi.fn(async () => undefined);

    manager.submit({ accountId: "account-a", seasonId: "shared-season" }, () => release.promise);
    expect(manager.submit(
      { accountId: "account-b", seasonId: "shared-season" },
      secondAccountWork,
    )).toEqual({ state: "queued" });
    expect(secondAccountWork).not.toHaveBeenCalled();

    release.resolve();
    await manager.whenIdle();
    expect(secondAccountWork).toHaveBeenCalledTimes(1);
  });
});
