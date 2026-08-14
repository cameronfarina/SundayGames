import { ownerOrder, type Owner } from "../../../config/league.js";
import { cleanCell } from "./cells.js";

export interface OwnerColumn {
  owner: Owner;
  index: number;
}

const ownerFromHeader = (value: string, ownerPosition: number): Owner => {
  const owner = ownerOrder[ownerPosition];
  if (!owner) throw new Error(`Historical board has an unexpected owner column: ${value}`);

  const syntheticOwner = `Owner ${String(ownerPosition + 1).padStart(2, "0")}`;
  if (value !== owner && value !== syntheticOwner) {
    throw new Error(`Unknown historical board owner: ${value}`);
  }

  return owner;
};

export const buildOwnerColumns = (header: string[], sourcePath: string): OwnerColumn[] => {
  const ownerColumns = header
    .map((cell, index) => ({ owner: cleanCell(cell), index }))
    .filter(entry => entry.index > 0 && entry.owner)
    .map((entry, ownerPosition) => ({
      owner: ownerFromHeader(entry.owner, ownerPosition),
      index: entry.index,
    }));

  if (ownerColumns.length !== ownerOrder.length) {
    throw new Error(
      `Historical board ${sourcePath} has ${ownerColumns.length} owners; expected ${ownerOrder.length}.`,
    );
  }

  const orderMismatch = ownerColumns.some((entry, index) => entry.owner !== ownerOrder[index]);
  if (orderMismatch) {
    throw new Error(`Historical board ${sourcePath} owner order does not match league configuration.`);
  }

  return ownerColumns;
};
