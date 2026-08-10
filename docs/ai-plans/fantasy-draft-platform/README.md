# Fantasy Draft Platform Plan

This folder captures the staff-engineer orchestration pass for turning Mockd into a hosted, league-calibrated fantasy draft prep platform.

Start here:

- `orchestration.md`: product boundaries and staff ownership.
- `epic-status-audit.md`: what is actually done, what remains, and who owns the next work.
- `ui-product-shell-plan.md`: the UI/UX consolidation plan for turning the current separate surfaces into one product.
- `engineering-plan.md`: integrated architecture, data ownership, core contracts, phases, and test strategy.
- `issue-slices.md`: stacked implementation slices for PR planning.
- `epics/`: detailed plans from the ten staff-engineer slices.

Current reality: the platform backend is still ahead of the full product UI, but this branch now has a small browser shell for signup/login, current session, seeded season loading, team claims, live-room actions, realtime updates, and final CSV artifacts. The next near-term product slice should make Mockd feel like one app around the board, not separate Real Draft, Mock Draft, My Expert, Player News, and Draft Room experiences.

The most important system rule is the shared/private split:

- Shared league truth belongs to the league and is visible to league members.
- Private prep artifacts belong to one user and are not visible to other league members by default.

The most important implementation rule is to keep the current trusted local engine behavior covered while moving persistence, accounts, jobs, and live draft state into hosted production infrastructure.

Implemented foundation code now includes `src/platform/platformApp.ts`, a product-facing app service facade over the pure domain repositories. Server routes should enter through that facade so shared league authorization, private prep ownership, current team-claim checks, and live draft export shape stay consistent while persistence moves from memory to Postgres.
