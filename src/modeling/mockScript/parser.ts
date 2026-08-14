import type {
  MockDraftScript,
  MockDraftScriptBuildAround,
  MockDraftScriptTargetMaxBid,
} from "./contracts.js";
import { scriptLabelFor } from "./label.js";
import { parseBuildAround, parseTarget } from "./targets.js";
import { normalizedScriptText, runsPerScenarioFrom, scriptParts } from "./text.js";

export const parseMockDraftScript = (rawValue: string): MockDraftScript | undefined => {
  const raw = normalizedScriptText(rawValue).trim();
  if (!raw) return undefined;

  const parts = scriptParts(raw);
  const targetMaxBids = parts
    .map(parseTarget)
    .filter((target): target is MockDraftScriptTargetMaxBid => target !== undefined);
  const buildArounds = parts
    .map(parseBuildAround)
    .filter((buildAround): buildAround is MockDraftScriptBuildAround => buildAround !== undefined);
  if (targetMaxBids.length === 0 && buildArounds.length === 0) {
    throw new Error("Mock script must include a target or build-around, like \"target Jadarian Price max 20\" or \"build around Omarion Hampton at 46-50:2\".");
  }
  if (buildArounds.length > 1) {
    throw new Error("Mock script can only build around one player at a time.");
  }

  const runsPerScenario = runsPerScenarioFrom(raw);
  const buildAround = buildArounds[0];
  return {
    raw,
    label: scriptLabelFor(targetMaxBids, buildAround),
    ...(buildAround === undefined ? {} : { buildAround }),
    targetMaxBids,
    ...(runsPerScenario === undefined ? {} : { runsPerScenario }),
  };
};
