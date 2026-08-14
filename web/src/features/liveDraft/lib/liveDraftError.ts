export const liveDraftErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "The draft action failed. Try again.";
