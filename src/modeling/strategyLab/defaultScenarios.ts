import { primaryOwner } from "../../../config/league.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { StrategyLabScenario } from "./scenarioContracts.js";

export const defaultScenarioKey: KeeperScenarioKey = "expected";
export const defaultRunsPerScenario = 25;
export const defaultSeedPrefix = "strategy-lab";
export const sampleBuildLimit = 3;

export const defaultStrategyLabScenarios: readonly StrategyLabScenario[] = [
  {
    key: "puka-75",
    label: "Puka $75",
    question: "If the primary team buys Puka Nacua for $75, what does the rest of the room leave?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: primaryOwner, player: "Puka Nacua", price: 75 }],
  },
  {
    key: "puka-80",
    label: "Puka $80",
    question: "If the primary team pays $80 for Puka, how thin does the build get?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: primaryOwner, player: "Puka Nacua", price: 80 }],
  },
  {
    key: "chase-70",
    label: "Chase $70",
    question: "If the primary team buys Ja'Marr Chase for $70, does the discount beat the Puka builds?",
    strategyKey: "wr-heavy",
    forcedSales: [{ owner: primaryOwner, player: "Ja'Marr Chase", price: 70 }],
  },
  {
    key: "puka-75-walker",
    label: "Puka $75 + Walker cap $42",
    question: "If the primary team buys Puka and only wins Kenneth Walker under its cap, can the value-WR build hold up?",
    strategyKey: "three-rb",
    forcedSales: [{ owner: primaryOwner, player: "Puka Nacua", price: 75 }],
    targetMaxBids: [{ owner: primaryOwner, player: "Kenneth Walker III", maxBid: 42 }],
  },
  {
    key: "elite-rb-rb2-caps",
    label: "Elite RB + RB2 caps",
    question: "If the primary team bids to elite prices for one RB and caps the secondary options, how often does that structure land?",
    strategyKey: "three-rb",
    forcedSales: [],
    targetMaxBids: [
      { owner: primaryOwner, player: "Jahmyr Gibbs", maxBid: 80 },
      { owner: primaryOwner, player: "Bijan Robinson", maxBid: 80 },
      { owner: primaryOwner, player: "Christian McCaffrey", maxBid: 80 },
      { owner: primaryOwner, player: "Jonathan Taylor", maxBid: 72 },
      { owner: primaryOwner, player: "Breece Hall", maxBid: 42 },
      { owner: primaryOwner, player: "Kenneth Walker III", maxBid: 42 },
    ],
  },
  {
    key: "value-wr-cook",
    label: "DeVonta + Ladd + Cook caps",
    question: "If the primary team skips elite WR spend and targets value WRs plus James Cook under caps, what is the upside?",
    strategyKey: "hero-rb",
    forcedSales: [],
    targetMaxBids: [
      { owner: primaryOwner, player: "DeVonta Smith", maxBid: 32 },
      { owner: primaryOwner, player: "Ladd McConkey", maxBid: 24 },
      { owner: primaryOwner, player: "James Cook III", maxBid: 52 },
    ],
  },
  {
    key: "value-wr-walker",
    label: "DeVonta + Ladd + Walker cap",
    question: "If the primary team keeps RB2 spend lighter with Kenneth Walker under a cap, does the room create better balance?",
    strategyKey: "hero-rb",
    forcedSales: [],
    targetMaxBids: [
      { owner: primaryOwner, player: "DeVonta Smith", maxBid: 32 },
      { owner: primaryOwner, player: "Ladd McConkey", maxBid: 24 },
      { owner: primaryOwner, player: "Kenneth Walker III", maxBid: 42 },
    ],
  },
  {
    key: "rb-stack-cook-walker",
    label: "Cook + RB2 caps",
    question: "If the primary team targets Cook, Breece, and Walker without forcing them, how hard does the WR room have to hit?",
    strategyKey: "three-rb",
    forcedSales: [],
    targetMaxBids: [
      { owner: primaryOwner, player: "James Cook III", maxBid: 52 },
      { owner: primaryOwner, player: "Breece Hall", maxBid: 42 },
      { owner: primaryOwner, player: "Kenneth Walker III", maxBid: 42 },
    ],
  },
];
