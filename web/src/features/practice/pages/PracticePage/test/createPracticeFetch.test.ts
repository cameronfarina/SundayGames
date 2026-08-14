import { describe, expect, it } from "vitest";
import { createPracticeFetch } from "./createPracticeFetch";

describe("createPracticeFetch", () => {
  it("supports Request and URL inputs with API defaults", async () => {
    const fetcher = createPracticeFetch();
    const catalog = await fetcher(new Request("http://mockd.test/player-catalog?seasonId=season-1"));
    const target = await fetcher(new URL("http://mockd.test/practice-shortlist"), {
      body: JSON.stringify({ playerName: "Puka Nacua" }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

    await expect(catalog.json()).resolves.toMatchObject({ strategyLabel: "balanced" });
    await expect(target.json()).resolves.toMatchObject({ item: { position: "WR" } });
  });

  it("serves new-run details and rejects unknown routes", async () => {
    const fetcher = createPracticeFetch();
    const detail = await fetcher("/season-simulations/history-new");
    const run = await fetcher("/season-simulations/history-new/runs/2");
    const missing = await fetcher("/unknown");

    await expect(detail.json()).resolves.toMatchObject({ historyId: "history-new", note: "New run" });
    await expect(run.json()).resolves.toMatchObject({ historyId: "history-new", run: { runNumber: 2 } });
    expect(missing.status).toBe(404);
  });
});
