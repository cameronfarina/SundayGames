import { ownerOrder } from "../../../config/league.js";
import { localDemoEmail } from "../localDemoFixtures.js";

export interface SeedAccountFixture {
  id: string;
  email: string;
  sessionId: string;
  sessionToken: string;
}

export const seedSessionExpiresAt = new Date("2100-01-01T00:00:00.000Z");

export const seedAccountFixtures: Record<"commissioner" | "manager", SeedAccountFixture> = {
  commissioner: {
    id: "acct_mockd_e2e_commissioner",
    email: localDemoEmail,
    sessionId: "sess_mockd_e2e_commissioner",
    sessionToken: "mockd-local-e2e-commissioner-session-token",
  },
  manager: {
    id: "acct_mockd_e2e_manager",
    email: "manager@mockd.local",
    sessionId: "sess_mockd_e2e_manager",
    sessionToken: "mockd-local-e2e-manager-session-token",
  },
};

export const commissionerOwner = ownerOrder[10] ?? "Owner11";
export const managerOwner = ownerOrder[3] ?? "Owner04";
