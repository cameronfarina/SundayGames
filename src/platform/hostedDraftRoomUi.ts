export const platformHostedDraftRoomHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Live draft | Mockd</title>
  <style>
    :root {
      color-scheme: dark;
      --page: #08090b;
      --surface: #101216;
      --surface-raised: #171a20;
      --surface-soft: #0c1014;
      --line: #2b3039;
      --line-strong: #454b57;
      --text: #f3f5f7;
      --muted: #a5acb8;
      --accent: #67d8b0;
      --accent-strong: #88edc8;
      --accent-soft: #10281f;
      --cyan: #71b7ff;
      --green: #67d8b0;
      --amber: #f4c86b;
      --red: #ff8c9b;
      --focus: #71b7ff;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-width: 0;
      background: var(--page);
      color: var(--text);
    }

    button, input, select { font: inherit; }

    button, input, select {
      min-height: 40px;
      border: 1px solid var(--line-strong);
      border-radius: 5px;
      background: var(--surface-soft);
      color: var(--text);
    }

    input, select {
      width: 100%;
      padding: 8px 10px;
    }

    button {
      padding: 8px 13px;
      cursor: pointer;
      font-weight: 750;
    }

    button:hover:not(:disabled) {
      border-color: var(--accent);
      background: var(--accent-soft);
    }

    button:disabled { cursor: not-allowed; opacity: 0.46; }

    button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }

    .primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #0b0710;
    }

    .danger { border-color: #8c3a45; color: #ffb0b5; }
    .quiet { color: var(--muted); }
    .hidden, [hidden] { display: none !important; }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .draft-shell {
      width: min(1540px, 100%);
      margin: 0 auto;
      padding: 0 16px 32px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 64px;
      padding: 12px 0;
      border-bottom: 1px solid var(--line);
    }

    .brand {
      color: var(--text);
      font-size: 22px;
      font-weight: 850;
      text-decoration: none;
    }

    .product-nav {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      border-bottom: 1px solid var(--line);
      scrollbar-width: thin;
    }

    .product-nav-link {
      flex: 0 0 auto;
      padding: 14px 10px 11px;
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
    }

    .product-nav-link:hover { color: var(--text); }

    .product-nav-link[aria-current="page"] {
      border-bottom-color: var(--accent);
      color: var(--text);
    }

    .draft-heading { padding: 16px 0 2px; }
    .draft-header-main { min-width: 0; }

    .eyebrow {
      margin: 0 0 4px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 26px; line-height: 1.15; overflow-wrap: anywhere; }
    h2 { font-size: 16px; }
    h3 { font-size: 14px; }

    .draft-header-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .header-link {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 8px 11px;
      border: 1px solid var(--line-strong);
      border-radius: 5px;
      color: var(--text);
      font-size: 13px;
      font-weight: 750;
      text-decoration: none;
    }

    .header-link:hover { border-color: var(--accent); background: var(--accent-soft); }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 5px 10px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .connection-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--amber);
    }

    #draft-connection-status[data-state="connected"] { color: var(--green); }
    #draft-connection-status[data-state="connected"] .connection-dot { background: var(--green); }
    #draft-connection-status[data-state="offline"] { color: var(--red); }
    #draft-connection-status[data-state="offline"] .connection-dot { background: var(--red); }

    .panel {
      border: 1px solid var(--line);
      border-radius: 7px;
      background: var(--surface);
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 48px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
    }

    .panel-body { padding: 14px; }

    .draft-command-panel {
      position: sticky;
      z-index: 5;
      top: 0;
      margin: 14px 0;
      border-color: #31594c;
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
    }

    .sale-form-row {
      display: grid;
      grid-template-columns: minmax(220px, 1fr) auto;
      gap: 9px;
      align-items: end;
    }

    .field-label {
      display: grid;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
    }

    .command-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    .complete-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .complete-copy {
      display: grid;
      gap: 4px;
    }

    .complete-copy span { color: var(--muted); line-height: 1.45; }

    .complete-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .member-command-note {
      color: var(--muted);
      line-height: 1.45;
    }

    .feedback {
      min-height: 20px;
      margin-top: 8px;
      color: var(--muted);
      font-size: 13px;
    }

    .feedback[data-tone="error"] { color: var(--red); }
    .feedback[data-tone="success"] { color: var(--green); }

    .draft-main-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.75fr) minmax(300px, 0.75fr);
      grid-template-areas:
        "status status"
        "board team"
        "board sales";
      gap: 12px;
      align-items: start;
    }

    .status-panel { grid-area: status; }
    .board-panel { grid-area: board; min-width: 0; }
    .team-panel { grid-area: team; min-width: 0; }
    .sales-panel { grid-area: sales; min-width: 0; }

    .room-status-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      background: var(--line);
    }

    .status-metric {
      min-width: 0;
      padding: 12px 14px;
      background: var(--surface);
    }

    .status-metric span {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 750;
      text-transform: uppercase;
    }

    .status-metric strong { display: block; overflow-wrap: anywhere; }

    .board-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }

    .board-scroll {
      max-height: 720px;
      overflow: auto;
      overscroll-behavior: contain;
    }

    table { width: 100%; border-collapse: collapse; }

    th, td {
      padding: 9px 10px;
      border-bottom: 1px solid #232631;
      text-align: left;
      vertical-align: middle;
    }

    th {
      position: sticky;
      z-index: 2;
      top: 0;
      background: var(--surface-raised);
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
    }

    tbody tr:hover { background: #171822; }
    .money { text-align: right; font-variant-numeric: tabular-nums; }
    .player-name { font-weight: 750; }
    .player-meta { color: var(--muted); font-size: 12px; }
    .position { color: var(--cyan); font-size: 12px; font-weight: 800; }

    .use-player {
      width: 36px;
      min-height: 34px;
      padding: 0;
      color: var(--green);
      font-size: 21px;
    }

    .mobile-board { display: none; }

    .team-picker { margin-bottom: 14px; }

    .current-team-note {
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
    }

    .team-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      padding: 10px 0 14px;
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .team-metric { min-width: 0; padding: 0 9px; border-right: 1px solid var(--line); }
    .team-metric:first-child { padding-left: 0; }
    .team-metric:last-child { padding-right: 0; border-right: 0; }
    .team-metric span { display: block; color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .team-metric strong { display: block; margin-top: 3px; overflow-wrap: anywhere; }

    .roster-list, .sales-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .roster-list { margin-top: 10px; }

    .roster-row {
      display: grid;
      grid-template-columns: 52px minmax(0, 1fr) auto;
      gap: 9px;
      align-items: center;
      min-height: 39px;
      padding: 7px 0;
      border-bottom: 1px solid #232631;
    }

    .slot-label { color: var(--accent); font-size: 12px; font-weight: 800; }
    .empty-slot { color: #777b88; }

    .sale-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #232631;
    }

    .sale-row:first-child { padding-top: 0; }
    .sale-player { font-weight: 750; }
    .sale-meta { margin-top: 3px; color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .sale-price { color: var(--green); font-weight: 800; }

    .sales-filter { margin-bottom: 10px; }

    .sales-scroll {
      max-height: 420px;
      overflow: auto;
      overscroll-behavior: contain;
      padding-right: 4px;
      scrollbar-width: thin;
    }

    .correction-form {
      display: grid;
      gap: 9px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
    }

    .correction-actions { display: flex; gap: 8px; }

    .loading-state, .empty-state {
      padding: 28px 16px;
      color: var(--muted);
      text-align: center;
    }

    .fatal-error {
      width: min(680px, 100%);
      margin: 32px auto;
      padding: 28px;
      border: 1px solid #87323d;
      border-radius: 6px;
      background: #241014;
    }

    .fatal-error h2 { margin-top: 4px; font-size: 20px; }

    .fatal-error-message {
      margin-top: 10px;
      color: #ffb8bd;
      line-height: 1.5;
    }

    .fatal-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 20px;
    }

    .primary-link {
      border-color: var(--accent);
      background: var(--accent);
      color: #0b0710;
    }

    .download-link { display: none; }

    @media (max-width: 960px) {
      .draft-main-grid {
        grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
      }

      .room-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 700px) {
      button, input, select { min-height: 44px; }

      .draft-shell {
        width: 100%;
        padding: 0 0 24px;
      }

      .topbar { padding: 10px 12px; }
      .product-nav { padding: 0 4px; }
      .draft-heading { padding: 14px 12px 2px; }
      .draft-header-meta { gap: 7px; }
      .header-link { min-height: 44px; }
      .account-chip { display: none; }
      h1 { font-size: 22px; }

      .draft-command-panel {
        position: static;
        margin: 0;
        border-right: 0;
        border-left: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .sale-form-row { grid-template-columns: minmax(0, 1fr); }
      .sale-form-row .primary { width: 100%; }
      .command-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .complete-actions { align-items: stretch; flex-direction: column; }
      .complete-buttons { display: grid; grid-template-columns: minmax(0, 1fr); }
      .complete-buttons > * { justify-content: center; width: 100%; }

      .draft-main-grid {
        grid-template-columns: minmax(0, 1fr);
        grid-template-areas: "status" "board" "team" "sales";
        gap: 8px;
        margin-top: 8px;
      }

      .panel { border-right: 0; border-left: 0; border-radius: 0; }
      .room-status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .status-metric { padding: 10px 12px; }
      .panel-body { padding: 12px; }
      .board-controls { grid-template-columns: minmax(0, 1fr) 126px; padding: 9px 12px; }

      .desktop-board { display: none; }
      .mobile-board {
        display: block;
        max-height: 58vh;
        overflow: auto;
        overscroll-behavior: contain;
      }
      .board-scroll { max-height: none; overflow: visible; }

      .player-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 9px;
        align-items: center;
        min-height: 58px;
        padding: 8px 12px;
        border-bottom: 1px solid #232631;
      }

      .player-card-actionable { grid-template-columns: 40px minmax(0, 1fr) auto; }

      .player-card-prices { display: grid; gap: 2px; justify-items: end; }
      .player-card-price { font-weight: 800; font-variant-numeric: tabular-nums; }
      .player-card-market { color: var(--muted); font-size: 11px; }
      .sales-scroll { max-height: 320px; }
      .roster-list { max-height: 240px; overflow: auto; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  </style>
</head>
<body>
  <main class="draft-shell" id="draft-room-view" data-platform-live-room aria-labelledby="draft-room-title">
    <header class="topbar">
      <a class="brand" id="draft-brand" href="/app">Mockd</a>
      <div class="draft-header-meta">
        <span class="status-chip account-chip" id="draft-account">Checking account</span>
        <span class="status-chip" id="draft-connection-status" role="status" aria-live="polite" data-state="reconnecting">
          <span class="connection-dot" aria-hidden="true"></span>
          <span id="draft-connection-label">Connecting</span>
        </span>
        <button id="draft-sign-out" type="button" hidden>Sign out</button>
      </div>
    </header>
    <nav class="product-nav" aria-label="Primary">
      <a class="product-nav-link" id="draft-nav-board" href="/board">Board</a>
      <a class="product-nav-link" id="draft-league-home" href="/league">League</a>
      <a class="product-nav-link" id="draft-nav-my-team" href="/my-team">My Team</a>
      <span class="product-nav-link" aria-current="page">Live draft</span>
    </nav>
    <div class="draft-heading draft-header-main">
      <p class="eyebrow">Live draft room</p>
      <h1 id="draft-room-title">Opening draft room</h1>
    </div>

    <section class="fatal-error" id="draft-fatal-error" role="alert" hidden aria-labelledby="draft-fatal-heading">
      <p class="eyebrow">Draft room unavailable</p>
      <h2 id="draft-fatal-heading">We could not open this room</h2>
      <p class="fatal-error-message" id="draft-fatal-message"></p>
      <div class="fatal-actions">
        <a class="header-link primary-link" id="draft-sign-in-link" href="/login">Sign in</a>
        <a class="header-link" id="draft-fatal-league-home" href="/app">League home</a>
      </div>
    </section>

    <div id="draft-room-content">
      <section class="panel draft-command-panel" aria-labelledby="draft-command-heading">
      <div class="panel-header">
        <h2 id="draft-command-heading">Draft command</h2>
        <span class="quiet" id="draft-access-label">Loading access</span>
      </div>
      <div class="panel-body">
        <div id="draft-commissioner-controls" hidden>
          <form id="draft-sale-form">
            <div class="sale-form-row">
              <label class="field-label" for="draft-sale-command">
                Sale command
                <input id="draft-sale-command" name="sale-command" type="text" autocomplete="off" placeholder="Cam drafted Puka Nacua for 62" disabled>
              </label>
              <button class="primary" id="draft-log-sale" type="submit" disabled>Log sale</button>
            </div>
          </form>
          <div class="command-actions" aria-label="Draft lifecycle controls">
            <button id="draft-start" type="button" disabled>Start draft</button>
            <button id="draft-pause" type="button" disabled>Pause draft</button>
            <button id="draft-undo" type="button" disabled>Undo latest sale</button>
            <button class="danger" id="draft-end" type="button" disabled>End draft</button>
          </div>
        </div>
        <div class="complete-actions" id="draft-complete-actions" hidden>
          <div class="complete-copy">
            <strong>Draft complete</strong>
            <span>Open My Team to see your final roster and which analysis is available.</span>
          </div>
          <div class="complete-buttons">
            <a class="header-link primary-link" id="draft-view-my-team" href="/my-team">View My Team</a>
            <button id="draft-export" type="button" disabled hidden>Export results CSV</button>
          </div>
        </div>
        <p class="member-command-note" id="draft-member-note">League members can follow the live board, sales, budgets, and rosters here.</p>
        <p class="feedback" id="draft-action-feedback" role="status" aria-live="polite"></p>
        <a class="download-link" id="draft-export-download" href="#">Download draft export</a>
      </div>
      </section>

      <div class="draft-main-grid">
      <section class="panel status-panel" aria-label="Draft status">
        <div class="room-status-grid">
          <div class="status-metric">
            <span>Status</span>
            <strong id="draft-room-status" role="status" aria-live="polite">Loading</strong>
          </div>
          <div class="status-metric">
            <span>Latest sale</span>
            <strong id="draft-latest-sale">No sales yet</strong>
          </div>
          <div class="status-metric">
            <span>Players available</span>
            <strong id="draft-available-count">--</strong>
          </div>
          <div class="status-metric">
            <span>Draft progress</span>
            <strong id="draft-progress">--</strong>
          </div>
        </div>
      </section>

      <section class="panel sales-panel" aria-labelledby="draft-sales-heading">
        <div class="panel-header">
          <h2 id="draft-sales-heading">All sales</h2>
          <span class="quiet" id="draft-sales-count">0</span>
        </div>
        <div class="panel-body">
          <div class="sales-filter">
            <label class="visually-hidden" for="draft-sales-search">Search all sales</label>
            <input id="draft-sales-search" type="search" autocomplete="off" placeholder="Search player, owner, team, or price">
          </div>
          <div class="sales-scroll" tabindex="0" aria-label="Complete sale ledger">
            <ol class="sales-list" id="draft-sales" aria-live="polite">
              <li class="empty-state">Sales will appear here for everyone.</li>
            </ol>
          </div>
          <form class="correction-form" id="draft-correction-form" hidden>
            <input id="draft-correction-sale-id" name="sale-id" type="hidden">
            <label class="field-label" for="draft-correction-command">
              Correct sale
              <input id="draft-correction-command" name="correction-command" type="text" autocomplete="off">
            </label>
            <div class="correction-actions">
              <button class="primary" id="draft-apply-correction" type="submit">Apply correction</button>
              <button id="draft-cancel-correction" type="button">Cancel</button>
            </div>
          </form>
        </div>
      </section>

      <aside class="panel team-panel" aria-labelledby="draft-team-heading">
        <div class="panel-header">
          <h2 id="draft-team-heading">Team</h2>
          <span class="quiet" id="draft-current-team">No claimed team</span>
        </div>
        <div class="panel-body">
          <label class="field-label team-picker" for="draft-team-select">
            View team
            <select id="draft-team-select" name="team" disabled>
              <option>Loading teams</option>
            </select>
          </label>
          <p class="current-team-note" id="draft-team-context">Your claimed team will be selected automatically.</p>
          <div class="team-metrics" aria-label="Selected team totals">
            <div class="team-metric"><span>Budget left</span><strong id="draft-team-budget">--</strong></div>
            <div class="team-metric"><span>Spent</span><strong id="draft-team-spent">--</strong></div>
            <div class="team-metric"><span>Open slots</span><strong id="draft-team-open-slots">--</strong></div>
          </div>
          <ol class="roster-list" id="draft-team-roster" aria-live="polite">
            <li class="empty-state">Roster slots will appear here.</li>
          </ol>
        </div>
      </aside>

      <section class="panel board-panel" aria-labelledby="draft-board-heading">
        <div class="panel-header">
          <h2 id="draft-board-heading">Available players</h2>
          <span class="quiet" id="draft-board-count">Loading board</span>
        </div>
        <div class="board-controls">
          <label class="visually-hidden" for="draft-player-search">Search available players</label>
          <input id="draft-player-search" type="search" autocomplete="off" placeholder="Search player, position, or NFL team">
          <label class="visually-hidden" for="draft-position-filter">Filter by position</label>
          <select id="draft-position-filter" aria-label="Filter available players by position">
            <option value="ALL">All positions</option>
            <option value="QB">QB</option>
            <option value="RB">RB</option>
            <option value="WR">WR</option>
            <option value="TE">TE</option>
            <option value="K">K</option>
            <option value="DST">DST</option>
          </select>
        </div>
        <div class="board-scroll desktop-board" tabindex="0" aria-label="Available player board">
          <table>
            <thead>
              <tr id="draft-board-head-row"><th scope="col">Player</th><th scope="col">Pos</th><th scope="col">NFL</th><th scope="col">Bye</th><th class="money" scope="col">Market</th><th class="money" scope="col">Our</th></tr>
            </thead>
            <tbody id="draft-board-rows">
              <tr><td colspan="6" class="loading-state">Loading players</td></tr>
            </tbody>
          </table>
        </div>
        <div class="mobile-board" id="draft-board-cards" aria-label="Available player board"></div>
      </section>
      </div>
    </div>
  </main>

  <script type="module">
    const query = new URLSearchParams(window.location.search);
    const seasonId = query.get("seasonId");
    const roomId = query.get("roomId");
    const getRequest = Object.freeze({
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    const state = {
      account: null,
      season: null,
      room: null,
      model: null,
      viewedTeamId: null,
      eventSource: null,
      recoveryTimer: 0,
      reconnectAttempts: 0,
      correctionSaleId: null,
      mutationPending: false,
    };

    const byId = id => document.getElementById(id);
    if (seasonId) {
      const seasonQuery = "?seasonId=" + encodeURIComponent(seasonId);
      byId("draft-brand").href = "/app" + seasonQuery;
      byId("draft-nav-board").href = "/board" + seasonQuery;
      byId("draft-league-home").href = "/league" + seasonQuery;
      byId("draft-nav-my-team").href = "/my-team" + seasonQuery;
      byId("draft-fatal-league-home").href = "/league" + seasonQuery;
      byId("draft-view-my-team").href = "/my-team?seasonId=" + encodeURIComponent(seasonId);
    }
    const roomTitle = byId("draft-room-title");
    const roomContent = byId("draft-room-content");
    const accountLabel = byId("draft-account");
    const connectionStatus = byId("draft-connection-status");
    const connectionLabel = byId("draft-connection-label");
    const fatalError = byId("draft-fatal-error");
    const fatalMessage = byId("draft-fatal-message");
    const signInLink = byId("draft-sign-in-link");
    const signOutButton = byId("draft-sign-out");
    const roomStatus = byId("draft-room-status");
    const draftProgress = byId("draft-progress");
    const availableCount = byId("draft-available-count");
    const latestSale = byId("draft-latest-sale");
    const accessLabel = byId("draft-access-label");
    const commissionerControls = byId("draft-commissioner-controls");
    const completeActions = byId("draft-complete-actions");
    const viewMyTeamLink = byId("draft-view-my-team");
    const memberNote = byId("draft-member-note");
    const actionFeedback = byId("draft-action-feedback");
    const saleForm = byId("draft-sale-form");
    const saleCommand = byId("draft-sale-command");
    const logSaleButton = byId("draft-log-sale");
    const startButton = byId("draft-start");
    const pauseButton = byId("draft-pause");
    const undoButton = byId("draft-undo");
    const endButton = byId("draft-end");
    const exportButton = byId("draft-export");
    const exportDownload = byId("draft-export-download");
    const salesList = byId("draft-sales");
    const salesCount = byId("draft-sales-count");
    const salesSearch = byId("draft-sales-search");
    const correctionForm = byId("draft-correction-form");
    const correctionSaleId = byId("draft-correction-sale-id");
    const correctionCommand = byId("draft-correction-command");
    const cancelCorrectionButton = byId("draft-cancel-correction");
    const teamSelect = byId("draft-team-select");
    const currentTeamLabel = byId("draft-current-team");
    const teamContext = byId("draft-team-context");
    const teamBudget = byId("draft-team-budget");
    const teamSpent = byId("draft-team-spent");
    const teamOpenSlots = byId("draft-team-open-slots");
    const teamRoster = byId("draft-team-roster");
    const playerSearch = byId("draft-player-search");
    const positionFilter = byId("draft-position-filter");
    const boardCount = byId("draft-board-count");
    const boardHeadRow = byId("draft-board-head-row");
    const boardRows = byId("draft-board-rows");
    const boardCards = byId("draft-board-cards");

    const seasonEndpoint = () => "/seasons/" + encodeURIComponent(seasonId || "");
    const roomEndpoint = action => "/live-rooms/" + encodeURIComponent(roomId || "") + (
      action === undefined ? "" : "/" + action
    );

    const jsonRequest = (method, body) => ({
      method,
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const readJson = async response => {
      const text = await response.text();
      let body = {};
      try {
        body = text.length === 0 ? {} : JSON.parse(text);
      } catch {
        throw new Error("The draft service returned an unreadable response.");
      }
      if (!response.ok) {
        const error = new Error(body.error?.message || "The draft request failed.");
        error.code = body.error?.code;
        throw error;
      }
      return body;
    };

    const setConnectionState = (value, label) => {
      connectionStatus.dataset.state = value;
      connectionLabel.textContent = label;
    };

    const setFeedback = (message, tone) => {
      actionFeedback.textContent = message;
      actionFeedback.dataset.tone = tone || "neutral";
    };

    const showFatalError = message => {
      stopUpdates();
      roomContent.hidden = true;
      fatalError.hidden = false;
      fatalMessage.textContent = message;
      const returnTo = window.location.pathname + window.location.search;
      signInLink.href = "/login?returnTo=" + encodeURIComponent(returnTo);
      signInLink.hidden = false;
      roomTitle.textContent = "Draft room unavailable";
      roomStatus.textContent = "Unavailable";
    };

    const statusLabelFor = status => ({
      setup: "Not started",
      countdown: "Starting soon",
      live: "Live",
      paused: "Paused",
      ended: "Complete",
      complete: "Complete",
    })[status] || "Unknown";

    const dollars = value => "$" + Number(value || 0).toLocaleString("en-US");
    const normalizedText = value => String(value || "").trim().toLowerCase();
    const idempotencyKeyFor = action => action + ":" + roomId + ":" + currentRevision() + ":" + crypto.randomUUID();
    const currentRevision = () => {
      if (typeof state.model?.revision !== "number") throw new Error("The room has not loaded yet.");
      return state.model.revision;
    };

    const emptyItem = message => {
      const item = document.createElement("li");
      item.className = "empty-state";
      item.textContent = message;
      return item;
    };

    const selectedTeamIdFor = model =>
      state.viewedTeamId || model.selectedTeam?.teamId || model.viewedTeam?.teamId || model.teamSummaries[0]?.teamId || null;

    const viewedTeamFor = model => {
      const selectedId = selectedTeamIdFor(model);
      return model.teamSummaries.find(team => team.teamId === selectedId) || model.viewedTeam || model.selectedTeam || null;
    };

    const renderLifecycle = model => {
      const canManage = model.canMutateRoom === true;
      const isLive = model.status === "live";
      const isPaused = model.status === "paused";
      const isComplete = model.status === "ended" || model.status === "complete";
      const hasSales = model.salesLog.length > 0;
      commissionerControls.hidden = !canManage || isComplete;
      completeActions.hidden = !isComplete;
      memberNote.hidden = canManage || isComplete;
      viewMyTeamLink.hidden = model.role === "observer";
      exportButton.hidden = !canManage || !isComplete;
      if (canManage) accessLabel.textContent = "Commissioner";
      else if (model.role === "observer") accessLabel.textContent = "Observer";
      else accessLabel.textContent = "League member";
      saleCommand.disabled = !canManage || !isLive || state.mutationPending;
      logSaleButton.disabled = !canManage || !isLive || state.mutationPending;
      startButton.disabled = !canManage || !["setup", "countdown"].includes(model.status) || state.mutationPending;
      pauseButton.disabled = !canManage || (!isLive && !isPaused) || state.mutationPending;
      pauseButton.textContent = isPaused ? "Resume draft" : "Pause draft";
      undoButton.disabled = !canManage || !isLive || !hasSales || state.mutationPending;
      endButton.disabled = !canManage || (!isLive && !isPaused) || state.mutationPending;
      exportButton.disabled = !canManage || !isComplete || model.exportReadiness?.status !== "ready" || state.mutationPending;
    };

    const renderStatus = model => {
      const sales = model.salesLog || [];
      const lastSale = sales.at(-1);
      const totalRosterSpots = model.teamSummaries.reduce(
        (total, team) => total + team.roster.length + team.rosterSlotsRemaining,
        0,
      );
      const filledRosterSpots = model.teamSummaries.reduce(
        (total, team) => total + team.roster.length,
        0,
      );
      roomStatus.textContent = statusLabelFor(model.status);
      draftProgress.textContent = sales.length + " sales · " + filledRosterSpots + " of " + totalRosterSpots + " spots filled";
      availableCount.textContent = String(model.board.length);
      latestSale.textContent = lastSale
        ? lastSale.playerName + " to " + lastSale.ownerDisplayName + " for " + dollars(lastSale.price)
        : "No sales yet";
    };

    const usePlayerButtonFor = player => {
      const button = document.createElement("button");
      button.className = "use-player";
      button.type = "button";
      button.textContent = "+";
      button.setAttribute("aria-label", "Use " + player.name + " in sale command");
      button.disabled = state.model?.canMutateRoom !== true || state.model?.status !== "live";
      button.addEventListener("click", () => {
        const team = state.model === null ? null : viewedTeamFor(state.model);
        saleCommand.value = team
          ? team.ownerDisplayName + " " + player.name + " "
          : player.name + " ";
        saleCommand.focus();
      });
      return button;
    };

    const playerIdentityFor = player => {
      const wrapper = document.createElement("div");
      const name = document.createElement("div");
      const meta = document.createElement("div");
      name.className = "player-name";
      name.textContent = player.name;
      meta.className = "player-meta";
      meta.textContent = [player.teamAbbreviation || "FA", player.byeWeek ? "bye " + player.byeWeek : "bye --"].join(" · ");
      wrapper.append(name, meta);
      return wrapper;
    };

    const playerRowFor = (player, mode, canManage) => {
      if (mode === "mobile") {
        const row = document.createElement("article");
        row.className = "player-card";
        row.classList.toggle("player-card-actionable", canManage);
        row.dataset.playerName = player.name;
        const prices = document.createElement("span");
        const market = document.createElement("span");
        const price = document.createElement("span");
        prices.className = "player-card-prices";
        market.className = "player-card-market";
        market.textContent = "Market " + dollars(player.marketPrice ?? player.expectedPrice);
        price.className = "player-card-price";
        price.textContent = "Our " + dollars(player.expectedPrice);
        prices.append(market, price);
        if (canManage) row.appendChild(usePlayerButtonFor(player));
        row.append(playerIdentityFor(player), prices);
        return row;
      }

      const row = document.createElement("tr");
      row.dataset.playerName = player.name;
      const playerCell = document.createElement("td");
      const positionCell = document.createElement("td");
      const nflTeamCell = document.createElement("td");
      const byeCell = document.createElement("td");
      const marketCell = document.createElement("td");
      const priceCell = document.createElement("td");
      if (canManage) {
        const useCell = document.createElement("td");
        useCell.appendChild(usePlayerButtonFor(player));
        row.appendChild(useCell);
      }
      playerCell.appendChild(playerIdentityFor(player));
      positionCell.className = "position";
      positionCell.textContent = player.position;
      nflTeamCell.textContent = player.teamAbbreviation || "FA";
      byeCell.textContent = player.byeWeek === undefined ? "--" : String(player.byeWeek);
      marketCell.className = "money";
      marketCell.textContent = dollars(player.marketPrice ?? player.expectedPrice);
      priceCell.className = "money";
      priceCell.textContent = dollars(player.expectedPrice);
      row.append(playerCell, positionCell, nflTeamCell, byeCell, marketCell, priceCell);
      return row;
    };

    const renderBoardHeader = canManage => {
      const columnDefinitions = [
        ...(canManage ? [{ label: "Use", className: "" }] : []),
        { label: "Player", className: "" },
        { label: "Pos", className: "" },
        { label: "NFL", className: "" },
        { label: "Bye", className: "" },
        { label: "Market", className: "money" },
        { label: "Our", className: "money" },
      ];
      const columns = columnDefinitions.map(column => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = column.label;
        heading.className = column.className;
        return heading;
      });
      boardHeadRow.replaceChildren(...columns);
    };

    const renderBoard = model => {
      const canManage = model.canMutateRoom === true;
      renderBoardHeader(canManage);
      const search = normalizedText(playerSearch.value);
      const position = positionFilter.value;
      const visiblePlayers = model.board.filter(player => {
        const matchesPosition = position === "ALL" || player.position === position;
        const haystack = normalizedText([player.name, player.position, player.teamAbbreviation].join(" "));
        return matchesPosition && (search.length === 0 || haystack.includes(search));
      });
      const desktopFragment = document.createDocumentFragment();
      const mobileFragment = document.createDocumentFragment();
      visiblePlayers.forEach(player => {
        desktopFragment.appendChild(playerRowFor(player, "desktop", canManage));
        mobileFragment.appendChild(playerRowFor(player, "mobile", canManage));
      });
      boardRows.replaceChildren(desktopFragment);
      boardCards.replaceChildren(mobileFragment);
      if (visiblePlayers.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = canManage ? 7 : 6;
        cell.className = "empty-state";
        cell.textContent = "No available players match these filters.";
        row.appendChild(cell);
        boardRows.appendChild(row);
        const mobileEmpty = document.createElement("p");
        mobileEmpty.className = "empty-state";
        mobileEmpty.textContent = "No available players match these filters.";
        boardCards.appendChild(mobileEmpty);
      }
      boardCount.textContent = visiblePlayers.length + " available / " + model.board.length + " loaded";
    };

    const rosterRowFor = slot => {
      const item = document.createElement("li");
      item.className = "roster-row";
      const label = document.createElement("span");
      const player = document.createElement("span");
      const price = document.createElement("span");
      label.className = "slot-label";
      label.textContent = slot.slot;
      if (slot.player) {
        player.textContent = slot.player.name;
        price.className = "sale-price";
        price.textContent = dollars(slot.player.price);
      } else {
        player.className = "empty-slot";
        player.textContent = "Open";
        price.textContent = "";
      }
      item.append(label, player, price);
      return item;
    };

    const renderTeam = model => {
      const claimedTeamId = model.selectedTeam?.teamId || null;
      const viewedTeamId = selectedTeamIdFor(model);
      if (state.viewedTeamId === null) state.viewedTeamId = viewedTeamId;
      const options = model.teamSummaries.map(team => {
        const option = document.createElement("option");
        option.value = team.teamId;
        option.textContent = team.draftOrderPosition + ". " + team.teamDisplayName + " · " + team.ownerDisplayName;
        return option;
      });
      teamSelect.replaceChildren(...options);
      teamSelect.disabled = options.length === 0;
      if (viewedTeamId !== null) teamSelect.value = viewedTeamId;

      const claimedTeam = model.teamSummaries.find(team => team.teamId === claimedTeamId);
      currentTeamLabel.textContent = claimedTeam ? "Your team: " + claimedTeam.teamDisplayName : "No claimed team";
      const team = viewedTeamFor(model);
      if (!team) {
        teamContext.textContent = "Choose a team when one becomes available.";
        teamBudget.textContent = "--";
        teamSpent.textContent = "--";
        teamOpenSlots.textContent = "--";
        teamRoster.replaceChildren(emptyItem("Roster slots will appear here."));
        return;
      }
      teamContext.textContent = team.teamId === claimedTeamId
        ? "Viewing your claimed team."
        : "Viewing " + team.ownerDisplayName + " · " + team.teamDisplayName;
      teamBudget.textContent = dollars(team.budgetRemaining);
      teamSpent.textContent = dollars(team.spent);
      teamOpenSlots.textContent = String(team.rosterSlotsRemaining);
      const slots = team.slots || [];
      teamRoster.replaceChildren(...(slots.length === 0
        ? [emptyItem("No roster slots are available.")]
        : slots.map(rosterRowFor)));
    };

    const saleRowFor = (sale, canCorrect) => {
      const item = document.createElement("li");
      item.className = "sale-row";
      const detail = document.createElement("div");
      const player = document.createElement("div");
      const meta = document.createElement("div");
      const trailing = document.createElement("div");
      const price = document.createElement("div");
      player.className = "sale-player";
      player.textContent = sale.playerName;
      meta.className = "sale-meta";
      meta.textContent = sale.ownerDisplayName + " · " + sale.teamDisplayName;
      price.className = "sale-price";
      price.textContent = dollars(sale.price);
      detail.append(player, meta);
      trailing.appendChild(price);
      if (canCorrect) {
        const correctButton = document.createElement("button");
        correctButton.type = "button";
        correctButton.textContent = "Correct";
        correctButton.setAttribute("aria-label", "Correct sale of " + sale.playerName);
        correctButton.addEventListener("click", () => openCorrection(sale));
        trailing.appendChild(correctButton);
      }
      item.append(detail, trailing);
      return item;
    };

    const renderSales = model => {
      const allSales = (model.salesLog || []).slice().reverse();
      const search = normalizedText(salesSearch.value);
      const visibleSales = allSales.filter(sale =>
        search.length === 0 || normalizedText([
          sale.playerName,
          sale.ownerDisplayName,
          sale.teamDisplayName,
          sale.price,
        ].join(" ")).includes(search)
      );
      const canCorrect = model.canMutateRoom === true && model.status === "live" && !state.mutationPending;
      salesCount.textContent = search.length === 0
        ? String(allSales.length)
        : visibleSales.length + " of " + allSales.length;
      const emptyMessage = allSales.length === 0
        ? "Sales will appear here for everyone."
        : "No sales match this search.";
      salesList.replaceChildren(...(visibleSales.length === 0
        ? [emptyItem(emptyMessage)]
        : visibleSales.map(sale => saleRowFor(sale, canCorrect))));
      const correctionIsActive = allSales.some(sale => sale.saleEventId === state.correctionSaleId);
      if (!canCorrect || (state.correctionSaleId !== null && !correctionIsActive)) {
        closeCorrection();
      }
    };

    const renderModel = model => {
      state.model = model;
      roomTitle.textContent = state.season?.league?.name
        ? state.season.league.name + " " + state.season.seasonYear
        : "Live draft room";
      renderLifecycle(model);
      renderStatus(model);
      renderSales(model);
      renderTeam(model);
      renderBoard(model);
    };

    const openCorrection = sale => {
      state.correctionSaleId = sale.saleEventId;
      correctionSaleId.value = sale.saleEventId;
      correctionCommand.value = sale.ownerDisplayName + " " + sale.playerName + " " + sale.price;
      correctionForm.hidden = false;
      correctionCommand.focus();
      correctionCommand.select();
    };

    const closeCorrection = () => {
      state.correctionSaleId = null;
      correctionSaleId.value = "";
      correctionCommand.value = "";
      correctionForm.hidden = true;
    };

    const snapshotFrom = body =>
      (body.events?.events || []).find(event => event.event === "room.snapshot")?.data || null;

    const loadSnapshot = async () => {
      const body = await readJson(await fetch(roomEndpoint("events") + "?afterRevision=0", getRequest));
      const model = snapshotFrom(body);
      if (!model) throw new Error("The room did not return an authoritative snapshot.");
      renderModel(model);
      return model;
    };

    const stopUpdates = () => {
      if (state.eventSource !== null) {
        state.eventSource.close();
        state.eventSource = null;
      }
      if (state.recoveryTimer !== 0) {
        window.clearTimeout(state.recoveryTimer);
        state.recoveryTimer = 0;
      }
    };

    const pollForMissedRevisions = async () => {
      state.recoveryTimer = 0;
      if (!state.model || !navigator.onLine) {
        setConnectionState("offline", "Offline");
        return;
      }
      try {
        const url = roomEndpoint("events") + "?afterRevision=" + encodeURIComponent(currentRevision());
        const body = await readJson(await fetch(url, getRequest));
        if (body.events?.requiresSnapshot || (body.events?.events || []).length > 0 || body.events?.currentRevision > currentRevision()) {
          await loadSnapshot();
        }
        state.reconnectAttempts = 0;
        setConnectionState("connected", "Connected");
        connectRoomUpdates();
      } catch (error) {
        state.reconnectAttempts += 1;
        setConnectionState(navigator.onLine ? "reconnecting" : "offline", navigator.onLine ? "Reconnecting" : "Offline");
        scheduleRecovery();
      }
    };

    const scheduleRecovery = () => {
      if (state.recoveryTimer !== 0) return;
      const delay = Math.min(1000 * Math.pow(2, state.reconnectAttempts), 10000);
      state.recoveryTimer = window.setTimeout(() => {
        pollForMissedRevisions().catch(() => undefined);
      }, delay);
    };

    const refreshFromStream = event => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        setConnectionState("reconnecting", "Reconnecting");
        stopUpdates();
        scheduleRecovery();
        return;
      }
      if (event.type === "room.snapshot") {
        renderModel(payload);
        setConnectionState("connected", "Connected");
        return;
      }
      stopUpdates();
      loadSnapshot()
        .then(() => {
          setConnectionState("connected", "Connected");
          connectRoomUpdates();
        })
        .catch(() => {
          setConnectionState("reconnecting", "Reconnecting");
          scheduleRecovery();
        });
    };

    const connectRoomUpdates = () => {
      if (!state.model || !navigator.onLine) {
        setConnectionState("offline", "Offline");
        return;
      }
      if (!("EventSource" in window)) {
        setConnectionState("reconnecting", "Polling");
        scheduleRecovery();
        return;
      }
      if (state.eventSource !== null) state.eventSource.close();
      const url = roomEndpoint("event-stream") + "?afterRevision=" + encodeURIComponent(currentRevision());
      const eventSource = new EventSource(url);
      state.eventSource = eventSource;
      eventSource.onopen = () => {
        state.reconnectAttempts = 0;
        setConnectionState("connected", "Connected");
      };
      eventSource.addEventListener("room.snapshot", refreshFromStream);
      eventSource.addEventListener("room.sale", refreshFromStream);
      eventSource.addEventListener("room.started", refreshFromStream);
      eventSource.addEventListener("room.paused", refreshFromStream);
      eventSource.addEventListener("room.resumed", refreshFromStream);
      eventSource.addEventListener("room.ended", refreshFromStream);
      eventSource.addEventListener("room.error", refreshFromStream);
      eventSource.onerror = () => {
        if (state.eventSource !== eventSource) return;
        eventSource.close();
        state.eventSource = null;
        state.reconnectAttempts += 1;
        setConnectionState(navigator.onLine ? "reconnecting" : "offline", navigator.onLine ? "Reconnecting" : "Offline");
        scheduleRecovery();
      };
    };

    const mutateRoom = async (action, values, feedback) => {
      if (state.model?.canMutateRoom !== true) throw new Error("Only the commissioner can change this draft.");
      if (state.mutationPending) throw new Error("Wait for the current draft action to finish.");
      const body = {
        expectedRevision: currentRevision(),
        idempotencyKey: idempotencyKeyFor(action),
        ...(values || {}),
      };
      state.mutationPending = true;
      renderLifecycle(state.model);
      setFeedback(feedback, "neutral");
      try {
        const response = await readJson(await fetch(roomEndpoint(action), jsonRequest("POST", body)));
        if (response.room) state.room = response.room;
        await loadSnapshot();
        setFeedback("Draft room updated.", "success");
      } catch (error) {
        if (error?.code === "stale_revision") {
          await loadSnapshot().catch(() => undefined);
          throw new Error("The room changed before that action completed. Review the latest state and try again.");
        }
        throw error;
      } finally {
        state.mutationPending = false;
        renderLifecycle(state.model);
      }
    };

    const exportDraft = async () => {
      exportButton.disabled = true;
      setFeedback("Preparing final CSV...", "neutral");
      try {
        const body = await readJson(await fetch(roomEndpoint("export-artifacts"), jsonRequest("POST", {
          exportedAt: new Date().toISOString(),
        })));
        const blob = new Blob([body.content || ""], { type: body.artifact?.mediaType || "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        exportDownload.href = url;
        exportDownload.download = body.artifact?.fileName || "mockd-draft.csv";
        exportDownload.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        setFeedback("Final CSV downloaded.", "success");
      } finally {
        renderLifecycle(state.model);
      }
    };

    const bootstrap = async () => {
      if (!seasonId || !roomId) {
        showFatalError("This draft room link is incomplete. Ask the commissioner for a link with seasonId and roomId.");
        setConnectionState("offline", "Unavailable");
        return;
      }
      try {
        const sessionBody = await readJson(await fetch("/session", getRequest));
        state.account = sessionBody.account;
        accountLabel.textContent = state.account.email;
        signOutButton.hidden = false;
        const [seasonBody, roomBody] = await Promise.all([
          readJson(await fetch(seasonEndpoint(), getRequest)),
          readJson(await fetch(roomEndpoint(), getRequest)),
        ]);
        state.season = seasonBody.season;
        state.room = roomBody.room;
        if (state.season.id !== seasonId || state.room.seasonId !== seasonId || state.room.roomId !== roomId) {
          throw new Error("This draft room does not belong to the requested league season.");
        }
        await loadSnapshot();
        setConnectionState("connected", "Connected");
        connectRoomUpdates();
      } catch (error) {
        let message = "The draft room could not be opened.";
        if (error?.code === "auth_required") {
          message = "Sign in to your Mockd account before opening this draft room.";
        } else if (error instanceof Error) {
          message = error.message;
        }
        showFatalError(message);
        setConnectionState("offline", "Unavailable");
      }
    };

    const signOut = async () => {
      signOutButton.disabled = true;
      try {
        const response = await fetch("/session", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { accept: "application/json" },
        });
        if (!response.ok) await readJson(response);
        stopUpdates();
        window.location.assign("/login");
      } catch (error) {
        signOutButton.disabled = false;
        showFatalError(error instanceof Error ? error.message : "Sign out failed. Please try again.");
      }
    };

    saleForm.addEventListener("submit", event => {
      event.preventDefault();
      const command = saleCommand.value.trim();
      if (!command) {
        setFeedback("Enter an owner, player, and sale price.", "error");
        saleCommand.focus();
        return;
      }
      mutateRoom("sales", { command }, "Logging sale...")
        .then(() => {
          saleCommand.value = "";
          saleCommand.focus();
        })
        .catch(error => setFeedback(error.message, "error"));
    });

    startButton.addEventListener("click", () => {
      mutateRoom("start", {}, "Starting draft...").catch(error => setFeedback(error.message, "error"));
    });

    pauseButton.addEventListener("click", () => {
      const action = state.model?.status === "paused" ? "resume" : "pause";
      mutateRoom(action, {}, action === "pause" ? "Pausing draft..." : "Resuming draft...")
        .catch(error => setFeedback(error.message, "error"));
    });

    undoButton.addEventListener("click", () => {
      const sale = state.model?.salesLog?.at(-1);
      if (!sale || !window.confirm("Undo the latest sale of " + sale.playerName + "?")) return;
      mutateRoom("undo", {}, "Undoing latest sale...").catch(error => setFeedback(error.message, "error"));
    });

    endButton.addEventListener("click", () => {
      if (!window.confirm("End and lock the draft now? Any open roster slots will remain empty.")) return;
      mutateRoom("end", { allowIncomplete: true }, "Ending draft...")
        .catch(error => setFeedback(error.message, "error"));
    });

    correctionForm.addEventListener("submit", event => {
      event.preventDefault();
      const command = correctionCommand.value.trim();
      const saleEventId = correctionSaleId.value;
      if (!command || !saleEventId || !window.confirm("Apply this correction to the selected sale?")) return;
      mutateRoom("corrections", { saleEventId, replacementSale: command }, "Applying correction...")
        .then(closeCorrection)
        .catch(error => setFeedback(error.message, "error"));
    });

    cancelCorrectionButton.addEventListener("click", closeCorrection);
    signOutButton.addEventListener("click", () => signOut());
    exportButton.addEventListener("click", () => exportDraft().catch(error => setFeedback(error.message, "error")));
    playerSearch.addEventListener("input", () => state.model && renderBoard(state.model));
    positionFilter.addEventListener("change", () => state.model && renderBoard(state.model));
    salesSearch.addEventListener("input", () => state.model && renderSales(state.model));
    teamSelect.addEventListener("change", () => {
      state.viewedTeamId = teamSelect.value;
      if (state.model) renderTeam(state.model);
    });

    window.addEventListener("online", () => {
      setConnectionState("reconnecting", "Reconnecting");
      stopUpdates();
      loadSnapshot()
        .then(() => {
          setConnectionState("connected", "Connected");
          connectRoomUpdates();
        })
        .catch(scheduleRecovery);
    });
    window.addEventListener("offline", () => {
      stopUpdates();
      setConnectionState("offline", "Offline");
    });
    window.addEventListener("pagehide", stopUpdates);

    bootstrap().catch(error => showFatalError(error.message));
  </script>
</body>
</html>`;

export const hostedDraftRoomHtml = platformHostedDraftRoomHtml;
