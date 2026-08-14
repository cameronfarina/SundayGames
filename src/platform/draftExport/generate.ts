import {
  blankDraftExportCell,
  draftExportSlotOrder,
  draftExportTeamColumnWidth,
} from "./constants.js";
import type {
  DraftExportCell,
  DraftExportResult,
  DraftExportRosterSlot,
  DraftExportRosterSlotKey,
  DraftExportTeamState,
  GenerateDraftExportInput,
} from "./contracts.js";
import { tableToCsv } from "./csv.js";
import { validateDraftExportState } from "./validation.js";

const compareTeams = (left: DraftExportTeamState, right: DraftExportTeamState): number =>
  (left.draftOrderPosition ?? Number.MAX_SAFE_INTEGER) -
    (right.draftOrderPosition ?? Number.MAX_SAFE_INTEGER) ||
  left.teamName.localeCompare(right.teamName) ||
  left.ownerName.localeCompare(right.ownerName) ||
  left.teamId.localeCompare(right.teamId);

const padRow = (row: readonly DraftExportCell[], count: number): DraftExportCell[] => [
  ...row,
  ...Array.from({ length: Math.max(0, count - row.length) }, () => blankDraftExportCell),
];

const slotsByKeyFor = (
  team: DraftExportTeamState,
): ReadonlyMap<DraftExportRosterSlotKey, DraftExportRosterSlot> =>
  new Map(team.slots.map(slot => [slot.slot, slot]));

const exportedAtText = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const generateDraftExport = (input: GenerateDraftExportInput): DraftExportResult => {
  const teams = [...input.teams].sort(compareTeams);
  validateDraftExportState(teams);
  const columnCount = Math.max(draftExportTeamColumnWidth, teams.length * draftExportTeamColumnWidth);
  const slotMaps = teams.map(slotsByKeyFor);
  const table: DraftExportCell[][] = [
    padRow(["League", input.leagueName], columnCount),
    padRow(["Season", input.seasonYear], columnCount),
    padRow(["Draft room id", input.draftRoomId], columnCount),
    padRow(["Exported at", exportedAtText(input.exportedAt)], columnCount),
    padRow(["Status", input.status, "Revision", input.revision], columnCount),
    padRow(teams.flatMap(team => [team.teamName, blankDraftExportCell, blankDraftExportCell]), columnCount),
    padRow(teams.flatMap(team => [team.ownerName, blankDraftExportCell, blankDraftExportCell]), columnCount),
    padRow(teams.flatMap(() => ["Slot", "Player", "Price"]), columnCount),
  ];

  for (const slotKey of draftExportSlotOrder) {
    const row = teams.flatMap((team, index): DraftExportCell[] => {
      const player = slotMaps[index]?.get(slotKey)?.player;
      return [slotKey, player?.name ?? blankDraftExportCell, player?.price ?? blankDraftExportCell];
    });
    table.push(padRow(row, columnCount));
  }

  return { sheetName: "Draft Results", table, csv: tableToCsv(table) };
};
