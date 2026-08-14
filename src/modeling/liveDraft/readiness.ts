import type { KeeperDeclaration } from "../../../config/keepers.js";
import { ownerOrder } from "../../../config/league.js";
import type {
  LiveDraftCommandError,
  LiveDraftOwnerState,
  LiveDraftPathRecommendation,
  LiveDraftReadiness,
  LiveDraftReadinessCheck,
  LiveDraftReadinessStatus,
  LiveDraftTarget,
} from "./contracts.js";

const readinessStatusFor = (
  checks: readonly LiveDraftReadinessCheck[],
): LiveDraftReadinessStatus => {
  if (checks.some(check => check.status === "fail")) return "fail";
  if (checks.some(check => check.status === "warn")) return "warn";
  return "pass";
};

const keeperCoverageCheck = (
  keepers: readonly KeeperDeclaration[],
): LiveDraftReadinessCheck => {
  const ownersWithKeeperDecisions = new Set(keepers.map(keeper => keeper.owner));
  const missingOwners = ownerOrder.filter(owner => !ownersWithKeeperDecisions.has(owner));
  return {
    key: "keeper-coverage",
    label: "Keeper coverage",
    status: missingOwners.length ? "warn" : "pass",
    detail: missingOwners.length
      ? `${ownersWithKeeperDecisions.size}/${ownerOrder.length} owners have keeper declarations. Missing: ${missingOwners.join(", ")}.`
      : `Keeper declarations cover all ${ownerOrder.length} owners.`,
  };
};

export const buildReadiness = ({
  errors,
  availableTargets,
  owners,
  draftPath,
  keepers,
}: {
  errors: readonly LiveDraftCommandError[];
  availableTargets: readonly LiveDraftTarget[];
  owners: readonly LiveDraftOwnerState[];
  draftPath: LiveDraftPathRecommendation;
  keepers: readonly KeeperDeclaration[];
}): LiveDraftReadiness => {
  const checks: LiveDraftReadinessCheck[] = [
    {
      key: "engine-state",
      label: "Engine state",
      status: errors.length ? "warn" : "pass",
      detail: errors.length
        ? `${errors.length} command issue${errors.length === 1 ? "" : "s"} need review.`
        : "Commands replay cleanly.",
    },
    {
      key: "target-board",
      label: "Target board",
      status: availableTargets.length ? "pass" : "fail",
      detail: availableTargets.length
        ? `${availableTargets.length} draftable targets loaded.`
        : "No draftable targets are available.",
    },
    {
      key: "owner-rosters",
      label: "Owner rosters",
      status: owners.every(owner => owner.rosterSlotsRemaining >= 0 && owner.budgetRemaining >= 0)
        ? "pass"
        : "fail",
      detail: "Owner budgets, roster slots, and max bids are rebuilt from commands.",
    },
    keeperCoverageCheck(keepers),
    {
      key: "draft-path",
      label: "Draft path",
      status: draftPath.deadZoneWarnings.length ? "warn" : "pass",
      detail: draftPath.deadZoneWarnings[0] ?? draftPath.summary,
    },
  ];
  return { status: readinessStatusFor(checks), checks };
};
