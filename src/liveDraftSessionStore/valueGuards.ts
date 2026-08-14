export const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const validateCommandList = (commands: unknown): string[] => {
  if (!Array.isArray(commands)) {
    throw new Error("Draft command import must contain a commands array.");
  }

  return commands.map((command, index) => {
    if (typeof command !== "string") {
      throw new Error(`Draft command ${index + 1} must be a string.`);
    }
    const trimmed = command.trim();
    if (!trimmed) throw new Error(`Draft command ${index + 1} is blank.`);
    return trimmed;
  });
};
