import type { QaGateItemInput } from "./contracts.js";

type NonPassingGateItem = QaGateItemInput & { status: "fail" | "warn" };

const isNonPassing = (item: QaGateItemInput): item is NonPassingGateItem =>
  item.status !== "pass";

const statusPriority = (status: NonPassingGateItem["status"]): number =>
  status === "fail" ? 0 : 1;

export const topGateItems = (items: readonly QaGateItemInput[]): QaGateItemInput[] =>
  items
    .filter(isNonPassing)
    .sort((left, right) =>
      statusPriority(left.status) - statusPriority(right.status) ||
      left.key.localeCompare(right.key))
    .slice(0, 5);
