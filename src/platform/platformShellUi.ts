export const platformShellNavigation = [
  { label: "League", path: "/app" },
  { label: "Board", path: "/board" },
  { label: "Mock drafts", path: "/mock-drafts" },
  { label: "Simulations", path: "/simulations" },
  { label: "Live draft", path: "/draft-room" },
] as const;

export const draftRoomPathFor = (input: { seasonId: string; roomId: string }): string => {
  const query = new URLSearchParams({ seasonId: input.seasonId, roomId: input.roomId });
  return `/draft-room?${query.toString()}`;
};

const navigationMarkup = platformShellNavigation
  .map(item => `<a class="product-nav-link" data-nav-path="${item.path}" href="${item.path}">${item.label}</a>`)
  .join("");

export const platformShellHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #08090b;
      --surface: #101216;
      --surface-raised: #171a20;
      --line: #2b3039;
      --text: #f3f5f7;
      --muted: #a5acb8;
      --accent: #67d8b0;
      --accent-strong: #88edc8;
      --danger: #ff8c9b;
      --warning: #f4c86b;
      --focus: #71b7ff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    * { box-sizing: border-box; }

    body {
      background: var(--bg);
      color: var(--text);
      margin: 0;
      min-height: 100vh;
    }

    button, input, select, textarea { font: inherit; }
    button, select { cursor: pointer; }
    a { color: inherit; }

    :focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }

    .skip-link {
      background: var(--text);
      color: var(--bg);
      left: 12px;
      padding: 10px 12px;
      position: fixed;
      top: -60px;
      z-index: 20;
    }

    .skip-link:focus { top: 12px; }
    .hidden { display: none !important; }

    .topbar {
      align-items: center;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 16px;
      justify-content: space-between;
      min-height: 64px;
      padding: 12px 16px;
    }

    .brand {
      font-size: 22px;
      font-weight: 850;
      text-decoration: none;
    }

    .account-actions {
      align-items: center;
      display: flex;
      gap: 10px;
      min-width: 0;
    }

    .account-email {
      color: var(--muted);
      display: none;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .product-nav {
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 0 12px;
      scrollbar-width: thin;
    }

    .product-nav-link {
      border-bottom: 3px solid transparent;
      color: var(--muted);
      flex: 0 0 auto;
      font-size: 14px;
      font-weight: 700;
      padding: 14px 10px 11px;
      text-decoration: none;
    }

    .product-nav-link[aria-current="page"] {
      border-bottom-color: var(--accent);
      color: var(--text);
    }

    .product-nav-link[aria-disabled="true"] {
      cursor: not-allowed;
      opacity: .48;
    }

    .shell-main {
      margin: 0 auto;
      max-width: 1240px;
      padding: 20px 16px 56px;
    }

    .boot, .auth-shell {
      margin: 10vh auto 0;
      max-width: 440px;
    }

    .auth-shell h1, .workspace h1 {
      font-size: 28px;
      line-height: 1.15;
      margin: 0;
    }

    .eyebrow, label, .field-label {
      color: var(--muted);
      display: block;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 7px;
      text-transform: uppercase;
    }

    .lede {
      color: var(--muted);
      line-height: 1.5;
      margin: 8px 0 0;
    }

    .stack { display: grid; gap: 16px; }
    .compact-stack { display: grid; gap: 10px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }

    input, select, textarea {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      min-height: 44px;
      padding: 10px 12px;
      width: 100%;
    }

    textarea {
      line-height: 1.45;
      min-height: 190px;
      resize: vertical;
    }

    button, .button {
      align-items: center;
      background: var(--surface-raised);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      display: inline-flex;
      font-weight: 750;
      justify-content: center;
      min-height: 42px;
      padding: 9px 14px;
      text-decoration: none;
    }

    button.primary, .button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #06110d;
    }

    button:disabled, .button[aria-disabled="true"] {
      cursor: not-allowed;
      opacity: .5;
    }

    .text-button {
      background: transparent;
      border-color: transparent;
      color: var(--muted);
      min-height: 38px;
      padding: 6px 8px;
    }

    dialog {
      background: var(--surface-raised);
      border: 1px solid var(--line);
      border-radius: 8px;
      color: var(--text);
      margin: auto;
      max-height: calc(100vh - 32px);
      max-width: 420px;
      padding: 20px;
      width: calc(100% - 32px);
    }

    dialog::backdrop { background: rgb(0 0 0 / .72); }

    .dialog-header {
      align-items: start;
      display: flex;
      gap: 16px;
      justify-content: space-between;
    }

    .dialog-header h2 { font-size: 20px; margin: 0; }
    .dialog-copy { color: var(--muted); line-height: 1.45; margin: 8px 0 18px; }
    .notice { color: var(--accent-strong); line-height: 1.45; }

    .context-bar {
      align-items: end;
      border-bottom: 1px solid var(--line);
      display: grid;
      gap: 14px;
      margin-bottom: 28px;
      padding-bottom: 20px;
    }

    .identity {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .identity strong { overflow-wrap: anywhere; }
    .identity span { color: var(--muted); font-size: 13px; }

    .workspace { display: grid; gap: 24px; min-width: 0; }

    .workspace-header {
      align-items: start;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }

    .workspace-section {
      border-top: 1px solid var(--line);
      padding-top: 20px;
    }

    .workspace-section h2 {
      font-size: 18px;
      margin: 0 0 14px;
    }

    .facts {
      display: grid;
      gap: 1px;
      grid-template-columns: 1fr;
    }

    .fact {
      background: var(--surface);
      min-height: 82px;
      padding: 14px;
    }

    .fact span { color: var(--muted); display: block; font-size: 12px; font-weight: 750; margin-bottom: 6px; text-transform: uppercase; }
    .fact strong { display: block; overflow-wrap: anywhere; }
    .ready { color: var(--accent-strong); }
    .attention { color: var(--warning); }

    .status { color: var(--muted); min-height: 22px; }
    .error { color: var(--danger); line-height: 1.45; }

    .empty-state {
      border: 1px dashed var(--line);
      color: var(--muted);
      padding: 24px;
    }

    .setup-layout { display: grid; gap: 28px; min-width: 0; }
    .setup-layout > *, .context-bar > * { min-width: 0; }

    .setup-task {
      border-bottom: 1px solid var(--line);
      display: grid;
      gap: 14px;
      margin-bottom: 18px;
      padding-bottom: 20px;
    }

    .setup-task h3 { font-size: 15px; margin: 0; }
    .setup-task .lede { font-size: 14px; margin-top: -6px; }
    .upload-actions { align-items: end; display: grid; gap: 10px; }
    .setup-fields { display: grid; gap: 12px; }
    .review-cell { min-width: 150px; }
    .review-note { color: var(--warning); display: block; font-size: 12px; line-height: 1.35; margin-bottom: 7px; }
    .confirmation-label {
      align-items: center;
      color: var(--text);
      display: flex;
      font-size: 13px;
      gap: 8px;
      margin: 0;
      text-transform: none;
    }
    .confirmation-label input { flex: 0 0 auto; min-height: 18px; width: 18px; }
    .screenshot-review-row[data-needs-review="true"] { background: rgb(244 200 107 / .06); }
    .screenshot-review-row input { min-width: 88px; }
    .screenshot-review-row select { min-width: 180px; }
    .screenshot-review-row .team-name-input { min-width: 220px; }
    .screenshot-review-row .manager-names-input { min-width: 220px; }
    .screenshot-source-preview {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      display: block;
      max-height: 360px;
      object-fit: contain;
      width: 100%;
    }

    details {
      border-top: 1px solid var(--line);
      padding-top: 14px;
    }

    summary { cursor: pointer; font-weight: 750; }

    .result-list, .invitation-list {
      display: grid;
      gap: 1px;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .result-list li, .invitation-row {
      background: var(--surface);
      padding: 12px;
    }

    .table-scroll { max-width: 100%; min-width: 0; overflow-x: auto; }
    .setup-preview-table { border-collapse: collapse; min-width: 620px; width: 100%; }
    .setup-preview-table th, .setup-preview-table td {
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
    }
    .setup-preview-table th { color: var(--muted); font-size: 12px; text-transform: uppercase; }

    .invitation-row {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
    }

    .invitation-copy { min-width: 0; }
    .invitation-copy strong, .invitation-copy span { display: block; overflow-wrap: anywhere; }
    .invitation-copy span { color: var(--muted); font-size: 13px; margin-top: 3px; }

    .visually-hidden {
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }

    @media (min-width: 860px) {
      .topbar { padding-left: 28px; padding-right: 28px; }
      .account-email { display: block; max-width: 320px; }
      .product-nav { padding-left: max(20px, calc((100vw - 1240px) / 2)); }
      .shell-main { padding-left: 28px; padding-right: 28px; }
      .context-bar { grid-template-columns: minmax(260px, 380px) 1fr 1fr; }
      .facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .setup-layout { grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); }
      .upload-actions { grid-template-columns: minmax(0, 1fr) auto; }
      .setup-fields { grid-template-columns: minmax(0, 1fr) minmax(180px, .5fr); }
      .room-setup { grid-column: 1 / -1; }
    }
  </style>
</head>
<body data-session-state="loading">
  <a class="skip-link" href="#main-content">Skip to content</a>

  <header id="app-header" class="hidden">
    <div class="topbar">
      <a class="brand" href="/app">Mockd</a>
      <div class="account-actions">
        <span id="account-email" class="account-email"></span>
        <button id="account-settings-button" class="text-button" type="button" aria-haspopup="dialog" aria-controls="password-dialog">Account</button>
        <button id="sign-out-button" class="text-button" type="button">Sign out</button>
      </div>
    </div>
    <nav class="product-nav" aria-label="Primary">${navigationMarkup}<a id="commissioner-nav-item" class="product-nav-link hidden" data-nav-path="/setup" href="/setup">Commissioner</a></nav>
  </header>

  <dialog id="password-dialog" aria-labelledby="password-dialog-title" aria-describedby="password-dialog-description">
    <div class="dialog-header">
      <h2 id="password-dialog-title">Change password</h2>
      <button id="password-dialog-close" class="text-button" type="button">Close</button>
    </div>
    <p id="password-dialog-description" class="dialog-copy">You will be signed out on every device after your password changes.</p>
    <form id="password-change-form" class="compact-stack">
      <div>
        <label for="current-password-input">Current password</label>
        <input id="current-password-input" type="password" autocomplete="current-password" required>
      </div>
      <div>
        <label for="new-password-input">New password</label>
        <input id="new-password-input" type="password" autocomplete="new-password" minlength="8" required>
      </div>
      <div>
        <label for="confirm-password-input">Confirm new password</label>
        <input id="confirm-password-input" type="password" autocomplete="new-password" minlength="8" required>
      </div>
      <p id="password-change-status" class="status" role="status" aria-live="polite"></p>
      <div class="actions">
        <button id="password-change-submit" class="primary" type="submit">Update password</button>
        <button id="password-dialog-cancel" type="button">Cancel</button>
      </div>
    </form>
  </dialog>

  <main id="main-content" class="shell-main">
    <section id="boot-panel" class="boot" aria-live="polite">
      <p class="eyebrow">Mockd</p>
      <p>Opening your league...</p>
    </section>

    <section id="auth-panel" class="auth-shell stack hidden" aria-labelledby="auth-title">
      <div>
        <p class="eyebrow">Mockd</p>
        <h1 id="auth-title">Sign in</h1>
        <p id="auth-description" class="lede">Open your league, draft tools, and live room.</p>
      </div>
      <form id="auth-form" class="stack">
        <div>
          <label for="email-input">Email</label>
          <input id="email-input" name="email" type="email" autocomplete="email" required>
        </div>
        <div>
          <label for="password-input">Password</label>
          <input id="password-input" name="password" type="password" autocomplete="new-password" minlength="8" required>
        </div>
        <button id="auth-submit-button" class="primary" type="submit">Sign in</button>
      </form>
      <p id="auth-error" class="error hidden" role="alert"></p>
      <p id="auth-notice" class="notice hidden" role="status"></p>
      <p><span id="auth-mode-prompt">Need access? Ask your commissioner for an invitation.</span> <a id="auth-mode-link" class="hidden" href="/login">Sign in</a></p>
    </section>

    <div id="app-shell" class="hidden">
      <div id="app-error" class="error hidden" role="alert">
        <p id="app-error-message"></p>
        <button id="retry-onboarding-button" type="button">Try again</button>
      </div>
      <p id="app-status" class="status" role="status" aria-live="polite"></p>

      <section id="league-context" class="context-bar hidden" aria-label="League context">
        <div>
          <label for="league-picker">League</label>
          <select id="league-picker"></select>
        </div>
        <div class="identity">
          <span>My team</span>
          <strong id="my-team-name">Not assigned</strong>
        </div>
        <div class="identity">
          <span>Access</span>
          <strong id="membership-role">Member</strong>
        </div>
      </section>

      <section id="empty-leagues" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">League</p>
            <h1>No league yet</h1>
            <p class="lede">Accept an invitation from your commissioner to join your league.</p>
          </div>
        </div>
        <div class="empty-state">Invitation links open the correct league automatically.</div>
      </section>

      <section id="league-workspace" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">League home</p>
            <h1 id="league-name">Your league</h1>
            <p id="league-season" class="lede"></p>
          </div>
          <a id="open-live-draft-button" class="button primary" href="/draft-room">Open live draft</a>
        </div>
        <div class="facts" aria-label="League readiness">
          <div class="fact"><span>League setup</span><strong id="league-setup-readiness"></strong></div>
          <div class="fact"><span>My team</span><strong id="team-claim-readiness"></strong></div>
          <div class="fact"><span>Live draft</span><strong id="live-draft-readiness"></strong></div>
        </div>
        <section id="team-claim-panel" class="workspace-section hidden" aria-labelledby="team-claim-title">
          <h2 id="team-claim-title">Claim your team</h2>
          <p class="lede">Choose your team before opening private draft prep.</p>
          <div class="actions">
            <select id="team-claim-picker" aria-label="Team to claim"></select>
            <button id="team-claim-button" class="primary" type="button">Claim team</button>
          </div>
          <p id="team-claim-status" class="status" role="status" aria-live="polite"></p>
        </section>
        <section class="workspace-section">
          <h2>Draft schedule</h2>
          <p id="next-draft-at" class="lede">No draft time scheduled.</p>
        </section>
      </section>

      <section id="feature-workspace" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p id="feature-eyebrow" class="eyebrow"></p>
            <h1 id="feature-title"></h1>
            <p id="feature-description" class="lede"></p>
          </div>
        </div>
        <div id="feature-empty-state" class="empty-state"></div>
      </section>

      <section id="setup-workspace" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">Commissioner</p>
            <h1>League setup</h1>
            <p class="lede">Manage team ownership and invitations for the selected season.</p>
          </div>
        </div>
        <div class="setup-layout">
          <section class="workspace-section">
            <h2>Teams and owners</h2>
            <input id="setup-season-id-input" type="hidden">
            <div class="setup-task" aria-labelledby="screenshot-import-title">
              <h3 id="screenshot-import-title">Import from ESPN screenshot</h3>
              <p class="lede">Upload the League Members page, then verify every team and manager before applying.</p>
              <div class="upload-actions">
                <div>
                  <label for="screenshot-import-file">League Members screenshot</label>
                  <input id="screenshot-import-file" type="file" accept="image/png,image/jpeg,image/webp">
                </div>
                <button id="screenshot-analyze-button" type="button">Analyze screenshot</button>
              </div>
              <p id="screenshot-import-status" class="status" role="status" aria-live="polite"></p>
              <div id="screenshot-review" class="stack hidden">
                <img id="screenshot-source-preview" class="screenshot-source-preview hidden" alt="Uploaded ESPN League Members screenshot">
                <div class="setup-fields">
                  <div>
                    <label for="screenshot-league-name">League name</label>
                    <input id="screenshot-league-name" autocomplete="off">
                  </div>
                  <div>
                    <label for="screenshot-league-id">ESPN league ID</label>
                    <input id="screenshot-league-id" autocomplete="off" inputmode="numeric">
                  </div>
                </div>
                <ul id="screenshot-import-blockers" class="result-list"></ul>
                <div id="screenshot-review-table" class="table-scroll">
                  <table class="setup-preview-table screenshot-review-table">
                    <thead><tr><th>Team #</th><th>Abbr</th><th>Team</th><th>Managers</th><th>Mockd profile</th><th>Review</th></tr></thead>
                    <tbody id="screenshot-review-body"></tbody>
                  </table>
                </div>
                <div class="actions">
                  <button id="screenshot-apply-button" class="primary" type="button" disabled>Apply teams</button>
                </div>
              </div>
            </div>
            <p id="setup-team-summary" class="lede">Loading teams...</p>
            <div id="setup-team-table" class="table-scroll hidden">
              <table class="setup-preview-table">
                <thead><tr><th>Team #</th><th>Abbr</th><th>Mockd profile</th><th>Managers</th><th>Team</th></tr></thead>
                <tbody id="setup-team-body"></tbody>
              </table>
            </div>
            <details>
              <summary>Advanced: paste a team list</summary>
              <div class="stack" style="margin-top: 16px">
                <div>
                  <label for="setup-rows-input">Owner rows</label>
                  <textarea id="setup-rows-input" spellcheck="false" placeholder="owner,team,email,role"></textarea>
                </div>
                <div class="actions">
                  <button id="setup-preview-button" type="button">Preview</button>
                  <button id="setup-apply-button" class="primary" type="button" disabled>Apply changes</button>
                </div>
              </div>
            </details>
            <p id="setup-status" class="status" role="status" aria-live="polite"></p>
            <ul id="setup-blockers" class="result-list"></ul>
            <div id="setup-preview-table" class="table-scroll hidden">
              <table class="setup-preview-table">
                <thead><tr><th>Owner</th><th>Team</th><th>Email</th><th>Role</th></tr></thead>
                <tbody id="setup-preview-body"></tbody>
              </table>
            </div>
          </section>
          <section class="workspace-section" aria-labelledby="invitations-title">
            <h2 id="invitations-title">Invitations</h2>
            <p class="lede">Create a private signup link for a manager after their team is configured.</p>
            <form id="create-invitation-form" class="compact-stack" style="margin: 16px 0 20px">
              <div>
                <label for="invitation-team-picker">Team</label>
                <select id="invitation-team-picker"></select>
              </div>
              <div>
                <label for="invitation-email-input">Manager email</label>
                <input id="invitation-email-input" type="email" autocomplete="email" required>
              </div>
              <div class="actions">
                <button id="create-invitation-button" class="primary" type="submit" disabled>Create invite link</button>
              </div>
              <p id="invitation-create-status" class="status" role="status" aria-live="polite"></p>
            </form>
            <div id="setup-invitations" class="invitation-list"></div>
          </section>
          <section class="workspace-section room-setup" aria-labelledby="live-room-setup-title">
            <h2 id="live-room-setup-title">Live draft room</h2>
            <p class="lede">Create the shared room after teams and keepers are ready.</p>
            <div class="stack" style="margin-top: 16px">
              <div>
                <label for="draft-starts-at-input">Draft time (optional)</label>
                <input id="draft-starts-at-input" type="datetime-local">
              </div>
              <div class="actions">
                <button id="create-live-room-button" class="primary" type="button">Create draft room</button>
                <a id="open-setup-live-room" class="button primary hidden" href="/draft-room">Open draft room</a>
              </div>
              <p id="live-room-setup-status" class="status" role="status" aria-live="polite"></p>
            </div>
          </section>
        </div>
      </section>

      <section id="setup-access-denied" class="workspace hidden">
        <div>
          <p class="eyebrow">Commissioner</p>
          <h1>Commissioner access required</h1>
          <p class="lede">Ask a league owner or commissioner to make setup changes.</p>
        </div>
        <div><a class="button" href="/app">Back to league</a></div>
      </section>

      <section id="invite-workspace" class="workspace hidden">
        <div>
          <p class="eyebrow">League invitation</p>
          <h1>Join your league</h1>
          <p class="lede">Your account email must match the invitation.</p>
        </div>
        <div class="actions">
          <button id="accept-invitation-button" class="primary" type="button">Accept invitation</button>
        </div>
        <p id="invite-status" class="status" role="status" aria-live="polite"></p>
      </section>
    </div>
  </main>

  <script>
    const routePath = window.location.pathname;
    const signupMode = window.location.pathname === "/signup";
    const navigation = ${JSON.stringify(platformShellNavigation)};
    const featureRoutes = {
      "/board": ["Draft prep", "Board", "Rank, filter, and shortlist players for your selected league."],
      "/mock-drafts": ["Practice", "Mock drafts", "Run a draft against your league settings and keep the results."],
      "/simulations": ["Modeling", "Simulations", "Compare strategy outcomes for your selected team."],
    };
    const state = {
      account: null,
      onboarding: null,
      selectedLeague: null,
      invitations: [],
      setupLocked: false,
      screenshotImport: null,
      screenshotImportRevision: null,
      screenshotTeamProfiles: [],
      screenshotPreviewUrl: null,
      screenshotRequestGeneration: 0,
      workspaceRequestGeneration: 0,
      currentSeason: null,
      claimedTeamIds: new Set(),
    };

    const byId = id => document.getElementById(id);
    const bootPanel = byId("boot-panel");
    const authPanel = byId("auth-panel");
    const authForm = byId("auth-form");
    const authTitle = byId("auth-title");
    const authDescription = byId("auth-description");
    const authSubmitButton = byId("auth-submit-button");
    const authModePrompt = byId("auth-mode-prompt");
    const authModeLink = byId("auth-mode-link");
    const authError = byId("auth-error");
    const authNotice = byId("auth-notice");
    const emailInput = byId("email-input");
    const passwordInput = byId("password-input");
    const appHeader = byId("app-header");
    const appShell = byId("app-shell");
    const appStatus = byId("app-status");
    const appError = byId("app-error");
    const appErrorMessage = byId("app-error-message");
    const leagueContext = byId("league-context");
    const leaguePicker = byId("league-picker");
    const commissionerNavItem = byId("commissioner-nav-item");
    const teamClaimPanel = byId("team-claim-panel");
    const teamClaimPicker = byId("team-claim-picker");
    const teamClaimButton = byId("team-claim-button");
    const teamClaimStatus = byId("team-claim-status");
    const setupRowsInput = byId("setup-rows-input");
    const setupPreviewButton = byId("setup-preview-button");
    const setupApplyButton = byId("setup-apply-button");
    const setupStatus = byId("setup-status");
    const setupBlockers = byId("setup-blockers");
    const setupTeamSummary = byId("setup-team-summary");
    const setupTeamTable = byId("setup-team-table");
    const setupTeamBody = byId("setup-team-body");
    const setupPreviewTable = byId("setup-preview-table");
    const setupPreviewBody = byId("setup-preview-body");
    const setupInvitations = byId("setup-invitations");
    const screenshotImportFile = byId("screenshot-import-file");
    const screenshotAnalyzeButton = byId("screenshot-analyze-button");
    const screenshotImportStatus = byId("screenshot-import-status");
    const screenshotReview = byId("screenshot-review");
    const screenshotSourcePreview = byId("screenshot-source-preview");
    const screenshotLeagueName = byId("screenshot-league-name");
    const screenshotLeagueId = byId("screenshot-league-id");
    const screenshotImportBlockers = byId("screenshot-import-blockers");
    const screenshotReviewBody = byId("screenshot-review-body");
    const screenshotApplyButton = byId("screenshot-apply-button");
    const invitationForm = byId("create-invitation-form");
    const invitationTeamPicker = byId("invitation-team-picker");
    const invitationEmailInput = byId("invitation-email-input");
    const createInvitationButton = byId("create-invitation-button");
    const invitationCreateStatus = byId("invitation-create-status");
    const draftStartsAtInput = byId("draft-starts-at-input");
    const createLiveRoomButton = byId("create-live-room-button");
    const openSetupLiveRoom = byId("open-setup-live-room");
    const liveRoomSetupStatus = byId("live-room-setup-status");
    const passwordDialog = byId("password-dialog");
    const passwordChangeForm = byId("password-change-form");
    const currentPasswordInput = byId("current-password-input");
    const newPasswordInput = byId("new-password-input");
    const confirmPasswordInput = byId("confirm-password-input");
    const passwordChangeStatus = byId("password-change-status");
    const passwordChangeSubmit = byId("password-change-submit");

    const setHidden = (element, hidden) => element.classList.toggle("hidden", hidden);

    const errorMessageFor = body => body && body.error && body.error.message
      ? body.error.message
      : "Mockd could not complete that request.";

    const readJson = async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(errorMessageFor(body));
        error.status = response.status;
        error.body = body;
        throw error;
      }
      return body;
    };

    const returnPath = () => routePath + window.location.search;

    const authenticationReturnPath = () => {
      const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
      return requestedPath && requestedPath.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : "/app";
    };

    const configureAuthMode = () => {
      authTitle.textContent = signupMode ? "Create your account" : "Sign in";
      authDescription.textContent = signupMode
        ? "Use the email address where your league invitation was sent."
        : "Open your league, draft tools, and live room.";
      authSubmitButton.textContent = signupMode ? "Create account" : "Sign in";
      authModePrompt.textContent = signupMode
        ? "Already have an account?"
        : "Need access? Ask your commissioner for an invitation.";
      authModeLink.textContent = "Sign in";
      setHidden(authModeLink, !signupMode);
      const modeReturnPath = routePath === "/login" || routePath === "/signup"
        ? authenticationReturnPath()
        : returnPath();
      authModeLink.href = "/login?returnTo=" + encodeURIComponent(modeReturnPath);
      passwordInput.autocomplete = signupMode ? "new-password" : "current-password";
      const passwordChanged = new URLSearchParams(window.location.search).get("passwordChanged") === "1";
      authNotice.textContent = passwordChanged ? "Password changed. Sign in with your new password." : "";
      setHidden(authNotice, !passwordChanged);
    };

    const showAuth = () => {
      document.body.dataset.sessionState = "signed-out";
      setHidden(bootPanel, true);
      setHidden(appHeader, true);
      setHidden(appShell, true);
      setHidden(authPanel, false);
      configureAuthMode();
      emailInput.focus();
    };

    const showAppError = message => {
      appErrorMessage.textContent = message;
      setHidden(appError, false);
      appStatus.textContent = "";
    };

    const clearAppError = () => setHidden(appError, true);

    const titleCase = value => value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");

    const readinessLabel = value => value === "ready" ? "Ready" : "Needs attention";

    const renderReadiness = (elementId, value) => {
      const element = byId(elementId);
      element.textContent = readinessLabel(value);
      element.className = value === "ready" ? "ready" : "attention";
    };

    const draftRoomPathFor = (seasonId, roomId) => {
      const query = new URLSearchParams({ seasonId: seasonId, roomId: roomId });
      return "/draft-room?" + query.toString();
    };

    const pathWithSeason = (path, seasonId) => {
      const query = new URLSearchParams({ seasonId: seasonId });
      return path + "?" + query.toString();
    };

    const ownerScopedPaths = new Set(["/board", "/mock-drafts", "/simulations"]);

    const productPathFor = (path, selectedLeague) => {
      const query = new URLSearchParams({ seasonId: selectedLeague.seasonId });
      const ownerDisplayName = selectedLeague.membership?.ownerDisplayName;
      if (ownerScopedPaths.has(path) && ownerDisplayName) query.set("owner", ownerDisplayName);
      return path + "?" + query.toString();
    };

    const markCurrentNavigation = () => {
      document.querySelectorAll("[data-nav-path]").forEach(link => {
        if (link.dataset.navPath === routePath) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    };

    const updateNavigation = selectedLeague => {
      navigation.forEach(item => {
        const link = document.querySelector('[data-nav-path="' + item.path + '"]');
        if (!link) return;
        if (item.path === "/draft-room") {
          const roomId = selectedLeague.liveDraft?.roomId;
          if (roomId) {
            link.href = draftRoomPathFor(selectedLeague.seasonId, roomId);
            link.removeAttribute("aria-disabled");
            link.removeAttribute("tabindex");
          } else if (selectedLeague.canManageLeague) {
            link.href = pathWithSeason("/setup", selectedLeague.seasonId);
            link.removeAttribute("aria-disabled");
            link.removeAttribute("tabindex");
          } else {
            link.removeAttribute("href");
            link.setAttribute("aria-disabled", "true");
            link.setAttribute("tabindex", "-1");
          }
        } else if (ownerScopedPaths.has(item.path) && !selectedLeague.membership?.ownerDisplayName) {
          link.removeAttribute("href");
          link.setAttribute("aria-disabled", "true");
          link.setAttribute("tabindex", "-1");
        } else {
          link.href = item.path === "/app" ? "/app" : productPathFor(item.path, selectedLeague);
          link.removeAttribute("aria-disabled");
          link.removeAttribute("tabindex");
        }
      });
      commissionerNavItem.href = pathWithSeason("/setup", selectedLeague.seasonId);
      document.querySelector(".brand").href = pathWithSeason("/app", selectedLeague.seasonId);
    };

    const hideWorkspaces = () => {
      ["empty-leagues", "league-workspace", "feature-workspace", "setup-workspace", "setup-access-denied", "invite-workspace"]
        .forEach(id => setHidden(byId(id), true));
    };

    const renderInvitationRows = invitations => {
      state.invitations = invitations;
      setupInvitations.replaceChildren();
      if (!invitations.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No invitations yet.";
        setupInvitations.append(empty);
        return;
      }

      invitations.forEach(invitation => {
        const row = document.createElement("div");
        row.className = "invitation-row";
        const copy = document.createElement("div");
        copy.className = "invitation-copy";
        const email = document.createElement("strong");
        email.textContent = invitation.email;
        const detail = document.createElement("span");
        detail.textContent = invitation.teamDisplayName + " · " + titleCase(invitation.status);
        copy.append(email, detail);
        const actions = document.createElement("div");
        actions.className = "actions";
        if (invitation.status === "pending" && invitation.acceptPath) {
          const copyButton = document.createElement("button");
          copyButton.type = "button";
          copyButton.dataset.invitationAction = "copy";
          copyButton.dataset.invitationId = invitation.id;
          copyButton.textContent = "Copy invite link";
          actions.append(copyButton);
        }
        if (invitation.status === "pending") {
          const reissueButton = document.createElement("button");
          reissueButton.type = "button";
          reissueButton.dataset.invitationAction = "reissue";
          reissueButton.dataset.invitationId = invitation.id;
          reissueButton.textContent = "Reissue";
          const revokeButton = document.createElement("button");
          revokeButton.type = "button";
          revokeButton.dataset.invitationAction = "revoke";
          revokeButton.dataset.invitationId = invitation.id;
          revokeButton.textContent = "Revoke";
          actions.append(reissueButton, revokeButton);
        }
        row.append(copy, actions);
        setupInvitations.append(row);
      });
    };

    const renderSeasonTeams = season => {
      state.currentSeason = season || null;
      const teams = [...(season?.teams || [])]
        .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
      setupTeamBody.replaceChildren();
      const selectedInvitationTeamId = invitationTeamPicker.value;
      invitationTeamPicker.replaceChildren();
      teams.forEach(team => {
        const row = document.createElement("tr");
        const managers = team.managerDisplayNames?.length
          ? team.managerDisplayNames.join(", ")
          : team.ownerDisplayName;
        [team.draftOrderPosition, team.abbreviation || "-", team.ownerDisplayName, managers, team.displayName].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
        setupTeamBody.append(row);

        if (!state.claimedTeamIds.has(team.id)) {
          const option = document.createElement("option");
          option.value = team.id;
          option.textContent = team.draftOrderPosition + ". " + team.displayName + " · " + managers;
          invitationTeamPicker.append(option);
        }
      });
      if ([...invitationTeamPicker.options].some(option => option.value === selectedInvitationTeamId)) {
        invitationTeamPicker.value = selectedInvitationTeamId;
      }
      invitationTeamPicker.disabled = invitationTeamPicker.options.length === 0;
      createInvitationButton.disabled = invitationTeamPicker.options.length === 0;
      setupTeamSummary.textContent = teams.length
        ? teams.length + " teams configured."
        : "No teams have been configured for this season.";
      setHidden(setupTeamTable, teams.length === 0);
    };

    const loadClaimableTeams = async selectedLeague => {
      const body = await readJson(await fetch(
        "/seasons/" + encodeURIComponent(selectedLeague.seasonId),
        { credentials: "same-origin" },
      ));
      const teams = [...(body.season?.teams || [])]
        .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
      teamClaimPicker.replaceChildren();
      teams.forEach(team => {
        const option = document.createElement("option");
        option.value = team.id;
        option.dataset.ownerId = team.ownerId;
        option.textContent = team.draftOrderPosition + ". " + team.ownerDisplayName + " · " + team.displayName;
        teamClaimPicker.append(option);
      });
      teamClaimButton.disabled = teams.length === 0;
      teamClaimStatus.textContent = teams.length ? "" : "No teams are available to claim.";
    };

    const renderLiveRoomSetup = selectedLeague => {
      const room = selectedLeague.liveDraft;
      const hasRoom = Boolean(room?.roomId);
      state.setupLocked = hasRoom;
      setHidden(createLiveRoomButton, hasRoom);
      setHidden(openSetupLiveRoom, !hasRoom);
      draftStartsAtInput.disabled = hasRoom;
      setupRowsInput.disabled = hasRoom;
      setupPreviewButton.disabled = hasRoom;
      setupApplyButton.disabled = true;
      screenshotImportFile.disabled = hasRoom;
      screenshotAnalyzeButton.disabled = hasRoom;
      screenshotApplyButton.disabled = hasRoom || state.screenshotImport === null;
      screenshotLeagueName.disabled = hasRoom;
      screenshotLeagueId.disabled = hasRoom;
      screenshotReviewBody.querySelectorAll("input, select").forEach(control => { control.disabled = hasRoom; });
      if (hasRoom) {
        openSetupLiveRoom.href = draftRoomPathFor(selectedLeague.seasonId, room.roomId);
        liveRoomSetupStatus.textContent = "The shared draft room is ready.";
        setupStatus.textContent = "Team assignments are locked after the live draft room is created.";
      } else {
        openSetupLiveRoom.removeAttribute("href");
        liveRoomSetupStatus.textContent = "No live draft room has been created for this season.";
        setupStatus.textContent = "";
      }
    };

    const selectedLeagueFor = onboarding => {
      const requestedSeasonId = new URLSearchParams(window.location.search).get("seasonId");
      return onboarding.leagues.find(league => league.seasonId === requestedSeasonId)
        || onboarding.leagues[0]
        || null;
    };

    const renderSelectedLeague = selectedLeague => {
      if (state.selectedLeague?.seasonId !== selectedLeague?.seasonId) {
        state.workspaceRequestGeneration += 1;
        resetScreenshotReview({ clearFile: true, clearStatus: true });
        state.currentSeason = null;
        state.claimedTeamIds = new Set();
      }
      state.selectedLeague = selectedLeague;
      hideWorkspaces();
      if (routePath === "/invite") {
        setHidden(leagueContext, true);
        setHidden(commissionerNavItem, true);
        setHidden(byId("invite-workspace"), false);
        return;
      }
      if (!selectedLeague) {
        setHidden(leagueContext, true);
        setHidden(commissionerNavItem, true);
        setHidden(byId("empty-leagues"), false);
        return;
      }

      const membership = selectedLeague.membership;
      setHidden(leagueContext, false);
      byId("my-team-name").textContent = membership.teamDisplayName || "Not assigned";
      byId("membership-role").textContent = titleCase(membership.role);
      commissionerNavItem.classList.toggle("hidden", !selectedLeague.canManageLeague);
      updateNavigation(selectedLeague);

      if (routePath === "/setup") {
        if (selectedLeague.canManageLeague) {
          const requestGeneration = state.workspaceRequestGeneration;
          const seasonId = selectedLeague.seasonId;
          byId("setup-season-id-input").value = selectedLeague.seasonId;
          renderInvitationRows(selectedLeague.invitations || []);
          renderLiveRoomSetup(selectedLeague);
          setHidden(byId("setup-workspace"), false);
          fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId), { credentials: "same-origin" })
            .then(readJson)
            .then(body => {
              if (isCurrentSetupRequest(seasonId, requestGeneration)) renderSeasonTeams(body.season);
            })
            .catch(error => {
              if (isCurrentSetupRequest(seasonId, requestGeneration)) setupTeamSummary.textContent = error.message;
            });
          loadSeasonInvitations(seasonId, requestGeneration).catch(error => {
            if (isCurrentSetupRequest(seasonId, requestGeneration)) setupStatus.textContent = error.message;
          });
        } else {
          setHidden(byId("setup-access-denied"), false);
        }
        return;
      }

      const feature = featureRoutes[routePath];
      if (feature) {
        byId("feature-eyebrow").textContent = feature[0];
        byId("feature-title").textContent = feature[1];
        byId("feature-description").textContent = feature[2];
        byId("feature-empty-state").textContent = "This workspace is ready for " + selectedLeague.leagueName + ".";
        setHidden(byId("feature-workspace"), false);
        return;
      }

      byId("league-name").textContent = selectedLeague.leagueName;
      byId("league-season").textContent = selectedLeague.seasonYear + " season";
      renderReadiness("league-setup-readiness", selectedLeague.readiness.leagueSetup);
      renderReadiness("team-claim-readiness", selectedLeague.readiness.teamClaim);
      renderReadiness("live-draft-readiness", selectedLeague.readiness.liveDraft);
      byId("next-draft-at").textContent = selectedLeague.nextDraftAt
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedLeague.nextDraftAt))
        : "No draft time scheduled.";

      const needsTeamClaim = !membership.teamId;
      setHidden(teamClaimPanel, !needsTeamClaim);
      if (needsTeamClaim) {
        loadClaimableTeams(selectedLeague).catch(error => {
          teamClaimButton.disabled = true;
          teamClaimStatus.textContent = error.message;
        });
      }

      const liveDraftButton = byId("open-live-draft-button");
      const roomId = selectedLeague.liveDraft?.roomId;
      if (roomId) {
        liveDraftButton.href = draftRoomPathFor(selectedLeague.seasonId, roomId);
        liveDraftButton.textContent = "Open live draft";
        liveDraftButton.removeAttribute("aria-disabled");
        liveDraftButton.removeAttribute("tabindex");
      } else {
        liveDraftButton.textContent = selectedLeague.canManageLeague ? "Finish draft setup" : "Draft room not ready";
        if (selectedLeague.canManageLeague) {
          liveDraftButton.href = "/setup?seasonId=" + encodeURIComponent(selectedLeague.seasonId);
          liveDraftButton.removeAttribute("aria-disabled");
          liveDraftButton.removeAttribute("tabindex");
        } else {
          liveDraftButton.removeAttribute("href");
          liveDraftButton.setAttribute("aria-disabled", "true");
          liveDraftButton.setAttribute("tabindex", "-1");
        }
      }
      setHidden(byId("league-workspace"), false);
    };

    const renderLeaguePicker = onboarding => {
      leaguePicker.replaceChildren();
      onboarding.leagues.forEach(league => {
        const option = document.createElement("option");
        option.value = league.seasonId;
        option.textContent = league.leagueName + " · " + league.seasonYear;
        leaguePicker.append(option);
      });
      if (state.selectedLeague) leaguePicker.value = state.selectedLeague.seasonId;
    };

    const loadOnboarding = async () => {
      clearAppError();
      appStatus.textContent = "Loading your league...";
      const onboarding = await readJson(await fetch("/onboarding", { credentials: "same-origin" }));
      state.onboarding = onboarding;
      state.selectedLeague = selectedLeagueFor(onboarding);
      renderLeaguePicker(onboarding);
      renderSelectedLeague(state.selectedLeague);
      appStatus.textContent = onboarding.leagues.length ? "" : "No league memberships found.";
    };

    const showSignedInApp = async account => {
      state.account = account;
      document.body.dataset.sessionState = "signed-in";
      byId("account-email").textContent = account.email;
      setHidden(bootPanel, true);
      setHidden(authPanel, true);
      setHidden(appHeader, false);
      setHidden(appShell, false);
      markCurrentNavigation();
      await loadOnboarding();
    };

    const login = async () => {
      const body = await readJson(await fetch("/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value }),
      }));
      return body.account;
    };

    const signupInvitationToken = () => {
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      if (!returnTo) return null;
      const invitationUrl = new URL(returnTo, window.location.origin);
      return invitationUrl.pathname === "/invite" ? invitationUrl.searchParams.get("token") : null;
    };

    const finishAuthentication = account => {
      if (routePath === "/login" || routePath === "/signup") {
        window.location.assign(authenticationReturnPath());
        return;
      }
      return showSignedInApp(account);
    };

    authForm.addEventListener("submit", event => {
      event.preventDefault();
      setHidden(authError, true);
      authSubmitButton.disabled = true;
      const accountRequest = signupMode
        ? fetch("/accounts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              email: emailInput.value,
              password: passwordInput.value,
              invitationToken: signupInvitationToken(),
            }),
          }).then(readJson).then(login)
        : login();
      accountRequest
        .then(finishAuthentication)
        .catch(error => {
          authError.textContent = error.message;
          setHidden(authError, false);
        })
        .finally(() => { authSubmitButton.disabled = false; });
    });

    byId("sign-out-button").addEventListener("click", () => {
      fetch("/session", { method: "DELETE", credentials: "same-origin" })
        .finally(() => window.location.assign("/login"));
    });

    byId("account-settings-button").addEventListener("click", () => {
      passwordChangeForm.reset();
      passwordChangeStatus.textContent = "";
      passwordChangeStatus.className = "status";
      passwordDialog.showModal();
      currentPasswordInput.focus();
    });

    const closePasswordDialog = () => passwordDialog.close();
    byId("password-dialog-close").addEventListener("click", closePasswordDialog);
    byId("password-dialog-cancel").addEventListener("click", closePasswordDialog);
    passwordDialog.addEventListener("close", () => {
      passwordChangeForm.reset();
      passwordChangeStatus.textContent = "";
    });

    passwordChangeForm.addEventListener("submit", event => {
      event.preventDefault();
      passwordChangeSubmit.disabled = true;
      passwordChangeStatus.className = "status";
      passwordChangeStatus.textContent = "Updating password...";
      fetch("/session/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          currentPassword: currentPasswordInput.value,
          newPassword: newPasswordInput.value,
          newPasswordConfirmation: confirmPasswordInput.value,
        }),
      }).then(readJson)
        .then(() => window.location.assign("/login?passwordChanged=1"))
        .catch(error => {
          passwordChangeStatus.className = "error";
          passwordChangeStatus.textContent = error.message;
        })
        .finally(() => { passwordChangeSubmit.disabled = false; });
    });

    byId("retry-onboarding-button").addEventListener("click", () => {
      loadOnboarding().catch(error => showAppError(error.message));
    });

    leaguePicker.addEventListener("change", () => {
      const selectedLeague = state.onboarding.leagues.find(league => league.seasonId === leaguePicker.value) || null;
      renderSelectedLeague(selectedLeague);
      if (selectedLeague) {
        const query = new URLSearchParams(window.location.search);
        query.set("seasonId", selectedLeague.seasonId);
        window.history.replaceState(null, "", routePath + "?" + query.toString());
      }
    });

    const setupEndpoint = action => "/seasons/" + encodeURIComponent(byId("setup-season-id-input").value) + "/setup-import/" + action;
    const screenshotMaxBytes = 5 * 1024 * 1024;
    const screenshotMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

    const isCurrentSetupRequest = (seasonId, requestGeneration) =>
      state.workspaceRequestGeneration === requestGeneration &&
      state.selectedLeague?.seasonId === seasonId &&
      byId("setup-season-id-input").value === seasonId;

    const resetScreenshotReview = (options = {}) => {
      state.screenshotRequestGeneration += 1;
      state.screenshotImport = null;
      state.screenshotImportRevision = null;
      state.screenshotTeamProfiles = [];
      screenshotReviewBody.replaceChildren();
      renderScreenshotBlockers([]);
      setHidden(screenshotReview, true);
      screenshotApplyButton.disabled = true;
      if (state.screenshotPreviewUrl) URL.revokeObjectURL(state.screenshotPreviewUrl);
      state.screenshotPreviewUrl = null;
      screenshotSourcePreview.removeAttribute("src");
      setHidden(screenshotSourcePreview, true);
      if (options.clearFile) screenshotImportFile.value = "";
      if (options.clearStatus) screenshotImportStatus.textContent = "";
    };

    const renderScreenshotBlockers = blockers => {
      screenshotImportBlockers.replaceChildren();
      (blockers || []).forEach(blocker => {
        const item = document.createElement("li");
        item.textContent = blocker.message || "This row needs attention.";
        screenshotImportBlockers.append(item);
      });
    };

    const screenshotInput = (value, field, label, className) => {
      const input = document.createElement("input");
      input.value = String(value ?? "");
      input.dataset.field = field;
      input.setAttribute("aria-label", label);
      if (className) input.className = className;
      return input;
    };

    const screenshotReviewBlockers = () => {
      if (!state.screenshotImport) return ["Analyze a screenshot before applying teams."];
      const teams = state.screenshotImport.teams;
      const profileIds = new Set(state.screenshotTeamProfiles.map(profile => profile.teamId));
      const blockers = [];
      if (teams.length !== state.screenshotTeamProfiles.length) {
        blockers.push("The screenshot must contain one row for every existing Mockd profile.");
      }
      const teamNumbers = new Set();
      const targetTeamIds = new Set();
      const teamNames = new Set();
      const managerNames = new Set();
      teams.forEach((team, index) => {
        const rowNumber = index + 1;
        if (!Number.isInteger(team.draftOrderPosition) || team.draftOrderPosition < 1 || team.draftOrderPosition > teams.length) {
          blockers.push("Team row " + rowNumber + " needs a number from 1 to " + teams.length + ".");
        } else if (teamNumbers.has(team.draftOrderPosition)) {
          blockers.push("Team number " + team.draftOrderPosition + " appears more than once.");
        }
        teamNumbers.add(team.draftOrderPosition);
        const abbreviation = String(team.abbreviation || "").trim();
        if (!abbreviation) blockers.push("Team row " + rowNumber + " needs an abbreviation.");
        else if (abbreviation.length > 12) blockers.push("Team row " + rowNumber + " needs an abbreviation with 12 characters or fewer.");
        const teamName = String(team.teamDisplayName || "").trim();
        const teamNameKey = teamName.toLowerCase();
        if (!teamName) blockers.push("Team row " + rowNumber + " needs a team name.");
        else if (teamName.includes("...") || teamName.includes(String.fromCharCode(8230))) {
          blockers.push("Replace the truncated name in team row " + rowNumber + ".");
        }
        else if (teamNames.has(teamNameKey)) blockers.push("Team name " + teamName + " appears more than once.");
        teamNames.add(teamNameKey);
        const managers = (team.managerDisplayNames || []).map(name => name.trim()).filter(Boolean);
        if (!managers.length) blockers.push("Team row " + rowNumber + " needs at least one manager.");
        managers.forEach(manager => {
          const key = manager.toLowerCase();
          if (managerNames.has(key)) blockers.push("Manager " + manager + " appears on more than one team.");
          managerNames.add(key);
        });
        const targetTeamId = team.targetTeamId || "";
        if (!profileIds.has(targetTeamId)) blockers.push("Choose a Mockd profile for team row " + rowNumber + ".");
        else if (targetTeamIds.has(targetTeamId)) blockers.push("Each Mockd profile can be used only once.");
        targetTeamIds.add(targetTeamId);
        if ((team.confidence !== "high" || team.issues.length > 0) && team.confirmed !== true) {
          blockers.push("Verify the uncertain reading in team row " + rowNumber + ".");
        }
      });
      return [...new Set(blockers)];
    };

    const updateScreenshotReviewState = () => {
      const blockers = screenshotReviewBlockers();
      renderScreenshotBlockers(blockers.map(message => ({ message: message })));
      screenshotApplyButton.disabled = state.setupLocked || blockers.length > 0;
      screenshotImportStatus.textContent = blockers.length
        ? "Resolve " + blockers.length + " review item" + (blockers.length === 1 ? "." : "s.")
        : "Ready to apply " + state.screenshotImport.teams.length + " teams.";
    };

    const renderScreenshotReview = body => {
      const extraction = body.extraction || { leagueName: null, externalLeagueId: null, teams: [] };
      state.screenshotImport = {
        leagueName: extraction.leagueName,
        externalLeagueId: extraction.externalLeagueId,
        teams: (extraction.teams || []).map(team => ({
          ...team,
          managerDisplayNames: [...(team.managerDisplayNames || [])],
          issues: [...(team.issues || [])],
        })),
      };
      state.screenshotImportRevision = body.setupRevision || null;
      state.screenshotTeamProfiles = [...(body.availableTeamProfiles || [])];
      screenshotLeagueName.value = extraction.leagueName || "";
      screenshotLeagueId.value = extraction.externalLeagueId || "";
      screenshotReviewBody.replaceChildren();
      state.screenshotImport.teams.forEach((team, index) => {
        const row = document.createElement("tr");
        row.className = "screenshot-review-row";
        row.dataset.index = String(index);
        const needsReview = team.confidence !== "high" || team.issues.length > 0;
        row.dataset.needsReview = String(needsReview);

        const pickCell = document.createElement("td");
        const pickInput = screenshotInput(team.draftOrderPosition, "draftOrderPosition", "Team number for row " + (index + 1));
        pickInput.type = "number";
        pickInput.min = "1";
        pickInput.step = "1";
        pickCell.append(pickInput);

        const abbreviationCell = document.createElement("td");
        const abbreviationInput = screenshotInput(team.abbreviation, "abbreviation", "Abbreviation for team " + (index + 1));
        abbreviationInput.maxLength = 12;
        abbreviationCell.append(abbreviationInput);

        const teamCell = document.createElement("td");
        teamCell.append(screenshotInput(team.teamDisplayName, "teamDisplayName", "Team name for row " + (index + 1), "team-name-input"));

        const managerCell = document.createElement("td");
        managerCell.append(screenshotInput(
          team.managerDisplayNames.join("; "),
          "managerDisplayNames",
          "Managers for team " + (index + 1),
          "manager-names-input",
        ));

        const profileCell = document.createElement("td");
        const profileSelect = document.createElement("select");
        profileSelect.dataset.field = "targetTeamId";
        profileSelect.setAttribute("aria-label", "Mockd profile for team row " + (index + 1));
        const emptyProfile = document.createElement("option");
        emptyProfile.value = "";
        emptyProfile.textContent = "Choose profile";
        profileSelect.append(emptyProfile);
        state.screenshotTeamProfiles.forEach(profile => {
          const option = document.createElement("option");
          option.value = profile.teamId;
          option.textContent = profile.ownerDisplayName + " · " + profile.teamDisplayName;
          profileSelect.append(option);
        });
        profileSelect.value = team.targetTeamId || "";
        profileCell.append(profileSelect);

        const reviewCell = document.createElement("td");
        reviewCell.className = "review-cell";
        if (needsReview) {
          const note = document.createElement("span");
          note.className = "review-note";
          note.textContent = team.issues.length
            ? team.issues.join(" ")
            : "The screenshot reading was not fully confident.";
          const label = document.createElement("label");
          label.className = "confirmation-label";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = team.confirmed === true;
          checkbox.dataset.field = "confirmed";
          const labelText = document.createElement("span");
          labelText.textContent = "I verified this row";
          label.append(checkbox, labelText);
          reviewCell.append(note, label);
        } else {
          const ready = document.createElement("span");
          ready.className = "ready";
          ready.textContent = "Clear";
          reviewCell.append(ready);
        }

        row.append(pickCell, abbreviationCell, teamCell, managerCell, profileCell, reviewCell);
        screenshotReviewBody.append(row);
      });
      setHidden(screenshotSourcePreview, !state.screenshotPreviewUrl);
      setHidden(screenshotReview, false);
      updateScreenshotReviewState();
    };

    const imageBase64For = file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("error", () => reject(new Error("The screenshot could not be read.")));
      reader.addEventListener("load", () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const separator = result.indexOf(",");
        if (separator < 0) {
          reject(new Error("The screenshot could not be read."));
          return;
        }
        resolve(result.slice(separator + 1));
      });
      reader.readAsDataURL(file);
    });

    screenshotAnalyzeButton.addEventListener("click", async () => {
      const file = screenshotImportFile.files?.[0];
      if (!file) {
        screenshotImportStatus.textContent = "Choose a screenshot first.";
        screenshotImportFile.focus();
        return;
      }
      if (!screenshotMimeTypes.has(file.type)) {
        screenshotImportStatus.textContent = "Choose a PNG, JPEG, or WebP screenshot.";
        return;
      }
      if (file.size > screenshotMaxBytes) {
        screenshotImportStatus.textContent = "Choose a screenshot smaller than 5 MB.";
        return;
      }

      resetScreenshotReview();
      const requestGeneration = state.screenshotRequestGeneration;
      const requestedSeasonId = byId("setup-season-id-input").value;
      state.screenshotPreviewUrl = URL.createObjectURL(file);
      screenshotSourcePreview.src = state.screenshotPreviewUrl;
      screenshotAnalyzeButton.disabled = true;
      screenshotImportStatus.textContent = "Reading teams from the screenshot...";
      try {
        const base64 = await imageBase64For(file);
        const body = await readJson(await fetch(setupEndpoint("screenshot-analyze"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ mimeType: file.type, base64: base64 }),
        }));
        if (
          requestGeneration !== state.screenshotRequestGeneration ||
          requestedSeasonId !== byId("setup-season-id-input").value
        ) return;
        screenshotImportFile.value = "";
        renderScreenshotReview(body);
      } catch (error) {
        if (requestGeneration === state.screenshotRequestGeneration) {
          screenshotImportStatus.textContent = error.message;
        }
      } finally {
        screenshotAnalyzeButton.disabled = state.setupLocked;
      }
    });

    screenshotLeagueName.addEventListener("input", () => {
      if (state.screenshotImport) state.screenshotImport.leagueName = screenshotLeagueName.value.trim() || null;
    });
    screenshotLeagueId.addEventListener("input", () => {
      if (state.screenshotImport) state.screenshotImport.externalLeagueId = screenshotLeagueId.value.trim() || null;
    });
    screenshotReviewBody.addEventListener("input", event => {
      const control = event.target.closest("[data-field]");
      const row = control?.closest("tr[data-index]");
      const team = row && state.screenshotImport?.teams[Number(row.dataset.index)];
      if (!control || !team) return;
      if (control.dataset.field === "draftOrderPosition") {
        team.draftOrderPosition = Number(control.value);
      } else if (control.dataset.field === "managerDisplayNames") {
        team.managerDisplayNames = control.value.split(";").map(value => value.trim()).filter(Boolean);
      } else if (control.dataset.field === "confirmed") {
        team.confirmed = control.checked;
      } else if (control.dataset.field === "targetTeamId") {
        team.targetTeamId = control.value || null;
      } else {
        team[control.dataset.field] = control.value;
      }
      updateScreenshotReviewState();
    });
    screenshotReviewBody.addEventListener("change", event => {
      if (event.target.matches('input[data-field="confirmed"], select[data-field="targetTeamId"]')) {
        event.target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });

    screenshotApplyButton.addEventListener("click", async () => {
      if (!state.screenshotImport) return;
      const requestedSeasonId = byId("setup-season-id-input").value;
      const requestGeneration = state.screenshotRequestGeneration;
      const workspaceRequestGeneration = state.workspaceRequestGeneration;
      screenshotApplyButton.disabled = true;
      screenshotImportStatus.textContent = "Applying league teams...";
      try {
        const body = await readJson(await fetch(setupEndpoint("screenshot-apply"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            ...state.screenshotImport,
            setupRevision: state.screenshotImportRevision,
          }),
        }));
        if (
          requestGeneration !== state.screenshotRequestGeneration ||
          !isCurrentSetupRequest(requestedSeasonId, workspaceRequestGeneration)
        ) return;
        resetScreenshotReview({ clearFile: true });
        renderSeasonTeams(body.season);
        screenshotImportStatus.textContent = body.season.teams.length + " teams imported. You can create manager invite links next.";
        await loadOnboarding();
      } catch (error) {
        if (
          requestGeneration !== state.screenshotRequestGeneration ||
          !isCurrentSetupRequest(requestedSeasonId, workspaceRequestGeneration)
        ) return;
        renderScreenshotBlockers(error.body?.import?.blockers || []);
        screenshotImportStatus.textContent = error.message;
        screenshotApplyButton.disabled = true;
      }
    });

    const loadSeasonInvitations = async (seasonId, requestGeneration = state.workspaceRequestGeneration) => {
      const body = await readJson(await fetch("/invitations?seasonId=" + encodeURIComponent(seasonId), {
        credentials: "same-origin",
      }));
      if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
      state.claimedTeamIds = new Set(body.claimedTeamIds || []);
      renderInvitationRows(body.invitations || []);
      if (state.currentSeason?.id === seasonId) renderSeasonTeams(state.currentSeason);
    };

    const renderSetupResult = body => {
      const setupImport = body.import || {};
      const blockers = setupImport.blockers || [];
      const records = setupImport.records || [];
      setupApplyButton.disabled = state.setupLocked || setupImport.status !== "ready" || Boolean(body.season);
      setupStatus.textContent = body.season
        ? (body.invitationFailures?.length
            ? "League setup updated, but some invitations need to be retried."
            : "League setup updated.")
        : state.setupLocked
          ? "Team assignments are locked after the live draft room is created."
          : setupImport.status === "ready" ? "Ready to apply." : "Resolve the listed rows.";
      setupBlockers.replaceChildren();
      blockers.forEach(blocker => {
        const item = document.createElement("li");
        item.textContent = blocker.message || "This row needs attention.";
        setupBlockers.append(item);
      });
      (body.invitationFailures || []).forEach(failure => {
        const item = document.createElement("li");
        item.textContent = failure.email + ": " + failure.message;
        setupBlockers.append(item);
      });
      setupPreviewBody.replaceChildren();
      records.forEach(record => {
        const row = document.createElement("tr");
        [record.ownerDisplayName, record.teamDisplayName, record.email || "No email", titleCase(record.role)]
          .forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.append(cell);
          });
        setupPreviewBody.append(row);
      });
      setHidden(setupPreviewTable, records.length === 0);
      if (body.invitations) renderInvitationRows(body.invitations);
    };

    const submitSetup = async action => {
      const seasonId = byId("setup-season-id-input").value;
      const requestGeneration = state.workspaceRequestGeneration;
      setupStatus.textContent = action === "preview" ? "Checking owner rows..." : "Updating league setup...";
      let body;
      try {
        body = await readJson(await fetch(
          "/seasons/" + encodeURIComponent(seasonId) + "/setup-import/" + action,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ content: setupRowsInput.value }),
          },
        ));
      } catch (error) {
        if (isCurrentSetupRequest(seasonId, requestGeneration)) throw error;
        return;
      }
      if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
      renderSetupResult(body);
    };

    byId("setup-preview-button").addEventListener("click", () => {
      submitSetup("preview").catch(error => {
        setupApplyButton.disabled = true;
        setupStatus.textContent = error.message;
      });
    });

    setupApplyButton.addEventListener("click", () => {
      submitSetup("apply").catch(error => { setupStatus.textContent = error.message; });
    });

    teamClaimButton.addEventListener("click", async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague || !teamClaimPicker.value) return;
      const selectedOption = teamClaimPicker.selectedOptions[0];
      if (!selectedOption?.dataset.ownerId) return;
      teamClaimButton.disabled = true;
      teamClaimStatus.textContent = "Claiming your team...";
      try {
        await readJson(await fetch(
          "/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/team-claims",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              ownerId: selectedOption.dataset.ownerId,
              teamId: teamClaimPicker.value,
            }),
          },
        ));
        await loadOnboarding();
      } catch (error) {
        teamClaimStatus.textContent = error.message;
        teamClaimButton.disabled = false;
      }
    });

    createLiveRoomButton.addEventListener("click", async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) return;
      createLiveRoomButton.disabled = true;
      liveRoomSetupStatus.textContent = "Creating the shared draft room...";
      try {
        const startsAt = draftStartsAtInput.value;
        const body = await readJson(await fetch("/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/live-room", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
        }));
        const room = body.room;
        window.location.assign(draftRoomPathFor(selectedLeague.seasonId, room.roomId));
      } catch (error) {
        liveRoomSetupStatus.textContent = error.message;
        createLiveRoomButton.disabled = false;
      }
    });

    invitationForm.addEventListener("submit", async event => {
      event.preventDefault();
      const seasonId = byId("setup-season-id-input").value;
      const requestGeneration = state.workspaceRequestGeneration;
      if (!seasonId || !invitationTeamPicker.value) return;
      createInvitationButton.disabled = true;
      invitationCreateStatus.textContent = "Creating invite link...";
      try {
        const body = await readJson(await fetch("/invitations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            seasonId: seasonId,
            teamId: invitationTeamPicker.value,
            email: invitationEmailInput.value,
          }),
        }));
        if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
        const invitation = body.invitation;
        renderInvitationRows([
          ...state.invitations.filter(candidate => !(
            candidate.status === "pending"
              && (candidate.email === invitation.email || candidate.teamDisplayName === invitation.teamDisplayName)
          )),
          invitation,
        ]);
        invitationEmailInput.value = "";
        invitationCreateStatus.textContent = "Invite link created. Copy it before leaving this page.";
      } catch (error) {
        if (isCurrentSetupRequest(seasonId, requestGeneration)) {
          invitationCreateStatus.textContent = error.message;
        }
      } finally {
        if (isCurrentSetupRequest(seasonId, requestGeneration)) {
          createInvitationButton.disabled = invitationTeamPicker.options.length === 0;
        }
      }
    });

    setupInvitations.addEventListener("click", event => {
      const button = event.target.closest("button[data-invitation-action]");
      if (!button) return;
      const seasonId = byId("setup-season-id-input").value;
      const requestGeneration = state.workspaceRequestGeneration;
      const invitation = state.invitations.find(candidate => candidate.id === button.dataset.invitationId);
      if (!invitation || invitation.seasonId !== seasonId) return;
      if (button.dataset.invitationAction === "copy") {
        navigator.clipboard.writeText(new URL(invitation.acceptPath, window.location.origin).toString())
          .then(() => {
            if (isCurrentSetupRequest(seasonId, requestGeneration)) setupStatus.textContent = "Invite link copied.";
          })
          .catch(() => {
            if (isCurrentSetupRequest(seasonId, requestGeneration)) setupStatus.textContent = "Could not copy the invite link.";
          });
        return;
      }
      button.disabled = true;
      const actionPath = button.dataset.invitationAction === "revoke"
        ? invitation.revokePath
        : invitation.reissuePath;
      fetch(actionPath, { method: "POST", credentials: "same-origin" }).then(readJson)
        .then(body => {
          if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
          const updatedInvitation = body.invitation || body;
          renderInvitationRows(state.invitations.map(candidate => candidate.id === invitation.id ? updatedInvitation : candidate));
          setupStatus.textContent = button.dataset.invitationAction === "revoke"
            ? "Invitation revoked."
            : "Invitation reissued.";
        })
        .catch(error => {
          if (isCurrentSetupRequest(seasonId, requestGeneration)) setupStatus.textContent = error.message;
        })
        .finally(() => {
          if (isCurrentSetupRequest(seasonId, requestGeneration) && button.isConnected) button.disabled = false;
        });
    });

    byId("accept-invitation-button").addEventListener("click", () => {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        byId("invite-status").textContent = "This invitation link is missing its token.";
        return;
      }
      byId("invite-status").textContent = "Joining league...";
      fetch("/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token: token }),
      }).then(readJson)
        .then(body => window.location.assign("/app?seasonId=" + encodeURIComponent(body.membership.seasonId || body.invitation.seasonId)))
        .catch(error => { byId("invite-status").textContent = error.message; });
    });

    configureAuthMode();
    fetch("/session", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(body => {
        if (body && body.account) {
          Promise.resolve(finishAuthentication(body.account)).catch(error => showAppError(error.message));
        } else {
          showAuth();
        }
      })
      .catch(() => showAuth());
  </script>
</body>
</html>`;
