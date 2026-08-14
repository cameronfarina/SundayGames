import type { QaCheck, QaSmokeInput } from "./contracts.js";
import { smokeCheckStatus } from "./status.js";

export const smokeCheck = (smoke: QaSmokeInput): QaCheck => {
  const status = smokeCheckStatus(smoke);
  return {
    key: "smoke",
    label: "Mock smoke",
    status,
    severity: "hard",
    message: status === "pass"
      ? "Smoke mock produced valid rosters and early-round picks."
      : smoke.warnings.join(" ") || "Smoke mock failed roster or early-round checks.",
    topItems: [],
  };
};
