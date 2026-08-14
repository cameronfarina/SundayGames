import type { SanitizedJobError } from "./contracts.js";

const safeErrorNamePattern = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

const sanitizeJobErrorName = (error: unknown): string => {
  if (!(error instanceof Error) || !safeErrorNamePattern.test(error.name)) {
    return "Error";
  }

  return error.name;
};

export const sanitizeJobError = (error: unknown): SanitizedJobError => ({
  name: sanitizeJobErrorName(error),
  message: "Job failed. Check worker logs for details.",
});
