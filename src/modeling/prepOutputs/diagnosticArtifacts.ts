import { mockBidDiagnosticsCsv } from "./bidDiagnosticsCsv.js";
import { ownerBudgetTrajectoryCsv } from "./budgetTrajectoryCsv.js";
import { csvArtifact } from "./csv.js";
import { mockDraftBoardCsv } from "./draftBoardCsv.js";
import { mockNominationDiagnosticsCsv } from "./nominationDiagnosticsCsv.js";
import { mockRoomPressureDiagnosticsCsv } from "./roomPressureCsv.js";
import type { BuildPrepOutputArtifactsOptions, PrepOutputContent } from "./types.js";

export const diagnosticArtifacts = (
  options: BuildPrepOutputArtifactsOptions,
): PrepOutputContent[] => [
  {
    filename: "mock-draft-board.csv",
    content: csvArtifact(mockDraftBoardCsv(options.batch)),
  },
  {
    filename: "mock-bid-diagnostics.csv",
    content: csvArtifact(mockBidDiagnosticsCsv(options.batch)),
  },
  {
    filename: "mock-nomination-diagnostics.csv",
    content: csvArtifact(mockNominationDiagnosticsCsv(options.batch)),
  },
  {
    filename: "mock-room-pressure-diagnostics.csv",
    content: csvArtifact(mockRoomPressureDiagnosticsCsv(options.batch)),
  },
  {
    filename: "owner-budget-trajectory.csv",
    content: csvArtifact(ownerBudgetTrajectoryCsv(options.batch)),
  },
];
