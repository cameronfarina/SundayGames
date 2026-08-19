import type { ZodError } from "zod";
import type { PlatformApiErrorIssue } from "./PlatformApiError";

/**
 * A path segment is a PropertyKey, so it can be a symbol. String() renders one
 * where an implicit conversion throws, and joining an array containing one
 * throws too. This runs while an error is already being built, so it takes the
 * explicit call rather than risk throwing over the failure it is describing.
 */
const issuePath = (segments: readonly PropertyKey[]): string =>
  segments.map(segment => String(segment)).join(".");

/** Turns a validator's complaint into the shape a caller of ours reads. */
export const contractIssues = (error: ZodError): readonly PlatformApiErrorIssue[] =>
  error.issues.map(issue => ({ message: issue.message, path: issuePath(issue.path) }));
