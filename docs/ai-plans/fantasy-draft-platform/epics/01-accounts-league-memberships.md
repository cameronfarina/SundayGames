# Epic 1: Accounts, League Memberships, And Permissions

## Goal

Establish the account, session, league membership, and permission foundation for Mockd so every production workflow is authenticated, league-aware, and privacy-safe. This epic creates durable identity and authorization for the first production league of about 18 users while keeping a path to support more leagues later.

## Launch-Critical Scope

- Email/password account registration and login.
- Secure session creation, persistence, refresh/expiration, and logout.
- Initial production league creation or seeding.
- League membership records that tie users to leagues.
- Role-based access for league owners/admins, members, and read-only/system contexts.
- Server-side authorization for every league-scoped API route.
- Current-user/session bootstrap endpoint for the frontend.
- Postgres-backed source of truth for users, sessions, leagues, memberships, and roles.
- No reliance on browser `localStorage` for identity, permissions, league membership, or draft state.

## Deferred Scope

- OAuth/social login.
- Passwordless magic links.
- Multi-factor authentication.
- Self-serve league creation and invites beyond the launch path.
- Billing, subscriptions, or paid-seat management.
- ESPN import/writeback or external league sync.
- Organization/team management beyond leagues.
- Advanced audit log UI.
- Granular per-resource sharing controls beyond the launch privacy model.
- Polished cross-league account switching.

## Data Model Impact

- `users`: email, password hash, display name, status, timestamps. Email is unique case-insensitively.
- `sessions`: user reference, hashed session token, expiration, revocation timestamp, last-used timestamp, metadata.
- `leagues`: name, season/year, sport/provider metadata, timestamps. This represents shared league truth.
- `league_memberships`: user reference, league reference, role, status, timestamps, unique `(league_id, user_id)`.
- `password_reset_tokens`: optional but likely needed before launch.
- `audit_events`: optional launch table for security-sensitive actions.

Shared league data belongs to the league. User-created prep artifacts belong to the user and may reference a league, but are private by default.

## API, Session, And Permission Contracts

- `POST /signup`: create account and session.
- `POST /login`: validate credentials and create session.
- `POST /logout`: revoke current session.
- `GET /session`: return current user, memberships, active league context, and role hints.
- Authenticated requests use secure, HttpOnly cookies.
- Session tokens are never stored in `localStorage`.
- Expired or revoked sessions return `401`.
- League-scoped requests require active membership in the target league.
- Missing membership returns `403`.
- Private prep artifacts require both league membership and user ownership.
- Admin-only league actions require `owner` or `admin`.
- Live draft SSE connections require authentication and league membership before the stream opens.

The frontend can cache harmless preferences in `localStorage`, but permission state from bootstrap responses is only a display hint. The server remains authoritative.

## Privacy Boundaries

Shared within a league:

- league settings
- league members
- team and owner names
- keepers and prices
- calibrated shared board values
- draft order and live draft room state
- final draft results/export

Private to each user:

- mock draft sessions
- simulation jobs and results
- strategy plans
- target lists
- coach conversations
- personal notes, rankings adjustments, and preferences

Required invariant: a user can only read or mutate their own private prep artifacts, even when those artifacts reference a shared league.

## Dependencies

- Live draft room depends on authenticated league membership and role checks for SSE access and commissioner actions.
- Simulation and mock draft engines depend on user-owned private artifacts scoped to a league.
- Strategy coach depends on strict per-user privacy boundaries.
- League setup and imports depend on the league/membership model.
- Frontend shell depends on current-user and current-league bootstrap contracts.

## Acceptance Criteria

- A user can create an account, log in, refresh the app, remain authenticated, and log out.
- The initial production league can be seeded or created with about 18 members.
- Every league-scoped API requires authentication.
- A member can access shared data for their league.
- A non-member cannot access another league's data.
- A user cannot access another user's mock drafts, simulations, strategy plans, target lists, or coach conversations.
- Live draft SSE connections reject unauthenticated users and non-members.
- Session invalidation works after logout.
- No sensitive auth/session/permission state is stored in `localStorage`.
- Database constraints prevent duplicate memberships and obvious identity collisions.

## Test And Verification Strategy

- Unit tests for password hashing, session token hashing/validation, expiration, and revocation.
- Authorization tests covering unauthenticated, non-member, member, and admin cases.
- Integration tests for signup, login, logout, and session bootstrap.
- API tests proving private user artifacts are isolated across users in the same league.
- API tests proving league data is unavailable across league boundaries.
- SSE connection tests for authenticated member access and rejected unauthenticated/non-member access.
- Migration or database constraint checks for unique email and unique league membership.
- Manual launch smoke test with seeded production-like league users.

## Risks And Open Questions

- Password reset may be necessary for launch even if broader account management is deferred.
- Decide whether the first league is seeded administratively or created through a minimal internal flow.
- Decide whether launch roles are `owner`, `admin`, and `member`, or just `admin` and `member`.
- Define session duration and idle timeout expectations.
- Decide whether users can belong to multiple leagues at launch, even if only one production league exists.
- Define audit requirements for login, membership changes, and live draft actions.
- Confirm whether email verification is required before joining the production league.
