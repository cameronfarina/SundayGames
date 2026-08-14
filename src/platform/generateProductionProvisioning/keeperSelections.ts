import { keepers } from "../../../config/keepers.js";
import type { ProductionKeeperSelection } from "./contracts.js";
import { assertOnlyFields, fail, objectAt, stringAt } from "./validation.js";
import { ownerAt } from "./ownerMappings.js";

export const keeperSelectionKey = (selection: ProductionKeeperSelection): string =>
  `${selection.owner}\0${selection.player}`;

const configuredKeeperBySelectionKey = new Map(
  keepers.map(keeper => [keeperSelectionKey(keeper), keeper]),
);

export const keeperSelectionAt = (value: unknown, index: number): ProductionKeeperSelection => {
  const path = `selectedKeepers[${index}]`;
  const record = objectAt(value, path);
  assertOnlyFields(record, ["owner", "player"], path);
  const selection = {
    owner: ownerAt(record.owner, `${path}.owner`),
    player: stringAt(record.player, `${path}.player`),
  };
  if (!configuredKeeperBySelectionKey.has(keeperSelectionKey(selection))) {
    fail(path, "does not exactly match a configured keeper by owner and player.");
  }
  return selection;
};

export const canonicalKeeperSelections = (
  selections: readonly ProductionKeeperSelection[],
): readonly ProductionKeeperSelection[] => {
  const selectedKeys = new Set<string>();
  for (const selection of selections) {
    const key = keeperSelectionKey(selection);
    if (selectedKeys.has(key)) {
      fail("selectedKeepers", `duplicate keeper selection for ${selection.owner} and ${selection.player}.`);
    }
    selectedKeys.add(key);
  }
  return keepers
    .filter(keeper => selectedKeys.has(keeperSelectionKey(keeper)))
    .map(keeper => ({ owner: keeper.owner, player: keeper.player }));
};
