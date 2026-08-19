import { describe, expect, it } from "vitest";
import advisoryWire from "./liveDraftAdvisory.wire.json";
import { liveDraftAdvisorySchema } from "./liveDraftAdvisorySchemas";

/**
 * Half of a parity pair. The other half lives in
 * tests/fantasyProsAdvisoryRoute.test.ts, where the live draft room's advisory
 * route is driven with production-shaped FantasyPros rows and its response is
 * held against this same file. So the file can only change when the server
 * changes, and it can only stay here when this schema still accepts it.
 *
 * The pair exists because the two halves drifted once and nothing noticed: the
 * schema demanded a positive week, the room sent the 0 FantasyPros reports for
 * rest-of-season ranks, and the overlay silently stopped rendering in
 * production while every test stayed green.
 */
describe("live draft advisory wire contract", () => {
  it("accepts the body the advisory route actually serves", () => {
    const parsed = liveDraftAdvisorySchema.safeParse(advisoryWire);

    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("keeps the fields the board reads off that body", () => {
    const parsed = liveDraftAdvisorySchema.parse(advisoryWire);

    expect(parsed.basis).toBe("ros");
    expect(parsed.week).toBeNull();
    expect(parsed.players.map(player => player.rankEcr)).toEqual([3, 2]);
    expect(parsed.players[1]?.injury?.headline).toBe("Gibbs is limited with an ankle injury");
  });
});
