import type { PlayerAuditIdentity, PlayerAuditPricing } from "./audit.js";
import type { PlayerAuditMockSale } from "./mockSale.js";
import type { PlayerAuditScenario } from "./scenario.js";
import type { PlayerPriceWaterfall } from "./waterfall.js";

export interface PlayerPriceAudit {
  player: PlayerAuditIdentity;
  pricing: PlayerAuditPricing;
  scenario: PlayerAuditScenario;
  mockSale: PlayerAuditMockSale;
  waterfall: PlayerPriceWaterfall;
  explanation: string[];
}
