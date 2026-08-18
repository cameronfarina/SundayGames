export const expectedBehaviorNames: readonly string[] = [
  "persists active-league quotas and still permits updates to an existing league",
  "persists league archives and releases only the active-league quota",
  "enforces the durable per-account league creation window",
  "restores active-league ownership from snapshots created before quota metadata",
  "changes the signed-in account password and invalidates all active sessions",
  "requires an owner or admin actor when registering league season data",
  "uses an injected async league setup repository for season reads and registration",
  "lets league members claim one current team without taking another user's team",
  "locks an assigned team claim after a live draft has started",
  "registers a league season, gates shared access by membership, and keeps prep private",
  "lets a server worker execute an existing simulation while preserving private team ownership checks",
  "marks a synchronous season simulation failed when completion persistence throws",
  "blocks outsider setup overwrites and replaces omitted league memberships",
  "runs shared historical imports and league pricing rebuilds behind commissioner permissions",
  "blocks outsider registration for a new season in an existing league",
  "returns copies of shared league and live room state",
  "runs mock draft sessions through revision and command-count guards",
  "rejects mock draft result references to another user's private simulation",
  "rechecks current team claims before reading or mutating private prep",
  "routes live room commands through commissioner authorization and exports one draft sheet",
  "rejects snake hosted rooms before delegating creation to the repository",
  "cancels a setup room idempotently so league setup can resume and the room can be recreated",
  "can route live draft rooms and export artifacts through injected async repositories",
];

export const expectedAssertionCount = 109;
export const expectedAssertionFingerprint =
  "81b2bef009b736f3ffcae886853ca0f22f96525a63dde6bc7946fa40b5bddfd2";
