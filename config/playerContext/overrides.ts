import type { PlayerContextOverride } from "./contracts.js";

export const playerContextOverrides: readonly PlayerContextOverride[] = [
  {
    player: "Jadarian Price",
    signals: { role: -1.5, injury: -0.5 },
    notes: {
      role: "Temporary opportunity concern tied to Zach Charbonnet's recovery.",
      injury: "Opportunity is injury-contingent rather than fully durable.",
    },
  },
  {
    player: "Bhayshul Tuten",
    signals: { role: -0.75 },
    notes: { role: "Role expansion is plausible but workload is not yet fully established." },
  },
  {
    player: "TreVeyon Henderson",
    signals: { role: -0.5 },
    notes: { role: "Modeled as part of a tandem rather than a solo backfield." },
  },
  {
    player: "Rico Dowdle",
    signals: { role: -1 },
    notes: { role: "Committee-sensitive workload." },
  },
  {
    player: "Christian Watson",
    signals: { injury: -0.75, role: -0.25 },
    notes: {
      injury: "Availability volatility adjustment.",
      role: "Target-volume volatility adjustment.",
    },
  },
  {
    player: "Harold Fannin Jr.",
    signals: { role: -1 },
    notes: { role: "Early-career tight end role uncertainty." },
  },
  {
    player: "Jordyn Tyson",
    signals: { role: -1 },
    notes: { role: "Projection-driven role is not fully established." },
  },
  {
    player: "J.K. Dobbins",
    signals: { injury: -1, role: -0.5 },
    notes: { injury: "Durability risk.", role: "Backfield-role risk." },
  },
  {
    player: "Kenny Gainwell",
    signals: { role: -1.25 },
    notes: { role: "Projection spike is role-sensitive behind Bucky Irving." },
  },
  {
    player: "Tucker Kraft",
    signals: { injury: -1.25 },
    notes: { injury: "ACL recovery and early-season availability risk." },
  },
];
