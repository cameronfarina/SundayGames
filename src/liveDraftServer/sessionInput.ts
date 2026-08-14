import { join } from "node:path";
import { primaryOwner, ownerOrder, type Owner } from "../../config/league.js";
import {
  defaultLiveDraftSessionKey,
  defaultLiveDraftSessionMode,
  liveDraftNightLockReason,
  presetDraftSessions,
  scratchSessionPrefix,
} from "./constants.js";
import type {
  DraftNightLockStatus,
  LiveDraftSessionDescriptor,
  LiveDraftSessionMode,
} from "./contracts.js";

export const draftNightLockFor = (draftSessionKey: string): DraftNightLockStatus =>
  draftSessionKey === defaultLiveDraftSessionKey
    ? { locked: true, reason: liveDraftNightLockReason }
    : { locked: false };

export const isProtectedLiveDraftMutation = (
  draftSessionKey: string,
  mode: LiveDraftSessionMode,
): boolean => draftSessionKey === defaultLiveDraftSessionKey && mode === "real";

export const strategyKeyValueFromQuery = (url: URL): string | undefined =>
  url.searchParams.get("strategy") ?? undefined;

export const watchOwnerFromValue = (value: unknown, fallback: Owner = primaryOwner): Owner => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Draft owner must be a string.");
  const owner = ownerOrder.find(candidate => candidate === value.trim());
  if (!owner) throw new Error(`Unknown draft owner "${value}".`);
  return owner;
};

export const watchOwnerFromQuery = (url: URL): Owner =>
  watchOwnerFromValue(url.searchParams.get("owner") ?? url.searchParams.get("watchOwner"));

export const watchOwnerFromBody = (body: Record<string, unknown>): Owner =>
  watchOwnerFromValue(body.owner ?? body.watchOwner);

export const currentWeekFromQuery = (url: URL): number => {
  const value = url.searchParams.get("week");
  if (!value) return 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Week must be a positive integer.");
  return parsed;
};

const modeFromValue = (
  value: unknown,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === "real" || value === "interactive-mock") return value;
  throw new Error("Draft mode must be real or interactive-mock.");
};

export const canonicalSessionModeFor = (
  draftSessionKey: string,
  mode: LiveDraftSessionMode,
): LiveDraftSessionMode =>
  draftSessionKey === defaultLiveDraftSessionKey && mode === "interactive-mock" ? "real" : mode;

export const sessionModeFromQuery = (
  url: URL,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => modeFromValue(url.searchParams.get("mode"), fallback);

export const sessionModeFromQueryForSession = (
  url: URL,
  draftSessionKey: string,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => canonicalSessionModeFor(draftSessionKey, sessionModeFromQuery(url, fallback));

export const sessionModeFromBodyForSession = (
  body: Record<string, unknown>,
  draftSessionKey: string,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => canonicalSessionModeFor(draftSessionKey, modeFromValue(body.mode, fallback));

const scratchSlugFromValue = (value: string): string => {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 40);
  if (!slug) throw new Error("Scratch session name is required.");
  return slug;
};

const draftSessionKeyFromValue = (value: unknown, fallback: string): string => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Draft session must be a string.");
  const trimmed = value.trim();
  if (presetDraftSessions.some(session => session.key === trimmed)) return trimmed;
  if (trimmed.startsWith(scratchSessionPrefix)) {
    return `${scratchSessionPrefix}${scratchSlugFromValue(trimmed.slice(scratchSessionPrefix.length))}`;
  }
  throw new Error("Draft session must be live, practice-3rb, practice-wr-heavy, or scratch:<name>.");
};

export const draftSessionKeyFromQuery = (
  url: URL,
  fallback = defaultLiveDraftSessionKey,
): string => draftSessionKeyFromValue(
  url.searchParams.get("draftSession") ?? url.searchParams.get("session"),
  fallback,
);

export const draftSessionKeyFromBody = (
  body: Record<string, unknown>,
  fallback = defaultLiveDraftSessionKey,
): string => draftSessionKeyFromValue(body.draftSession ?? body.sessionKey ?? body.session, fallback);

export const draftSessionDirectoryFor = (baseDirectory: string, draftSessionKey: string): string => {
  if (draftSessionKey === defaultLiveDraftSessionKey) return baseDirectory;
  if (draftSessionKey.startsWith(scratchSessionPrefix)) {
    return join(baseDirectory, "scratch", draftSessionKey.slice(scratchSessionPrefix.length));
  }
  return join(baseDirectory, draftSessionKey);
};

export const activeDraftSessionDescriptorFor = (
  draftSessionKey: string,
): LiveDraftSessionDescriptor => presetDraftSessions.find(session => session.key === draftSessionKey) ?? {
  key: draftSessionKey,
  label: `Scratch: ${draftSessionKey.slice(scratchSessionPrefix.length)}`,
  description: "Custom scratch room. Isolated from live and preset practice rooms.",
};

export const draftSessionDescriptorsFor = (
  draftSessionKey: string,
): readonly LiveDraftSessionDescriptor[] => {
  const active = activeDraftSessionDescriptorFor(draftSessionKey);
  return presetDraftSessions.some(session => session.key === active.key)
    ? presetDraftSessions
    : [...presetDraftSessions, active];
};
