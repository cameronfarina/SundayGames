import { keepers } from "../../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../../src/data/parseHistoricalBoards.js";
import { loadEspnWeeksOneToFour } from "../../src/projections.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

export const commandsBeforeAffordableRb3Decision = [
  "Owner01 drafted Jahmyr Gibbs for 74",
  "Owner14 drafted Puka Nacua for 74",
  "Owner01 drafted Bijan Robinson for 74",
  "Owner14 drafted Ja'Marr Chase for 74",
  "Owner13 drafted Christian McCaffrey for 69",
  "Owner13 drafted Jonathan Taylor for 69",
  "Owner03 drafted Amon-Ra St. Brown for 69",
  "Owner03 drafted CeeDee Lamb for 69",
  "Owner10 drafted Saquon Barkley for 69",
  "Owner11 drafted Derrick Henry for 62",
  "Owner02 drafted Justin Jefferson for 66",
  "Owner02 drafted Rashee Rice for 58",
  "Owner08 drafted Ashton Jeanty for 59",
  "Owner08 drafted Jeremiyah Love for 55",
  "Owner04 drafted Nico Collins for 55",
  "Owner07 drafted Garrett Wilson for 58",
  "Owner11 drafted Omarion Hampton for 54",
  "Owner04 drafted Drake London for 56",
  "Owner07 drafted James Cook III for 51",
  "Owner09 drafted A.J. Brown for 49",
  "Owner12 drafted Josh Jacobs for 46",
  "Owner12 drafted Josh Allen for 37",
  "Owner12 drafted Brock Bowers for 39",
  "Owner05 drafted Trey McBride for 39",
];

export const loadInteractiveMockDraftInputs = async () => ({
  projections: await loadEspnWeeksOneToFour(projectionPath),
  historicalRecords: await loadHistoricalAuctionRecords(),
  keepers,
});
