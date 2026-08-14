export type PlayerPriceWaterfallStepKey =
  | "espn-anchor"
  | "position-multiplier"
  | "rank-gap-adjustment"
  | "market-pressure"
  | "projection-floor"
  | "sustainability"
  | "factual-context"
  | "spend-reconciliation"
  | "keeper-inflation"
  | "keeper-removal"
  | "mock-sale-average";

export interface PlayerPriceWaterfallStep {
  key: PlayerPriceWaterfallStepKey;
  label: string;
  inputAmount: number | null;
  outputAmount: number | null;
  delta: number | null;
  factor?: number;
  note: string;
}

export interface PlayerPriceWaterfallSummary {
  anchorPrice: number;
  basePrice: number;
  scenarioPrice: number;
  averageMockSalePrice: number | null;
  saleVsScenarioPrice: number | null;
}

export interface PlayerPriceWaterfall {
  summary: PlayerPriceWaterfallSummary;
  steps: readonly PlayerPriceWaterfallStep[];
}
