import type { Owner, Position } from "./league.js";

export type KeeperStatus = "confirmed" | "assumed" | "pending" | "open";

export interface KeeperDeclaration {
  owner: Owner;
  player: string;
  position: Position;
  priorCost: number;
  newCost: number;
  status: KeeperStatus;
  notes?: string;
}

export const keeperCost = (priorCost: number): number => Math.ceil(priorCost * 1.2);

export const keepers: KeeperDeclaration[] = [
  {
    owner: "Owner03",
    player: "Rico Dowdle",
    position: "RB",
    priorCost: 3,
    newCost: keeperCost(3),
    status: "confirmed",
  },
  {
    owner: "Owner05",
    player: "Quinshon Judkins",
    position: "RB",
    priorCost: 2,
    newCost: keeperCost(2),
    status: "confirmed",
  },
  {
    owner: "Owner11",
    player: "Ashton Jeanty",
    position: "RB",
    priorCost: 41,
    newCost: keeperCost(41),
    status: "confirmed",
  },
  {
    owner: "Owner09",
    player: "Trey McBride",
    position: "TE",
    priorCost: 8,
    newCost: keeperCost(8),
    status: "assumed",
  },
  {
    owner: "Owner13",
    player: "Kyren Williams",
    position: "RB",
    priorCost: 3,
    newCost: keeperCost(3),
    status: "confirmed",
  },
  {
    owner: "Owner04",
    player: "Justin Jefferson",
    position: "WR",
    priorCost: 35,
    newCost: keeperCost(35),
    status: "assumed",
  },
  {
    owner: "Owner10",
    player: "Mark Andrews",
    position: "TE",
    priorCost: 1,
    newCost: keeperCost(1),
    status: "assumed",
  },
];
