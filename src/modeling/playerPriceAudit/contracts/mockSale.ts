export interface PlayerAuditMockPick {
  seed: string;
  pick: number;
  nominator: string;
  owner: string;
  salePrice: number;
  marketPrice: number;
  budgetAfterPick: number;
  rosterSlotsAfterPick: number;
}

export interface PlayerAuditMockSale {
  runCount: number;
  draftedCount: number;
  draftedRate: number;
  averageMarketPrice: number | null;
  averageSalePrice: number | null;
  averageSaleVsScenarioPrice: number | null;
  minSalePrice: number | null;
  maxSalePrice: number | null;
  picks: readonly PlayerAuditMockPick[];
}
