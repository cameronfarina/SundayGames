import { describe, expect, it } from "vitest";
import { accountDashboardQuery } from "../src/platform/accountDashboard.js";

const normalized = accountDashboardQuery.replace(/\s+/gu, " ");

describe("account dashboard query", () => {
  it("selects the latest season for every active, non-archived membership", () => {
    expect(normalized).toContain("WHERE season.league_id = lm.league_id");
    expect(normalized).toContain("ORDER BY season.season_year DESC, season.created_at DESC LIMIT 1");
    expect(normalized).toContain("WHERE lm.user_id = $1 AND lm.status = 'active'");
    expect(normalized).toContain("l.archived_at IS NULL");
    expect(normalized).toContain("COALESCE(l.provider, 'mockd') AS provider");
    expect(normalized).toContain("COALESCE(rrs.draft_format, 'auction') AS draft_format");
  });

  it("uses the durable draft schedule with both normalized and legacy fallbacks", () => {
    expect(normalized).toContain("room.starts_at::text");
    expect(normalized).toContain("ls.settings_json #>> '{draft,scheduledAt}'");
    expect(normalized).toContain("ls.settings_json ->> 'draftScheduledAt'");
    expect(normalized).toContain("ls.settings_json #>> '{draft,timezone}'");
  });

  it("keeps shared history league-wide and private practice metrics account-scoped", () => {
    expect(normalized).toContain("COUNT(DISTINCT batch.season_year)");
    expect(normalized).toContain("batch.league_id = l.id AND batch.status = 'committed'");
    expect(normalized).not.toContain("batch.uploaded_by_user_id = $1");
    expect(normalized).toContain(
      "mock.user_id = $1 AND mock.league_season_id = ls.id AND mock.status = 'completed'",
    );
    expect(normalized).toContain("mock.completed_at >= NOW() - INTERVAL '24 hours'");
    expect(normalized).toContain(
      "simulation.user_id = $1 AND simulation.league_season_id = ls.id",
    );
    expect(normalized).toContain("FILTER (WHERE simulation.status = 'completed')");
    expect(normalized).toContain(
      "COALESCE((simulation.request_json ->> 'count')::integer, 1)",
    );
    expect(normalized).toContain("result.result_set_json -> 'favoriteRunNumbers'");
  });
});
