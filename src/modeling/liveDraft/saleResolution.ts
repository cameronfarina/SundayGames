import { ownerForText, parseLiveDraftSaleCommand } from "./commandParsing.js";
import type { LiveDraftPlayerRecord, ResolvedSale } from "./internalTypes.js";
import { resolvePlayer } from "./playerMatching.js";

export const resolveSale = (
  input: string,
  records: readonly LiveDraftPlayerRecord[],
): ResolvedSale => {
  const parsed = parseLiveDraftSaleCommand(input);
  return {
    parsed,
    owner: ownerForText(parsed.ownerText),
    player: resolvePlayer(parsed.playerText, records),
  };
};
