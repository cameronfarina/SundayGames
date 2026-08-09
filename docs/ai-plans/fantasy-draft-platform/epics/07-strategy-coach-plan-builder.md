# Epic 7: Strategy Coach, Plan Builder, And Private Context Boundaries

## Goal

Give each Mockd user a private strategy coach that turns league-calibrated numbers into draft plans, target lists, notes, and simulation-ready constraints. The coach reasons from shared league truth plus that user's private prep artifacts only.

No user's conversations, plans, targets, notes, mocks, or simulations may be visible to another user, even inside the same league.

## Launch-Critical Scope

- Authenticated coach chat scoped to one `user_id`, `league_id`, and season.
- Private persistence for coach conversations, messages, generated plans, target lists, and notes.
- Coach grounding from shared league data: roster rules, scoring, budgets, keepers, historical boards, owner profiles, calibrated prices, inflation scenarios, draft-room rankings, and model/version metadata.
- Coach grounding from private user data: selected owner/team, preferred strategy, prior coach messages, saved target lists, private notes, mock sessions, simulation jobs, and simulation results.
- Plan builder that produces structured draft plans: strategy key, budget lanes, target clusters, max bids, pivot rules, contingency plans, risk guardrails, and rationale tied to league numbers.
- Simulation handoff from chat/plan into deterministic mock constraints.
- Server-side privacy checks on every coach, plan, target-list, note, mock, and simulation read/write.
- Context audit metadata so each answer can explain which shared league inputs and which private user artifacts were used.

## Deferred Scope

- Cross-league strategy memory.
- Sharing plans or target lists with other league members.
- Collaborative coach rooms.
- Voice coach or live draft speech mode.
- Autonomous draft actions or ESPN writeback.
- Long-term personalization across seasons beyond explicit saved artifacts.
- Advanced prompt/eval tuning UI.
- Fine-grained per-artifact sharing controls.

## Data Model Impact

- `coach_conversations`: league, user, season, title/status, timestamps.
- `coach_messages`: conversation, role, content, structured tool calls/results, token/model metadata, timestamps.
- `strategy_plans`: league, user, season, name, status, selected owner/team, strategy key, keeper scenario, active version reference, timestamps.
- `strategy_plan_versions`: immutable structured plan JSON, source conversation/message references, context manifest, created timestamp.
- `target_lists`: private named lists tied to league, user, and optional plan/version.
- `target_list_items`: player, position, target/max price, priority, tags, rationale, source plan/message.
- `private_notes`: league, user, optional player/plan/simulation references, body, tags.

All private tables need composite authorization indexes around `(league_id, user_id)` and should avoid nullable ownership for launch.

## Coach Context Contracts

Every coach request resolves to a typed context envelope:

```ts
type CoachContextRequest = {
  userId: string;
  leagueId: string;
  seasonId: string;
  conversationId?: string;
  selectedOwnerId: string;
  selectedStrategyKey?: "balanced" | "three-rb" | "hero-rb" | "wr-heavy";
  keeperScenarioKey?: "confirmedOnly" | "expected" | "highRetention";
  userMessage: string;
  referencedPrivateArtifactIds?: string[];
};
```

The assembled context includes a manifest separating:

- `sharedLeagueContext`: settings, owners, keepers, calibrated prices, inflation, historical calibration, roster rules, player evidence, model run versions.
- `privateUserContext`: the user's conversations, plans, targets, notes, private mocks, simulation jobs/results.
- `excludedContext`: requested artifacts rejected because they are not owned by the user or not in the active league.

Coach outputs include structured citations to internal context objects, not hidden claims.

## Plan And Simulation Handoff Contracts

The coach emits a structured draft plan plus optional simulation request:

```ts
type CoachPlanDraft = {
  planName: string;
  ownerId: string;
  strategyKey: "balanced" | "three-rb" | "hero-rb" | "wr-heavy";
  keeperScenarioKey: string;
  budgetLanes: Array<{ slot: string; position: string; minPrice: number; maxPrice: number }>;
  targetMaxBids: Array<{ playerId?: string; playerName: string; maxBid: number; priority: number }>;
  buildAround?: { playerId?: string; playerName: string; prices: number[] };
  forcedSales?: Array<{ ownerId: string; playerName: string; price: number }>;
  avoidRules?: Array<{ playerName?: string; position?: string; reason: string }>;
  contingencyPlans: Array<{ trigger: string; action: string; targetNames: string[] }>;
  riskGuardrails: Array<{ label: string; status: "pass" | "warn" | "fail"; detail: string }>;
};
```

Simulation handoff creates a `simulation_job` from an approved plan version, never from unpersisted assistant prose. Job input includes plan version, model/input version, keeper scenario, strategy key, constraints, run count, and seed prefix.

## Privacy Boundaries

- Shared league truth can be read by any active league member.
- Private artifacts require active league membership and exact `user_id` ownership.
- Coach retrieval filters by `league_id` and `user_id` before ranking, summarizing, or sending context to a model.
- A plan may reference shared players, owners, prices, and keepers, but rationale, notes, target priorities, and simulation outputs are private.
- Admins manage membership and shared league data, but cannot read user strategy artifacts in launch scope.
- Logs, traces, analytics, and model prompts must not store private context in a place visible to league members.
- The coach refuses or omits requests like "show me Sam's plan" unless explicit sharing exists in future scope.

## Dependencies

- Epic 1 for accounts, sessions, memberships, and ownership authorization.
- Epic 2 for league settings, owners, roster rules, scoring, keepers, and historical boards.
- Epic 4 for versioned model outputs, keeper inflation, player evidence, and audit explanations.
- Epic 5 and 6 for private mocks, simulation jobs, progress, and results.
- Epic 9 for current live draft state as shared context.
- Epic 10 for model gateway operations, rate limits, and observability.

## Acceptance Criteria

- A logged-in league member can ask for a draft strategy and receive a plan grounded in league settings, keepers, pricing, and calibration.
- The coach can save a private plan, target list, and notes.
- The coach can turn a plan into simulation constraints and start a private simulation job.
- Simulation results link back into the originating conversation and plan version.
- A user cannot read, list, mutate, search, retrieve, or summarize another user's coach conversations, plans, targets, notes, mocks, or simulation results.
- Shared league updates invalidate or version coach context so stale plans are identifiable.
- Coach answers expose enough context metadata to debug which league/model inputs informed the response.
- Invalid or ambiguous player names use the same canonicalization path as mock scripts, with clarification when needed.

## Test And Verification Strategy

- Authorization tests for every private artifact route.
- Retrieval tests proving coach context assembly excludes other users' private artifacts.
- Structured-output validation tests for plan drafts and simulation handoff payloads.
- Integration tests from chat message to saved plan to simulation job creation.
- Regression tests for target max bids, build-around ranges, forced sales, scenario key, run count, and seed prefix.
- Prompt/eval tests for privacy refusal and league-grounding requirements.
- Audit/log tests ensuring prompts and traces do not leak private context across users.
- Manual launch smoke with two seeded users in the same league creating different private plans.

## Risks And Open Questions

- Decide whether launch coach uses a general LLM with strict retrieval filters, a tool-first planner, or a hybrid.
- Define how much raw simulation detail to persist versus summarize.
- Decide whether admins/support can access private artifacts through a break-glass path; default launch answer should be no.
- Define model/version invalidation rules when keepers, projections, evidence, or calibration inputs change.
- Confirm plan sharing is out of launch scope.
- Determine retention/deletion policy for coach conversations and private notes.
- Decide how live draft state enters coach context without exposing another user's private overlays.
