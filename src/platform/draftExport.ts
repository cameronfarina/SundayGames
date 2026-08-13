export const draftExportSlotOrder = [
  "QB",
  "RB1",
  "RB2",
  "WR1",
  "WR2",
  "TE",
  "FLEX",
  "K",
  "DST",
  "BENCH1",
  "BENCH2",
  "BENCH3",
  "BENCH4",
  "BENCH5",
  "BENCH6",
  "BENCH7",
] as const;

export type DraftExportRosterSlotKey = typeof draftExportSlotOrder[number];
export type DraftExportPlayerSource = "keeper" | "auction";
export type DraftExportCell = string | number;
export type DraftExportErrorCode = "duplicate_player" | "invalid_price" | "invalid_slot";

export interface DraftExportRosterPlayer {
  name: string;
  price: number;
  source?: DraftExportPlayerSource;
}

export interface DraftExportRosterSlot {
  slot: DraftExportRosterSlotKey;
  player?: DraftExportRosterPlayer;
}

export interface DraftExportTeamState {
  teamId: string;
  teamName: string;
  ownerName: string;
  draftOrderPosition?: number;
  slots: readonly DraftExportRosterSlot[];
}

export interface GenerateDraftExportInput {
  leagueName: string;
  seasonYear: number;
  draftRoomId: string;
  exportedAt: Date | string;
  status: string;
  revision: number;
  teams: readonly DraftExportTeamState[];
}

export interface DraftExportResult {
  sheetName: "Draft Results";
  table: DraftExportCell[][];
  csv: string;
}

export class DraftExportError extends Error {
  constructor(
    readonly code: DraftExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DraftExportError";
  }
}

const blankCell = "";
const teamColumnWidth = 3;
const slotOrderSet = new Set<string>(draftExportSlotOrder);

const normalizePlayerName = (playerName: string): string =>
  playerName.trim().toLowerCase().replace(/\s+/g, " ");

const exportedAtText = (exportedAt: Date | string): string =>
  exportedAt instanceof Date ? exportedAt.toISOString() : exportedAt;

const compareTeamsForExport = (
  left: DraftExportTeamState,
  right: DraftExportTeamState,
): number => {
  const leftDraftOrder = left.draftOrderPosition ?? Number.MAX_SAFE_INTEGER;
  const rightDraftOrder = right.draftOrderPosition ?? Number.MAX_SAFE_INTEGER;

  return leftDraftOrder - rightDraftOrder ||
    left.teamName.localeCompare(right.teamName) ||
    left.ownerName.localeCompare(right.ownerName) ||
    left.teamId.localeCompare(right.teamId);
};

const padRow = (row: readonly DraftExportCell[], columnCount: number): DraftExportCell[] => [
  ...row,
  ...Array.from({ length: Math.max(0, columnCount - row.length) }, () => blankCell),
];

const playerLocationText = (
  team: DraftExportTeamState,
  slot: DraftExportRosterSlot,
): string =>
  `${team.teamName} ${slot.slot}`;

const validateSlot = (slot: DraftExportRosterSlot): void => {
  if (!slotOrderSet.has(slot.slot)) {
    throw new DraftExportError("invalid_slot", `${slot.slot} is not a supported export roster slot.`);
  }
};

const validatePrice = (team: DraftExportTeamState, slot: DraftExportRosterSlot): void => {
  const player = slot.player;
  if (!player) return;

  if (!Number.isFinite(player.price) || player.price < 0) {
    throw new DraftExportError(
      "invalid_price",
      `${player.name} on ${playerLocationText(team, slot)} has an invalid price.`,
    );
  }
};

const validateDraftState = (teams: readonly DraftExportTeamState[]): void => {
  const seenPlayers = new Map<string, { displayName: string; location: string }>();

  for (const team of teams) {
    for (const slot of team.slots) {
      validateSlot(slot);
      validatePrice(team, slot);

      if (!slot.player) continue;

      const playerKey = normalizePlayerName(slot.player.name);
      if (!playerKey) continue;

      const previous = seenPlayers.get(playerKey);
      if (previous) {
        throw new DraftExportError(
          "duplicate_player",
          `${previous.displayName} appears on both ${previous.location} and ${playerLocationText(team, slot)}.`,
        );
      }

      seenPlayers.set(playerKey, {
        displayName: slot.player.name,
        location: playerLocationText(team, slot),
      });
    }
  }
};

const slotsByKeyFor = (
  team: DraftExportTeamState,
): ReadonlyMap<DraftExportRosterSlotKey, DraftExportRosterSlot> =>
  new Map(team.slots.map(slot => [slot.slot, slot]));

const csvCell = (cell: DraftExportCell): string => {
  const value = typeof cell === "string" && /^\s*[=+\-@]/u.test(cell)
    ? `'${cell}`
    : String(cell);

  if (!/[",\n\r]/.test(value)) return value;

  return `"${value.replaceAll("\"", "\"\"")}"`;
};

export const tableToCsv = (table: readonly (readonly DraftExportCell[])[]): string =>
  table.map(row => row.map(csvCell).join(",")).join("\n");

export const generateDraftExport = (input: GenerateDraftExportInput): DraftExportResult => {
  const teams = [...input.teams].sort(compareTeamsForExport);
  validateDraftState(teams);

  const columnCount = Math.max(teamColumnWidth, teams.length * teamColumnWidth);
  const teamSlotMaps = teams.map(team => slotsByKeyFor(team));
  const table: DraftExportCell[][] = [
    padRow(["League", input.leagueName], columnCount),
    padRow(["Season", input.seasonYear], columnCount),
    padRow(["Draft room id", input.draftRoomId], columnCount),
    padRow(["Exported at", exportedAtText(input.exportedAt)], columnCount),
    padRow(["Status", input.status, "Revision", input.revision], columnCount),
    padRow(teams.flatMap(team => [team.teamName, blankCell, blankCell]), columnCount),
    padRow(teams.flatMap(team => [team.ownerName, blankCell, blankCell]), columnCount),
    padRow(teams.flatMap(() => ["Slot", "Player", "Price"]), columnCount),
  ];

  for (const slotKey of draftExportSlotOrder) {
    const row = teams.flatMap((team, teamIndex): DraftExportCell[] => {
      const slot = teamSlotMaps[teamIndex]?.get(slotKey);
      const player = slot?.player;

      return [
        slotKey,
        player?.name ?? blankCell,
        player?.price ?? blankCell,
      ];
    });

    table.push(padRow(row, columnCount));
  }

  return {
    sheetName: "Draft Results",
    table,
    csv: tableToCsv(table),
  };
};
