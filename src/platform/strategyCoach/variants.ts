import type {
  StrategyCoachGuardrail,
  StrategyCoachPlayerConstraint,
  StrategyCoachVariant,
} from "./contracts.js";
import { dedupeGuardrails } from "./guardrails.js";
import { stableId } from "./identity.js";
import { commandForDraft, commandForTarget } from "./variantCommands.js";

interface BuildVariantsInput {
  hardLocks: readonly StrategyCoachPlayerConstraint[];
  rb2Alternatives: readonly StrategyCoachPlayerConstraint[];
  wrCandidates: readonly StrategyCoachPlayerConstraint[];
  desiredWrCount?: number;
  globalMaxPrice?: number;
  planSeed: unknown;
}

interface BuiltVariants {
  variants: StrategyCoachVariant[];
  guardrails: StrategyCoachGuardrail[];
}

const variantNameFor = (
  rb2Selection: StrategyCoachPlayerConstraint | undefined,
  wrTargets: readonly StrategyCoachPlayerConstraint[],
): string => {
  if (rb2Selection !== undefined) {
    return `${rb2Selection.playerName} RB2 + ${wrTargets.length > 0 ? "value WRs" : "open build"}`;
  }

  return wrTargets.length > 0 ? "Value WR targets" : "Base locks";
};

export const buildVariants = (input: BuildVariantsInput): BuiltVariants => {
  const wrTargets = input.desiredWrCount === undefined
    ? input.wrCandidates
    : input.wrCandidates.slice(0, input.desiredWrCount);
  const rb2Selections = input.rb2Alternatives.length > 0 ? input.rb2Alternatives : [undefined];
  const planGuardrails: StrategyCoachGuardrail[] = [];

  if (input.desiredWrCount !== undefined && input.wrCandidates.length === 0) {
    planGuardrails.push({
      code: "unresolved_wr_targets",
      severity: "warn",
      message: `The prompt asks for ${input.desiredWrCount} WRs but does not resolve exact WR targets from the catalog.`,
    });
  }

  const variants = rb2Selections.map((rb2Selection, index) => {
    const variantGuardrails: StrategyCoachGuardrail[] = [];
    const commands = [
      ...input.hardLocks.map(lock => commandForDraft(lock, input.globalMaxPrice, variantGuardrails)),
      ...(rb2Selection === undefined
        ? []
        : [commandForDraft(rb2Selection, input.globalMaxPrice, variantGuardrails)]),
      ...wrTargets.map(target => commandForTarget(target, input.globalMaxPrice, variantGuardrails)),
    ];
    const guardrails = dedupeGuardrails(variantGuardrails);
    const name = variantNameFor(rb2Selection, wrTargets);

    return {
      id: stableId("strategy_variant", { planSeed: input.planSeed, index, name, commands }),
      name,
      summary: commands.length > 0 ? commands.join("; ") : "No runnable commands were resolved.",
      runnable: !guardrails.some(guardrail => guardrail.severity === "block"),
      commands,
      hardLocks: input.hardLocks,
      ...(rb2Selection === undefined ? {} : { rb2Selection }),
      wrTargets,
      guardrails,
    };
  });

  return {
    variants,
    guardrails: dedupeGuardrails([
      ...planGuardrails,
      ...variants.flatMap(variant => variant.guardrails),
    ]),
  };
};
