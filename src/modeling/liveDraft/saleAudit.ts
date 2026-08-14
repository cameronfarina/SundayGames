import type {
  LiveDraftSaleAudit,
  LiveDraftSaleAuditVerdict,
} from "./contracts.js";
import type { ResolvedSale } from "./internalTypes.js";

const saleAuditVerdictFor = ({
  price,
  expectedPrice,
  liveExpectedPrice,
  personalValue,
}: {
  price: number;
  expectedPrice: number;
  liveExpectedPrice: number;
  personalValue: number;
}): LiveDraftSaleAuditVerdict => {
  const benchmarks = [expectedPrice, liveExpectedPrice, ...(personalValue > 0 ? [personalValue] : [])];
  if (price <= Math.min(...benchmarks) - 3) return "deal";
  if (price >= Math.max(...benchmarks) + 6) return "overpay";
  return "fair";
};

export const saleAuditFor = ({
  input,
  sale,
  liveExpectedPrice,
  personalValue,
}: {
  input: string;
  sale: ResolvedSale;
  liveExpectedPrice: number;
  personalValue: number;
}): LiveDraftSaleAudit => {
  const price = sale.parsed.price;
  return {
    input,
    owner: sale.owner,
    player: sale.player.name,
    normalizedPlayerName: sale.player.normalizedName,
    position: sale.player.position,
    price,
    expectedPrice: sale.player.expectedPrice,
    liveExpectedPrice,
    personalValue,
    expectedDelta: price - sale.player.expectedPrice,
    liveDelta: price - liveExpectedPrice,
    personalDelta: price - personalValue,
    verdict: saleAuditVerdictFor({
      price,
      expectedPrice: sale.player.expectedPrice,
      liveExpectedPrice,
      personalValue,
    }),
  };
};
