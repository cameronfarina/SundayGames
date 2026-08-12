export const platformShellNavigation = [
  { label: "Practice", path: "/practice" },
  { label: "League", path: "/league" },
  { label: "My team", path: "/my-team" },
] as const;

export const rosterSlotDisplayOrder = [
  "QB",
  "RB",
  "WR",
  "TE",
  "FLEX",
  "DST",
  "K",
  "BENCH",
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

    .header-league-switcher { min-width: 0; }
    .header-league-switcher select {
      background: var(--bg);
      max-width: min(46vw, 280px);
      min-height: 38px;
      padding: 7px 34px 7px 10px;
    }

    .account-menu { border: 0; padding: 0; position: relative; }
    .account-menu > summary { list-style: none; padding: 0; }
    .account-menu > summary::-webkit-details-marker { display: none; }
    .account-avatar {
      align-items: center;
      background: var(--surface-raised);
      border: 1px solid var(--line);
      border-radius: 50%;
      color: var(--text);
      display: flex;
      font-size: 13px;
      font-weight: 850;
      height: 40px;
      justify-content: center;
      width: 40px;
    }
    .account-menu-popover {
      background: var(--surface-raised);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 18px 48px rgb(0 0 0 / .45);
      display: grid;
      gap: 8px;
      min-width: 280px;
      padding: 14px;
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      z-index: 10;
    }
    .account-menu-email { font-size: 13px; overflow-wrap: anywhere; }
    .account-menu-context {
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      display: grid;
      font-size: 12px;
      gap: 4px;
      padding-bottom: 12px;
    }
    .account-menu-context strong { color: var(--text); }
    .account-menu-leagues { display: grid; gap: 2px; }
    .account-menu-leagues a, .account-menu-command {
      border-radius: 4px;
      color: var(--text);
      display: block;
      font-size: 14px;
      min-height: 38px;
      padding: 9px 10px;
      text-align: left;
      text-decoration: none;
      width: 100%;
    }
    .account-menu-leagues a[aria-current="true"] { background: var(--surface); color: var(--accent-strong); }

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
    .readiness-action {
      color: var(--accent-strong);
      display: inline-block;
      font-size: 13px;
      font-weight: 750;
      margin-top: 10px;
    }
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

    .keeper-list { display: grid; gap: 8px; margin-top: 12px; }
    .section-title-row {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: space-between;
    }
    .section-title-row h2 { margin-bottom: 0; }
    .saved-indicator { color: var(--accent-strong); font-size: 13px; font-weight: 750; }
    .keeper-row {
      align-items: center;
      border: 1px solid var(--line);
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) auto auto;
      padding: 10px 12px;
    }
    .historical-file-list { display: grid; gap: 8px; margin-top: 12px; }
    .historical-file-row {
      align-items: end;
      border: 1px solid var(--line);
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr) minmax(120px, .28fr) auto;
      padding: 12px;
    }
    .historical-file-row strong, .historical-file-row span { display: block; overflow-wrap: anywhere; }
    .historical-file-row span { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .historical-file-row[data-status="imported"] { border-left: 3px solid var(--accent); }
    .historical-file-row[data-status="error"] { border-left: 3px solid var(--warning); }
    .historical-owner-mappings {
      border-top: 1px solid var(--line);
      display: grid;
      gap: 10px;
      grid-column: 1 / -1;
      padding-top: 12px;
    }
    .historical-owner-mapping {
      align-items: end;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) minmax(180px, 1fr);
    }
    .setup-fields { display: grid; gap: 12px; }
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

    .league-create-launch {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }
    .league-create-launch .lede { max-width: 700px; }

    dialog.league-wizard-dialog {
      height: min(900px, calc(100dvh - 24px));
      max-height: calc(100dvh - 24px);
      max-width: 1120px;
      overflow: hidden;
      padding: 0;
      width: calc(100% - 24px);
    }
    .league-wizard-form {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      height: 100%;
      min-height: 0;
    }
    .league-wizard-header {
      align-items: start;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 20px;
      justify-content: space-between;
      padding: 22px 24px 18px;
    }
    .league-wizard-header h2 { font-size: 24px; margin: 0; }
    .league-wizard-header .lede { font-size: 14px; }
    .league-wizard-close {
      flex: 0 0 auto;
      font-size: 24px;
      line-height: 1;
      min-height: 38px;
      min-width: 38px;
      padding: 4px;
    }
    .league-wizard-progress {
      border-bottom: 1px solid var(--line);
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      list-style: none;
      margin: 0;
      padding: 0 24px;
    }
    .league-wizard-progress li {
      border-bottom: 3px solid transparent;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      padding: 13px 8px 10px;
      text-align: center;
      text-transform: uppercase;
    }
    .league-wizard-progress li[aria-current="step"] {
      border-bottom-color: var(--accent);
      color: var(--text);
    }
    .league-wizard-body {
      display: grid;
      grid-template-rows: minmax(0, 1fr);
      min-height: 0;
      overflow: hidden;
    }
    .league-wizard-content {
      min-height: 0;
      overflow-y: auto;
      padding: 24px;
    }
    .league-wizard-step {
      display: grid;
      gap: 22px;
      margin: 0 auto;
      max-width: 860px;
    }
    .league-wizard-step h3 { font-size: 20px; margin: 0; width: fit-content; }
    .league-wizard-step h3:focus-visible { outline-width: 2px; }
    .league-wizard-step > header .lede { margin-top: 6px; }
    .league-wizard-footer {
      align-items: center;
      background: var(--surface-raised);
      border-top: 1px solid var(--line);
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      min-height: 72px;
      padding: 14px 24px;
    }
    .league-wizard-footer .status {
      margin: 0 auto 0 0;
      min-height: 0;
    }
    .league-import-panel {
      border-left: 3px solid var(--focus);
      display: grid;
      gap: 12px;
      padding: 4px 0 4px 16px;
    }
    .league-import-panel h4 { font-size: 15px; margin: 0; }
    .league-import-panel .lede { font-size: 14px; margin: 0; }
    .league-import-actions {
      align-items: end;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .league-screenshot-dropzone {
      align-items: center;
      border: 1px dashed var(--line);
      display: grid;
      gap: 8px;
      justify-items: center;
      padding: 22px 16px;
      text-align: center;
    }
    .league-screenshot-dropzone.is-dragging {
      background: var(--surface);
      border-color: var(--accent);
    }
    .league-screenshot-dropzone span { color: var(--muted); font-size: 13px; }
    .league-import-summary {
      border: 1px solid var(--line);
      display: grid;
      gap: 12px;
      padding: 14px;
    }
    .league-import-summary[data-kind="success"] { border-left: 3px solid var(--accent); }
    .league-import-summary[data-kind="failure"] { border-left: 3px solid var(--warning); }
    .league-import-summary h4, .league-import-summary p { margin: 0; }
    .league-import-facts {
      display: grid;
      gap: 1px;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }
    .league-import-facts div { background: var(--surface); padding: 10px; }
    .league-import-facts span { color: var(--muted); display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .league-import-facts strong { display: block; margin-top: 4px; }
    .league-team-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    }
    .league-team-row {
      border-top: 1px solid var(--line);
      display: grid;
      gap: 12px;
      padding-top: 14px;
    }
    .league-team-row[data-needs-review="true"] { border-top-color: var(--warning); }
    .league-team-row h4 { font-size: 14px; margin: 0; }
    .league-team-review { color: var(--warning); font-size: 12px; line-height: 1.4; margin: 0; }
    .league-team-meta { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr) minmax(110px, .4fr); }
    .league-team-progress { color: var(--muted); font-size: 13px; margin: 0; }

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
    .player-board-scroll {
      border-bottom: 1px solid var(--line);
      border-top: 1px solid var(--line);
      max-height: min(68vh, 720px);
      overflow: auto;
      overscroll-behavior: contain;
    }
    .player-board-scroll .player-board thead th {
      background: var(--bg);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .setup-preview-table { border-collapse: collapse; min-width: 620px; width: 100%; }
    .setup-preview-table th, .setup-preview-table td {
      border-bottom: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
    }
    .setup-preview-table th { color: var(--muted); font-size: 12px; text-transform: uppercase; }

    .board-controls {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr);
    }
    .shortlist-filter {
      align-items: center;
      align-self: end;
      display: flex;
      gap: 8px;
      min-height: 44px;
      white-space: nowrap;
    }
    .shortlist-filter input { min-height: auto; width: auto; }
    .shortlist-toggle {
      align-items: center;
      display: inline-flex;
      font-size: 19px;
      height: 34px;
      justify-content: center;
      min-height: 34px;
      padding: 0;
      width: 34px;
    }
    .shortlist-toggle[aria-pressed="true"] {
      border-color: var(--warning);
      color: var(--warning);
    }
    .shortlisted-player-row { background: rgb(244 200 107 / .035); }

    .board-pricing-context {
      background: var(--surface);
      border-left: 3px solid var(--accent);
      display: grid;
      gap: 8px;
      padding: 12px 14px;
    }
    .board-pricing-context strong { font-size: 14px; }
    .board-pricing-context ul { margin: 0; padding-left: 20px; }
    .board-pricing-context li { color: var(--warning); font-size: 13px; line-height: 1.45; }

    .player-board {
      border-collapse: collapse;
      min-width: 760px;
      width: 100%;
    }

    .player-board th, .player-board td {
      border-bottom: 1px solid var(--line);
      padding: 11px 12px;
      text-align: left;
    }

    .player-board th {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
    }

    .player-board .numeric { text-align: right; }
    .player-name { font-weight: 760; }
    .player-meta { color: var(--muted); display: block; font-size: 12px; margin-top: 2px; }
    .keeper-badge, .team-badge {
      background: rgb(103 216 176 / .14);
      border: 1px solid rgb(103 216 176 / .42);
      border-radius: 4px;
      color: var(--accent-strong);
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      margin-left: 8px;
      padding: 2px 5px;
      text-transform: uppercase;
    }
    .keeper-player-row { background: rgb(103 216 176 / .035); }

    .simulation-run-toolbar {
      align-items: end;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: space-between;
    }
    .simulation-run-toolbar > div { min-width: min(100%, 220px); }
    .simulation-league-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    }
    .simulation-team {
      border: 1px solid var(--line);
      border-radius: 6px;
      min-width: 0;
    }
    .simulation-team[data-user-team="true"] { border-color: var(--accent); }
    .simulation-team-header {
      align-items: start;
      border-bottom: 1px solid var(--line);
      display: flex;
      gap: 12px;
      justify-content: space-between;
      padding: 12px;
    }
    .simulation-team-header h3 { font-size: 15px; margin: 0; overflow-wrap: anywhere; }
    .simulation-team-summary { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .simulation-team-score { color: var(--accent-strong); flex: 0 0 auto; font-weight: 850; text-align: right; }
    .simulation-team-roster { border-collapse: collapse; font-size: 13px; width: 100%; }
    .simulation-team-roster th, .simulation-team-roster td { border-bottom: 1px solid var(--line); padding: 8px 10px; text-align: left; }
    .simulation-team-roster th { color: var(--muted); font-size: 10px; text-transform: uppercase; }
    .simulation-team-roster tr:last-child td { border-bottom: 0; }
    .simulation-team-roster .numeric { text-align: right; }
    .simulation-team-roster tr[data-starter="false"] { color: var(--muted); }

    .mock-layout { display: grid; gap: 24px; min-width: 0; }
    .mock-toolbar {
      align-items: end;
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr);
    }
    .mock-roster {
      display: grid;
      gap: 1px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .mock-roster li {
      align-items: center;
      background: var(--surface);
      display: flex;
      gap: 10px;
      justify-content: space-between;
      min-height: 44px;
      padding: 10px 12px;
    }
    .mock-roster span { color: var(--muted); font-size: 13px; }
    .mock-player-action { min-height: 34px; padding: 5px 10px; }

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
      .product-nav { padding-left: max(20px, calc((100vw - 1240px) / 2)); }
      .shell-main { padding-left: 28px; padding-right: 28px; }
      .context-bar { grid-template-columns: minmax(260px, 380px) 1fr 1fr; }
      .facts { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .setup-layout { grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); }
      .setup-fields { grid-template-columns: minmax(0, 1fr) minmax(180px, .5fr); }
      .board-controls { grid-template-columns: minmax(0, 1fr) 140px 180px 165px auto; }
      .mock-layout { grid-template-columns: minmax(0, 1fr) minmax(280px, .36fr); }
      .mock-toolbar { grid-template-columns: minmax(0, 1fr) auto; }
      .mock-roster-panel { order: 0; }
      .room-setup { grid-column: 1 / -1; }
    }

    @media (max-width: 700px) {
      dialog.league-wizard-dialog {
        border-radius: 0;
        height: 100dvh;
        max-height: 100dvh;
        width: 100%;
      }
      .league-wizard-header { padding: 18px 16px 14px; }
      .league-wizard-header h2 { font-size: 21px; }
      .league-wizard-progress {
        grid-template-columns: repeat(4, 86px);
        justify-content: start;
        overflow-x: auto;
        padding: 0 8px;
      }
      .league-wizard-content { padding: 20px 16px; }
      .league-wizard-footer { flex-wrap: wrap; padding: 12px 16px; }
      .league-wizard-footer .status { flex: 1 0 100%; order: -1; }
      .league-import-actions { grid-template-columns: 1fr; }
      .league-team-grid { grid-template-columns: 1fr; }
      .historical-file-row { grid-template-columns: 1fr; }
      .player-board-scroll { max-height: min(58vh, 520px); }
      .mock-roster-panel { order: -1; }
      .player-board { min-width: 0; }
      .player-board thead { display: none; }
      .player-board tbody, .player-board tr, .player-board td { display: block; width: 100%; }
      .player-board tr {
        border-bottom: 1px solid var(--line);
        display: grid;
        gap: 6px;
        padding: 12px;
      }
      .player-board td, .player-board td.numeric {
        align-items: center;
        border: 0;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        min-width: 0;
        padding: 0;
        text-align: right;
      }
      .player-board td[data-label]::before {
        color: var(--muted);
        content: attr(data-label);
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .player-board td.player-name {
        align-items: start;
        font-size: 16px;
        grid-row: 1;
        text-align: left;
      }
      .player-board td.player-name::before { display: none; }
    }
  </style>
</head>
<body data-session-state="loading">
  <a class="skip-link" href="#main-content">Skip to content</a>

  <header id="app-header" class="hidden">
    <div class="topbar">
      <a class="brand" href="/practice">Mockd</a>
      <div class="account-actions">
        <div id="header-league-switcher" class="header-league-switcher hidden">
          <label class="visually-hidden" for="header-league-picker">Active league</label>
          <select id="header-league-picker" aria-label="Active league"></select>
        </div>
        <details id="account-menu" class="account-menu">
          <summary id="account-menu-button" aria-label="Open account menu" title="Account">
            <span id="account-avatar-initials" class="account-avatar" aria-hidden="true">?</span>
          </summary>
          <div class="account-menu-popover">
            <strong id="account-menu-email" class="account-menu-email"></strong>
            <div class="account-menu-context">
              <span>My team <strong id="my-team-name">Not assigned</strong></span>
              <span>Access <strong id="membership-role">Member</strong></span>
            </div>
            <div id="account-menu-leagues" class="account-menu-leagues" aria-label="Connected leagues"></div>
            <a id="account-create-league" class="account-menu-command" href="/league?create=1">Create league</a>
            <button id="account-settings-button" class="account-menu-command" type="button" aria-haspopup="dialog" aria-controls="password-dialog">Change password</button>
            <button id="sign-out-button" class="account-menu-command" type="button">Sign out</button>
          </div>
        </details>
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
        <div id="password-confirmation-field" class="hidden">
          <label for="password-confirmation-input">Confirm password</label>
          <input id="password-confirmation-input" name="passwordConfirmation" type="password" autocomplete="new-password" minlength="8">
        </div>
        <button id="auth-submit-button" class="primary" type="submit">Sign in</button>
      </form>
      <p id="auth-error" class="error hidden" role="alert"></p>
      <p id="auth-notice" class="notice hidden" role="status"></p>
      <p><span id="auth-mode-prompt">New to Mockd?</span> <a id="auth-mode-link" href="/signup">Create account</a></p>
      <p id="auth-recovery-link"><a href="/forgot-password">Forgot password?</a></p>
    </section>

    <div id="app-shell" class="hidden">
      <div id="app-error" class="error hidden" role="alert">
        <p id="app-error-message"></p>
        <button id="retry-onboarding-button" type="button">Try again</button>
      </div>
      <p id="app-status" class="status" role="status" aria-live="polite"></p>

      <section id="standalone-board" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">Practice</p>
            <h1>Draft lab</h1>
            <p class="lede">Build a strategy, run full-league simulations, and practice against your active league.</p>
          </div>
          <div class="actions">
            <a id="standalone-board-open-mock" class="button primary hidden">Start mock draft</a>
            <button id="standalone-board-open-simulations" class="button hidden" type="button">Run simulations</button>
          </div>
        </div>
        <div class="board-controls">
          <div>
            <label for="standalone-player-search">Search players</label>
            <input id="standalone-player-search" type="search" placeholder="Player, position, or NFL team" autocomplete="off">
          </div>
          <div>
            <label for="standalone-position-filter">Position</label>
            <select id="standalone-position-filter"><option value="">All positions</option></select>
          </div>
          <div>
            <label for="practice-strategy">My value strategy</label>
            <select id="practice-strategy">
              <option value="balanced">Balanced</option>
              <option value="three-rb">Three-RB start</option>
              <option value="hero-rb">Hero RB</option>
              <option value="wr-heavy">WR heavy</option>
            </select>
          </div>
          <div>
            <label for="standalone-board-sort">Sort</label>
            <select id="standalone-board-sort">
              <option value="mine">My value</option>
              <option value="market">Market value</option>
              <option value="rank">Rank</option>
            </select>
          </div>
          <label class="shortlist-filter" for="standalone-shortlist-only">
            <input id="standalone-shortlist-only" type="checkbox">
            <span>Shortlist only (<strong id="standalone-shortlist-count">0</strong>)</span>
          </label>
        </div>
        <p id="standalone-board-status" class="status" role="status" aria-live="polite"></p>
        <section id="standalone-pricing-context" class="board-pricing-context" aria-labelledby="standalone-pricing-source">
          <strong id="standalone-pricing-source">Pricing source: current market board</strong>
          <ul id="standalone-pricing-warnings" class="hidden"></ul>
        </section>
        <details id="simulation-panel" class="workspace-section hidden">
          <summary>Run simulations</summary>
          <div class="compact-stack" style="margin-top: 16px">
            <div class="setup-fields">
              <div>
                <label for="simulation-strategy">Draft strategy</label>
                <input id="simulation-strategy" autocomplete="off" placeholder="Draft Jadarian Price for no more than $20 and target an elite RB">
              </div>
              <div>
                <label for="simulation-count">Runs</label>
                <input id="simulation-count" type="number" min="1" max="100" step="1" value="25">
              </div>
              <div>
                <label for="simulation-note">Run note</label>
                <input id="simulation-note" maxlength="1000" autocomplete="off" placeholder="What are you testing in this run?">
              </div>
            </div>
            <div class="actions"><button id="simulation-run" class="primary" type="button">Run simulations</button></div>
            <section id="simulation-history" class="compact-stack hidden" aria-labelledby="simulation-history-title">
              <h2 id="simulation-history-title">Previous runs</h2>
              <div class="actions">
                <select id="simulation-history-picker" aria-label="Saved simulation run"></select>
                <button id="simulation-history-open" type="button">Open saved run</button>
              </div>
              <p id="simulation-history-note" class="lede"></p>
            </section>
            <p id="simulation-status" class="status" role="status" aria-live="polite"></p>
            <div id="simulation-results" class="compact-stack hidden">
              <p id="simulation-strategy-summary" class="lede"></p>
              <ul id="simulation-warnings" class="result-list hidden"></ul>
              <div class="facts">
                <div class="fact"><span>Completed</span><strong id="simulation-completed">-</strong></div>
                <div class="fact"><span>Target hit rate</span><strong id="simulation-target-rate">-</strong></div>
                <div class="fact"><span>Format</span><strong id="simulation-format">-</strong></div>
              </div>
              <section class="workspace-section">
                <div class="simulation-run-toolbar">
                  <div>
                    <h2>League results</h2>
                    <p class="lede">Every team includes its keepers and players drafted in this run.</p>
                  </div>
                  <div>
                    <label for="simulation-run-picker">Simulation run</label>
                    <select id="simulation-run-picker"></select>
                  </div>
                </div>
                <div id="simulation-league-grid" class="simulation-league-grid"></div>
              </section>
              <details class="workspace-section">
                <summary>Player exposure across all runs</summary>
                <div class="table-scroll" style="margin-top: 14px">
                  <table class="setup-preview-table">
                    <thead><tr><th>Player</th><th>Pos</th><th>Exposure</th><th>Average</th></tr></thead>
                    <tbody id="simulation-exposure-body"></tbody>
                  </table>
                </div>
              </details>
            </div>
          </div>
        </details>
        <div id="standalone-player-scroll" class="table-scroll player-board-scroll" tabindex="0" aria-label="Player board results">
          <table class="player-board">
            <thead><tr><th>Target</th><th class="numeric">Rank</th><th>Player</th><th>Pos</th><th>NFL</th><th class="numeric">Bye</th><th class="numeric">Market</th><th class="numeric">My value</th></tr></thead>
            <tbody id="standalone-player-rows"></tbody>
          </table>
        </div>
      </section>

      <section id="empty-leagues" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">League</p>
            <h1>Create a league</h1>
            <p class="lede">Add the settings and teams Mockd will use for values, simulations, mock drafts, and your live auction.</p>
          </div>
        </div>
        <section class="workspace-section league-create-launch" aria-labelledby="league-info-title">
          <div>
            <h2 id="league-info-title">League information</h2>
            <p class="lede">Use a public ESPN league when available, or enter the league settings and teams manually.</p>
          </div>
          <button id="league-info-button" class="primary" type="button" aria-haspopup="dialog" aria-controls="league-setup-dialog">Input league info</button>
        </section>
        <dialog id="league-setup-dialog" class="league-wizard-dialog" aria-labelledby="league-setup-title" aria-describedby="league-setup-description">
          <form id="league-create-review" class="league-wizard-form">
            <header class="league-wizard-header">
              <div>
                <p class="eyebrow">Create league</p>
                <h2 id="league-setup-title">Input league info</h2>
                <p id="league-setup-description" class="lede">Review each section before Mockd creates your league.</p>
              </div>
              <button id="league-setup-close" class="text-button league-wizard-close" type="button" aria-label="Close league setup" title="Close">&times;</button>
            </header>
            <ol class="league-wizard-progress" aria-label="League setup progress">
              <li data-league-step-indicator="basics" aria-current="step">Basics</li>
              <li data-league-step-indicator="scoring">Scoring</li>
              <li data-league-step-indicator="roster">Roster</li>
              <li data-league-step-indicator="teams">Teams</li>
            </ol>
            <div class="league-wizard-body">
              <div class="league-wizard-content">
                <section class="league-wizard-step" data-league-step="basics">
                  <header>
                    <h3>League basics</h3>
                    <p class="lede">ESPN import is optional. It only works when ESPN exposes the league without a login.</p>
                  </header>
                  <div class="setup-fields">
                    <div><label for="league-create-name">League name</label><input id="league-create-name" autocomplete="off" required></div>
                    <div><label for="league-create-season">Season</label><input id="league-create-season" type="number" min="2000" max="2100" step="1" required></div>
                    <div><label for="league-create-team-count">Team count</label><input id="league-create-team-count" type="number" min="4" max="20" step="1" value="12" required></div>
                    <div>
                      <label for="league-create-draft-format">Draft format</label>
                      <select id="league-create-draft-format"><option value="auction">Auction</option><option value="snake">Snake (prep beta)</option></select>
                    </div>
                    <div id="league-create-auction-budget-field"><label for="league-create-auction-budget">Auction budget</label><input id="league-create-auction-budget" type="number" min="1" step="1" value="200"></div>
                    <div id="league-create-auction-minimum-bid-field"><label for="league-create-auction-minimum-bid">Minimum bid</label><input id="league-create-auction-minimum-bid" type="number" min="1" step="1" value="1"></div>
                    <div id="league-create-snake-rounds-field" class="hidden"><label for="league-create-snake-rounds">Snake rounds</label><input id="league-create-snake-rounds" type="number" min="1" step="1" value="16"></div>
                  </div>
                  <p id="league-create-format-note" class="lede"></p>
                  <section class="league-import-panel" aria-labelledby="league-import-heading">
                    <div>
                      <h4 id="league-import-heading">Fill from a public ESPN league</h4>
                      <p class="lede">Paste a league ID or URL. Mockd will show exactly what ESPN returned before changing this form.</p>
                    </div>
                    <div class="league-import-actions">
                      <div><label for="league-create-espn-id">ESPN league ID or URL</label><input id="league-create-espn-id" placeholder="214674 or an ESPN league URL" autocomplete="off"></div>
                      <button id="league-create-review-espn" type="button">Try ESPN import</button>
                    </div>
                    <p id="league-create-import-status" class="status" role="status" aria-live="polite"></p>
                    <div id="league-create-import-summary" class="league-import-summary hidden" role="status">
                      <h4 id="league-create-import-summary-title"></h4>
                      <p id="league-create-import-summary-copy" class="lede"></p>
                      <div id="league-create-import-facts" class="league-import-facts"></div>
                      <ul id="league-create-warnings" class="result-list hidden"></ul>
                    </div>
                  </section>
                </section>
                <section class="league-wizard-step hidden" data-league-step="scoring">
                  <header><h3>Scoring rules</h3><p class="lede">Enter the points your league awards for each event.</p></header>
                  <div class="setup-fields">
                    <div><label for="league-create-pass-yard">Points per passing yard</label><input id="league-create-pass-yard" type="number" min="0" step="0.01" value="0.04" required></div>
                    <div><label for="league-create-pass-td">Points per passing TD</label><input id="league-create-pass-td" type="number" min="0" step="0.1" value="4" required></div>
                    <div><label for="league-create-rush-yard">Points per rushing yard</label><input id="league-create-rush-yard" type="number" min="0" step="0.01" value="0.1" required></div>
                    <div><label for="league-create-rush-td">Points per rushing TD</label><input id="league-create-rush-td" type="number" min="0" step="0.1" value="6" required></div>
                    <div><label for="league-create-receive-yard">Points per receiving yard</label><input id="league-create-receive-yard" type="number" min="0" step="0.01" value="0.1" required></div>
                    <div><label for="league-create-receive-td">Points per receiving TD</label><input id="league-create-receive-td" type="number" min="0" step="0.1" value="6" required></div>
                    <div><label for="league-create-ppr">Points per reception</label><input id="league-create-ppr" type="number" min="0" step="0.1" value="0.5" required></div>
                  </div>
                </section>
                <section class="league-wizard-step hidden" data-league-step="roster">
                  <header><h3>Roster settings</h3><p class="lede">Set the number of slots each team drafts.</p></header>
                  <div id="league-create-roster-slots" class="setup-fields"></div>
                </section>
                <section class="league-wizard-step hidden" data-league-step="teams">
                  <header>
                    <h3>Teams</h3>
                    <p class="lede">Team names are required. Manager names and abbreviations are optional.</p>
                  </header>
                  <section id="league-create-screenshot-panel" class="league-import-panel hidden" aria-labelledby="league-create-screenshot-title">
                    <div>
                      <h4 id="league-create-screenshot-title">Fill teams from an ESPN screenshot</h4>
                      <p class="lede">Your entire selected image is sent to OpenAI for analysis. Before uploading, crop it to only the team and manager rows and remove invite links and email addresses. Mockd retains only the team number, abbreviation, team name, and manager names you approve.</p>
                    </div>
                    <div id="league-create-screenshot-dropzone" class="league-screenshot-dropzone">
                      <strong>Drop a League Members screenshot here</strong>
                      <span>PNG, JPEG, or WebP, up to 5 MB</span>
                      <button id="league-create-screenshot-choose" type="button">Choose screenshot</button>
                      <input id="league-create-screenshot-file" class="hidden" type="file" accept="image/png,image/jpeg,image/webp">
                    </div>
                    <div class="actions">
                      <button id="league-create-screenshot-analyze" type="button" disabled>Analyze screenshot</button>
                    </div>
                    <p id="league-create-screenshot-status" class="status" role="status" aria-live="polite"></p>
                  </section>
                  <p id="league-create-team-progress" class="league-team-progress"></p>
                  <div id="league-create-team-rows" class="league-team-grid"></div>
                </section>
              </div>
            </div>
            <footer class="league-wizard-footer">
              <p id="league-create-status" class="status" role="status" aria-live="polite"></p>
              <button id="league-create-back" type="button">Back</button>
              <button id="league-create-next" class="primary" type="button">Next</button>
              <button id="league-create-submit" class="primary hidden" type="submit" disabled>Finish</button>
            </footer>
          </form>
        </dialog>
        <div class="empty-state">Already invited? Open the invitation link from your commissioner. Your player board remains available before setup.</div>
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
        <section id="team-claim-panel" class="workspace-section hidden" aria-labelledby="team-claim-title">
          <h2 id="team-claim-title">Claim your team</h2>
          <p class="lede">Choose your team before opening private draft prep.</p>
          <div class="actions">
            <select id="team-claim-picker" aria-label="Team to claim"></select>
            <button id="team-claim-button" class="primary" type="button">Claim team</button>
          </div>
          <p id="team-claim-status" class="status" role="status" aria-live="polite"></p>
        </section>
        <div class="facts" aria-label="League readiness">
          <div class="fact"><span>League setup</span><strong id="league-setup-readiness"></strong><a id="league-setup-readiness-action" class="readiness-action hidden"></a></div>
          <div class="fact"><span>My team</span><strong id="team-claim-readiness"></strong><a id="team-claim-readiness-action" class="readiness-action hidden"></a></div>
          <div class="fact"><span>Live draft</span><strong id="live-draft-readiness"></strong><a id="live-draft-readiness-action" class="readiness-action hidden"></a></div>
        </div>
        <section class="workspace-section compact-stack" aria-labelledby="league-overview-title">
          <h2 id="league-overview-title">League settings</h2>
          <div id="league-overview-settings" class="facts" aria-label="League draft and scoring settings"></div>
          <p id="league-overview-team-summary" class="lede">Loading league teams...</p>
          <div id="league-overview-team-table" class="table-scroll hidden">
            <table class="setup-preview-table">
              <thead><tr><th>Team #</th><th>Team</th><th>Managers</th><th>Keepers</th></tr></thead>
              <tbody id="league-overview-team-body"></tbody>
            </table>
          </div>
        </section>
        <section class="workspace-section">
          <h2>Draft schedule</h2>
          <p id="next-draft-at" class="lede">No draft time scheduled.</p>
        </section>
      </section>

      <section id="my-team-workspace" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">My team</p>
            <h1>Post-draft review</h1>
            <p class="lede">Your roster, private draft rank, strengths, risks, and coach readiness.</p>
          </div>
          <a id="my-team-claim-link" class="button hidden" href="/league">Claim team</a>
        </div>
        <p id="my-team-status" class="status" role="status" aria-live="polite"></p>
        <div id="my-team-results" class="stack hidden">
          <div class="facts">
            <div class="fact"><span>Draft rank</span><strong id="my-team-rank">-</strong></div>
            <div class="fact"><span>Teams ranked</span><strong id="my-team-count">-</strong></div>
            <div class="fact"><span>Coach</span><strong id="my-team-coach">-</strong></div>
          </div>
          <div class="setup-layout">
            <section class="workspace-section">
              <h2>Roster</h2>
              <div class="table-scroll">
                <table class="setup-preview-table">
                  <thead><tr><th>Player</th><th>Position</th></tr></thead>
                  <tbody id="my-team-roster-body"></tbody>
                </table>
              </div>
            </section>
            <section class="workspace-section">
              <h2>What stands out</h2>
              <ul id="my-team-findings" class="result-list"></ul>
            </section>
          </div>
        </div>
      </section>

      <section id="mock-draft-workspace" class="workspace hidden">
        <div class="workspace-header">
          <div>
            <p class="eyebrow">Mock draft</p>
            <h1 id="mock-draft-title">League mock room</h1>
            <p class="lede">Draft for your claimed team while Mockd runs the rest of your league.</p>
          </div>
          <div class="actions">
            <button id="mock-draft-start" class="primary" type="button">Start draft</button>
            <button id="mock-draft-buy" class="primary" type="button">Buy</button>
            <button id="mock-draft-pass" type="button">Pass</button>
            <button id="mock-draft-undo" type="button">Undo pick</button>
            <button id="mock-draft-complete" type="button">Finish mock</button>
          </div>
        </div>
        <div class="facts">
          <div class="fact"><span>Status</span><strong id="mock-draft-state">Loading</strong></div>
          <div class="fact"><span>On the clock</span><strong id="mock-draft-on-clock">-</strong></div>
          <div class="fact"><span>Progress</span><strong id="mock-draft-progress">-</strong></div>
        </div>
        <p id="mock-draft-status" class="status" role="status" aria-live="polite"></p>
        <div class="mock-layout">
          <section class="workspace-section">
            <div class="mock-toolbar">
              <div>
                <label for="mock-draft-search">Search available players</label>
                <input id="mock-draft-search" type="search" placeholder="Player or position" autocomplete="off">
              </div>
            </div>
            <div id="mock-draft-player-scroll" class="table-scroll player-board-scroll" tabindex="0" aria-label="Available players">
              <table class="player-board">
                <thead><tr id="mock-draft-player-head"><th class="numeric">Rank</th><th>Player</th><th>Pos</th><th>Status</th><th>Action</th></tr></thead>
                <tbody id="mock-draft-player-rows"></tbody>
              </table>
            </div>
          </section>
          <aside class="workspace-section mock-roster-panel">
            <h2>My roster</h2>
            <ul id="mock-draft-roster" class="mock-roster"></ul>
          </aside>
        </div>
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
            <p id="setup-team-summary" class="lede">Loading teams...</p>
            <div id="setup-team-table" class="table-scroll hidden">
              <table class="setup-preview-table">
                <thead><tr><th>Team #</th><th>Abbr</th><th>Mockd profile</th><th>Managers</th><th>Team</th></tr></thead>
                <tbody id="setup-team-body"></tbody>
              </table>
            </div>
            <div id="setup-settings-summary" class="facts" aria-label="Imported league settings"></div>
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
          <section class="workspace-section" aria-labelledby="history-title">
            <h2 id="history-title">Draft history</h2>
            <p id="historical-import-description" class="lede">Add one or more prior auction draft sheets. Mockd accepts a standard row list or a wide sheet with each team's players in a separate column group.</p>
            <div id="historical-import-dropzone" class="league-screenshot-dropzone" style="margin-top: 16px">
              <strong>Drop prior draft files here</strong>
              <span>CSV, TSV, or XLSX, up to 5 MB each</span>
              <button id="historical-import-choose" type="button">Choose files</button>
              <input id="historical-import-file" class="hidden" type="file" multiple accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
            </div>
            <div id="historical-import-file-list" class="historical-file-list"></div>
            <div class="actions" style="margin-top: 12px">
              <button id="historical-import-button" class="primary" type="button" disabled>Import files</button>
            </div>
            <label class="confirmation-label" for="historical-replace-input" style="margin-top: 12px">
              <input id="historical-replace-input" type="checkbox">
              <span>Replace an existing import when a file uses the same draft year.</span>
            </label>
            <p id="historical-import-status" class="status" role="status" aria-live="polite"></p>
          </section>
          <section class="workspace-section" aria-labelledby="keepers-title">
            <div class="section-title-row">
              <h2 id="keepers-title">Keepers</h2>
              <span id="keeper-save-state" class="saved-indicator">Loading keepers...</span>
            </div>
            <p class="lede">Enter one keeper at a time using a team or manager name, player, and auction cost or snake round. Keepers save automatically, and you can return to edit them until the draft starts.</p>
            <div style="margin-top: 16px">
              <label for="keeper-command-input">Keeper command</label>
              <input id="keeper-command-input" placeholder="Cam keeping Achane 50" autocomplete="off">
            </div>
            <div class="actions" style="margin-top: 12px">
              <button id="keeper-preview-button" type="button">Review keeper</button>
              <button id="keeper-apply-button" class="primary" type="button" disabled>Confirm keeper</button>
            </div>
            <p id="keeper-status" class="status" role="status" aria-live="polite"></p>
            <div id="keeper-list" class="keeper-list"></div>
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
              <label class="confirmation-label" for="setup-final-review">
                <input id="setup-final-review" type="checkbox">
                <span>I reviewed the teams, draft settings, roster rules, history, and keepers. History and keepers may be empty.</span>
              </label>
              <div class="actions">
                <button id="publish-season-button" type="button">Publish league</button>
                <button id="create-live-room-button" class="primary" type="button">Create draft room</button>
                <a id="open-setup-live-room" class="button primary hidden" href="/draft-room">Open draft room</a>
                <button id="cancel-live-room-button" class="hidden" type="button">Cancel room</button>
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
    const verificationMode = window.location.pathname === "/verify-email";
    const forgotPasswordMode = window.location.pathname === "/forgot-password";
    const resetPasswordMode = window.location.pathname === "/reset-password";
    const navigation = ${JSON.stringify(platformShellNavigation)};
    const state = {
      account: null,
      onboarding: null,
      selectedLeague: null,
      invitations: [],
      setupLocked: false,
      draftHasStarted: false,
      workspaceRequestGeneration: 0,
      boardRequestGeneration: 0,
      currentSeason: null,
      claimedTeamIds: new Set(),
      playerCatalog: null,
      playerCatalogSeasonId: null,
      playerCatalogStrategyKey: null,
      playerCatalogMeta: null,
      playerBoardSort: null,
      practiceShortlist: [],
      practiceShortlistSeasonId: null,
      simulation: null,
      simulationHistory: [],
      selectedSimulationRunIndex: 0,
      leagueCreation: null,
      leagueCreationStep: "basics",
      leagueCreationScreenshotAvailable: null,
      leagueCreationScreenshotFile: null,
      leagueCreationScreenshotRequestGeneration: 0,
      leagueCreationScreenshotAbortController: null,
      historicalImportFiles: [],
      historicalImportBusy: false,
      keeperPreviewCommand: null,
      mockSession: null,
      mockDraft: null,
      mockRequestGeneration: 0,
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
    const passwordConfirmationField = byId("password-confirmation-field");
    const passwordConfirmationInput = byId("password-confirmation-input");
    const authRecoveryLink = byId("auth-recovery-link");
    const appHeader = byId("app-header");
    const appShell = byId("app-shell");
    const appStatus = byId("app-status");
    const appError = byId("app-error");
    const appErrorMessage = byId("app-error-message");
    const leaguePicker = byId("header-league-picker");
    const headerLeagueSwitcher = byId("header-league-switcher");
    const accountMenu = byId("account-menu");
    const accountMenuLeagues = byId("account-menu-leagues");
    const commissionerNavItem = byId("commissioner-nav-item");
    const teamClaimPanel = byId("team-claim-panel");
    const teamClaimPicker = byId("team-claim-picker");
    const teamClaimButton = byId("team-claim-button");
    const teamClaimStatus = byId("team-claim-status");
    const leagueOverviewSettings = byId("league-overview-settings");
    const leagueOverviewTeamSummary = byId("league-overview-team-summary");
    const leagueOverviewTeamTable = byId("league-overview-team-table");
    const leagueOverviewTeamBody = byId("league-overview-team-body");
    const setupRowsInput = byId("setup-rows-input");
    const setupPreviewButton = byId("setup-preview-button");
    const setupApplyButton = byId("setup-apply-button");
    const setupStatus = byId("setup-status");
    const setupBlockers = byId("setup-blockers");
    const setupTeamSummary = byId("setup-team-summary");
    const setupTeamTable = byId("setup-team-table");
    const setupTeamBody = byId("setup-team-body");
    const setupSettingsSummary = byId("setup-settings-summary");
    const setupPreviewTable = byId("setup-preview-table");
    const setupPreviewBody = byId("setup-preview-body");
    const setupInvitations = byId("setup-invitations");
    const historicalImportDropzone = byId("historical-import-dropzone");
    const historicalImportChoose = byId("historical-import-choose");
    const historicalImportFile = byId("historical-import-file");
    const historicalImportFileList = byId("historical-import-file-list");
    const historicalImportButton = byId("historical-import-button");
    const historicalReplaceInput = byId("historical-replace-input");
    const historicalImportStatus = byId("historical-import-status");
    const historicalImportDescription = byId("historical-import-description");
    const keeperCommandInput = byId("keeper-command-input");
    const keeperPreviewButton = byId("keeper-preview-button");
    const keeperApplyButton = byId("keeper-apply-button");
    const keeperStatus = byId("keeper-status");
    const keeperList = byId("keeper-list");
    const keeperSaveState = byId("keeper-save-state");
    const myTeamStatus = byId("my-team-status");
    const myTeamClaimLink = byId("my-team-claim-link");
    const myTeamResults = byId("my-team-results");
    const myTeamRosterBody = byId("my-team-roster-body");
    const myTeamFindings = byId("my-team-findings");
    const invitationForm = byId("create-invitation-form");
    const invitationTeamPicker = byId("invitation-team-picker");
    const invitationEmailInput = byId("invitation-email-input");
    const createInvitationButton = byId("create-invitation-button");
    const invitationCreateStatus = byId("invitation-create-status");
    const draftStartsAtInput = byId("draft-starts-at-input");
    const createLiveRoomButton = byId("create-live-room-button");
    const publishSeasonButton = byId("publish-season-button");
    const setupFinalReview = byId("setup-final-review");
    const openSetupLiveRoom = byId("open-setup-live-room");
    const cancelLiveRoomButton = byId("cancel-live-room-button");
    const liveRoomSetupStatus = byId("live-room-setup-status");
    const passwordDialog = byId("password-dialog");
    const passwordChangeForm = byId("password-change-form");
    const currentPasswordInput = byId("current-password-input");
    const newPasswordInput = byId("new-password-input");
    const confirmPasswordInput = byId("confirm-password-input");
    const passwordChangeStatus = byId("password-change-status");
    const passwordChangeSubmit = byId("password-change-submit");
    const standalonePlayerSearch = byId("standalone-player-search");
    const standalonePositionFilter = byId("standalone-position-filter");
    const practiceStrategy = byId("practice-strategy");
    const standaloneBoardSort = byId("standalone-board-sort");
    const standaloneBoardStatus = byId("standalone-board-status");
    const standaloneShortlistOnly = byId("standalone-shortlist-only");
    const standaloneShortlistCount = byId("standalone-shortlist-count");
    const standalonePlayerRows = byId("standalone-player-rows");
    const standalonePricingSource = byId("standalone-pricing-source");
    const standalonePricingWarnings = byId("standalone-pricing-warnings");
    const simulationPanel = byId("simulation-panel");
    const simulationStrategy = byId("simulation-strategy");
    const simulationCount = byId("simulation-count");
    const simulationNote = byId("simulation-note");
    const simulationRun = byId("simulation-run");
    const simulationStatus = byId("simulation-status");
    const simulationResults = byId("simulation-results");
    const simulationWarnings = byId("simulation-warnings");
    const simulationExposureBody = byId("simulation-exposure-body");
    const simulationRunPicker = byId("simulation-run-picker");
    const simulationLeagueGrid = byId("simulation-league-grid");
    const simulationHistory = byId("simulation-history");
    const simulationHistoryPicker = byId("simulation-history-picker");
    const simulationHistoryOpen = byId("simulation-history-open");
    const simulationHistoryNote = byId("simulation-history-note");
    const mockDraftStatus = byId("mock-draft-status");
    const mockDraftSearch = byId("mock-draft-search");
    const mockDraftPlayerRows = byId("mock-draft-player-rows");
    const mockDraftRoster = byId("mock-draft-roster");
    const mockDraftStart = byId("mock-draft-start");
    const mockDraftBuy = byId("mock-draft-buy");
    const mockDraftPass = byId("mock-draft-pass");
    const mockDraftUndo = byId("mock-draft-undo");
    const mockDraftComplete = byId("mock-draft-complete");
    const leagueSetupDialog = byId("league-setup-dialog");
    const leagueCreateReview = byId("league-create-review");
    const leagueCreateEspnId = byId("league-create-espn-id");
    const leagueCreateSeason = byId("league-create-season");
    const leagueCreateTeamCount = byId("league-create-team-count");
    const leagueCreateImportStatus = byId("league-create-import-status");
    const leagueCreateImportSummary = byId("league-create-import-summary");
    const leagueCreateImportSummaryTitle = byId("league-create-import-summary-title");
    const leagueCreateImportSummaryCopy = byId("league-create-import-summary-copy");
    const leagueCreateImportFacts = byId("league-create-import-facts");
    const leagueCreateName = byId("league-create-name");
    const leagueCreateDraftFormat = byId("league-create-draft-format");
    const leagueCreateAuctionBudget = byId("league-create-auction-budget");
    const leagueCreateAuctionMinimumBid = byId("league-create-auction-minimum-bid");
    const leagueCreateSnakeRounds = byId("league-create-snake-rounds");
    const leagueCreateFormatNote = byId("league-create-format-note");
    const leagueCreateWarnings = byId("league-create-warnings");
    const leagueCreateRosterSlots = byId("league-create-roster-slots");
    const leagueCreatePassYard = byId("league-create-pass-yard");
    const leagueCreatePassTd = byId("league-create-pass-td");
    const leagueCreateRushYard = byId("league-create-rush-yard");
    const leagueCreateRushTd = byId("league-create-rush-td");
    const leagueCreateReceiveYard = byId("league-create-receive-yard");
    const leagueCreateReceiveTd = byId("league-create-receive-td");
    const leagueCreatePpr = byId("league-create-ppr");
    const leagueCreateScreenshotPanel = byId("league-create-screenshot-panel");
    const leagueCreateScreenshotDropzone = byId("league-create-screenshot-dropzone");
    const leagueCreateScreenshotChoose = byId("league-create-screenshot-choose");
    const leagueCreateScreenshotFile = byId("league-create-screenshot-file");
    const leagueCreateScreenshotAnalyze = byId("league-create-screenshot-analyze");
    const leagueCreateScreenshotStatus = byId("league-create-screenshot-status");
    const leagueCreateTeamRows = byId("league-create-team-rows");
    const leagueCreateTeamProgress = byId("league-create-team-progress");
    const leagueCreateBack = byId("league-create-back");
    const leagueCreateNext = byId("league-create-next");
    const leagueCreateSubmit = byId("league-create-submit");
    const leagueCreateStatus = byId("league-create-status");

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
        : "/practice";
    };

    const configureAuthMode = () => {
      authTitle.textContent = signupMode
        ? "Create your account"
        : verificationMode
          ? "Verify your email"
          : forgotPasswordMode
            ? "Reset your password"
            : resetPasswordMode
              ? "Choose a new password"
              : "Sign in";
      authDescription.textContent = signupMode
        ? "Create a league as commissioner, or join one from an invitation."
        : verificationMode
          ? "Open the link from your email, or request a new one."
          : forgotPasswordMode
            ? "Enter your account email. We'll send a reset link if an account exists."
            : resetPasswordMode
              ? "Choose a new password for your Mockd account."
              : "Open your league, draft tools, and live room.";
      authSubmitButton.textContent = signupMode
        ? "Create account"
        : verificationMode
          ? "Send verification link"
          : forgotPasswordMode
            ? "Send reset link"
            : resetPasswordMode
              ? "Update password"
              : "Sign in";
      const recoveryMode = verificationMode || forgotPasswordMode || resetPasswordMode;
      authModePrompt.textContent = recoveryMode
        ? "Ready to sign in?"
        : signupMode
          ? "Already have an account?"
          : "New to Mockd?";
      authModeLink.textContent = recoveryMode ? "Back to sign in" : signupMode ? "Sign in" : "Create account";
      setHidden(authModePrompt, false);
      setHidden(authModeLink, false);
      const modeReturnPath = routePath === "/login" || routePath === "/signup"
        ? authenticationReturnPath()
        : returnPath();
      authModeLink.href = recoveryMode
        ? "/login?returnTo=" + encodeURIComponent(authenticationReturnPath())
        : (signupMode ? "/login?returnTo=" : "/signup?returnTo=") + encodeURIComponent(modeReturnPath);
      const emailOnlyMode = verificationMode || forgotPasswordMode;
      setHidden(emailInput.closest("div"), resetPasswordMode);
      emailInput.required = !resetPasswordMode;
      setHidden(passwordInput.closest("div"), emailOnlyMode);
      passwordInput.required = !emailOnlyMode;
      passwordInput.autocomplete = signupMode || resetPasswordMode ? "new-password" : "current-password";
      setHidden(passwordConfirmationField, !resetPasswordMode);
      passwordConfirmationInput.required = resetPasswordMode;
      setHidden(authRecoveryLink, signupMode || verificationMode || forgotPasswordMode || resetPasswordMode);
      const requestedEmail = new URLSearchParams(window.location.search).get("email");
      if ((verificationMode || forgotPasswordMode) && requestedEmail) emailInput.value = requestedEmail;
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
      const verificationToken = verificationMode
        ? new URLSearchParams(window.location.search).get("token")
        : null;
      if (verificationToken) {
        setHidden(authForm, true);
        authNotice.textContent = "Verifying your email...";
        setHidden(authNotice, false);
        fetch("/email-verifications/consume", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token: verificationToken }),
        }).then(readJson).then(() => {
          authNotice.textContent = "Email verified. You can sign in now.";
        }).catch(error => {
          authNotice.textContent = "";
          setHidden(authNotice, true);
          authError.textContent = error.message;
          setHidden(authError, false);
        });
        return;
      }
      (resetPasswordMode ? passwordInput : emailInput).focus();
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

    const renderReadinessAction = (elementId, label, href) => {
      const element = byId(elementId);
      element.textContent = label || "";
      if (href) element.href = href;
      else element.removeAttribute("href");
      setHidden(element, !label || !href);
    };

    const practicePlayerKey = value => String(value || "").trim().toLowerCase().replace(/\s+/gu, " ");
    const isPracticePlayerShortlisted = playerName => state.practiceShortlist.some(item =>
      practicePlayerKey(item.playerName) === practicePlayerKey(playerName)
    );

    const renderStandaloneBoard = () => {
      const playerCatalog = state.playerCatalog || [];
      const search = standalonePlayerSearch.value.trim().toLowerCase();
      const position = standalonePositionFilter.value;
      const snake = state.playerCatalogMeta?.draftFormat === "snake";
      const sortMode = standaloneBoardSort.value || state.playerBoardSort || "market";
      const numericValue = value => Number.isFinite(Number(value)) ? Number(value) : 0;
      const sortValue = player => {
        if (sortMode === "rank") return numericValue(player.marketRank || player.rank);
        if (sortMode === "mine") {
          return snake
            ? numericValue(player.leagueRank || player.marketRank || player.rank)
            : numericValue(player.myValue ?? player.leagueValue ?? player.expectedPrice);
        }
        return snake
          ? numericValue(player.marketRank || player.rank)
          : numericValue(player.marketPrice ?? player.expectedPrice);
      };
      const sortedPlayers = playerCatalog.slice().sort((left, right) => {
        const difference = sortMode === "rank" || snake
          ? sortValue(left) - sortValue(right)
          : sortValue(right) - sortValue(left);
        return difference
          || numericValue(left.rank) - numericValue(right.rank)
          || String(left.name).localeCompare(String(right.name));
      }).map((player, index) => ({ player: player, displayRank: index + 1 }));
      const visiblePlayers = sortedPlayers.filter(entry => {
        const player = entry.player;
        if (standaloneShortlistOnly.checked && !isPracticePlayerShortlisted(player.name)) return false;
        if (position && player.position !== position) return false;
        if (!search) return true;
        return [player.name, player.position, player.teamAbbreviation]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(search));
      });
      const fragment = document.createDocumentFragment();
      visiblePlayers.forEach(entry => {
        const player = entry.player;
        const row = document.createElement("tr");
        row.classList.toggle("keeper-player-row", player.isKeeper === true);
        row.classList.toggle("shortlisted-player-row", isPracticePlayerShortlisted(player.name));
        const shortlistCell = document.createElement("td");
        shortlistCell.dataset.label = "Target";
        const shortlistButton = document.createElement("button");
        const isShortlisted = isPracticePlayerShortlisted(player.name);
        shortlistButton.type = "button";
        shortlistButton.className = "shortlist-toggle";
        shortlistButton.textContent = isShortlisted ? "\u2605" : "\u2606";
        shortlistButton.setAttribute("aria-pressed", String(isShortlisted));
        shortlistButton.setAttribute(
          "aria-label",
          (isShortlisted ? "Remove " : "Add ") + player.name + (isShortlisted ? " from" : " to") + " shortlist",
        );
        shortlistButton.title = isShortlisted ? "Remove from shortlist" : "Add to shortlist";
        shortlistButton.disabled = !state.selectedLeague;
        shortlistButton.addEventListener("click", () => togglePracticeShortlist(player, shortlistButton));
        shortlistCell.append(shortlistButton);
        row.append(shortlistCell);
        const values = [
          { label: "Rank", value: String(entry.displayRank), className: "numeric" },
          { label: "Player", value: player.name, className: "player-name" },
          { label: "Position", value: player.position || "-" },
          { label: "NFL team", value: player.teamAbbreviation || "FA" },
          { label: "Bye", value: player.byeWeek == null ? "-" : String(player.byeWeek), className: "numeric" },
          { label: "Market", value: snake ? String(player.marketRank || "-") : "$" + Math.round(Number(player.marketPrice ?? player.expectedPrice ?? 0)), className: "numeric" },
          { label: "My value", value: snake ? String(player.leagueRank || player.marketRank || "-") : "$" + Math.round(Number(player.myValue ?? player.leagueValue ?? player.expectedPrice ?? 0)), className: "numeric" },
        ];
        values.forEach(cellValue => {
          const cell = document.createElement("td");
          cell.dataset.label = cellValue.label;
          if (cellValue.className) cell.className = cellValue.className;
          if (cellValue.label === "Player") {
            const name = document.createElement("span");
            name.textContent = cellValue.value;
            cell.append(name);
            if (player.isKeeper) {
              const keeper = document.createElement("span");
              keeper.className = "keeper-badge";
              keeper.textContent = player.keeperPrice === undefined ? "Keeper" : "Keeper · $" + player.keeperPrice;
              cell.append(keeper);
            }
          } else {
            cell.textContent = cellValue.value;
          }
          row.append(cell);
        });
        fragment.append(row);
      });
      standalonePlayerRows.replaceChildren(fragment);
      standaloneShortlistCount.textContent = String(state.practiceShortlist.length);
      const personalized = state.playerCatalogMeta?.personalized === true;
      const warnings = state.playerCatalogMeta?.pricingWarnings || [];
      const historyUnavailable = warnings.some(warning => warning.toLowerCase().includes("history unavailable"));
      standalonePricingSource.textContent = personalized && !historyUnavailable
        ? "Market uses your league's history, inflation, and keeper pool. My value applies your " + state.playerCatalogMeta.strategyLabel + " strategy."
        : personalized
          ? "Market uses the current baseline with this league's roster and keeper context. Import draft history to calibrate league inflation; My value applies your " + state.playerCatalogMeta.strategyLabel + " strategy."
        : state.playerCatalogMeta?.draftFormat
          ? "Market uses the current baseline. Import draft history to calibrate it to your league; My value applies your strategy."
          : "Pricing source: current market board. Create a league to add history and keeper context.";
      standalonePricingWarnings.replaceChildren();
      warnings.slice(0, 6).forEach(warning => {
        const item = document.createElement("li");
        item.textContent = warning;
        standalonePricingWarnings.append(item);
      });
      if (warnings.length > 6) {
        const item = document.createElement("li");
        item.textContent = String(warnings.length - 6) + " more pricing warnings apply.";
        standalonePricingWarnings.append(item);
      }
      setHidden(standalonePricingWarnings, warnings.length === 0);
      const valueStatus = state.playerCatalogMeta?.personalized && !historyUnavailable
        ? " · league-calibrated values active"
        : state.playerCatalogMeta?.personalized
          ? " · league context active; history not yet calibrated"
        : state.playerCatalogMeta?.draftFormat
          ? " · baseline values until history is imported"
          : "";
      standaloneBoardStatus.textContent = visiblePlayers.length + " shown / " + playerCatalog.length + " loaded"
        + " · " + state.practiceShortlist.length + " shortlisted" + valueStatus;
    };

    const loadStandaloneBoard = async () => {
      setHidden(byId("standalone-board"), false);
      const seasonId = state.selectedLeague?.seasonId || null;
      const strategyKey = practiceStrategy.value;
      if (state.playerCatalog === null || state.playerCatalogSeasonId !== seasonId || state.playerCatalogStrategyKey !== strategyKey) {
        const requestGeneration = ++state.boardRequestGeneration;
        standaloneBoardStatus.textContent = "Loading players...";
        const endpoint = seasonId
          ? "/player-catalog?seasonId=" + encodeURIComponent(seasonId) + "&strategy=" + encodeURIComponent(strategyKey)
          : "/player-catalog?strategy=" + encodeURIComponent(strategyKey);
        const body = await readJson(await fetch(endpoint, { credentials: "same-origin" }));
        if (
          requestGeneration !== state.boardRequestGeneration
          || (state.selectedLeague?.seasonId || null) !== seasonId
          || practiceStrategy.value !== strategyKey
        ) return;
        state.playerCatalog = (body.players || []).map((player, index) => ({ ...player, rank: index + 1 }));
        state.playerCatalogSeasonId = seasonId;
        state.playerCatalogStrategyKey = strategyKey;
        const pricingWarnings = [...new Set((body.players || []).flatMap(player =>
          Array.isArray(player.pricingWarnings)
            ? player.pricingWarnings.filter(warning => typeof warning === "string" && warning.trim())
            : [],
        ))];
        state.playerCatalogMeta = {
          draftFormat: body.draftFormat || null,
          personalized: body.personalized === true,
          strategyLabel: body.strategyLabel || "balanced",
          pricingWarnings: pricingWarnings,
        };
        state.playerBoardSort = body.personalized === true ? "mine" : "market";
        standaloneBoardSort.value = state.playerBoardSort;
        standalonePositionFilter.replaceChildren();
        const allPositionsOption = document.createElement("option");
        allPositionsOption.value = "";
        allPositionsOption.textContent = "All positions";
        standalonePositionFilter.append(allPositionsOption);
        const positions = [...new Set(state.playerCatalog.map(player => player.position).filter(Boolean))].sort();
        positions.forEach(position => {
          const option = document.createElement("option");
          option.value = position;
          option.textContent = position;
          standalonePositionFilter.append(option);
        });
      }
      renderStandaloneBoard();
    };

    const loadPracticeShortlist = async (selectedLeague, requestGeneration) => {
      if (!selectedLeague) {
        state.practiceShortlist = [];
        state.practiceShortlistSeasonId = null;
        renderStandaloneBoard();
        return;
      }
      const body = await readJson(await fetch(
        "/practice-shortlist?seasonId=" + encodeURIComponent(selectedLeague.seasonId),
        { credentials: "same-origin" },
      ));
      if (
        requestGeneration !== state.workspaceRequestGeneration
        || state.selectedLeague?.seasonId !== selectedLeague.seasonId
      ) return;
      state.practiceShortlist = body.items || [];
      state.practiceShortlistSeasonId = selectedLeague.seasonId;
      renderStandaloneBoard();
    };

    const togglePracticeShortlist = async (player, button) => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) return;
      const existing = isPracticePlayerShortlisted(player.name);
      button.disabled = true;
      try {
        await readJson(await fetch("/practice-shortlist", {
          method: existing ? "DELETE" : "PUT",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            seasonId: selectedLeague.seasonId,
            playerName: player.name,
            position: player.position,
          }),
        }));
        await loadPracticeShortlist(selectedLeague, state.workspaceRequestGeneration);
      } catch (error) {
        standaloneBoardStatus.textContent = error.message;
        button.disabled = false;
      }
    };

    const configureSimulationPanel = selectedLeague => {
      setHidden(simulationPanel, false);
      setHidden(simulationResults, true);
      state.simulation = null;
      state.simulationHistory = [];
      state.selectedSimulationRunIndex = 0;
      simulationExposureBody.replaceChildren();
      simulationRunPicker.replaceChildren();
      simulationLeagueGrid.replaceChildren();
      simulationWarnings.replaceChildren();
      renderSimulationHistory();
      const canRun = Boolean(selectedLeague.membership?.teamId);
      simulationRun.disabled = !canRun;
      simulationStatus.textContent = canRun
        ? ""
        : "Claim your team from League before running private simulations.";
      const requestedStrategy = new URLSearchParams(window.location.search).get("strategy");
      if (!simulationStrategy.value && requestedStrategy) simulationStrategy.value = requestedStrategy;
      loadSimulationHistory(selectedLeague, state.workspaceRequestGeneration).catch(error => {
        if (state.selectedLeague?.seasonId === selectedLeague.seasonId) {
          simulationStatus.textContent = error.message;
        }
      });
    };

    const renderSimulationHistory = () => {
      simulationHistoryPicker.replaceChildren();
      state.simulationHistory.forEach(run => {
        const simulation = run.simulation;
        const option = document.createElement("option");
        option.value = run.id;
        const timestamp = new Date(run.completedAt || run.createdAt).toLocaleString();
        option.textContent = timestamp + " · " + simulation.runCount + " runs · "
          + (simulation.strategy?.summary || "Best available roster fit");
        simulationHistoryPicker.append(option);
      });
      const hasHistory = state.simulationHistory.length > 0;
      setHidden(simulationHistory, !hasHistory);
      simulationHistoryOpen.disabled = !hasHistory;
      simulationHistoryNote.textContent = hasHistory
        ? state.simulationHistory[0]?.note || "No note saved for this run."
        : "";
    };

    const loadSimulationHistory = async (selectedLeague, requestGeneration) => {
      const body = await readJson(await fetch(
        "/season-simulations?seasonId=" + encodeURIComponent(selectedLeague.seasonId),
        { credentials: "same-origin" },
      ));
      if (
        requestGeneration !== state.workspaceRequestGeneration
        || state.selectedLeague?.seasonId !== selectedLeague.seasonId
      ) return;
      state.simulationHistory = body.history || [];
      renderSimulationHistory();
    };

    const renderSimulationRun = () => {
      const simulation = state.simulation;
      const run = simulation?.runs?.[state.selectedSimulationRunIndex];
      simulationLeagueGrid.replaceChildren();
      if (!run) return;

      const fragment = document.createDocumentFragment();
      [...run.teams]
        .sort((left, right) => Number(right.isUserTeam === true) - Number(left.isUserTeam === true))
        .forEach(team => {
        const panel = document.createElement("article");
        panel.className = "simulation-team";
        panel.dataset.userTeam = String(team.isUserTeam === true);

        const header = document.createElement("header");
        header.className = "simulation-team-header";
        const identity = document.createElement("div");
        const heading = document.createElement("h3");
        heading.textContent = team.teamName;
        if (team.isUserTeam) {
          const badge = document.createElement("span");
          badge.className = "team-badge";
          badge.textContent = "Your team";
          heading.append(badge);
        }
        const budget = document.createElement("div");
        budget.className = "simulation-team-summary";
        budget.textContent = team.spent === undefined
          ? team.roster.length + " picks"
          : "$" + team.spent + " spent · $" + team.budgetRemaining + " left";
        identity.append(heading, budget);
        const score = document.createElement("div");
        score.className = "simulation-team-score";
        score.textContent = Number(team.week1Points || 0).toFixed(1);
        const scoreLabel = document.createElement("span");
        scoreLabel.className = "player-meta";
        scoreLabel.textContent = "Week 1";
        score.append(scoreLabel);
        header.append(identity, score);

        const table = document.createElement("table");
        table.className = "simulation-team-roster";
        const tableHead = document.createElement("thead");
        const headRow = document.createElement("tr");
        ["Slot", "Player", "Result", "W1"].forEach((label, index) => {
          const cell = document.createElement("th");
          cell.textContent = label;
          if (index > 1) cell.className = "numeric";
          headRow.append(cell);
        });
        tableHead.append(headRow);
        const body = document.createElement("tbody");
        team.roster.forEach(player => {
          const row = document.createElement("tr");
          row.dataset.starter = String(player.starter === true);
          const result = player.price !== undefined
            ? "$" + player.price
            : player.overallPick !== undefined
              ? "#" + player.overallPick
              : "-";
          [player.rosterSlot, player.playerName, result, Number(player.week1Points || 0).toFixed(1)].forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            if (index > 1) cell.className = "numeric";
            if (index === 1 && player.source === "keeper") {
              const badge = document.createElement("span");
              badge.className = "keeper-badge";
              badge.textContent = "Keeper";
              cell.append(badge);
            }
            row.append(cell);
          });
          body.append(row);
        });
        table.append(tableHead, body);
        panel.append(header, table);
        fragment.append(panel);
        });
      simulationLeagueGrid.replaceChildren(fragment);
    };

    const renderSimulationResult = (simulation, note = "") => {
      byId("simulation-strategy-summary").textContent = simulation.strategy?.summary || "Best available roster fit.";
      simulationWarnings.replaceChildren();
      (simulation.strategy?.warnings || []).forEach(warning => {
        const item = document.createElement("li");
        item.textContent = warning;
        simulationWarnings.append(item);
      });
      setHidden(simulationWarnings, simulationWarnings.childElementCount === 0);
      byId("simulation-completed").textContent = simulation.completedCount + " / " + simulation.runCount;
      byId("simulation-target-rate").textContent = simulation.targetOutcome
        ? Math.round(simulation.targetOutcome.hitRate * 100) + "% · " + simulation.targetOutcome.playerName
        : "No named target";
      byId("simulation-format").textContent = titleCase(simulation.draftFormat);

      const exposureFragment = document.createDocumentFragment();
      (simulation.playerExposure || []).slice(0, 10).forEach(player => {
        const row = document.createElement("tr");
        const average = player.averagePrice !== undefined
          ? "$" + Number(player.averagePrice).toFixed(1)
          : player.averagePick !== undefined
            ? "Pick " + Number(player.averagePick).toFixed(1)
            : "-";
        [player.playerName, player.position, Math.round(player.rate * 100) + "%", average].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
        exposureFragment.append(row);
      });
      simulationExposureBody.replaceChildren(exposureFragment);

      state.simulation = simulation;
      state.selectedSimulationRunIndex = 0;
      simulationRunPicker.replaceChildren();
      (simulation.runs || []).forEach((run, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = run.label || "Run " + (index + 1);
        simulationRunPicker.append(option);
      });
      renderSimulationRun();
      simulationStatus.textContent = "Simulation results are private to your account.";
      simulationHistoryNote.textContent = note || "No note saved for this run.";
      setHidden(simulationResults, false);
    };

    const runBoardSimulations = async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague?.membership?.teamId) return;
      const seasonId = selectedLeague.seasonId;
      const requestGeneration = state.workspaceRequestGeneration;
      const note = simulationNote.value.trim();
      const count = Number(simulationCount.value);
      simulationRun.disabled = true;
      setHidden(simulationResults, true);
      simulationStatus.textContent = "Running " + count + " league drafts...";
      try {
        const body = await readJson(await fetch("/season-simulations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            seasonId,
            count: count,
            strategyPreset: practiceStrategy.value,
            strategy: simulationStrategy.value.trim(),
            note,
          }),
        }));
        if (!isCurrentWorkspaceRequest(seasonId, requestGeneration)) return;
        renderSimulationResult(body.simulation, note);
        await loadSimulationHistory(selectedLeague, requestGeneration);
      } catch (error) {
        if (isCurrentWorkspaceRequest(seasonId, requestGeneration)) {
          simulationStatus.textContent = error.message;
        }
      } finally {
        if (isCurrentWorkspaceRequest(seasonId, requestGeneration)) {
          simulationRun.disabled = false;
        }
      }
    };

    const leagueRosterSlotOrder = ${JSON.stringify(rosterSlotDisplayOrder)};
    const leagueCreationSteps = ["basics", "scoring", "roster", "teams"];
    const defaultLeagueRosterSlots = {
      QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1, BENCH: 7,
    };

    const updateLeagueCreationFormatFields = () => {
      const isSnake = leagueCreateDraftFormat.value === "snake";
      setHidden(byId("league-create-auction-budget-field"), isSnake);
      setHidden(byId("league-create-auction-minimum-bid-field"), isSnake);
      setHidden(byId("league-create-snake-rounds-field"), !isSnake);
      leagueCreateFormatNote.textContent = isSnake
        ? "Snake values, simulations, and mock drafts are available in beta. Hosted live drafting is currently auction-only."
        : "Auction values, simulations, mock drafts, and hosted live drafting are available.";
    };

    const renderLeagueCreationTeamRows = teams => {
      const fragment = document.createDocumentFragment();
      teams.forEach((team, index) => {
        const row = document.createElement("section");
        row.className = "league-team-row";
        row.dataset.teamIndex = String(index);
        const issues = [...(team.issues || [])];
        const needsReview = (team.confidence !== undefined && team.confidence !== "high") || issues.length > 0;
        row.dataset.needsReview = String(needsReview);
        const title = document.createElement("h4");
        title.textContent = "Team " + String(index + 1);
        const field = (fieldName, value, labelText, required) => {
          const wrapper = document.createElement("div");
          const label = document.createElement("label");
          const input = document.createElement("input");
          const id = "league-create-team-" + String(index + 1) + "-" + fieldName;
          label.htmlFor = id;
          label.textContent = labelText;
          input.id = id;
          input.value = value;
          input.dataset.field = fieldName;
          input.required = required;
          if (fieldName === "abbreviation") input.maxLength = 12;
          wrapper.append(label, input);
          return wrapper;
        };
        const meta = document.createElement("div");
        meta.className = "league-team-meta";
        meta.append(
          field("managerNames", (team.managerNames || []).join("; "), "Manager names", false),
          field("abbreviation", team.abbreviation || "", "Abbreviation", false),
        );
        row.append(title);
        if (needsReview) {
          const review = document.createElement("p");
          review.className = "league-team-review";
          review.textContent = issues.length
            ? issues.join(" ")
            : "Double-check this screenshot reading.";
          const confirmation = document.createElement("label");
          confirmation.className = "confirmation-label";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = team.confirmed === true;
          checkbox.dataset.screenshotReviewConfirmation = "true";
          const confirmationText = document.createElement("span");
          confirmationText.textContent = "I checked Team " + String(index + 1);
          confirmation.append(checkbox, confirmationText);
          row.append(review, confirmation);
        }
        row.append(field("displayName", team.displayName || "", "Team name", true), meta);
        fragment.append(row);
      });
      leagueCreateTeamRows.replaceChildren(fragment);
      updateLeagueCreationSubmit();
    };

    const renderLeagueCreationRosterSlots = rosterSlots => {
      const fragment = document.createDocumentFragment();
      const rosterSlotRank = slot => {
        const index = leagueRosterSlotOrder.indexOf(slot);
        return index === -1 ? leagueRosterSlotOrder.length : index;
      };
      Object.entries(rosterSlots)
        .sort(([left], [right]) => rosterSlotRank(left) - rosterSlotRank(right) || left.localeCompare(right))
        .forEach(entry => {
          const field = document.createElement("div");
          const label = document.createElement("label");
          const input = document.createElement("input");
          label.textContent = entry[0];
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.value = String(entry[1]);
          input.dataset.rosterSlot = entry[0];
          label.htmlFor = "league-create-roster-slot-" + entry[0].toLowerCase();
          input.id = label.htmlFor;
          field.append(label, input);
          fragment.append(field);
        });
      leagueCreateRosterSlots.replaceChildren(fragment);
    };

    const readLeagueCreationTeams = () => [...leagueCreateTeamRows.querySelectorAll("[data-team-index]")]
      .map((row, index) => {
        const valueFor = field => row.querySelector('[data-field="' + field + '"]').value.trim();
        const sourceTeam = state.leagueCreation?.teams[index];
        return {
          externalTeamId: sourceTeam?.externalTeamId || String(index + 1),
          displayName: valueFor("displayName"),
          abbreviation: valueFor("abbreviation"),
          managerNames: valueFor("managerNames").split(/[;,]/u).map(value => value.trim()).filter(Boolean),
          confidence: sourceTeam?.confidence,
          issues: [...(sourceTeam?.issues || [])],
          confirmed: row.querySelector("[data-screenshot-review-confirmation]")?.checked === true,
        };
      });

    const leagueCreationTeamsForSubmission = () => readLeagueCreationTeams().map(team => ({
      externalTeamId: team.externalTeamId,
      displayName: team.displayName,
      abbreviation: team.abbreviation,
      managerNames: team.managerNames,
    }));

    const teamNamesComplete = () => {
      const teams = readLeagueCreationTeams();
      const expectedTeamCount = Number(leagueCreateTeamCount.value);
      const normalizedNames = teams.map(team => team.displayName.toLowerCase());
      const reviewConfirmed = [...leagueCreateTeamRows.querySelectorAll("[data-screenshot-review-confirmation]")]
        .every(input => input.checked);
      return teams.length === expectedTeamCount
        && teams.every(team =>
          team.displayName.length > 0
          && (team.confidence === undefined
            || (!team.displayName.includes("...") && !team.displayName.includes(String.fromCharCode(8230))))
          && team.abbreviation.length <= 12)
        && new Set(normalizedNames).size === normalizedNames.length
        && reviewConfirmed;
    };

    const leagueCreationTeamValidationMessage = () => {
      const teams = readLeagueCreationTeams();
      const expectedTeamCount = Number(leagueCreateTeamCount.value) || 0;
      if (teams.length !== expectedTeamCount || teams.some(team => team.displayName.length === 0)) {
        const completed = teams.filter(team => team.displayName.length > 0).length;
        return String(completed) + " of " + String(expectedTeamCount) + " team names entered";
      }
      if (teams.some(team => team.confidence !== undefined
        && (team.displayName.includes("...") || team.displayName.includes(String.fromCharCode(8230))))) {
        return "Replace each truncated team name before finishing.";
      }
      if (teams.some(team => team.abbreviation.length > 12)) {
        return "Shorten each abbreviation to 12 characters or fewer.";
      }
      const normalizedNames = teams.map(team => team.displayName.toLowerCase());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        return "Give each team a unique name before finishing.";
      }
      if ([...leagueCreateTeamRows.querySelectorAll("[data-screenshot-review-confirmation]")].some(input => !input.checked)) {
        return "Confirm each uncertain screenshot row before finishing.";
      }
      return "All " + String(expectedTeamCount) + " team names entered";
    };

    const updateLeagueCreationSubmit = () => {
      leagueCreateTeamProgress.textContent = leagueCreationTeamValidationMessage();
      leagueCreateSubmit.disabled = !teamNamesComplete();
    };

    const applyLeagueCreationReview = review => {
      state.leagueCreation = review;
      leagueCreateName.value = review.leagueName || "";
      leagueCreateSeason.value = String(review.seasonYear || new Date().getFullYear());
      leagueCreateTeamCount.value = String(review.teams.length);
      leagueCreateDraftFormat.value = review.draft.type;
      if (review.draft.type === "auction") {
        leagueCreateAuctionBudget.value = String(review.draft.budgetDollars);
        leagueCreateAuctionMinimumBid.value = String(review.draft.minimumBidDollars);
      }
      if (review.draft.type === "snake") leagueCreateSnakeRounds.value = String(review.draft.rounds);
      leagueCreatePassYard.value = String(review.scoring.passingYards);
      leagueCreatePassTd.value = String(review.scoring.passingTouchdown);
      leagueCreateRushYard.value = String(review.scoring.rushingYards);
      leagueCreateRushTd.value = String(review.scoring.rushingTouchdown);
      leagueCreateReceiveYard.value = String(review.scoring.receivingYards);
      leagueCreateReceiveTd.value = String(review.scoring.receivingTouchdown);
      leagueCreatePpr.value = String(review.scoring.reception);
      renderLeagueCreationRosterSlots(review.rosterSlots);
      renderLeagueCreationTeamRows(review.teams);
      updateLeagueCreationFormatFields();
    };

    const leagueCreationReviewFromEspn = outcome => {
      const review = outcome.review;
      return {
        provider: "espn",
        leagueName: review.leagueName || "",
        externalLeagueId: review.externalLeagueId,
        seasonYear: review.season,
        teams: review.teams.map(team => ({
          externalTeamId: team.externalTeamId,
          displayName: team.displayName,
          abbreviation: team.abbreviation || "",
          managerNames: [],
          confidence: "high",
          issues: [],
        })),
        draft: review.draft,
        scoring: {
          passingYards: review.scoring.pointsPerPassingYard,
          passingTouchdown: review.scoring.pointsPerPassingTouchdown,
          rushingYards: review.scoring.pointsPerRushingYard,
          rushingTouchdown: review.scoring.pointsPerRushingTouchdown,
          receivingYards: review.scoring.pointsPerReceivingYard,
          receivingTouchdown: review.scoring.pointsPerReceivingTouchdown,
          reception: review.scoring.pointsPerReception,
        },
        rosterSlots: review.rosterSlots,
        warnings: outcome.warnings || [],
      };
    };

    const newManualLeagueId = () => "mockd-" + (
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : Date.now().toString(36)
    );

    const manualLeagueCreationReview = () => {
      const teamCount = Math.max(4, Math.min(20, Number(leagueCreateTeamCount.value) || 12));
      return {
        provider: "mockd",
        leagueName: leagueCreateName.value.trim(),
        externalLeagueId: newManualLeagueId(),
        seasonYear: Number(leagueCreateSeason.value) || new Date().getFullYear(),
        teams: Array.from({ length: teamCount }, (_, index) => ({
          externalTeamId: String(index + 1),
          displayName: "",
          abbreviation: "",
          managerNames: [],
        })),
        draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
        scoring: {
          passingYards: 0.04,
          passingTouchdown: 4,
          rushingYards: 0.1,
          rushingTouchdown: 6,
          receivingYards: 0.1,
          receivingTouchdown: 6,
          reception: 0.5,
        },
        rosterSlots: { ...defaultLeagueRosterSlots },
        warnings: [],
      };
    };

    const syncLeagueCreationFromBasics = () => {
      if (!state.leagueCreation) state.leagueCreation = manualLeagueCreationReview();
      const teamCount = Math.max(4, Math.min(20, Number(leagueCreateTeamCount.value) || 12));
      leagueCreateTeamCount.value = String(teamCount);
      const currentTeams = readLeagueCreationTeams();
      const existingExternalTeamIds = new Set(currentTeams.map(team => team.externalTeamId));
      const nextExternalTeamId = index => {
        let candidate = String(index + 1);
        while (existingExternalTeamIds.has(candidate)) candidate = "manual-" + candidate;
        existingExternalTeamIds.add(candidate);
        return candidate;
      };
      state.leagueCreation.leagueName = leagueCreateName.value.trim();
      state.leagueCreation.seasonYear = Number(leagueCreateSeason.value);
      state.leagueCreation.teams = Array.from({ length: teamCount }, (_, index) => currentTeams[index] || {
        externalTeamId: nextExternalTeamId(index),
        displayName: "",
        abbreviation: "",
        managerNames: [],
      });
      state.leagueCreation.draft = leagueCreateDraftFormat.value === "snake"
        ? { type: "snake", rounds: Number(leagueCreateSnakeRounds.value) }
        : {
            type: "auction",
            budgetDollars: Number(leagueCreateAuctionBudget.value),
            minimumBidDollars: Number(leagueCreateAuctionMinimumBid.value),
          };
      renderLeagueCreationTeamRows(state.leagueCreation.teams);
    };

    const loadLeagueCreationScreenshotCapability = async () => {
      try {
        const body = await readJson(await fetch("/league-imports/espn/members-screenshot-review", {
          credentials: "same-origin",
        }));
        state.leagueCreationScreenshotAvailable = body.available === true;
      } catch {
        state.leagueCreationScreenshotAvailable = false;
      }
      setHidden(leagueCreateScreenshotPanel, state.leagueCreationScreenshotAvailable !== true);
    };

    const fileBase64For = file => new Promise((resolve, reject) => {
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

    const cancelLeagueCreationScreenshotRequest = () => {
      state.leagueCreationScreenshotRequestGeneration += 1;
      state.leagueCreationScreenshotAbortController?.abort();
      state.leagueCreationScreenshotAbortController = null;
    };

    const selectLeagueCreationScreenshot = file => {
      cancelLeagueCreationScreenshotRequest();
      state.leagueCreationScreenshotFile = null;
      leagueCreateScreenshotAnalyze.disabled = true;
      if (!file) {
        leagueCreateScreenshotStatus.textContent = "Choose a screenshot first.";
        return;
      }
      if (!screenshotMimeTypes.has(file.type)) {
        leagueCreateScreenshotStatus.textContent = "Choose a PNG, JPEG, or WebP screenshot.";
        return;
      }
      if (file.size > screenshotMaxBytes) {
        leagueCreateScreenshotStatus.textContent = "Choose a screenshot smaller than 5 MB.";
        return;
      }
      state.leagueCreationScreenshotFile = file;
      leagueCreateScreenshotAnalyze.disabled = false;
      leagueCreateScreenshotStatus.textContent = file.name + " is ready to analyze.";
    };

    const analyzeLeagueCreationScreenshot = async () => {
      const file = state.leagueCreationScreenshotFile;
      if (!file) {
        selectLeagueCreationScreenshot(null);
        return;
      }
      const requestGeneration = ++state.leagueCreationScreenshotRequestGeneration;
      const abortController = new AbortController();
      state.leagueCreationScreenshotAbortController = abortController;
      leagueCreateScreenshotAnalyze.disabled = true;
      leagueCreateScreenshotStatus.textContent = "Reading teams from the screenshot...";
      try {
        const base64 = await fileBase64For(file);
        if (requestGeneration !== state.leagueCreationScreenshotRequestGeneration) return;
        const body = await readJson(await fetch("/league-imports/espn/members-screenshot-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          signal: abortController.signal,
          body: JSON.stringify({ mimeType: file.type, base64: base64 }),
        }));
        if (requestGeneration !== state.leagueCreationScreenshotRequestGeneration) return;
        const extraction = body.import || { teams: [] };
        const teams = [...(extraction.teams || [])]
          .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
        const expectedTeamCount = Number(leagueCreateTeamCount.value);
        if (teams.length !== expectedTeamCount) {
          leagueCreateScreenshotStatus.textContent = "Mockd found " + teams.length + " teams, but this league expects " + expectedTeamCount + ". Try a clearer screenshot or enter the teams manually.";
          return;
        }
        const draftPositions = teams.map(team => Number(team.draftOrderPosition));
        if (
          draftPositions.some(position => !Number.isInteger(position) || position < 1 || position > expectedTeamCount)
          || new Set(draftPositions).size !== expectedTeamCount
        ) {
          leagueCreateScreenshotStatus.textContent = "Mockd could not read a unique team number for every row. Try a clearer screenshot or enter the teams manually.";
          return;
        }
        const issuesByIndex = teams.map(team => [...(team.issues || [])]);
        teams.forEach((team, index) => {
          const teamName = String(team.teamDisplayName || "").trim();
          const abbreviation = String(team.abbreviation || "").trim();
          if (!teamName) issuesByIndex[index].push("Enter the missing team name.");
          if (teamName.includes("...") || teamName.includes(String.fromCharCode(8230))) {
            issuesByIndex[index].push("Replace the truncated team name.");
          }
          if (abbreviation.length > 12) issuesByIndex[index].push("Shorten the abbreviation to 12 characters or fewer.");
        });
        const leagueTeams = teams.map((team, index) => ({
          externalTeamId: String(team.draftOrderPosition),
          displayName: team.teamDisplayName || "",
          abbreviation: team.abbreviation || "",
          managerNames: [...(team.managerDisplayNames || [])],
          confidence: team.confidence,
          issues: issuesByIndex[index],
        }));
        state.leagueCreation.teams = leagueTeams;
        renderLeagueCreationTeamRows(leagueTeams);
        const needsReview = leagueTeams.filter(team => team.confidence !== "high" || team.issues.length > 0).length;
        leagueCreateScreenshotStatus.textContent = "Filled " + teams.length + " teams from " + file.name + "."
          + (needsReview ? " Review " + needsReview + " uncertain row" + (needsReview === 1 ? "." : "s.") : " Review the fields before finishing.");
      } catch (error) {
        if (error.name === "AbortError") return;
        if (requestGeneration === state.leagueCreationScreenshotRequestGeneration) {
          leagueCreateScreenshotStatus.textContent = error.message;
        }
      } finally {
        if (state.leagueCreationScreenshotAbortController === abortController) {
          state.leagueCreationScreenshotAbortController = null;
        }
        if (requestGeneration === state.leagueCreationScreenshotRequestGeneration) {
          leagueCreateScreenshotAnalyze.disabled = state.leagueCreationScreenshotFile === null;
        }
      }
    };

    const renderLeagueCreationImportSummary = (kind, title, copy, review, warnings) => {
      leagueCreateImportSummary.dataset.kind = kind;
      leagueCreateImportSummaryTitle.textContent = title;
      leagueCreateImportSummaryCopy.textContent = copy;
      leagueCreateImportFacts.replaceChildren();
      leagueCreateWarnings.replaceChildren();
      if (review) {
        const rosterSize = Object.values(review.rosterSlots).reduce((total, count) => total + Number(count), 0);
        const draftSummary = review.draft.type === "auction"
          ? "$" + String(review.draft.budgetDollars) + " auction"
          : String(review.draft.rounds) + "-round snake";
        [
          ["League", review.leagueName || "Unnamed"],
          ["Teams", String(review.teams.length)],
          ["Draft", draftSummary],
          ["Reception", String(review.scoring.reception) + " points"],
          ["Roster", String(rosterSize) + " slots"],
        ].forEach(([label, value]) => {
          const fact = document.createElement("div");
          const factLabel = document.createElement("span");
          const factValue = document.createElement("strong");
          factLabel.textContent = label;
          factValue.textContent = value;
          fact.append(factLabel, factValue);
          leagueCreateImportFacts.append(fact);
        });
      }
      (warnings || []).forEach(warning => {
        const item = document.createElement("li");
        item.textContent = warning.message || warning;
        leagueCreateWarnings.append(item);
      });
      setHidden(leagueCreateWarnings, leagueCreateWarnings.childElementCount === 0);
      setHidden(leagueCreateImportFacts, !review);
      setHidden(leagueCreateImportSummary, false);
    };

    const showLeagueCreationStep = step => {
      state.leagueCreationStep = step;
      const stepIndex = leagueCreationSteps.indexOf(step);
      document.querySelectorAll("[data-league-step]").forEach(section => {
        setHidden(section, section.dataset.leagueStep !== step);
      });
      document.querySelectorAll("[data-league-step-indicator]").forEach(indicator => {
        if (indicator.dataset.leagueStepIndicator === step) indicator.setAttribute("aria-current", "step");
        else indicator.removeAttribute("aria-current");
      });
      leagueCreateBack.disabled = stepIndex === 0;
      setHidden(leagueCreateNext, step === "teams");
      setHidden(leagueCreateSubmit, step !== "teams");
      setHidden(leagueCreateScreenshotPanel, state.leagueCreationScreenshotAvailable !== true);
      leagueCreateStatus.textContent = "";
      if (step === "teams") {
        leagueCreateScreenshotAnalyze.disabled = state.leagueCreationScreenshotFile === null;
        if (
          state.leagueCreationScreenshotFile
          && leagueCreateScreenshotStatus.textContent === "Reading teams from the screenshot..."
        ) {
          leagueCreateScreenshotStatus.textContent = state.leagueCreationScreenshotFile.name + " is ready to analyze.";
        }
        updateLeagueCreationSubmit();
      }
      const heading = document.querySelector('[data-league-step="' + step + '"] h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    };

    const leagueCreationStepIsValid = step => {
      if (step === "basics") {
        const fields = [leagueCreateName, leagueCreateSeason, leagueCreateTeamCount];
        if (leagueCreateDraftFormat.value === "snake") fields.push(leagueCreateSnakeRounds);
        else fields.push(leagueCreateAuctionBudget, leagueCreateAuctionMinimumBid);
        const invalid = fields.find(field => !field.checkValidity());
        if (invalid) {
          invalid.reportValidity();
          invalid.focus();
          return false;
        }
        syncLeagueCreationFromBasics();
        return true;
      }
      if (step === "scoring") {
        const fields = [leagueCreatePassYard, leagueCreatePassTd, leagueCreateRushYard, leagueCreateRushTd, leagueCreateReceiveYard, leagueCreateReceiveTd, leagueCreatePpr];
        const invalid = fields.find(field => !field.checkValidity());
        if (invalid) {
          invalid.reportValidity();
          invalid.focus();
          return false;
        }
      }
      if (step === "roster") {
        const fields = [...leagueCreateRosterSlots.querySelectorAll("[data-roster-slot]")];
        const invalid = fields.find(field => !field.checkValidity());
        if (invalid) {
          invalid.reportValidity();
          invalid.focus();
          return false;
        }
        if (!fields.some(field => Number(field.value) > 0)) {
          leagueCreateStatus.textContent = "Add at least one roster slot.";
          fields[0]?.focus();
          return false;
        }
      }
      return true;
    };

    const draftRoomPathFor = (seasonId, roomId) => {
      const query = new URLSearchParams({ seasonId: seasonId, roomId: roomId });
      return "/draft-room?" + query.toString();
    };

    const pathWithSeason = (path, seasonId) => {
      const query = new URLSearchParams({ seasonId: seasonId });
      return path + "?" + query.toString();
    };

    const ownerScopedPaths = new Set();

    const productPathFor = (path, selectedLeague) => {
      const query = new URLSearchParams({ seasonId: selectedLeague.seasonId });
      const ownerDisplayName = selectedLeague.membership?.ownerDisplayName;
      if (ownerScopedPaths.has(path) && ownerDisplayName) query.set("owner", ownerDisplayName);
      return path + "?" + query.toString();
    };

    const markCurrentNavigation = () => {
      const activePath = routePath === "/mock-drafts" ? "/practice" : routePath;
      document.querySelectorAll("[data-nav-path]").forEach(link => {
        if (link.dataset.navPath === activePath) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    };

    const updateNavigation = selectedLeague => {
      navigation.forEach(item => {
        const link = document.querySelector('[data-nav-path="' + item.path + '"]');
        if (!link) return;
        if (ownerScopedPaths.has(item.path) && !selectedLeague.membership?.ownerDisplayName) {
          link.removeAttribute("href");
          link.setAttribute("aria-disabled", "true");
          link.setAttribute("tabindex", "-1");
        } else {
          link.href = productPathFor(item.path, selectedLeague);
          link.removeAttribute("aria-disabled");
          link.removeAttribute("tabindex");
        }
      });
      commissionerNavItem.href = pathWithSeason("/setup", selectedLeague.seasonId);
      document.querySelector(".brand").href = pathWithSeason("/practice", selectedLeague.seasonId);
    };

    const updateNavigationForNoLeague = () => {
      navigation.forEach(item => {
        const link = document.querySelector('[data-nav-path="' + item.path + '"]');
        if (!link) return;
        if (item.path === "/my-team") {
          link.removeAttribute("href");
          link.setAttribute("aria-disabled", "true");
          link.setAttribute("tabindex", "-1");
          return;
        }
        link.href = item.path === "/league" ? "/league?create=1" : item.path;
        link.removeAttribute("aria-disabled");
        link.removeAttribute("tabindex");
      });
      document.querySelector(".brand").href = "/practice";
    };

    const hideWorkspaces = () => {
      ["standalone-board", "empty-leagues", "league-workspace", "my-team-workspace", "mock-draft-workspace", "feature-workspace", "setup-workspace", "setup-access-denied", "invite-workspace"]
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

    const summariesForSettings = settings => {
      if (!settings) return [];
      const lineup = Object.entries(settings.roster?.lineup || {})
        .filter(([, count]) => Number(count) > 0)
        .map(([slot, count]) => count + " " + slot)
        .join(", ");

      return [
        ["Draft", settings.draftFormat === "auction"
          ? "$" + settings.auction.budgetDollars + " auction · $" + settings.auction.minimumBidDollars + " minimum"
          : settings.snake.rounds + "-round snake"],
        ["Scoring", settings.scoring.reception + " PPR · " + settings.scoring.passingTouchdown + " point pass TD"],
        ["Roster", settings.roster.rosterSize + " players · " + lineup],
      ];
    };

    const renderSettingsFacts = (container, settings) => {
      container.replaceChildren();
      summariesForSettings(settings).forEach(([label, value]) => {
        const fact = document.createElement("div");
        fact.className = "fact";
        const factLabel = document.createElement("span");
        const factValue = document.createElement("strong");
        factLabel.textContent = label;
        factValue.textContent = value;
        fact.append(factLabel, factValue);
        container.append(fact);
      });
    };

    const renderLeagueOverview = (season, keepers = []) => {
      renderSettingsFacts(leagueOverviewSettings, season?.settings);
      const teams = [...(season?.teams || [])]
        .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
      const keepersByTeam = new Map();
      keepers.forEach(keeper => {
        const teamKeepers = keepersByTeam.get(keeper.teamId) || [];
        const cost = keeper.keeperRound ? "R" + keeper.keeperRound : "$" + keeper.price;
        teamKeepers.push(keeper.playerName + " (" + cost + ")");
        keepersByTeam.set(keeper.teamId, teamKeepers);
      });
      leagueOverviewTeamBody.replaceChildren();
      teams.forEach(team => {
        const row = document.createElement("tr");
        const managers = team.managerDisplayNames?.length
          ? team.managerDisplayNames.join(", ")
          : team.ownerDisplayName;
        const keeperSummary = (keepersByTeam.get(team.id) || []).join(", ") || "-";
        [team.draftOrderPosition, team.displayName, managers, keeperSummary].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = String(value);
          row.append(cell);
        });
        leagueOverviewTeamBody.append(row);
      });
      leagueOverviewTeamSummary.textContent = teams.length
        ? teams.length + " teams in this league."
        : "No teams have been configured for this season.";
      setHidden(leagueOverviewTeamTable, teams.length === 0);
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
      const settings = season?.settings;
      renderSettingsFacts(setupSettingsSummary, settings);
      const isDraftSetup = season?.setupStatus === "draft";
      setHidden(publishSeasonButton, !isDraftSetup || state.setupLocked);
      const isSnake = season?.settings?.draftFormat === "snake";
      setupFinalReview.disabled = !isDraftSetup || state.setupLocked;
      if (!isDraftSetup) setupFinalReview.checked = true;
      publishSeasonButton.disabled = !setupFinalReview.checked;
      historicalImportDescription.textContent = isSnake
        ? "Historical snake draft imports are not available yet. This does not block league mocks."
        : "Add one or more prior auction draft sheets. Mockd accepts a standard row list or a wide sheet with each team's players in a separate column group.";
      updateHistoricalImportControls();
      createLiveRoomButton.disabled = isDraftSetup || isSnake;
      if (isSnake && !state.setupLocked) {
        liveRoomSetupStatus.textContent = "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.";
      } else if (isDraftSetup && !state.setupLocked) {
        liveRoomSetupStatus.textContent = "Publish the reviewed league setup before creating its shared draft room.";
      }
    };

    const loadClaimableTeams = async selectedLeague => {
      const body = await readJson(await fetch(
        "/seasons/" + encodeURIComponent(selectedLeague.seasonId),
        { credentials: "same-origin" },
      ));
      const teams = [...(body.claimableTeams || [])]
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
      const roomIsUnstarted = hasRoom && (room.status === "setup" || room.status === "countdown");
      const draftHasStarted = hasRoom && !roomIsUnstarted;
      state.setupLocked = hasRoom;
      state.draftHasStarted = draftHasStarted;
      setHidden(createLiveRoomButton, hasRoom);
      setHidden(openSetupLiveRoom, !hasRoom);
      setHidden(cancelLiveRoomButton, !hasRoom || (room.status !== "setup" && room.status !== "countdown"));
      cancelLiveRoomButton.disabled = !hasRoom;
      draftStartsAtInput.disabled = hasRoom;
      setupRowsInput.disabled = hasRoom;
      setupPreviewButton.disabled = hasRoom;
      setupApplyButton.disabled = true;
      updateHistoricalImportControls();
      keeperCommandInput.disabled = draftHasStarted;
      keeperPreviewButton.disabled = draftHasStarted;
      keeperApplyButton.disabled = draftHasStarted || state.keeperPreviewCommand === null;
      if (hasRoom) {
        openSetupLiveRoom.href = draftRoomPathFor(selectedLeague.seasonId, room.roomId);
        liveRoomSetupStatus.textContent = draftHasStarted
          ? "The draft has started. League setup is now locked."
          : "The shared draft room is ready. Keepers and draft history remain editable until the draft starts.";
        setupStatus.textContent = draftHasStarted
          ? "League setup is locked after the draft starts."
          : "Team assignments are locked. Keepers and draft history remain editable until the draft starts.";
      } else {
        openSetupLiveRoom.removeAttribute("href");
        liveRoomSetupStatus.textContent = "No live draft room has been created for this season.";
        setupStatus.textContent = "";
      }
    };

    const loadMyTeam = async selectedLeague => {
      setHidden(myTeamResults, true);
      setHidden(myTeamClaimLink, true);
      myTeamRosterBody.replaceChildren();
      myTeamFindings.replaceChildren();
      if (!selectedLeague.membership?.teamId) {
        myTeamStatus.textContent = "Claim your team from League before opening private roster analysis.";
        myTeamClaimLink.href = pathWithSeason("/league", selectedLeague.seasonId);
        setHidden(myTeamClaimLink, false);
        return;
      }
      if (!selectedLeague.liveDraft?.roomId) {
        myTeamStatus.textContent = "Your roster and draft rank will appear here after the league draft ends.";
        return;
      }

      myTeamStatus.textContent = "Loading your private post-draft review...";
      const body = await readJson(await fetch(
        "/live-rooms/" + encodeURIComponent(selectedLeague.liveDraft.roomId) + "/my-team",
        { credentials: "same-origin" },
      ));
      const ranking = body.analysis?.ranking || { status: "unavailable", teamCount: 0, reasons: [] };
      byId("my-team-rank").textContent = ranking.status === "available" ? "#" + ranking.rank : "Unavailable";
      byId("my-team-count").textContent = String(ranking.teamCount || 0);
      const startSitRecommendations = body.analysis?.recommendations?.startSit
        || body.analysis?.recommendationReadiness?.startSit
        || { status: "unavailable", reasons: [], records: [] };
      const pickupDropRecommendations = body.analysis?.recommendations?.pickupDrop
        || body.analysis?.recommendationReadiness?.pickupDrop
        || { status: "unavailable", reasons: [], records: [] };
      const startSit = startSitRecommendations.status;
      const pickupDrop = pickupDropRecommendations.status;
      byId("my-team-coach").textContent = startSit === "ready" && pickupDrop === "ready"
        ? "Ready"
        : "Unavailable";

      (body.roster?.players || []).forEach(player => {
        const row = document.createElement("tr");
        [player.playerName, player.position].forEach(value => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.append(cell);
        });
        myTeamRosterBody.append(row);
      });
      const findings = [
        ...(body.analysis?.strengths || []).map(finding => ({ label: "Strength", finding })),
        ...(body.analysis?.risks || []).map(finding => ({ label: "Risk", finding })),
        ...(ranking.status === "unavailable"
          ? (ranking.reasons || []).map(reason => ({ label: "Ranking", finding: { summary: reason.message, evidence: "" } }))
          : []),
        ...(startSitRecommendations.records || []).map(record => ({
          label: "Start/sit",
          finding: { summary: record.explanation, evidence: "" },
        })),
        ...(pickupDropRecommendations.records || []).map(record => ({
          label: "Pickup/drop",
          finding: { summary: record.explanation, evidence: "" },
        })),
        ...(startSit !== "ready"
          ? (startSitRecommendations.reasons || []).map(reason => ({
              label: "Start/sit",
              finding: { summary: reason.message, evidence: "" },
            }))
          : []),
        ...(pickupDrop !== "ready"
          ? (pickupDropRecommendations.reasons || []).map(reason => ({
              label: "Pickup/drop",
              finding: { summary: reason.message, evidence: "" },
            }))
          : []),
      ];
      if (!findings.length) {
        const item = document.createElement("li");
        item.textContent = "No major roster risks were detected.";
        myTeamFindings.append(item);
      } else {
        findings.forEach(({ label, finding }) => {
          const item = document.createElement("li");
          item.textContent = label + ": " + finding.summary + (finding.evidence ? " " + finding.evidence : "");
          myTeamFindings.append(item);
        });
      }
      const projectionSource = body.analysis?.projectionProvenance?.source;
      myTeamStatus.textContent = projectionSource?.kind === "static_fallback"
        ? "Roster loaded. Rankings and coach advice need current league-scoring projections."
        : "Private analysis generated from the completed league draft.";
      setHidden(myTeamResults, false);
    };

    const mockDraftPlayerName = playerId =>
      state.mockDraft?.board?.players?.find(player => player.id === playerId)?.name || playerId;

    const renderMockDraft = () => {
      const draft = state.mockDraft;
      const session = state.mockSession;
      if (!draft || !session) return;
      const sessionState = draft.session || {};
      const auction = session.draftMode?.format === "auction";
      byId("mock-draft-player-head").innerHTML = auction
        ? '<th class="numeric">Market</th><th class="numeric">My value</th><th>Player</th><th>Pos</th><th>Status</th><th>Action</th>'
        : '<th class="numeric">Rank</th><th>Player</th><th>Pos</th><th>Status</th><th>Action</th>';
      const picks = draft.board?.picks || [];
      const completedPicks = picks.filter(pick => pick.selection).length;
      byId("mock-draft-title").textContent = auction ? "Auction mock draft" : "Snake mock draft";
      byId("mock-draft-state").textContent = titleCase(sessionState.status || session.status || "setup");
      const currentPick = sessionState.currentPick;
      const decisionTeamId = auction ? sessionState.nextNominatorTeamId : currentPick?.teamId;
      const currentTeam = decisionTeamId
        ? draft.teams?.find(team => team.id === decisionTeamId)
        : null;
      const nomination = sessionState.currentNomination;
      byId("mock-draft-on-clock").textContent = nomination
        ? nomination.playerName + " · $" + nomination.currentPrice
        : currentTeam?.name || (sessionState.status === "completed" ? "Complete" : "Not started");
      const auctionCapacity = (draft.teams || []).reduce(
        (total, team) => total + (team.roster?.length || 0) + (team.rosterSlotsRemaining || 0),
        0,
      );
      byId("mock-draft-progress").textContent = auction
        ? (draft.sales?.length || 0) + " / " + auctionCapacity + " rostered"
        : completedPicks + " / " + picks.length + " picks";
      mockDraftStart.disabled = sessionState.status !== "setup";
      mockDraftBuy.disabled = !auction || nomination?.humanCanBuy !== true;
      mockDraftBuy.textContent = nomination?.nextBid ? "Buy $" + nomination.nextBid : "Buy";
      mockDraftPass.disabled = !auction || nomination?.humanCanPass !== true;
      mockDraftUndo.disabled = sessionState.canUndo !== true;
      mockDraftComplete.disabled = sessionState.canComplete !== true;

      const search = mockDraftSearch.value.trim().toLowerCase();
      const players = (draft.board?.players || []).filter(player => {
        if (!player.available) return false;
        if (!search) return true;
        return [player.name, player.position].some(value => String(value || "").toLowerCase().includes(search));
      });
      const canPick = sessionState.status === "active" && (auction
        ? sessionState.phase === "awaiting_human_nomination"
        : currentPick?.teamId === session.teamId);
      const fragment = document.createDocumentFragment();
      players.forEach(player => {
        const row = document.createElement("tr");
        const values = [
          { label: auction ? "Market" : "Rank", value: auction
              ? "$" + Math.round(Number(player.expectedPrice || 0))
              : String(player.personalRank || player.leagueExpectedPick || player.rank || "-"), className: "numeric" },
          ...(auction ? [{
            label: "My value",
            value: "$" + Math.round(Number(player.humanValue ?? player.expectedPrice ?? 0)),
            className: "numeric",
          }] : []),
          { label: "Player", value: player.name, className: "player-name" },
          { label: "Position", value: player.position || "-" },
          { label: "Status", value: "Available" },
        ];
        values.forEach(value => {
          const cell = document.createElement("td");
          cell.dataset.label = value.label;
          cell.textContent = value.value;
          if (value.className) cell.className = value.className;
          row.append(cell);
        });
        const actionCell = document.createElement("td");
        actionCell.dataset.label = "Action";
        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.className = "mock-player-action";
        actionButton.dataset.mockPlayerId = player.id;
        actionButton.textContent = auction ? "Nominate" : "Draft";
        actionButton.disabled = !canPick;
        actionCell.append(actionButton);
        row.append(actionCell);
        fragment.append(row);
      });
      mockDraftPlayerRows.replaceChildren(fragment);

      const myTeam = draft.teams?.find(team => team.id === session.teamId);
      const rosterFragment = document.createDocumentFragment();
      (myTeam?.slots || []).forEach(slot => {
        const item = document.createElement("li");
        const slotName = document.createElement("span");
        slotName.textContent = slot.slot;
        const playerName = document.createElement("strong");
        playerName.textContent = slot.playerId ? mockDraftPlayerName(slot.playerId) : "Open";
        item.append(slotName, playerName);
        rosterFragment.append(item);
      });
      if (!rosterFragment.childNodes.length) {
        const item = document.createElement("li");
        item.textContent = "Your roster will fill as the mock runs.";
        rosterFragment.append(item);
      }
      mockDraftRoster.replaceChildren(rosterFragment);
      mockDraftStatus.textContent = canPick
        ? auction
          ? "Choose a player to nominate."
          : "You are on the clock. Choose a player from the board."
        : auction && nomination?.humanCanBuy
          ? "Buy at the next bid or pass."
        : sessionState.status === "setup"
          ? "Ready when you are."
          : sessionState.status === "completed"
            ? "Mock complete. Review your roster or start another mock from Practice."
            : "Mockd is ready for your next turn.";
    };

    const mockCommandId = type => {
      const randomId = window.crypto?.randomUUID?.();
      return type + ":" + (randomId || String(Date.now()));
    };

    const sendMockDraftCommand = async command => {
      const selectedLeague = state.selectedLeague;
      const session = state.mockSession;
      if (!selectedLeague || !session) return;
      const controls = [
        mockDraftStart,
        mockDraftBuy,
        mockDraftPass,
        mockDraftUndo,
        mockDraftComplete,
        ...mockDraftPlayerRows.querySelectorAll("button"),
      ];
      controls.forEach(control => { control.disabled = true; });
      mockDraftStatus.textContent = "Updating the mock draft...";
      try {
        const body = await readJson(await fetch(
          "/season-mock-drafts/" + encodeURIComponent(session.id) + "/commands",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              seasonId: selectedLeague.seasonId,
              commandId: mockCommandId(command.type),
              command: command,
            }),
          },
        ));
        state.mockSession = body.mockSession;
        state.mockDraft = body.state;
        renderMockDraft();
      } catch (error) {
        mockDraftStatus.textContent = error.message;
        renderMockDraft();
      }
    };

    const loadMockDraft = async selectedLeague => {
      const requestGeneration = ++state.mockRequestGeneration;
      state.mockSession = null;
      state.mockDraft = null;
      mockDraftPlayerRows.replaceChildren();
      mockDraftRoster.replaceChildren();
      mockDraftStatus.textContent = "Opening your league mock...";
      const query = new URLSearchParams(window.location.search);
      const requestedSessionId = query.get("mockSessionId");
      const requestedStrategy = query.get("strategy") || "balanced";
      const response = requestedSessionId
        ? await fetch(
            "/season-mock-drafts/" + encodeURIComponent(requestedSessionId)
              + "?seasonId=" + encodeURIComponent(selectedLeague.seasonId),
            { credentials: "same-origin" },
          )
        : await fetch("/season-mock-drafts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ seasonId: selectedLeague.seasonId, strategy: requestedStrategy }),
          });
      const body = await readJson(response);
      if (requestGeneration !== state.mockRequestGeneration) return;
      state.mockSession = body.mockSession;
      state.mockDraft = body.state;
      if (!requestedSessionId) {
        query.set("seasonId", selectedLeague.seasonId);
        query.set("mockSessionId", body.mockSession.id);
        window.history.replaceState(null, "", routePath + "?" + query.toString());
      }
      renderMockDraft();
    };

    const selectedLeagueFor = onboarding => {
      const search = new URLSearchParams(window.location.search);
      if (routePath === "/league" && search.get("create") === "1") return null;
      const requestedSeasonId = search.get("seasonId") || search.get("contextSeasonId");
      return onboarding.leagues.find(league => league.seasonId === requestedSeasonId)
        || onboarding.leagues[0]
        || null;
    };

    const renderSelectedLeague = selectedLeague => {
      if (state.selectedLeague?.seasonId !== selectedLeague?.seasonId) {
        state.workspaceRequestGeneration += 1;
        state.boardRequestGeneration += 1;
        state.currentSeason = null;
        state.claimedTeamIds = new Set();
        state.historicalImportFiles = [];
        state.historicalImportBusy = false;
        state.keeperPreviewCommand = null;
        state.mockRequestGeneration += 1;
        state.mockSession = null;
        state.mockDraft = null;
        state.playerCatalog = null;
        state.playerCatalogSeasonId = null;
        state.playerCatalogStrategyKey = null;
        state.playerCatalogMeta = null;
        state.playerBoardSort = null;
        state.practiceShortlist = [];
        state.practiceShortlistSeasonId = null;
        state.simulation = null;
        state.simulationHistory = [];
        state.selectedSimulationRunIndex = 0;
        standalonePlayerRows.replaceChildren();
        historicalImportButton.disabled = true;
        historicalImportStatus.textContent = "";
        historicalImportFileList.replaceChildren();
        keeperApplyButton.disabled = true;
        keeperStatus.textContent = "";
        keeperList.replaceChildren();
        setupFinalReview.checked = false;
        setHidden(simulationResults, true);
        simulationStatus.textContent = "";
      }
      state.selectedLeague = selectedLeague;
      hideWorkspaces();
      if (routePath === "/invite") {
        setHidden(commissionerNavItem, true);
        setHidden(byId("invite-workspace"), false);
        return;
      }
      if (!selectedLeague) {
        setHidden(commissionerNavItem, true);
        byId("my-team-name").textContent = "Not assigned";
        byId("membership-role").textContent = "Member";
        updateNavigationForNoLeague();
        if (routePath === "/practice") {
          setHidden(simulationPanel, true);
          setHidden(byId("standalone-board-open-mock"), true);
          setHidden(byId("standalone-board-open-simulations"), true);
          loadStandaloneBoard().catch(error => {
            standaloneBoardStatus.textContent = error.message;
          });
        } else {
          setHidden(byId("empty-leagues"), false);
        }
        return;
      }

      const membership = selectedLeague.membership;
      byId("my-team-name").textContent = membership.teamDisplayName || "Not assigned";
      byId("membership-role").textContent = titleCase(membership.role);
      commissionerNavItem.classList.toggle("hidden", !selectedLeague.canManageLeague);
      updateNavigation(selectedLeague);

      if (routePath === "/practice") {
        configureSimulationPanel(selectedLeague);
        const mockLink = byId("standalone-board-open-mock");
        const mockQuery = new URLSearchParams({
          seasonId: selectedLeague.seasonId,
          strategy: practiceStrategy.value,
        });
        mockLink.href = "/mock-drafts?" + mockQuery.toString();
        setHidden(mockLink, false);
        setHidden(byId("standalone-board-open-simulations"), false);
        loadStandaloneBoard().catch(error => {
          standaloneBoardStatus.textContent = error.message;
        });
        loadPracticeShortlist(selectedLeague, state.workspaceRequestGeneration).catch(error => {
          standaloneBoardStatus.textContent = error.message;
        });
        return;
      }

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
          loadSeasonKeepers(seasonId, requestGeneration).catch(error => {
            if (isCurrentSetupRequest(seasonId, requestGeneration)) {
              keeperStatus.textContent = error.message;
              keeperSaveState.textContent = "Could not load";
            }
          });
        } else {
          setHidden(byId("setup-access-denied"), false);
        }
        return;
      }

      if (routePath === "/mock-drafts") {
        setHidden(byId("mock-draft-workspace"), false);
        if (!membership.teamId) {
          mockDraftStart.disabled = true;
          mockDraftBuy.disabled = true;
          mockDraftPass.disabled = true;
          mockDraftUndo.disabled = true;
          mockDraftComplete.disabled = true;
          mockDraftStatus.textContent = "Claim your team from League before starting a private mock draft.";
        } else {
          loadMockDraft(selectedLeague).catch(error => {
            mockDraftStatus.textContent = error.message;
            mockDraftStart.disabled = true;
            mockDraftBuy.disabled = true;
            mockDraftPass.disabled = true;
            mockDraftUndo.disabled = true;
            mockDraftComplete.disabled = true;
          });
        }
        return;
      }

      if (routePath === "/my-team") {
        setHidden(byId("my-team-workspace"), false);
        loadMyTeam(selectedLeague).catch(error => {
          myTeamStatus.textContent = error.message;
          setHidden(myTeamResults, true);
        });
        return;
      }

      byId("league-name").textContent = selectedLeague.leagueName;
      byId("league-season").textContent = selectedLeague.seasonYear + " season";
      renderReadiness("league-setup-readiness", selectedLeague.readiness.leagueSetup);
      renderReadiness("team-claim-readiness", selectedLeague.readiness.teamClaim);
      renderReadiness("live-draft-readiness", selectedLeague.readiness.liveDraft);
      const setupPath = pathWithSeason("/setup", selectedLeague.seasonId);
      const liveDraftReadinessSetupPath = setupPath + "#live-room-setup-title";
      const setupReady = selectedLeague.readiness.leagueSetup === "ready";
      const needsTeamClaim = !membership.teamId;
      const roomId = selectedLeague.liveDraft?.roomId;
      let liveDraftReadinessLabel = null;
      let liveDraftReadinessPath = liveDraftReadinessSetupPath;
      if (roomId) {
        liveDraftReadinessLabel = "Open draft room";
        liveDraftReadinessPath = draftRoomPathFor(selectedLeague.seasonId, roomId);
      } else if (selectedLeague.canManageLeague) {
        liveDraftReadinessLabel = setupReady ? "Create draft room" : "Finish setup first";
      }
      renderReadinessAction(
        "league-setup-readiness-action",
        selectedLeague.readiness.leagueSetup !== "ready" && selectedLeague.canManageLeague ? "Finish setup" : null,
        setupPath,
      );
      renderReadinessAction(
        "team-claim-readiness-action",
        needsTeamClaim ? "Claim your team" : null,
        "#team-claim-panel",
      );
      renderReadinessAction(
        "live-draft-readiness-action",
        liveDraftReadinessLabel,
        liveDraftReadinessPath,
      );
      byId("next-draft-at").textContent = selectedLeague.nextDraftAt
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short" }).format(new Date(selectedLeague.nextDraftAt))
        : "No draft time scheduled.";

      const overviewRequestGeneration = state.workspaceRequestGeneration;
      const overviewSeasonId = selectedLeague.seasonId;
      leagueOverviewTeamSummary.textContent = "Loading league teams...";
      Promise.all([
        fetch("/seasons/" + encodeURIComponent(overviewSeasonId), { credentials: "same-origin" }).then(readJson),
        fetch("/seasons/" + encodeURIComponent(overviewSeasonId) + "/keepers", { credentials: "same-origin" }).then(readJson),
      ])
        .then(([body, keepersBody]) => {
          if (isCurrentWorkspaceRequest(overviewSeasonId, overviewRequestGeneration)) {
            renderLeagueOverview(body.season, keepersBody.keepers || []);
          }
        })
        .catch(error => {
          if (isCurrentWorkspaceRequest(overviewSeasonId, overviewRequestGeneration)) {
            leagueOverviewTeamSummary.textContent = error.message;
          }
        });

      setHidden(teamClaimPanel, !needsTeamClaim);
      if (needsTeamClaim) {
        loadClaimableTeams(selectedLeague).catch(error => {
          teamClaimButton.disabled = true;
          teamClaimStatus.textContent = error.message;
        });
      }

      const liveDraftButton = byId("open-live-draft-button");
      if (roomId) {
        liveDraftButton.href = draftRoomPathFor(selectedLeague.seasonId, roomId);
        liveDraftButton.textContent = "Open live draft";
        liveDraftButton.removeAttribute("aria-disabled");
        liveDraftButton.removeAttribute("tabindex");
      } else if (selectedLeague.canManageLeague) {
        liveDraftButton.href = "/setup?seasonId=" + encodeURIComponent(selectedLeague.seasonId) + "#live-room-setup-title";
        liveDraftButton.textContent = setupReady ? "Create draft room" : "Finish draft setup";
        liveDraftButton.removeAttribute("aria-disabled");
        liveDraftButton.removeAttribute("tabindex");
      } else {
        liveDraftButton.textContent = "Draft room not ready";
        liveDraftButton.removeAttribute("href");
        liveDraftButton.setAttribute("aria-disabled", "true");
        liveDraftButton.setAttribute("tabindex", "-1");
      }
      setHidden(byId("league-workspace"), false);
    };

    const renderLeaguePicker = onboarding => {
      leaguePicker.replaceChildren();
      accountMenuLeagues.replaceChildren();
      onboarding.leagues.forEach(league => {
        const option = document.createElement("option");
        option.value = league.seasonId;
        option.textContent = league.leagueName + " · " + league.seasonYear;
        leaguePicker.append(option);
        const link = document.createElement("a");
        link.href = pathWithSeason("/league", league.seasonId);
        link.textContent = league.leagueName + " · " + league.seasonYear;
        if (state.selectedLeague?.seasonId === league.seasonId) link.setAttribute("aria-current", "true");
        accountMenuLeagues.append(link);
      });
      if (state.selectedLeague) leaguePicker.value = state.selectedLeague.seasonId;
      setHidden(headerLeagueSwitcher, onboarding.leagues.length === 0);
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
      byId("account-menu-email").textContent = account.email;
      const localPart = String(account.email || "?").split("@")[0];
      const initialParts = localPart.split(/[._-]+/).filter(Boolean);
      byId("account-avatar-initials").textContent = initialParts
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("") || "?";
      setHidden(bootPanel, true);
      setHidden(authPanel, true);
      setHidden(appHeader, false);
      setHidden(appShell, false);
      markCurrentNavigation();
      await loadOnboarding();
      if (new URLSearchParams(window.location.search).get("account") === "password") {
        openPasswordDialog();
      }
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
      const authRequest = signupMode
        ? fetch("/accounts", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              email: emailInput.value,
              password: passwordInput.value,
              invitationToken: signupInvitationToken(),
              returnTo: authenticationReturnPath(),
            }),
          }).then(readJson).then(body => {
            if (body.account) return login();
            authNotice.textContent = body.message;
            setHidden(authNotice, false);
            return null;
          })
        : verificationMode
          ? fetch("/email-verifications", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                email: emailInput.value,
                returnTo: authenticationReturnPath(),
              }),
            }).then(readJson).then(body => {
              authNotice.textContent = body.message;
              setHidden(authNotice, false);
              return null;
            })
          : forgotPasswordMode
            ? fetch("/password-resets", {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ email: emailInput.value }),
              }).then(readJson).then(body => {
                authNotice.textContent = body.message;
                setHidden(authNotice, false);
                return null;
              })
            : resetPasswordMode
              ? fetch("/password-resets/consume", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  credentials: "same-origin",
                  body: JSON.stringify({
                    token: new URLSearchParams(window.location.search).get("token") || "",
                    newPassword: passwordInput.value,
                    newPasswordConfirmation: passwordConfirmationInput.value,
                  }),
                }).then(readJson).then(() => {
                  window.location.assign("/login?passwordChanged=1");
                  return null;
                })
              : login();
      authRequest
        .then(account => account ? finishAuthentication(account) : undefined)
        .catch(error => {
          authError.textContent = error.message;
          setHidden(authError, false);
          if (error.body && error.body.error && error.body.error.code === "email_unverified") {
            authModePrompt.textContent = "Need a new verification link?";
            authModeLink.textContent = "Resend verification";
            authModeLink.href = "/verify-email?email=" + encodeURIComponent(emailInput.value)
              + "&returnTo=" + encodeURIComponent(authenticationReturnPath());
          }
        })
        .finally(() => { authSubmitButton.disabled = false; });
    });

    byId("sign-out-button").addEventListener("click", () => {
      fetch("/session", { method: "DELETE", credentials: "same-origin" })
        .finally(() => window.location.assign("/login"));
    });

    const openPasswordDialog = () => {
      accountMenu.open = false;
      passwordChangeForm.reset();
      passwordChangeStatus.textContent = "";
      passwordChangeStatus.className = "status";
      passwordDialog.showModal();
      currentPasswordInput.focus();
    };
    byId("account-settings-button").addEventListener("click", openPasswordDialog);

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
      if (selectedLeague) {
        const query = new URLSearchParams(window.location.search);
        query.set("seasonId", selectedLeague.seasonId);
        query.delete("contextSeasonId");
        query.delete("mockSessionId");
        window.history.replaceState(null, "", routePath + "?" + query.toString());
      }
      renderSelectedLeague(selectedLeague);
      renderLeaguePicker(state.onboarding);
      accountMenu.open = false;
    });

    const setupEndpoint = action => "/seasons/" + encodeURIComponent(byId("setup-season-id-input").value) + "/setup-import/" + action;
    const screenshotMaxBytes = 5 * 1024 * 1024;
    const screenshotMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

    const isCurrentWorkspaceRequest = (seasonId, requestGeneration) =>
      state.workspaceRequestGeneration === requestGeneration &&
      state.selectedLeague?.seasonId === seasonId;

    const isCurrentSetupRequest = (seasonId, requestGeneration) =>
      isCurrentWorkspaceRequest(seasonId, requestGeneration) &&
      byId("setup-season-id-input").value === seasonId;

    const historicalFileKeyFor = file => [file.name, file.size, file.lastModified].join(":");
    const inferHistoricalImportYear = (file, index) => {
      const namedYears = file.name.match(/(?:19|20)\\d{2}/gu) || [];
      const namedYear = Number(namedYears.at(-1));
      if (Number.isInteger(namedYear)) return namedYear;
      return Math.max(2000, (state.currentSeason?.seasonYear || new Date().getFullYear()) - 1 - index);
    };

    const itemCountLabel = (count, singular) =>
      count + " " + singular + (count === 1 ? "" : "s");

    const pendingHistoricalImportFiles = () =>
      state.historicalImportFiles.filter(item => item.status !== "imported");

    const duplicateHistoricalImportYears = items => {
      const yearCounts = items.reduce((counts, item) => {
        if (!Number.isInteger(item.seasonYear)) return counts;
        counts.set(item.seasonYear, (counts.get(item.seasonYear) || 0) + 1);
        return counts;
      }, new Map());
      return [...yearCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([year]) => year)
        .sort((left, right) => left - right);
    };

    const duplicateHistoricalImportYearMessage = years => years.length === 1
      ? "Each selected file needs a different draft year. " + years[0] + " is selected more than once."
      : "Each selected file needs a different draft year. " + years.join(", ") + " are each selected more than once.";

    const historicalImportQueueIssue = () => {
      const pendingFiles = pendingHistoricalImportFiles();
      if (pendingFiles.some(item => !Number.isInteger(item.seasonYear) || item.seasonYear < 2000 || item.seasonYear > 2100)) {
        return "Choose a valid draft year for every file.";
      }
      const duplicateYears = duplicateHistoricalImportYears(pendingFiles);
      if (duplicateYears.length > 0) return duplicateHistoricalImportYearMessage(duplicateYears);
      const hasIncompleteOwnerMappings = pendingFiles.some(item =>
        (item.ownerMappingNeeds || []).some(sourceLabel =>
          !(item.ownerMappings || []).some(mapping =>
            mapping.sourceOwnerOrTeamLabel === sourceLabel && mapping.teamId
          )
        )
      );
      return hasIncompleteOwnerMappings
        ? "Match every historical team name to a current team before importing again."
        : "";
    };

    const updateHistoricalImportControls = () => {
      const unavailable = state.currentSeason?.settings?.draftFormat === "snake" || state.draftHasStarted;
      historicalImportFile.disabled = unavailable;
      historicalImportChoose.disabled = unavailable;
      historicalReplaceInput.disabled = unavailable;
      historicalImportButton.disabled = unavailable || state.historicalImportBusy
        || pendingHistoricalImportFiles().length === 0
        || historicalImportQueueIssue().length > 0;
    };

    const renderHistoricalImportFiles = () => {
      const fragment = document.createDocumentFragment();
      state.historicalImportFiles.forEach(item => {
        const row = document.createElement("div");
        row.className = "historical-file-row";
        row.dataset.status = item.status;

        const identity = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.file.name;
        const status = document.createElement("span");
        status.textContent = item.message;
        identity.append(name, status);

        const yearField = document.createElement("div");
        const yearLabel = document.createElement("label");
        yearLabel.textContent = "Draft year";
        yearLabel.htmlFor = "historical-year-" + item.id;
        const yearInput = document.createElement("input");
        yearInput.id = yearLabel.htmlFor;
        yearInput.type = "number";
        yearInput.min = "2000";
        yearInput.max = "2100";
        yearInput.step = "1";
        yearInput.value = String(item.seasonYear);
        yearInput.dataset.historicalYear = item.id;
        yearInput.disabled = state.historicalImportBusy || item.status === "imported";
        yearField.append(yearLabel, yearInput);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.dataset.historicalRemove = item.id;
        remove.disabled = state.historicalImportBusy;
        row.append(identity, yearField, remove);
        if ((item.ownerMappingNeeds || []).length > 0) {
          const mappingPanel = document.createElement("div");
          mappingPanel.className = "historical-owner-mappings";
          const heading = document.createElement("strong");
          heading.textContent = "Match historical team names";
          mappingPanel.append(heading);
          const teams = [...(state.currentSeason?.teams || [])]
            .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
          item.ownerMappingNeeds.forEach(sourceLabel => {
            const field = document.createElement("div");
            field.className = "historical-owner-mapping";
            const label = document.createElement("label");
            label.textContent = 'Historical name: "' + sourceLabel + '"';
            const select = document.createElement("select");
            select.dataset.historicalOwnerFile = item.id;
            select.dataset.historicalOwnerLabel = sourceLabel;
            select.disabled = state.historicalImportBusy;
            const prompt = document.createElement("option");
            prompt.value = "";
            prompt.textContent = "Choose current team";
            select.append(prompt);
            teams.forEach(team => {
              const option = document.createElement("option");
              option.value = team.id;
              option.textContent = team.draftOrderPosition + ". " + team.displayName;
              select.append(option);
            });
            select.value = (item.ownerMappings || [])
              .find(mapping => mapping.sourceOwnerOrTeamLabel === sourceLabel)?.teamId || "";
            field.append(label, select);
            mappingPanel.append(field);
          });
          row.append(mappingPanel);
        }
        fragment.append(row);
      });
      historicalImportFileList.replaceChildren(fragment);
      updateHistoricalImportControls();
    };

    const selectHistoricalImportFiles = files => {
      const acceptedExtensions = new Set(["csv", "tsv", "xlsx"]);
      const existingKeys = new Set(state.historicalImportFiles.map(item => item.id));
      const nextFiles = [...files].filter(file => {
        const extension = file.name.toLowerCase().split(".").at(-1);
        return acceptedExtensions.has(extension) && file.size <= 5 * 1024 * 1024;
      });
      const firstNewFileIndex = state.historicalImportFiles.length;
      nextFiles.forEach((file, index) => {
        const id = historicalFileKeyFor(file);
        if (existingKeys.has(id)) return;
        existingKeys.add(id);
        state.historicalImportFiles.push({
          id,
          file,
          seasonYear: inferHistoricalImportYear(file, firstNewFileIndex + index),
          status: "ready",
          message: "Ready to import",
          ownerMappingNeeds: [],
          ownerMappings: [],
        });
      });
      renderHistoricalImportFiles();
      historicalImportFile.value = "";
      historicalImportStatus.textContent = historicalImportQueueIssue() || (nextFiles.length
        ? itemCountLabel(state.historicalImportFiles.length, "file") + " selected."
        : "Choose CSV, TSV, or XLSX files no larger than 5 MB.");
    };

    const historicalImportFailureMessage = body => {
      const issues = [
        ...(body.source?.sourceWarnings || []),
        ...(body.batch?.blockers || []),
      ].map(issue => issue.message).filter(Boolean);
      if (!issues.length) return "Mockd could not find complete player, position, price, and team data in this file.";
      const summary = issues.slice(0, 2).join(" ");
      return summary + (issues.length > 2 ? " " + (issues.length - 2) + " more issues were found." : "");
    };

    const importHistoricalFile = async (item, seasonId) => {
      const preview = await readJson(await fetch(
        "/seasons/" + encodeURIComponent(seasonId) + "/historical-imports/upload-preview",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            fileName: item.file.name,
            mimeType: item.file.type || "application/octet-stream",
            base64: await fileBase64For(item.file),
            seasonYear: item.seasonYear,
            replacementRequested: historicalReplaceInput.checked,
            ownerMappings: item.ownerMappings || [],
          }),
        },
      ));
      const batch = preview.batch || {};
      if (batch.status === "blocked") {
        const ownerMappingNeeds = [...new Set((batch.rows || []).flatMap(row => {
          const needsMapping = (row.blockers || []).some(blocker =>
            blocker.code === "owner_unknown" || blocker.code === "owner_ambiguous"
          );
          const sourceLabel = row.identityAudit?.sourceOwnerOrTeamLabel;
          return needsMapping && sourceLabel ? [sourceLabel] : [];
        }))];
        const error = new Error(historicalImportFailureMessage(preview));
        error.ownerMappingNeeds = ownerMappingNeeds;
        throw error;
      }
      if (!["previewed", "committed", "superseded"].includes(batch.status) || !batch.id) {
        throw new Error(historicalImportFailureMessage(preview));
      }
      const committed = await readJson(await fetch(
        "/historical-imports/" + encodeURIComponent(batch.id) + "/commit",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ seasonId: seasonId, seasonYear: item.seasonYear }),
        },
      ));
      return { ...committed, source: preview.source };
    };

    historicalImportChoose.addEventListener("click", () => historicalImportFile.click());
    historicalImportFile.addEventListener("change", () => {
      selectHistoricalImportFiles(historicalImportFile.files || []);
    });
    historicalImportDropzone.addEventListener("dragover", event => {
      event.preventDefault();
      historicalImportDropzone.classList.add("is-dragging");
    });
    historicalImportDropzone.addEventListener("dragleave", () => {
      historicalImportDropzone.classList.remove("is-dragging");
    });
    historicalImportDropzone.addEventListener("drop", event => {
      event.preventDefault();
      historicalImportDropzone.classList.remove("is-dragging");
      selectHistoricalImportFiles(event.dataTransfer?.files || []);
    });
    historicalImportFileList.addEventListener("input", event => {
      const input = event.target.closest("input[data-historical-year]");
      if (!input) return;
      const item = state.historicalImportFiles.find(candidate => candidate.id === input.dataset.historicalYear);
      if (!item) return;
      item.seasonYear = Number(input.value);
      item.status = "ready";
      item.message = "Ready to import";
      const row = input.closest(".historical-file-row");
      if (row) {
        row.dataset.status = item.status;
        const status = row.querySelector("span");
        if (status) status.textContent = item.message;
      }
      updateHistoricalImportControls();
      historicalImportStatus.textContent = historicalImportQueueIssue()
        || itemCountLabel(state.historicalImportFiles.length, "file") + " selected.";
    });
    historicalImportFileList.addEventListener("change", event => {
      const select = event.target.closest("select[data-historical-owner-file]");
      if (!select) return;
      const item = state.historicalImportFiles.find(candidate => candidate.id === select.dataset.historicalOwnerFile);
      if (!item) return;
      item.ownerMappings = (item.ownerMappings || [])
        .filter(mapping => mapping.sourceOwnerOrTeamLabel !== select.dataset.historicalOwnerLabel);
      if (select.value) {
        item.ownerMappings.push({
          sourceOwnerOrTeamLabel: select.dataset.historicalOwnerLabel,
          teamId: select.value,
        });
      }
      const allMapped = item.ownerMappingNeeds.every(sourceLabel =>
        item.ownerMappings.some(mapping => mapping.sourceOwnerOrTeamLabel === sourceLabel && mapping.teamId)
      );
      item.status = allMapped ? "ready" : "error";
      item.message = allMapped ? "Team names matched. Ready to import." : "Match every historical team name below.";
      renderHistoricalImportFiles();
      historicalImportStatus.textContent = historicalImportQueueIssue()
        || itemCountLabel(state.historicalImportFiles.length, "file") + " selected.";
    });
    historicalImportFileList.addEventListener("click", event => {
      const button = event.target.closest("button[data-historical-remove]");
      if (!button) return;
      state.historicalImportFiles = state.historicalImportFiles.filter(item => item.id !== button.dataset.historicalRemove);
      renderHistoricalImportFiles();
      historicalImportStatus.textContent = historicalImportQueueIssue()
        || (state.historicalImportFiles.length > 0
          ? itemCountLabel(state.historicalImportFiles.length, "file") + " selected."
          : "Choose CSV, TSV, or XLSX files no larger than 5 MB.");
    });

    const playerWarningDetail = warnings => {
      if (!warnings.length) return "";
      const remainingCount = warnings.length - 1;

      return ". " + warnings[0].message
        + (remainingCount === 0 ? "" : " " + remainingCount + " more player-name warnings.");
    };

    const historicalImportSummary = ({ importedCount, selectedCount, publicValueCount, warningCount }) => {
      if (importedCount !== selectedCount) {
        return "Imported " + importedCount + " of " + selectedCount
          + " files. Fix or remove the files marked in yellow, then retry.";
      }
      const warningCopy = warningCount === 0
        ? ""
        : " Check " + itemCountLabel(warningCount, "player-name warning") + " shown with the imported files.";
      const importedCopy = "Imported " + itemCountLabel(importedCount, "draft file") + ". ";
      if (publicValueCount > 0) {
        return importedCopy
          + "Public/AAV values affect league calibration only within the three-year window ending with the latest imported draft season."
          + warningCopy;
      }

      return importedCopy
        + "Draft history is saved. These files do not include public/AAV values. Mockd uses eligible public/AAV values from the three-year window ending with the latest imported draft season."
        + warningCopy;
    };

    historicalImportButton.addEventListener("click", async () => {
      const seasonId = byId("setup-season-id-input").value;
      const pendingFiles = pendingHistoricalImportFiles();
      if (!pendingFiles.length || state.historicalImportBusy) return;
      const queueIssue = historicalImportQueueIssue();
      if (queueIssue) {
        historicalImportStatus.textContent = queueIssue;
        return;
      }
      state.historicalImportBusy = true;
      historicalImportStatus.textContent = "Importing " + itemCountLabel(pendingFiles.length, "draft file") + "...";
      renderHistoricalImportFiles();
      let importedCount = 0;
      let publicValueComparisonCount = 0;
      let playerNameWarningCount = 0;
      for (const item of pendingFiles) {
        item.status = "importing";
        item.message = "Importing...";
        renderHistoricalImportFiles();
        try {
          const body = await importHistoricalFile(item, seasonId);
          const rowCount = (body.committedRecords || []).length;
          const playerNameWarnings = (body.source?.playerResolutionIssues || [])
            .filter(issue => issue.code === "player_historical_only" && issue.severity === "warning");
          item.status = "imported";
          item.message = rowCount + " draft rows imported for " + item.seasonYear
            + playerWarningDetail(playerNameWarnings);
          importedCount += 1;
          playerNameWarningCount += playerNameWarnings.length;
          publicValueComparisonCount += (body.committedRecords || [])
            .filter(record => Number.isFinite(record.publicPriceDollars)).length;
        } catch (error) {
          item.status = "error";
          item.ownerMappingNeeds = Array.isArray(error.ownerMappingNeeds) ? error.ownerMappingNeeds : [];
          item.message = item.ownerMappingNeeds.length > 0
            ? "Match " + itemCountLabel(item.ownerMappingNeeds.length, "historical team name") + " below, then import again."
            : error.message;
        }
        renderHistoricalImportFiles();
      }
      state.historicalImportBusy = false;
      state.playerCatalog = null;
      state.playerCatalogSeasonId = null;
      historicalImportStatus.textContent = historicalImportSummary({
        importedCount,
        selectedCount: pendingFiles.length,
        publicValueCount: publicValueComparisonCount,
        warningCount: playerNameWarningCount,
      });
      renderHistoricalImportFiles();
    });

    const renderSeasonKeepers = keepers => {
      keeperList.replaceChildren();
      keeperSaveState.textContent = itemCountLabel(keepers.length, "keeper") + " saved";
      if (!keepers.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No keepers added yet.";
        keeperList.append(empty);
        return;
      }
      const teams = new Map((state.currentSeason?.teams || []).map(team => [team.id, team.displayName]));
      keepers.forEach(keeper => {
        const row = document.createElement("div");
        row.className = "keeper-row";
        const identity = document.createElement("strong");
        identity.textContent = (teams.get(keeper.teamId) || "Team") + " · " + keeper.playerName;
        const value = document.createElement("span");
        value.textContent = keeper.keeperRound
          ? "Round " + keeper.keeperRound
          : "$" + keeper.price;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Remove";
        remove.dataset.keeperAction = "remove";
        remove.dataset.teamId = keeper.teamId;
        remove.dataset.playerId = keeper.playerId || "";
        remove.disabled = state.draftHasStarted;
        row.append(identity, value, remove);
        keeperList.append(row);
      });
    };

    const loadSeasonKeepers = async (seasonId, requestGeneration = state.workspaceRequestGeneration) => {
      keeperSaveState.textContent = "Loading keepers...";
      const body = await readJson(await fetch(
        "/seasons/" + encodeURIComponent(seasonId) + "/keepers",
        { credentials: "same-origin" },
      ));
      if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
      renderSeasonKeepers(body.keepers || []);
    };

    keeperCommandInput.addEventListener("input", () => {
      state.keeperPreviewCommand = null;
      keeperApplyButton.disabled = true;
      keeperStatus.textContent = "";
    });

    keeperPreviewButton.addEventListener("click", async () => {
      const seasonId = byId("setup-season-id-input").value;
      const command = keeperCommandInput.value.trim();
      if (!command) {
        keeperStatus.textContent = "Enter a keeper command first.";
        keeperCommandInput.focus();
        return;
      }
      keeperPreviewButton.disabled = true;
      keeperApplyButton.disabled = true;
      keeperStatus.textContent = "Checking keeper...";
      try {
        const response = await fetch(
          "/seasons/" + encodeURIComponent(seasonId) + "/keepers/preview",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ command: command }),
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok || body.kind !== "preview") {
          throw new Error(body.error?.message || errorMessageFor(body));
        }
        state.keeperPreviewCommand = command;
        const value = body.keeper.draftType === "snake"
          ? "round " + body.keeper.keeperRound
          : "$" + body.keeper.auctionCostDollars;
        keeperStatus.textContent = body.team.name + " keeps " + body.player.name + " for " + value + ".";
        keeperApplyButton.disabled = state.draftHasStarted;
      } catch (error) {
        state.keeperPreviewCommand = null;
        keeperStatus.textContent = error.message;
      } finally {
        keeperPreviewButton.disabled = state.draftHasStarted;
      }
    });

    keeperApplyButton.addEventListener("click", async () => {
      const seasonId = byId("setup-season-id-input").value;
      const command = state.keeperPreviewCommand;
      if (!command) return;
      keeperApplyButton.disabled = true;
      keeperStatus.textContent = "Adding keeper and updating league values...";
      keeperSaveState.textContent = "Saving...";
      try {
        const body = await readJson(await fetch(
          "/seasons/" + encodeURIComponent(seasonId) + "/keepers/apply",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ command: command, confirmed: true }),
          },
        ));
        renderSeasonKeepers(body.keepers || []);
        keeperCommandInput.value = "";
        state.keeperPreviewCommand = null;
        state.playerCatalog = null;
        state.playerCatalogSeasonId = null;
        keeperStatus.textContent = body.room
          ? "Saved. League values and the draft room are updated."
          : "Saved. League values are updated.";
      } catch (error) {
        keeperStatus.textContent = error.message;
        keeperSaveState.textContent = "Could not save";
        keeperApplyButton.disabled = state.draftHasStarted;
      }
    });

    keeperList.addEventListener("click", async event => {
      const button = event.target.closest('button[data-keeper-action="remove"]');
      if (!button) return;
      const seasonId = byId("setup-season-id-input").value;
      button.disabled = true;
      keeperStatus.textContent = "Removing keeper...";
      keeperSaveState.textContent = "Saving...";
      try {
        const body = await readJson(await fetch(
          "/seasons/" + encodeURIComponent(seasonId) + "/keepers",
          {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ teamId: button.dataset.teamId, playerId: button.dataset.playerId }),
          },
        ));
        renderSeasonKeepers(body.keepers || []);
        state.playerCatalog = null;
        state.playerCatalogSeasonId = null;
        keeperStatus.textContent = body.room
          ? "Removed and saved. League values and the draft room are updated."
          : "Removed and saved. League values are updated.";
      } catch (error) {
        keeperStatus.textContent = error.message;
        keeperSaveState.textContent = "Could not save";
        button.disabled = false;
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

    cancelLiveRoomButton.addEventListener("click", async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague?.liveDraft?.roomId) return;
      if (!window.confirm("Cancel this unstarted draft room? League setup and keepers will become editable again.")) return;
      cancelLiveRoomButton.disabled = true;
      liveRoomSetupStatus.textContent = "Cancelling the draft room...";
      try {
        await readJson(await fetch(
          "/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/live-room",
          { method: "DELETE", credentials: "same-origin" },
        ));
        await loadOnboarding();
      } catch (error) {
        liveRoomSetupStatus.textContent = error.message;
        cancelLiveRoomButton.disabled = false;
      }
    });

    publishSeasonButton.addEventListener("click", async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) return;
      publishSeasonButton.disabled = true;
      liveRoomSetupStatus.textContent = "Publishing league setup...";
      try {
        const body = await readJson(await fetch(
          "/seasons/" + encodeURIComponent(selectedLeague.seasonId) + "/publish",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ confirmed: setupFinalReview.checked }),
          },
        ));
        renderSeasonTeams(body.season);
        liveRoomSetupStatus.textContent = "League setup published. The shared draft room can now be created.";
      } catch (error) {
        liveRoomSetupStatus.textContent = error.message;
        publishSeasonButton.disabled = !setupFinalReview.checked;
      }
    });
    setupFinalReview.addEventListener("change", () => {
      publishSeasonButton.disabled = !setupFinalReview.checked || state.setupLocked;
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

    leagueCreateSeason.value = String(new Date().getFullYear());
    byId("league-info-button").addEventListener("click", () => {
      if (!state.leagueCreation) applyLeagueCreationReview(manualLeagueCreationReview());
      cancelLeagueCreationScreenshotRequest();
      state.leagueCreationScreenshotFile = null;
      leagueCreateScreenshotFile.value = "";
      leagueCreateScreenshotAnalyze.disabled = true;
      leagueCreateScreenshotStatus.textContent = "";
      setHidden(leagueCreateScreenshotPanel, true);
      loadLeagueCreationScreenshotCapability();
      showLeagueCreationStep("basics");
      leagueSetupDialog.showModal();
    });
    byId("league-setup-close").addEventListener("click", () => leagueSetupDialog.close());
    leagueSetupDialog.addEventListener("close", () => {
      cancelLeagueCreationScreenshotRequest();
      leagueCreateScreenshotDropzone.classList.remove("is-dragging");
    });

    leagueCreateScreenshotChoose.addEventListener("click", () => leagueCreateScreenshotFile.click());
    leagueCreateScreenshotFile.addEventListener("change", () => {
      selectLeagueCreationScreenshot(leagueCreateScreenshotFile.files?.[0] || null);
    });
    leagueCreateScreenshotDropzone.addEventListener("dragover", event => {
      event.preventDefault();
      leagueCreateScreenshotDropzone.classList.add("is-dragging");
    });
    leagueCreateScreenshotDropzone.addEventListener("dragleave", () => {
      leagueCreateScreenshotDropzone.classList.remove("is-dragging");
    });
    leagueCreateScreenshotDropzone.addEventListener("drop", event => {
      event.preventDefault();
      leagueCreateScreenshotDropzone.classList.remove("is-dragging");
      selectLeagueCreationScreenshot(event.dataTransfer?.files?.[0] || null);
    });
    leagueCreateScreenshotAnalyze.addEventListener("click", analyzeLeagueCreationScreenshot);

    byId("league-create-review-espn").addEventListener("click", async () => {
      const leagueIdOrUrl = leagueCreateEspnId.value.trim();
      if (!leagueIdOrUrl) {
        leagueCreateImportStatus.textContent = "Enter an ESPN league ID or URL.";
        leagueCreateEspnId.focus();
        return;
      }
      leagueCreateImportStatus.textContent = "Checking ESPN settings...";
      try {
        const outcome = await readJson(await fetch("/league-imports/espn/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            leagueIdOrUrl: leagueIdOrUrl,
            season: Number(leagueCreateSeason.value),
          }),
        }));
        if (outcome.kind === "manual-review-required") {
          if (!state.leagueCreation) applyLeagueCreationReview(manualLeagueCreationReview());
          state.leagueCreation.provider = "espn";
          state.leagueCreation.externalLeagueId = outcome.externalLeagueId || leagueIdOrUrl;
          renderLeagueCreationImportSummary(
            "failure",
            "ESPN settings unavailable",
            outcome.message + " No settings were imported. Continue with manual entry.",
            null,
            outcome.warnings || [],
          );
          leagueCreateImportStatus.textContent = "ESPN did not change any fields.";
          return;
        }
        const review = leagueCreationReviewFromEspn(outcome);
        applyLeagueCreationReview(review);
        renderLeagueCreationImportSummary(
          "success",
          "Imported from ESPN",
          "These fields came from ESPN. Review them before finishing.",
          review,
          outcome.warnings || [],
        );
        leagueCreateImportStatus.textContent = "ESPN settings filled the wizard.";
      } catch (error) {
        renderLeagueCreationImportSummary(
          "failure",
          "ESPN import failed",
          error.message + " No settings were imported. Continue with manual entry.",
          null,
          [],
        );
        leagueCreateImportStatus.textContent = "ESPN did not change any fields.";
      }
    });

    leagueCreateDraftFormat.addEventListener("change", updateLeagueCreationFormatFields);
    leagueCreateTeamRows.addEventListener("input", updateLeagueCreationSubmit);
    leagueCreateBack.addEventListener("click", () => {
      const currentIndex = leagueCreationSteps.indexOf(state.leagueCreationStep);
      if (state.leagueCreationStep === "teams") cancelLeagueCreationScreenshotRequest();
      if (currentIndex > 0) showLeagueCreationStep(leagueCreationSteps[currentIndex - 1]);
    });
    leagueCreateNext.addEventListener("click", () => {
      const currentIndex = leagueCreationSteps.indexOf(state.leagueCreationStep);
      if (!leagueCreationStepIsValid(state.leagueCreationStep)) return;
      if (currentIndex < leagueCreationSteps.length - 1) showLeagueCreationStep(leagueCreationSteps[currentIndex + 1]);
    });
    leagueCreateReview.addEventListener("submit", async event => {
      event.preventDefault();
      if (!state.leagueCreation || !teamNamesComplete()) return;
      const teams = leagueCreationTeamsForSubmission();
      const draft = leagueCreateDraftFormat.value === "snake"
        ? {
            type: "snake",
            rounds: Number(leagueCreateSnakeRounds.value),
            order: teams.map(team => team.externalTeamId),
            reversal: "standard",
          }
        : {
            type: "auction",
            budgetDollars: Number(leagueCreateAuctionBudget.value),
            minimumBidDollars: Number(leagueCreateAuctionMinimumBid.value),
          };
      leagueCreateSubmit.disabled = true;
      leagueCreateStatus.textContent = "Creating league...";
      try {
        const body = await readJson(await fetch("/leagues", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            setup: {
              provider: state.leagueCreation.provider,
              externalLeagueId: state.leagueCreation.externalLeagueId,
              leagueName: leagueCreateName.value.trim(),
              seasonYear: Number(leagueCreateSeason.value),
              expectedTeamCount: teams.length,
              teams: teams,
              draft: draft,
              scoring: {
                passingYards: Number(leagueCreatePassYard.value),
                passingTouchdown: Number(leagueCreatePassTd.value),
                rushingYards: Number(leagueCreateRushYard.value),
                rushingTouchdown: Number(leagueCreateRushTd.value),
                receivingYards: Number(leagueCreateReceiveYard.value),
                receivingTouchdown: Number(leagueCreateReceiveTd.value),
                reception: Number(leagueCreatePpr.value),
              },
              rosterSlots: Object.fromEntries(
                [...leagueCreateRosterSlots.querySelectorAll("[data-roster-slot]")]
                  .map(input => [input.dataset.rosterSlot, Number(input.value)]),
              ),
            },
          }),
        }));
        window.location.assign("/league?seasonId=" + encodeURIComponent(body.season.id));
      } catch (error) {
        leagueCreateStatus.textContent = error.message;
        updateLeagueCreationSubmit();
      }
    });

    standalonePlayerSearch.addEventListener("input", renderStandaloneBoard);
    standalonePositionFilter.addEventListener("change", renderStandaloneBoard);
    standaloneShortlistOnly.addEventListener("change", renderStandaloneBoard);
    practiceStrategy.addEventListener("change", () => {
      state.boardRequestGeneration += 1;
      state.playerCatalog = null;
      state.playerCatalogStrategyKey = null;
      const mockLink = byId("standalone-board-open-mock");
      if (state.selectedLeague) {
        const query = new URLSearchParams({
          seasonId: state.selectedLeague.seasonId,
          strategy: practiceStrategy.value,
        });
        mockLink.href = "/mock-drafts?" + query.toString();
      }
      loadStandaloneBoard().catch(error => {
        standaloneBoardStatus.textContent = error.message;
      });
    });
    standaloneBoardSort.addEventListener("change", () => {
      state.playerBoardSort = standaloneBoardSort.value;
      renderStandaloneBoard();
    });
    simulationRun.addEventListener("click", runBoardSimulations);
    simulationRunPicker.addEventListener("change", () => {
      state.selectedSimulationRunIndex = Number(simulationRunPicker.value) || 0;
      renderSimulationRun();
    });
    simulationHistoryPicker.addEventListener("change", () => {
      const run = state.simulationHistory.find(candidate => candidate.id === simulationHistoryPicker.value);
      simulationHistoryNote.textContent = run?.note || "No note saved for this run.";
    });
    simulationHistoryOpen.addEventListener("click", async () => {
      const run = state.simulationHistory.find(candidate => candidate.id === simulationHistoryPicker.value);
      const selectedLeague = state.selectedLeague;
      if (!run || !selectedLeague) return;
      const seasonId = selectedLeague.seasonId;
      const requestGeneration = state.workspaceRequestGeneration;
      simulationHistoryOpen.disabled = true;
      simulationStatus.textContent = "Loading saved run...";
      try {
        const body = await readJson(await fetch(
          "/season-simulations/" + encodeURIComponent(run.id),
          { credentials: "same-origin" },
        ));
        if (!isCurrentWorkspaceRequest(seasonId, requestGeneration)) return;
        renderSimulationResult(body.simulation, body.note || "");
      } catch (error) {
        if (isCurrentWorkspaceRequest(seasonId, requestGeneration)) {
          simulationStatus.textContent = error.message;
        }
      } finally {
        if (isCurrentWorkspaceRequest(seasonId, requestGeneration)) {
          simulationHistoryOpen.disabled = false;
        }
      }
    });
    byId("standalone-board-open-simulations").addEventListener("click", () => {
      simulationPanel.open = true;
      simulationPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      simulationStrategy.focus();
    });
    mockDraftSearch.addEventListener("input", renderMockDraft);
    mockDraftStart.addEventListener("click", () => {
      if (!state.mockDraft) return;
      sendMockDraftCommand({ type: "start", expectedRevision: state.mockDraft.session.revision });
    });
    mockDraftBuy.addEventListener("click", () => {
      const nomination = state.mockDraft?.session?.currentNomination;
      if (!state.mockDraft || !nomination) return;
      sendMockDraftCommand({
        type: "buy",
        expectedRevision: state.mockDraft.session.revision,
        price: nomination.nextBid,
      });
    });
    mockDraftPass.addEventListener("click", () => {
      if (!state.mockDraft) return;
      sendMockDraftCommand({ type: "pass", expectedRevision: state.mockDraft.session.revision });
    });
    mockDraftUndo.addEventListener("click", () => {
      if (!state.mockDraft) return;
      sendMockDraftCommand({ type: "undo", expectedRevision: state.mockDraft.session.revision });
    });
    mockDraftComplete.addEventListener("click", () => {
      if (!state.mockDraft) return;
      sendMockDraftCommand({ type: "complete", expectedRevision: state.mockDraft.session.revision });
    });
    mockDraftPlayerRows.addEventListener("click", event => {
      const button = event.target.closest("[data-mock-player-id]");
      if (!button || !state.mockDraft) return;
      const command = state.mockSession?.draftMode?.format === "auction"
        ? {
            type: "nominate",
            expectedRevision: state.mockDraft.session.revision,
            playerId: button.dataset.mockPlayerId,
          }
        : {
            type: "pick",
            expectedRevision: state.mockDraft.session.revision,
            playerId: button.dataset.mockPlayerId,
          };
      sendMockDraftCommand(command);
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
