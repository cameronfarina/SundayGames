import type {
  LiveDraftImportConflictReview,
  LiveDraftImportConflictType,
} from "./contracts.js";

const ambiguousOptionsFor = (message: string): string[] => {
  const matchesText = message.match(/ Matches: (.+)\.$/)?.[1];
  return matchesText ? matchesText.split(",").map(match => match.trim()).filter(Boolean) : [];
};

const conflictTypeFor = (message: string): LiveDraftImportConflictType =>
  message.startsWith("Ambiguous player") ? "ambiguous-player" : "invalid-command";

export const importConflictReviewFor = (
  commands: readonly string[],
  errors: readonly { input: string; message: string }[],
  title = "Import needs review",
): LiveDraftImportConflictReview => ({
  title,
  importedCount: commands.length,
  issueCount: errors.length,
  issues: errors.map((error, errorIndex) => {
    const commandIndex = commands.findIndex(command => command === error.input);
    return {
      index: commandIndex >= 0 ? commandIndex + 1 : errorIndex + 1,
      input: error.input,
      type: title === "Import could not be read" ? "invalid-import" : conflictTypeFor(error.message),
      message: error.message,
      matchOptions: ambiguousOptionsFor(error.message),
    };
  }),
});
