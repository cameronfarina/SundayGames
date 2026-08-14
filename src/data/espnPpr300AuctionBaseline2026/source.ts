import type {
  EspnPpr300AuctionBaselineRoster,
  EspnPpr300AuctionBaselineSource,
} from "./contracts.js";

const sourceRoster: Readonly<EspnPpr300AuctionBaselineRoster> = Object.freeze({
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 7,
});

export const espnPpr300AuctionBaseline2026Source: EspnPpr300AuctionBaselineSource =
  Object.freeze({
    provider: "ESPN",
    title: "2026 ESPN Fantasy Football Draft Kit - PPR Top 300 Cheat Sheet",
    url: "https://g.espncdn.com/s/ffldraftkit/26/NFL26_CS_PPR300.pdf?adddata=2026CS_PPR300",
    lastUpdated: "2026-08-13",
    scoring: "ppr",
    receptionPoints: 1,
    teamCount: 10,
    salaryCap: 200,
    roster: sourceRoster,
  });
