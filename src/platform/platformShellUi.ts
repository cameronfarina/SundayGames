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

interface MockRosterEligibilityTeam {
  positionCounts?: Readonly<Record<string, number>> | undefined;
  slots?: readonly {
    eligiblePositions?: readonly string[] | undefined;
    playerId?: string | undefined;
  }[] | undefined;
}

export const canMockTeamRosterPlayer = (
  team: MockRosterEligibilityTeam | undefined,
  playerPosition: string,
  positionMaximums: Readonly<Record<string, number>> | undefined,
): boolean => {
  if (team === undefined) return false;
  const positionCount = Number(team.positionCounts?.[playerPosition] ?? 0);
  const positionMaximum = Number(positionMaximums?.[playerPosition] ?? 0);
  if (positionCount >= positionMaximum) return false;

  return (team.slots ?? []).some(slot =>
    slot.playerId === undefined
    && (slot.eligiblePositions ?? []).includes(playerPosition)
  );
};

export const draftRoomPathFor = (input: { seasonId: string; roomId: string }): string => {
  const query = new URLSearchParams({ seasonId: input.seasonId, roomId: input.roomId });
  return `/draft-room?${query.toString()}`;
};

const navigationMarkup = platformShellNavigation
  .map(item => `<a class="product-nav-link" data-nav-path="${item.path}" href="${item.path}">${item.label}</a>`)
  .join("");

export interface PlatformShellCapabilities {
  leagueCreationScreenshotAnalysis: boolean;
}

const leagueCreationScreenshotPanelMarkup = `
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
                  </section>`;

export const createPlatformShellHtml = (capabilities: PlatformShellCapabilities): string => `<!doctype html>
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
      --control-bg: #11151b;
      --control-bg-hover: #151a22;
      --control-border: #3b424e;
      --control-border-hover: #596474;
      --control-placeholder: #7f8998;
      --text: #f3f5f7;
      --muted: #a5acb8;
      --accent: #67d8b0;
      --accent-strong: #88edc8;
      --task-progress-track: #15332b;
      --task-progress-fill: #1f6b53;
      --danger: #ff8c9b;
      --warning: #f4c86b;
      --focus: #71b7ff;
      --position-qb: #f4c86b;
      --position-rb: #67a8ff;
      --position-wr: #d38cff;
      --position-te: #ff8ca1;
      --position-flex: #67d8b0;
      --position-dst: #73d8d2;
      --position-k: #a7b0bf;
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
      background-color: var(--control-bg);
      font-weight: 650;
      max-width: min(52vw, 340px);
      min-height: 40px;
      padding-block: 7px;
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

    .field-hint {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      margin: 7px 0 0;
    }

    .stack { display: grid; gap: 16px; }
    .compact-stack { display: grid; gap: 10px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }

    input, select, textarea {
      background-color: var(--control-bg);
      border: 1px solid var(--control-border);
      border-radius: 6px;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / .025), 0 1px 2px rgb(0 0 0 / .18);
      caret-color: var(--accent-strong);
      color: var(--text);
      min-height: 44px;
      padding: 10px 12px;
      transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
      width: 100%;
    }

    input::placeholder, textarea::placeholder {
      color: var(--control-placeholder);
      opacity: 1;
    }

    input:hover:not(:disabled):not([readonly]),
    select:hover:not(:disabled),
    textarea:hover:not(:disabled):not([readonly]) {
      background-color: var(--control-bg-hover);
      border-color: var(--control-border-hover);
    }

    input:focus, select:focus, textarea:focus {
      background-color: var(--control-bg-hover);
      border-color: var(--focus);
      box-shadow: 0 0 0 3px rgb(113 183 255 / .15), inset 0 1px 0 rgb(255 255 255 / .035);
      outline: none;
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='m4 6 4 4 4-4' stroke='%23B8C0CC' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-position: right 12px center;
      background-repeat: no-repeat;
      background-size: 16px;
      padding-right: 40px;
    }

    input[type="checkbox"], input[type="radio"] {
      appearance: none;
      -webkit-appearance: none;
      accent-color: var(--accent);
      align-items: center;
      background: var(--control-bg);
      border: 1px solid var(--control-border-hover);
      box-shadow: inset 0 1px 0 rgb(255 255 255 / .035);
      display: inline-grid;
      justify-content: center;
      min-height: 18px;
      padding: 0;
      transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
      width: 18px;
    }

    input[type="checkbox"] { border-radius: 4px; }
    input[type="radio"] { border-radius: 50%; }

    input[type="checkbox"]::before {
      border-bottom: 2px solid #06110d;
      border-left: 2px solid #06110d;
      content: "";
      height: 4px;
      transform: translateY(-1px) rotate(-45deg) scale(0);
      transition: transform 100ms ease;
      width: 8px;
    }

    input[type="radio"]::before {
      background: #06110d;
      border-radius: 50%;
      content: "";
      height: 7px;
      transform: scale(0);
      transition: transform 100ms ease;
      width: 7px;
    }

    input[type="checkbox"]:checked, input[type="radio"]:checked {
      background: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgb(103 216 176 / .1);
    }

    input[type="checkbox"]:checked::before,
    input[type="radio"]:checked::before { transform: translateY(-1px) rotate(-45deg) scale(1); }
    input[type="radio"]:checked::before { transform: scale(1); }

    input[type="search"]::-webkit-search-cancel-button { cursor: pointer; filter: invert(.75); }
    input[type="number"] { font-variant-numeric: tabular-nums; }

    input::file-selector-button {
      background: var(--surface-raised);
      border: 1px solid var(--control-border);
      border-radius: 5px;
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-weight: 750;
      margin: -5px 10px -5px -7px;
      min-height: 34px;
      padding: 6px 11px;
    }

    input[type="file"]:hover::file-selector-button {
      background: #20242c;
      border-color: var(--control-border-hover);
    }

    input:disabled, select:disabled, textarea:disabled,
    input[readonly], textarea[readonly] {
      background-color: #0d1015;
      border-color: #292f38;
      box-shadow: none;
      color: #858e9c;
      cursor: not-allowed;
      opacity: .72;
    }

    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-text-fill-color: var(--text);
      box-shadow: 0 0 0 1000px var(--control-bg) inset;
      caret-color: var(--accent-strong);
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

    button:not(:disabled):hover, .button:not([aria-disabled="true"]):hover {
      background: #20242c;
      border-color: #5a6372;
    }
    button.primary:not(:disabled):hover, .button.primary:not([aria-disabled="true"]):hover {
      background: var(--accent-strong);
      border-color: var(--accent-strong);
    }
    button.danger {
      background: transparent;
      border-color: color-mix(in srgb, var(--danger) 55%, var(--line));
      color: var(--danger);
    }
    button.danger:not(:disabled):hover {
      background: color-mix(in srgb, var(--danger) 12%, var(--surface-raised));
      border-color: var(--danger);
    }

    button:disabled, .button[aria-disabled="true"] {
      cursor: not-allowed;
      opacity: .5;
    }

    .task-progress-button {
      font-variant-numeric: tabular-nums;
      isolation: isolate;
      min-width: 160px;
      overflow: hidden;
      position: relative;
    }
    .task-progress-button::before {
      background: var(--task-progress-fill);
      content: "";
      inset: 0 auto 0 0;
      opacity: 0;
      position: absolute;
      transition: width 180ms ease;
      width: var(--task-progress, 0%);
      z-index: -1;
    }
    .task-progress-button[aria-busy="true"] {
      background: var(--task-progress-track);
      border-color: color-mix(in srgb, var(--accent) 70%, var(--line));
      color: var(--text);
      opacity: 1;
    }
    .task-progress-button[aria-busy="true"]::before { opacity: 1; }
    .task-progress-button[data-progress-mode="indeterminate"]::before {
      animation: task-progress-indeterminate 1.1s ease-in-out infinite;
      transform: translateX(-120%);
      width: 42%;
    }
    .task-progress-button [data-button-label] {
      position: relative;
      z-index: 1;
    }

    @keyframes task-progress-indeterminate {
      to { transform: translateX(340%); }
    }

    @media (prefers-reduced-motion: reduce) {
      .task-progress-button[data-progress-mode="indeterminate"]::before {
        animation: none;
        transform: none;
      }
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
    .workspace > * { min-width: 0; }

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

    .no-league-practice-onboarding {
      background: var(--surface);
      border-left: 3px solid var(--accent);
      display: grid;
      gap: 12px;
      padding: 16px;
    }
    .no-league-practice-onboarding h2,
    .no-league-practice-onboarding p { margin: 0; }
    .no-league-practice-onboarding h2 { font-size: 18px; }
    .no-league-practice-onboarding .lede { max-width: 760px; }
    .no-league-invitation-instructions {
      color: var(--muted);
      line-height: 1.5;
      max-width: 760px;
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
    .keeper-command-form {
      align-items: end;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
      margin-top: 16px;
    }
    .keeper-command-form > div { min-width: 0; }
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
      scroll-padding-block: 24px;
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
      scroll-margin-block: 16px;
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
    .responsive-team-table { max-width: 100%; min-width: 0; }
    .player-board-scroll {
      border-bottom: 1px solid var(--line);
      border-top: 1px solid var(--line);
      max-height: min(68vh, 720px);
      overflow: auto;
      overscroll-behavior: auto;
    }
    .player-board-scroll .player-board thead th {
      background: var(--bg);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .setup-preview-table { border-collapse: collapse; min-width: 620px; width: 100%; }
    .commissioner-team-table { min-width: 0; table-layout: fixed; }
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

    .simulation-target-plan {
      border-bottom: 1px solid var(--line);
      border-top: 1px solid var(--line);
      display: grid;
      gap: 12px;
      padding: 16px 0;
    }
    .simulation-target-plan-header {
      align-items: baseline;
      display: flex;
      gap: 12px;
      justify-content: space-between;
    }
    .simulation-target-plan-header h2 { font-size: 16px; margin: 0; }
    .simulation-target-count { color: var(--muted); font-size: 13px; }
    .simulation-target-list { display: grid; }
    .simulation-target-row {
      align-items: end;
      border-top: 1px solid var(--line);
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) minmax(100px, 140px) 42px;
      padding: 10px 0;
    }
    .simulation-target-row.no-cap-control { grid-template-columns: minmax(0, 1fr) 42px; }
    .simulation-target-row:first-child { border-top: 0; }
    .simulation-target-player { align-self: center; display: grid; gap: 3px; min-width: 0; }
    .simulation-target-player strong { overflow-wrap: anywhere; }
    .simulation-target-player span { color: var(--muted); font-size: 12px; font-weight: 750; }
    .simulation-target-cap label { margin-bottom: 4px; }
    .simulation-target-cap input { min-height: 40px; }
    .simulation-target-remove { font-size: 19px; min-height: 40px; padding: 0; width: 42px; }
    .simulation-target-empty { color: var(--muted); margin: 0; }
    .simulation-target-status { margin: 0; }

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
    .mock-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mock-facts .fact { min-height: 68px; padding: 10px 14px; }
    .mock-auction-stage {
      background: var(--surface);
      border: 1px solid rgb(103 216 176 / .56);
      border-left: 4px solid var(--accent);
      border-radius: 6px;
      display: grid;
      gap: 16px;
      padding: 18px;
    }
    .mock-auction-stage > * { min-width: 0; }
    .mock-auction-main {
      align-items: center;
      display: grid;
      gap: 18px;
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .mock-auction-copy { min-width: 0; }
    .mock-auction-copy h2 {
      font-size: 24px;
      line-height: 1.2;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .mock-auction-meta { color: var(--muted); margin: 6px 0 0; }
    .mock-auction-bid { min-width: 130px; text-align: right; }
    .mock-auction-bid span {
      color: var(--muted);
      display: block;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .mock-auction-bid strong {
      color: var(--accent-strong);
      display: block;
      font-size: 34px;
      line-height: 1;
      margin-top: 7px;
    }
    .mock-auction-bid small { color: var(--muted); display: block; margin-top: 7px; }
    .mock-auction-controls {
      align-items: center;
      border-top: 1px solid var(--line);
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 14px;
    }
    .mock-auction-controls .primary { min-width: 132px; }
    .mock-auction-countdown {
      align-items: center;
      background: var(--accent);
      border-radius: 50%;
      color: #06110d;
      display: flex;
      font-size: 22px;
      font-weight: 900;
      height: 44px;
      justify-content: center;
      width: 44px;
    }
    .mock-auction-feed {
      display: flex;
      flex: 1 1 320px;
      gap: 7px;
      list-style: none;
      margin: 0;
      min-width: 0;
      overflow-x: auto;
      padding: 0;
      scrollbar-width: thin;
    }
    .mock-auction-feed li {
      background: var(--surface-raised);
      border: 1px solid var(--line);
      border-radius: 4px;
      color: var(--muted);
      flex: 0 0 auto;
      font-size: 12px;
      padding: 7px 9px;
    }
    .mock-auction-feed li[data-event-type="bid"] { border-color: rgb(113 183 255 / .5); color: #a9d3ff; }
    .mock-auction-feed li[data-event-type="sold"] { border-color: rgb(103 216 176 / .5); color: var(--accent-strong); }
    .mock-toolbar {
      align-items: end;
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(0, 1fr);
    }
    .mock-position-filters {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
      scrollbar-width: thin;
    }
    .mock-position-filter {
      --position-accent: var(--accent);
      --position-wash: rgb(103 216 176 / .12);
      flex: 0 0 auto;
      gap: 7px;
      min-height: 34px;
      padding: 6px 11px;
    }
    .mock-position-filter:not([data-mock-position="ALL"])::before {
      background: var(--position-accent);
      border-radius: 50%;
      content: "";
      height: 7px;
      width: 7px;
    }
    .mock-position-filter[data-mock-position="QB"] { --position-accent: var(--position-qb); --position-wash: rgb(244 200 107 / .13); }
    .mock-position-filter[data-mock-position="RB"] { --position-accent: var(--position-rb); --position-wash: rgb(103 168 255 / .13); }
    .mock-position-filter[data-mock-position="WR"] { --position-accent: var(--position-wr); --position-wash: rgb(211 140 255 / .13); }
    .mock-position-filter[data-mock-position="TE"] { --position-accent: var(--position-te); --position-wash: rgb(255 140 161 / .13); }
    .mock-position-filter[data-mock-position="FLEX"] { --position-accent: var(--position-flex); --position-wash: rgb(103 216 176 / .13); }
    .mock-position-filter[data-mock-position="DST"] { --position-accent: var(--position-dst); --position-wash: rgb(115 216 210 / .13); }
    .mock-position-filter[data-mock-position="K"] { --position-accent: var(--position-k); --position-wash: rgb(167 176 191 / .13); }
    .mock-position-filter[aria-pressed="true"] {
      background: var(--position-wash);
      border-color: var(--position-accent);
      color: var(--text);
    }
    .mock-results-header {
      align-items: end;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: space-between;
    }
    .mock-results-header h2 { margin-bottom: 4px; }
    .mock-results-header p { margin: 0; }
    #mock-draft-roster-team {
      font-size: 17px;
      font-weight: 800;
      margin-bottom: 12px;
    }
    .mock-roster-facts {
      display: grid;
      gap: 1px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 1px;
    }
    .mock-roster-fact {
      background: var(--surface);
      min-width: 0;
      padding: 10px;
    }
    .mock-roster-fact span {
      color: var(--muted);
      display: block;
      font-size: 10px;
      font-weight: 800;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .mock-roster-fact strong { display: block; overflow-wrap: anywhere; }
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
    .mock-roster-copy { display: grid; gap: 2px; min-width: 0; text-align: right; }
    .mock-roster-copy strong { overflow-wrap: anywhere; }
    .mock-roster span, .mock-roster-copy small { color: var(--muted); font-size: 12px; }
    .position-label { color: var(--muted); font-weight: 850; }
    .position-label[data-position="QB"] { color: var(--position-qb); }
    .position-label[data-position="RB"] { color: var(--position-rb); }
    .position-label[data-position="WR"] { color: var(--position-wr); }
    .position-label[data-position="TE"] { color: var(--position-te); }
    .position-label[data-position="FLEX"] { color: var(--position-flex); }
    .position-label[data-position="DST"] { color: var(--position-dst); }
    .position-label[data-position="K"] { color: var(--position-k); }
    .mock-player-action { min-height: 34px; padding: 5px 10px; }
    .mock-player-action:not(:disabled):hover { border-color: var(--accent); color: var(--accent-strong); }
    .player-board tr[data-position] { border-left: 3px solid transparent; }
    .player-board tr[data-position="RB"] { border-left-color: var(--position-rb); }
    .player-board tr[data-position="WR"] { border-left-color: var(--position-wr); }
    .player-board tr[data-position="QB"] { border-left-color: var(--position-qb); }
    .player-board tr[data-position="TE"] { border-left-color: var(--position-te); }
    .player-board tr[data-position="DST"] { border-left-color: var(--position-dst); }
    .player-board tr[data-position="K"] { border-left-color: var(--position-k); }
    .player-board tbody tr:hover { background: rgb(255 255 255 / .025); }

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
    .league-invite-link {
      align-items: stretch;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
      margin-top: 16px;
    }
    .league-invite-link input { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .invite-team-list { display: grid; gap: 1px; margin-top: 20px; }
    .invite-team-row {
      align-items: center;
      background: var(--surface);
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(0, 1fr) auto;
      min-height: 72px;
      padding: 14px 16px;
    }
    .invite-team-copy { min-width: 0; }
    .invite-team-copy strong, .invite-team-copy span { display: block; overflow-wrap: anywhere; }
    .invite-team-copy span { color: var(--muted); font-size: 13px; margin-top: 3px; }
    .invite-team-status { color: var(--muted); font-size: 13px; font-weight: 750; }
    .auth-invite-context {
      border-bottom: 1px solid var(--line);
      padding-bottom: 18px;
    }
    .auth-invite-context h2 { font-size: 22px; margin: 4px 0 6px; }
    .auth-invite-teams {
      display: grid;
      gap: 6px 18px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      list-style: none;
      margin: 14px 0 0;
      padding: 0;
    }
    .auth-invite-teams li { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
    .auth-invite-teams strong { color: var(--text); display: block; }

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
      .mock-facts { grid-template-columns: repeat(6, max-content); }
      .mock-facts .fact strong { white-space: nowrap; }
      .setup-layout { grid-template-columns: minmax(0, 1.15fr) minmax(320px, .85fr); }
      .setup-fields { grid-template-columns: minmax(0, 1fr) minmax(180px, .5fr); }
      .board-controls { grid-template-columns: minmax(0, 1fr) 140px 180px 165px auto; }
      .mock-layout { grid-template-columns: minmax(0, 1fr) minmax(280px, .36fr); }
      .mock-roster-panel { order: 0; }
      .room-setup { grid-column: 1 / -1; }
      .league-invite-section { grid-column: 1 / -1; }
    }

    @media (max-width: 560px) {
      .league-invite-link, .invite-team-row { grid-template-columns: 1fr; }
      .league-invite-link button, .invite-team-row button { width: 100%; }
      .auth-invite-teams { grid-template-columns: 1fr; }
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
      .setup-team-actions button { width: 100%; }
      .commissioner-team-table { display: block; }
      .commissioner-team-table thead { display: none; }
      .commissioner-team-table tbody {
        display: grid;
        gap: 10px;
      }
      .commissioner-team-table tr {
        background: var(--surface);
        border-left: 3px solid var(--accent);
        display: grid;
        gap: 8px;
        padding: 12px;
      }
      .commissioner-team-table td {
        align-items: start;
        border: 0;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(86px, .38fr) minmax(0, 1fr);
        overflow-wrap: anywhere;
        padding: 0;
      }
      .commissioner-team-table td[data-label]::before {
        color: var(--muted);
        content: attr(data-label);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .historical-file-row { grid-template-columns: 1fr; }
      .keeper-command-form { grid-template-columns: 1fr; }
      .keeper-command-form button { width: 100%; }
      .player-board-scroll { max-height: min(58vh, 520px); }
      .mock-auction-main { align-items: start; grid-template-columns: 1fr; }
      .mock-auction-bid { text-align: left; }
      .mock-auction-feed { flex-basis: 100%; order: 3; }
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
      <div id="auth-invite-context" class="auth-invite-context hidden">
        <p class="eyebrow">League invitation</p>
        <h2 id="auth-invite-league-name">Loading league...</h2>
        <p id="auth-invite-season" class="status"></p>
        <ul id="auth-invite-team-list" class="auth-invite-teams"></ul>
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
            <p id="standalone-board-description" class="lede">Explore current player rankings and compare baseline values.</p>
          </div>
          <div class="actions">
            <a id="standalone-board-open-mock" class="button primary hidden">Start mock draft</a>
            <button id="standalone-board-open-simulations" class="button hidden" type="button">Run simulations</button>
          </div>
        </div>
        <section id="no-league-practice-onboarding" class="no-league-practice-onboarding hidden" aria-labelledby="no-league-practice-title">
          <div>
            <p class="eyebrow">Board-only access</p>
            <h2 id="no-league-practice-title">Use the player board now</h2>
            <p class="lede">Without a league, this board uses baseline market values. Simulations, mock drafts, keepers, and league-specific pricing unlock after you create or join a league.</p>
          </div>
          <div class="actions">
            <a id="no-league-create-league" class="button primary" href="/league?create=1">Create league</a>
            <button id="no-league-invitation-help" type="button" aria-expanded="false" aria-controls="no-league-invitation-instructions">Join from invitation</button>
          </div>
          <p id="no-league-invitation-instructions" class="no-league-invitation-instructions hidden" tabindex="-1">Open the private league link your commissioner shared in email or your group chat. After you sign in or create an account, Mockd will let you choose your team.</p>
        </section>
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
            <span>Draft targets only (<strong id="standalone-shortlist-count">0</strong>)</span>
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
            <section class="simulation-target-plan" aria-labelledby="simulation-target-title">
              <div class="simulation-target-plan-header">
                <h2 id="simulation-target-title">Draft targets</h2>
                <span id="simulation-target-count" class="simulation-target-count">0 selected</span>
              </div>
              <div id="simulation-target-list" class="simulation-target-list"></div>
              <p id="simulation-target-empty" class="simulation-target-empty">Star players on the board to add them to this plan.</p>
              <p id="simulation-target-status" class="status simulation-target-status" role="status" aria-live="polite"></p>
            </section>
            <div class="setup-fields">
              <div>
                <label for="simulation-strategy">Additional strategy</label>
                <input id="simulation-strategy" autocomplete="off" placeholder="Prioritize an elite RB and cap other WRs at $25">
              </div>
              <div>
                <label for="simulation-count">Runs</label>
                <input id="simulation-count" type="number" min="1" max="100" step="1" value="25">
              </div>
              <div>
                <label for="simulation-note">Saved note (optional)</label>
                <input id="simulation-note" maxlength="1000" autocomplete="off" aria-describedby="simulation-note-help" placeholder="Label this run for later">
                <p id="simulation-note-help" class="field-hint">For your records only. This note does not change the simulation strategy.</p>
              </div>
            </div>
            <div class="actions"><button id="simulation-run" class="primary task-progress-button" type="button"><span data-button-label>Run simulations</span></button></div>
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
                <div class="fact"><span>Target hit rates</span><strong id="simulation-target-rate">-</strong></div>
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
                    <div id="league-create-import-summary" class="league-import-summary hidden" role="status" tabindex="-1" aria-labelledby="league-create-import-summary-title" aria-describedby="league-create-import-summary-copy">
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
${capabilities.leagueCreationScreenshotAnalysis ? leagueCreationScreenshotPanelMarkup : ""}
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
            <button id="mock-draft-undo" type="button">Undo pick</button>
            <button id="mock-draft-complete" type="button">Finish mock</button>
            <button id="mock-draft-abandon" class="danger hidden" type="button">Abandon mock</button>
          </div>
        </div>
        <div class="facts mock-facts">
          <div class="fact"><span>Status</span><strong id="mock-draft-state">Loading</strong></div>
          <div class="fact"><span>Progress</span><strong id="mock-draft-progress">-</strong></div>
          <div class="fact"><span>Budget left</span><strong id="mock-draft-budget-left">-</strong></div>
          <div class="fact"><span>Spent</span><strong id="mock-draft-spent">-</strong></div>
          <div class="fact"><span>Open slots</span><strong id="mock-draft-open-slots">-</strong></div>
          <div class="fact"><span>Max bid</span><strong id="mock-draft-max-bid">-</strong></div>
        </div>
        <p id="mock-draft-status" class="status" role="status" aria-live="polite"></p>
        <section id="mock-draft-abandoned" class="empty-state hidden" tabindex="-1" aria-labelledby="mock-draft-abandoned-title">
          <h2 id="mock-draft-abandoned-title">Mock abandoned</h2>
          <p>Your active mock slot is available again.</p>
          <div class="actions">
            <a id="mock-draft-back-to-practice" class="button" href="/practice">Back to Practice</a>
            <button id="mock-draft-start-another" class="primary" type="button">Start another mock</button>
          </div>
        </section>
        <section id="mock-auction-stage" class="mock-auction-stage hidden" aria-labelledby="mock-auction-player">
          <div class="mock-auction-main">
            <div class="mock-auction-copy">
              <p id="mock-auction-label" class="eyebrow">Live nomination</p>
              <h2 id="mock-auction-player">Waiting for the draft</h2>
              <p id="mock-auction-meta" class="mock-auction-meta">Start the mock when you are ready.</p>
            </div>
            <div class="mock-auction-bid">
              <span>Current bid</span>
              <strong id="mock-auction-current-bid">-</strong>
              <small id="mock-auction-high-bidder">No bids yet</small>
            </div>
          </div>
          <div class="mock-auction-controls">
            <div id="mock-auction-countdown" class="mock-auction-countdown hidden" aria-live="assertive"></div>
            <button id="mock-draft-buy" class="primary" type="button">Bid</button>
            <button id="mock-draft-pass" type="button">Pass</button>
            <ol id="mock-auction-feed" class="mock-auction-feed" aria-label="Auction activity" aria-live="polite"></ol>
          </div>
        </section>
        <div id="mock-draft-active" class="mock-layout">
          <section class="workspace-section">
            <div class="mock-toolbar">
              <div id="mock-draft-position-filters" class="mock-position-filters" role="group" aria-label="Filter players by position">
                <button class="mock-position-filter" type="button" data-mock-position="ALL" aria-pressed="true">All</button>
                <button class="mock-position-filter" type="button" data-mock-position="QB" aria-pressed="false">QB</button>
                <button class="mock-position-filter" type="button" data-mock-position="RB" aria-pressed="false">RB</button>
                <button class="mock-position-filter" type="button" data-mock-position="WR" aria-pressed="false">WR</button>
                <button class="mock-position-filter" type="button" data-mock-position="TE" aria-pressed="false">TE</button>
                <button class="mock-position-filter" type="button" data-mock-position="FLEX" aria-pressed="false">FLEX</button>
                <button class="mock-position-filter" type="button" data-mock-position="DST" aria-pressed="false">DST</button>
                <button class="mock-position-filter" type="button" data-mock-position="K" aria-pressed="false">K</button>
              </div>
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
            <label class="visually-hidden" for="mock-draft-roster-team">View team roster</label>
            <select id="mock-draft-roster-team" aria-label="View team roster"></select>
            <div id="mock-draft-roster-facts" class="mock-roster-facts">
              <div class="mock-roster-fact"><span>Budget left</span><strong id="mock-roster-budget-left">-</strong></div>
              <div class="mock-roster-fact"><span>Spent</span><strong id="mock-roster-spent">-</strong></div>
              <div class="mock-roster-fact"><span>Max bid</span><strong id="mock-roster-max-bid">-</strong></div>
            </div>
            <ul id="mock-draft-roster" class="mock-roster"></ul>
          </aside>
        </div>
        <section id="mock-draft-results" class="workspace-section hidden">
          <div class="mock-results-header">
            <div>
              <h2>League results</h2>
              <p class="lede">Every team ranked by its best projected Week 1 lineup.</p>
            </div>
            <p id="mock-draft-results-coverage" class="status"></p>
          </div>
          <div id="mock-draft-results-grid" class="simulation-league-grid"></div>
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
            <p id="setup-team-summary" class="lede">Loading teams...</p>
            <div id="setup-team-table" class="responsive-team-table hidden">
              <table class="setup-preview-table commissioner-team-table" aria-label="Configured teams">
                <thead><tr><th scope="col">Team #</th><th scope="col">Abbr</th><th scope="col">Mockd profile</th><th scope="col">Managers</th><th scope="col">Team</th></tr></thead>
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
                <div class="actions setup-team-actions">
                  <button id="setup-preview-button" type="button">Preview</button>
                  <button id="setup-apply-button" class="primary" type="button" disabled>Apply changes</button>
                </div>
              </div>
            </details>
            <p id="setup-status" class="status" role="status" aria-live="polite"></p>
            <ul id="setup-blockers" class="result-list"></ul>
            <div id="setup-preview-table" class="responsive-team-table hidden">
              <table class="setup-preview-table commissioner-team-table" aria-label="Team changes preview">
                <thead><tr><th scope="col">Owner</th><th scope="col">Team</th><th scope="col">Email</th><th scope="col">Role</th></tr></thead>
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
            <label class="confirmation-label" for="historical-row-one-keepers-input" style="margin-top: 8px">
              <input id="historical-row-one-keepers-input" type="checkbox">
              <span>Roster row 1 contains each team's keeper.</span>
            </label>
            <p id="historical-import-status" class="status" role="status" aria-live="polite"></p>
          </section>
          <section class="workspace-section" aria-labelledby="keepers-title">
            <div class="section-title-row">
              <h2 id="keepers-title">Keepers</h2>
              <span id="keeper-save-state" class="saved-indicator">Loading keepers...</span>
            </div>
            <p class="lede">Enter one keeper at a time using a team or manager name, player, and auction cost or snake round. Keepers save automatically, and you can return to edit them until the draft starts.</p>
            <form id="keeper-command-form" class="keeper-command-form">
              <div>
                <label for="keeper-command-input">Keeper command</label>
                <input id="keeper-command-input" placeholder="Hoody keeping Tuten 5" autocomplete="off">
              </div>
              <button id="keeper-add-button" class="primary task-progress-button" type="submit"><span data-button-label>Add keeper</span></button>
            </form>
            <p id="keeper-status" class="status" role="status" aria-live="polite"></p>
            <div id="keeper-list" class="keeper-list"></div>
          </section>
          <section class="workspace-section league-invite-section" aria-labelledby="invitations-title">
            <h2 id="invitations-title">Invite league</h2>
            <p class="lede">Share one link with your group. Managers sign in or create an account, then choose their team. Claimed teams cannot be selected again.</p>
            <div id="league-invite-link-row" class="league-invite-link hidden">
              <label class="visually-hidden" for="league-invite-link-input">League invite link</label>
              <input id="league-invite-link-input" type="text" readonly>
              <button id="copy-league-invite-button" type="button">Copy link</button>
            </div>
            <div class="actions" style="margin-top: 16px">
              <button id="create-league-invite-button" class="primary" type="button">Create league link</button>
            </div>
            <p id="invitation-create-status" class="status" role="status" aria-live="polite"></p>
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
          <section class="workspace-section" aria-labelledby="archive-league-title">
            <h2 id="archive-league-title">Archive league</h2>
            <p class="lede">Remove this league from every member's active league picker while keeping its seasons, teams, and draft history stored.</p>
            <div class="actions" style="margin-top: 16px">
              <button id="archive-league-button" class="danger" type="button">Archive league</button>
            </div>
            <p id="archive-league-status" class="status" role="status" aria-live="polite"></p>
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
          <h1 id="invite-league-title">Join your league</h1>
          <p id="invite-league-description" class="lede">Choose the team you manage. Your selection is linked to your Mockd account.</p>
        </div>
        <div id="invite-team-list" class="invite-team-list" role="list"></div>
        <a id="invite-open-league" class="button primary hidden" href="/league">Open league</a>
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
    const leagueCreationScreenshotAnalysisEnabled = ${JSON.stringify(capabilities.leagueCreationScreenshotAnalysis)};
    const state = {
      account: null,
      onboarding: null,
      selectedLeague: null,
      invitations: [],
      leagueInvitation: null,
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
      simulationAbortController: null,
      leagueCreation: null,
      leagueCreationStep: "basics",
      leagueCreationScreenshotFile: null,
      leagueCreationScreenshotRequestGeneration: 0,
      leagueCreationScreenshotAbortController: null,
      historicalImportFiles: [],
      sharedHistoricalOwnerMappings: new Map(),
      historicalImportBusy: false,
      mockSession: null,
      mockDraft: null,
      mockResults: null,
      mockPositionFilter: "ALL",
      mockRosterTeamId: null,
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
    const authInviteContext = byId("auth-invite-context");
    const authInviteLeagueName = byId("auth-invite-league-name");
    const authInviteSeason = byId("auth-invite-season");
    const authInviteTeamList = byId("auth-invite-team-list");
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
    const historicalImportDropzone = byId("historical-import-dropzone");
    const historicalImportChoose = byId("historical-import-choose");
    const historicalImportFile = byId("historical-import-file");
    const historicalImportFileList = byId("historical-import-file-list");
    const historicalImportButton = byId("historical-import-button");
    const historicalReplaceInput = byId("historical-replace-input");
    const historicalRowOneKeepersInput = byId("historical-row-one-keepers-input");
    const historicalImportStatus = byId("historical-import-status");
    const historicalImportDescription = byId("historical-import-description");
    const keeperCommandInput = byId("keeper-command-input");
    const keeperCommandForm = byId("keeper-command-form");
    const keeperAddButton = byId("keeper-add-button");
    const keeperStatus = byId("keeper-status");
    const keeperList = byId("keeper-list");
    const keeperSaveState = byId("keeper-save-state");
    const myTeamStatus = byId("my-team-status");
    const myTeamClaimLink = byId("my-team-claim-link");
    const myTeamResults = byId("my-team-results");
    const myTeamRosterBody = byId("my-team-roster-body");
    const myTeamFindings = byId("my-team-findings");
    const leagueInviteLinkRow = byId("league-invite-link-row");
    const leagueInviteLinkInput = byId("league-invite-link-input");
    const copyLeagueInviteButton = byId("copy-league-invite-button");
    const createLeagueInviteButton = byId("create-league-invite-button");
    const invitationCreateStatus = byId("invitation-create-status");
    const inviteTeamList = byId("invite-team-list");
    const inviteStatus = byId("invite-status");
    const inviteOpenLeague = byId("invite-open-league");
    const draftStartsAtInput = byId("draft-starts-at-input");
    const createLiveRoomButton = byId("create-live-room-button");
    const publishSeasonButton = byId("publish-season-button");
    const setupFinalReview = byId("setup-final-review");
    const openSetupLiveRoom = byId("open-setup-live-room");
    const cancelLiveRoomButton = byId("cancel-live-room-button");
    const liveRoomSetupStatus = byId("live-room-setup-status");
    const archiveLeagueButton = byId("archive-league-button");
    const archiveLeagueStatus = byId("archive-league-status");
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
    const standaloneBoardDescription = byId("standalone-board-description");
    const noLeaguePracticeOnboarding = byId("no-league-practice-onboarding");
    const noLeagueInvitationHelp = byId("no-league-invitation-help");
    const noLeagueInvitationInstructions = byId("no-league-invitation-instructions");
    const standaloneShortlistOnly = byId("standalone-shortlist-only");
    const standaloneShortlistCount = byId("standalone-shortlist-count");
    const standalonePlayerRows = byId("standalone-player-rows");
    const standalonePricingSource = byId("standalone-pricing-source");
    const standalonePricingWarnings = byId("standalone-pricing-warnings");
    const simulationPanel = byId("simulation-panel");
    const simulationTargetCount = byId("simulation-target-count");
    const simulationTargetList = byId("simulation-target-list");
    const simulationTargetEmpty = byId("simulation-target-empty");
    const simulationTargetStatus = byId("simulation-target-status");
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
    const mockDraftPositionFilters = byId("mock-draft-position-filters");
    const mockDraftPlayerRows = byId("mock-draft-player-rows");
    const mockDraftRosterTeam = byId("mock-draft-roster-team");
    const mockDraftRosterFacts = byId("mock-draft-roster-facts");
    const mockRosterBudgetLeft = byId("mock-roster-budget-left");
    const mockRosterSpent = byId("mock-roster-spent");
    const mockRosterMaxBid = byId("mock-roster-max-bid");
    const mockDraftRoster = byId("mock-draft-roster");
    const mockDraftActive = byId("mock-draft-active");
    const mockDraftResults = byId("mock-draft-results");
    const mockDraftResultsGrid = byId("mock-draft-results-grid");
    const mockDraftResultsCoverage = byId("mock-draft-results-coverage");
    const mockDraftStart = byId("mock-draft-start");
    const mockDraftBuy = byId("mock-draft-buy");
    const mockDraftPass = byId("mock-draft-pass");
    const mockDraftUndo = byId("mock-draft-undo");
    const mockDraftComplete = byId("mock-draft-complete");
    const mockDraftAbandon = byId("mock-draft-abandon");
    const mockDraftAbandoned = byId("mock-draft-abandoned");
    const mockDraftStartAnother = byId("mock-draft-start-another");
    const mockDraftBackToPractice = byId("mock-draft-back-to-practice");
    const mockAuctionStage = byId("mock-auction-stage");
    const mockAuctionPlayer = byId("mock-auction-player");
    const mockAuctionMeta = byId("mock-auction-meta");
    const mockAuctionCurrentBid = byId("mock-auction-current-bid");
    const mockAuctionHighBidder = byId("mock-auction-high-bidder");
    const mockAuctionCountdown = byId("mock-auction-countdown");
    const mockAuctionFeed = byId("mock-auction-feed");
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

    const taskButtonLabel = button => button.querySelector("[data-button-label]");

    const updateTaskButtonProgress = (button, completed, total) => {
      const safeTotal = Math.max(1, Number(total) || 1);
      const safeCompleted = Math.min(safeTotal, Math.max(0, Number(completed) || 0));
      const percent = Math.round((safeCompleted / safeTotal) * 100);
      button.dataset.progressMode = "determinate";
      button.style.setProperty("--task-progress", percent + "%");
      const label = taskButtonLabel(button);
      if (label) label.textContent = safeCompleted + " of " + safeTotal + " drafts";
      button.setAttribute("aria-label", "Running simulations: " + percent + "% complete");
    };

    const setTaskButtonBusy = (button, labelText, progress) => {
      const label = taskButtonLabel(button);
      if (!button.dataset.idleLabel) button.dataset.idleLabel = label?.textContent || button.textContent.trim();
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      if (progress) {
        updateTaskButtonProgress(button, progress.completed, progress.total);
        return;
      }
      button.dataset.progressMode = "indeterminate";
      button.style.removeProperty("--task-progress");
      button.removeAttribute("aria-label");
      if (label) label.textContent = labelText;
    };

    const clearTaskButtonBusy = (button, disabled = false) => {
      const label = taskButtonLabel(button);
      if (label && button.dataset.idleLabel) label.textContent = button.dataset.idleLabel;
      button.disabled = disabled;
      button.removeAttribute("aria-busy");
      button.removeAttribute("aria-label");
      button.removeAttribute("data-progress-mode");
      button.style.removeProperty("--task-progress");
    };

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

    const readEventStream = async (response, onEvent) => {
      if (!response.ok) return readJson(response);
      if (!response.body) throw new Error("Mockd could not read simulation progress.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const dispatch = block => {
        if (!block.trim()) return;
        let eventName = "message";
        const data = [];
        block.split(/\\r?\\n/).forEach(line => {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
        });
        if (data.length > 0) onEvent(eventName, JSON.parse(data.join("\\n")));
      };
      while (true) {
        const chunk = await reader.read();
        buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !chunk.done });
        const blocks = buffer.split(/\\r?\\n\\r?\\n/);
        buffer = blocks.pop() || "";
        blocks.forEach(dispatch);
        if (chunk.done) break;
      }
      dispatch(buffer);
    };

    const returnPath = () => routePath + window.location.search;

    const safeAuthenticationReturnPath = requestedPath => {
      if (!requestedPath || !requestedPath.startsWith("/")) return null;
      if (requestedPath.includes("\\\\") || requestedPath.startsWith("//")) return null;
      const queryIndex = requestedPath.search(/[?#]/);
      const encodedPathname = queryIndex === -1 ? requestedPath : requestedPath.slice(0, queryIndex);
      if (/%(?:25)*(?:2f|5c)/i.test(encodedPathname)) return null;
      let destination;
      try {
        destination = new URL(requestedPath, window.location.origin);
      } catch {
        return null;
      }
      if (destination.origin !== window.location.origin) return null;
      return destination.pathname + destination.search + destination.hash;
    };

    const authenticationReturnPath = () => safeAuthenticationReturnPath(
      new URLSearchParams(window.location.search).get("returnTo"),
    ) || "/practice";

    const invitationReturnPath = () => {
      const candidatePath = routePath === "/invite" ? returnPath() : authenticationReturnPath();
      const invitationUrl = new URL(candidatePath, window.location.origin);
      return invitationUrl.pathname === "/invite" && invitationUrl.searchParams.get("token")
        ? invitationUrl.pathname + invitationUrl.search
        : null;
    };

    const authenticationInvitationToken = () => {
      const invitationPath = invitationReturnPath();
      return invitationPath
        ? new URL(invitationPath, window.location.origin).searchParams.get("token")
        : null;
    };

    const loadAuthenticationInvitation = async token => {
      setHidden(authInviteContext, false);
      authInviteLeagueName.textContent = "Loading league...";
      authInviteSeason.textContent = "";
      authInviteTeamList.replaceChildren();
      try {
        const body = await readJson(await fetch(
          "/invitations/details?token=" + encodeURIComponent(token),
          { credentials: "same-origin" },
        ));
        authInviteLeagueName.textContent = body.league?.name || "League invitation";
        authInviteSeason.textContent = body.league?.seasonYear
          ? body.league.seasonYear + " season"
          : "Choose your team after signing in.";
        (body.teams || []).forEach(team => {
          const item = document.createElement("li");
          const name = document.createElement("strong");
          name.textContent = team.name;
          item.append(name);
          const details = [
            ...(team.managerNames || []),
            ...(team.status === "claimed" ? ["Claimed"] : []),
          ].join(" · ");
          if (details) item.append(document.createTextNode(details));
          authInviteTeamList.append(item);
        });
      } catch (error) {
        authInviteLeagueName.textContent = "Invitation unavailable";
        authInviteSeason.textContent = error.message;
      }
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
              : routePath === "/invite"
                ? "Join your league"
                : "Sign in";
      authDescription.textContent = signupMode
        ? "Create a league as commissioner, or join one from an invitation."
        : verificationMode
          ? "Open the link from your email, or request a new one."
          : forgotPasswordMode
            ? "Enter your account email. We'll send a reset link if an account exists."
            : resetPasswordMode
              ? "Choose a new password for your Mockd account."
              : routePath === "/invite"
                ? "Sign in to choose your team, or create an account to get started."
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
      const invitationToken = authenticationInvitationToken();
      setHidden(authInviteContext, !invitationToken);
      if (invitationToken) loadAuthenticationInvitation(invitationToken);
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

    const savePracticeTarget = async (target, maxBid) => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) throw new Error("Choose a league before changing draft targets.");
      await readJson(await fetch("/practice-shortlist", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          seasonId: selectedLeague.seasonId,
          playerName: target.playerName,
          position: target.position,
          maxBid: maxBid,
        }),
      }));
      await loadPracticeShortlist(selectedLeague, state.workspaceRequestGeneration);
    };

    const renderPracticeSimulationTargets = () => {
      const fragment = document.createDocumentFragment();
      const draftFormat = state.playerCatalogMeta?.draftFormat
        || state.currentSeason?.settings?.draftFormat;
      state.practiceShortlist.forEach(target => {
        const row = document.createElement("div");
        row.className = "simulation-target-row";

        const player = document.createElement("div");
        player.className = "simulation-target-player";
        const name = document.createElement("strong");
        name.textContent = target.playerName;
        const position = document.createElement("span");
        position.textContent = target.position;
        player.append(name, position);
        row.append(player);

        const cap = document.createElement("div");
        cap.className = "simulation-target-cap";
        if (draftFormat === "auction") {
          const inputId = "simulation-target-cap-" + target.id;
          const label = document.createElement("label");
          label.htmlFor = inputId;
          label.textContent = "Max bid";
          const input = document.createElement("input");
          input.id = inputId;
          input.type = "number";
          input.min = "1";
          input.step = "1";
          input.inputMode = "numeric";
          input.placeholder = "No cap";
          input.value = target.maxBid === undefined ? "" : String(target.maxBid);
          input.addEventListener("blur", async event => {
            if (event.relatedTarget?.classList.contains("simulation-target-remove")) return;
            const rawValue = input.value.trim();
            const maxBid = rawValue === "" ? undefined : Number(rawValue);
            if (maxBid !== undefined && (!Number.isInteger(maxBid) || maxBid < 1)) {
              simulationTargetStatus.textContent = "Enter a whole-dollar max bid, or leave it blank for no cap.";
              input.focus();
              return;
            }
            input.disabled = true;
            simulationTargetStatus.textContent = "Saving " + target.playerName + "...";
            try {
              await savePracticeTarget(target, maxBid);
              simulationTargetStatus.textContent = target.playerName + " saved to the simulation plan.";
            } catch (error) {
              simulationTargetStatus.textContent = error.message;
              input.disabled = false;
            }
          });
          input.addEventListener("keydown", event => {
            if (event.key === "Enter") input.blur();
          });
          cap.append(label, input);
          row.append(cap);
        } else {
          row.classList.add("no-cap-control");
        }

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "simulation-target-remove";
        remove.textContent = "\u2605";
        remove.title = "Remove draft target";
        remove.setAttribute("aria-label", "Remove " + target.playerName + " from the simulation plan");
        remove.addEventListener("click", async () => {
          const selectedLeague = state.selectedLeague;
          if (!selectedLeague) return;
          remove.disabled = true;
          simulationTargetStatus.textContent = "Removing " + target.playerName + "...";
          try {
            await readJson(await fetch("/practice-shortlist", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({
                seasonId: selectedLeague.seasonId,
                playerName: target.playerName,
              }),
            }));
            await loadPracticeShortlist(selectedLeague, state.workspaceRequestGeneration);
            simulationTargetStatus.textContent = target.playerName + " removed from the simulation plan.";
          } catch (error) {
            simulationTargetStatus.textContent = error.message;
            remove.disabled = false;
          }
        });
        row.append(remove);
        fragment.append(row);
      });
      simulationTargetList.replaceChildren(fragment);
      simulationTargetCount.textContent = state.practiceShortlist.length + " selected";
      setHidden(simulationTargetEmpty, state.practiceShortlist.length > 0);
    };

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
          (isShortlisted ? "Remove " : "Add ") + player.name + (isShortlisted ? " from" : " to") + " simulation plan",
        );
        shortlistButton.title = isShortlisted ? "Remove draft target" : "Add draft target";
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
      renderPracticeSimulationTargets();
      const personalized = state.playerCatalogMeta?.personalized === true;
      const warnings = state.playerCatalogMeta?.pricingWarnings || [];
      const historyUnavailable = warnings.some(warning => warning.toLowerCase().includes("history unavailable"));
      standalonePricingSource.textContent = personalized && !historyUnavailable
        ? "Market blends the current baseline with up to three years of your league's open-auction sales; keeper rows are excluded. My value starts with current season projections, then applies your " + state.playerCatalogMeta.strategyLabel + " strategy and roster context."
        : personalized
          ? "Market uses the current baseline. Import draft history to calibrate it to your league. My value starts with current season projections, then applies your " + state.playerCatalogMeta.strategyLabel + " strategy and roster context."
        : state.playerCatalogMeta?.draftFormat
          ? "Market uses the current baseline. Import draft history to calibrate it to your league. My value starts with current season projections, then applies your strategy and roster context."
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
        + " · " + state.practiceShortlist.length + " draft targets" + valueStatus;
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
        if (existing) {
          await readJson(await fetch("/practice-shortlist", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              seasonId: selectedLeague.seasonId,
              playerName: player.name,
            }),
          }));
          await loadPracticeShortlist(selectedLeague, state.workspaceRequestGeneration);
        } else {
          await savePracticeTarget({ playerName: player.name, position: player.position }, undefined);
        }
        simulationTargetStatus.textContent = player.name
          + (existing ? " removed from" : " added to") + " the simulation plan.";
      } catch (error) {
        standaloneBoardStatus.textContent = error.message;
        button.disabled = false;
      }
    };

    const configureSimulationPanel = selectedLeague => {
      setHidden(simulationPanel, false);
      setHidden(simulationResults, true);
      simulationTargetStatus.textContent = "";
      renderPracticeSimulationTargets();
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

    const playerResultLabel = player => {
      if (player.price !== undefined) return "$" + player.price;
      if (player.overallPick !== undefined) return "#" + player.overallPick;
      return "-";
    };

    const renderTeamResultsGrid = (root, teams) => {
      const fragment = document.createDocumentFragment();
      teams.forEach(team => {
        const panel = document.createElement("article");
        panel.className = "simulation-team";
        panel.dataset.userTeam = String(team.isUserTeam === true);
        panel.dataset.teamId = team.teamId || "";

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
        const summary = [];
        if (team.rank) summary.push("#" + team.rank + " projected");
        summary.push(team.spent === undefined
          ? team.roster.length + " picks"
          : "$" + team.spent + " spent · $" + team.budgetRemaining + " left");
        budget.textContent = summary.join(" · ");
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
          const result = playerResultLabel(player);
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
      root.replaceChildren(fragment);
    };

    const renderSimulationRun = () => {
      const simulation = state.simulation;
      const run = simulation?.runs?.[state.selectedSimulationRunIndex];
      simulationLeagueGrid.replaceChildren();
      if (!run) return;

      renderTeamResultsGrid(
        simulationLeagueGrid,
        [...run.teams].sort((left, right) => Number(right.isUserTeam === true) - Number(left.isUserTeam === true)),
      );
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
      const targetOutcomes = simulation.targetOutcomes?.length
        ? simulation.targetOutcomes
        : simulation.targetOutcome
          ? [simulation.targetOutcome]
          : [];
      byId("simulation-target-rate").textContent = targetOutcomes.length
        ? targetOutcomes.map(outcome =>
            Math.round(outcome.hitRate * 100) + "% " + outcome.playerName
          ).join(" · ")
        : "No named targets";
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
      state.simulationAbortController?.abort();
      const abortController = new AbortController();
      state.simulationAbortController = abortController;
      const note = simulationNote.value.trim();
      const count = Number(simulationCount.value);
      setTaskButtonBusy(simulationRun, "Running simulations...", { completed: 0, total: count });
      setHidden(simulationResults, true);
      simulationStatus.textContent = "Completed 0 of " + count + " league drafts...";
      try {
        const response = await fetch("/season-simulations", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "text/event-stream" },
          credentials: "same-origin",
          signal: abortController.signal,
          body: JSON.stringify({
            seasonId,
            count: count,
            strategyPreset: practiceStrategy.value,
            strategy: simulationStrategy.value.trim(),
            note,
          }),
        });
        let body = null;
        if ((response.headers.get("content-type") || "").includes("text/event-stream")) {
          await readEventStream(response, (eventName, payload) => {
            if (
              !isCurrentWorkspaceRequest(seasonId, requestGeneration)
              || state.simulationAbortController !== abortController
            ) return;
            if (eventName === "progress") {
              const progress = payload;
              updateTaskButtonProgress(simulationRun, progress.completed, progress.total);
              simulationStatus.textContent = "Completed " + progress.completed + " of "
                + progress.total + " league drafts...";
            } else if (eventName === "result") {
              body = payload;
            } else if (eventName === "error") {
              const error = new Error(errorMessageFor(payload));
              error.body = payload;
              throw error;
            }
          });
        } else {
          body = await readJson(response);
        }
        if (!body) throw new Error("Mockd finished without returning simulation results.");
        if (!isCurrentWorkspaceRequest(seasonId, requestGeneration)) return;
        renderSimulationResult(body.simulation, note);
        await loadSimulationHistory(selectedLeague, requestGeneration);
      } catch (error) {
        if (
          error.name !== "AbortError"
          && state.simulationAbortController === abortController
          && isCurrentWorkspaceRequest(seasonId, requestGeneration)
        ) {
          simulationStatus.textContent = error.message;
        }
      } finally {
        if (
          state.simulationAbortController === abortController
          && isCurrentWorkspaceRequest(seasonId, requestGeneration)
        ) {
          state.simulationAbortController = null;
          clearTaskButtonBusy(simulationRun);
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

    const revealLeagueCreationImportSummary = () => {
      requestAnimationFrame(() => {
        leagueCreateImportSummary.scrollIntoView({ block: "nearest" });
        leagueCreateImportSummary.focus({ preventScroll: true });
      });
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
      revealLeagueCreationImportSummary();
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
      if (leagueCreateScreenshotPanel) setHidden(leagueCreateScreenshotPanel, false);
      leagueCreateStatus.textContent = "";
      if (step === "teams") {
        if (leagueCreationScreenshotAnalysisEnabled) {
          leagueCreateScreenshotAnalyze.disabled = state.leagueCreationScreenshotFile === null;
          if (
            state.leagueCreationScreenshotFile
            && leagueCreateScreenshotStatus.textContent === "Reading teams from the screenshot..."
          ) {
            leagueCreateScreenshotStatus.textContent = state.leagueCreationScreenshotFile.name + " is ready to analyze.";
          }
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

    const renderLeagueInvitation = invitations => {
      state.invitations = invitations;
      const pendingInvitation = [...invitations]
        .reverse()
        .find(candidate => candidate.kind === "league" && candidate.status === "pending") || null;
      const invitationExpiresAt = pendingInvitation ? Date.parse(pendingInvitation.expiresAt) : Number.NaN;
      const invitation = pendingInvitation && invitationExpiresAt >= Date.now()
        ? pendingInvitation
        : null;
      const acceptPath = invitation?.acceptPath;
      setHidden(leagueInviteLinkRow, !acceptPath);
      leagueInviteLinkInput.value = acceptPath
        ? new URL(acceptPath, window.location.origin).toString()
        : "";
      copyLeagueInviteButton.disabled = !acceptPath;
      createLeagueInviteButton.textContent = pendingInvitation ? "Generate new link" : "Create league link";
      invitationCreateStatus.textContent = pendingInvitation && !invitation
        ? "The league link expired. Generate a new one to invite managers."
        : invitation
        ? acceptPath
          ? "This link is active for every unclaimed team."
          : "A league link is active. Generate a new link if you need another copy; the old link will stop working."
        : "No league link is active yet.";
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

    const appendLabeledTableCells = (row, values) => {
      values.forEach(([label, value]) => {
        const cell = document.createElement("td");
        cell.dataset.label = label;
        cell.textContent = String(value);
        row.append(cell);
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
      teams.forEach(team => {
        const row = document.createElement("tr");
        const managers = team.managerDisplayNames?.length
          ? team.managerDisplayNames.join(", ")
          : team.ownerDisplayName;
        appendLabeledTableCells(row, [
          ["Team #", team.draftOrderPosition],
          ["Abbr", team.abbreviation || "-"],
          ["Mockd profile", team.ownerDisplayName],
          ["Managers", managers],
          ["Team", team.displayName],
        ]);
        setupTeamBody.append(row);
      });
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
      keeperAddButton.disabled = draftHasStarted;
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

    const auctionMoney = value => "$" + Math.round(Number(value || 0));
    const mockRosterPositionLabels = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"];
    const canMockTeamRosterPlayer = ${canMockTeamRosterPlayer.toString()};

    const mockAuctionFeedItem = event => {
      const item = document.createElement("li");
      item.dataset.eventType = event.type || "activity";
      item.textContent = event.text || "Auction activity";
      return item;
    };

    const renderMockAuctionStage = (draft, nomination) => {
      const auctionEvents = draft.auctionEvents || [];
      const sessionState = draft.session || {};
      const relatedEvents = nomination
        ? auctionEvents.filter(event => event.nominationNumber === nomination.number)
        : auctionEvents;
      const visibleEvents = relatedEvents
        .filter(event => event.type !== "countdown")
        .slice(-8);
      const lastSale = [...(draft.sales || [])].reverse().find(sale => sale.source !== "keeper");

      mockAuctionStage.dataset.position = nomination?.position || lastSale?.position || "";
      mockAuctionCountdown.textContent = "";
      setHidden(mockAuctionCountdown, true);
      if (nomination) {
        byId("mock-auction-label").textContent = "Live nomination";
        mockAuctionPlayer.textContent = nomination.playerName;
        mockAuctionMeta.textContent = nomination.position + " · Nominated by " + nomination.nominatedByTeamName;
        mockAuctionCurrentBid.textContent = auctionMoney(nomination.currentPrice);
        mockAuctionHighBidder.textContent = nomination.highestBidderTeamName + " has the high bid";
      } else if (sessionState.phase === "awaiting_human_nomination") {
        byId("mock-auction-label").textContent = "Your nomination";
        mockAuctionPlayer.textContent = "Choose the next player";
        mockAuctionMeta.textContent = "Use Nominate on the board to open bidding at $1.";
        mockAuctionCurrentBid.textContent = "-";
        mockAuctionHighBidder.textContent = lastSale
          ? "Last: " + lastSale.teamName + " won " + lastSale.playerName + " for " + auctionMoney(lastSale.price)
          : "No completed sales yet";
      } else if (sessionState.status === "completed") {
        byId("mock-auction-label").textContent = "Mock complete";
        mockAuctionPlayer.textContent = "Draft finished";
        mockAuctionMeta.textContent = "Review your roster and results.";
        mockAuctionCurrentBid.textContent = "-";
        mockAuctionHighBidder.textContent = lastSale
          ? "Final: " + lastSale.teamName + " won " + lastSale.playerName + " for " + auctionMoney(lastSale.price)
          : "No completed sales";
      } else {
        byId("mock-auction-label").textContent = "Auction room";
        mockAuctionPlayer.textContent = "Waiting for the draft";
        mockAuctionMeta.textContent = "Start the mock when you are ready.";
        mockAuctionCurrentBid.textContent = "-";
        mockAuctionHighBidder.textContent = "No bids yet";
      }

      mockAuctionFeed.replaceChildren(...(
        visibleEvents.length
          ? visibleEvents.map(mockAuctionFeedItem)
          : [mockAuctionFeedItem({ type: "activity", text: "Bids and sales will appear here." })]
      ));
    };

    const renderMockDraftResults = () => {
      const results = state.mockResults;
      mockDraftResultsGrid.replaceChildren();
      if (!results?.teams?.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Completed results are unavailable for this mock.";
        mockDraftResultsGrid.append(empty);
        mockDraftResultsCoverage.textContent = "";
        return;
      }

      const projected = Number(results.projectedPlayerCount || 0);
      const rostered = Number(results.rosteredPlayerCount || 0);
      mockDraftResultsCoverage.textContent = projected === rostered
        ? "Week 1 estimates available for all " + rostered + " rostered players."
        : "Week 1 estimates available for " + projected + " of " + rostered + " rostered players.";
      renderTeamResultsGrid(mockDraftResultsGrid, results.teams);
    };

    const renderMockPlayerBoard = ({ draft, session, sessionState, auction, currentPick }) => {
      mockDraftPositionFilters.querySelectorAll("[data-mock-position]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.mockPosition === state.mockPositionFilter));
      });

      const search = mockDraftSearch.value.trim().toLowerCase();
      const players = (draft.board?.players || []).filter(player => {
        if (!player.available) return false;
        if (
          state.mockPositionFilter !== "ALL"
          && (state.mockPositionFilter === "FLEX"
            ? !["RB", "WR", "TE"].includes(player.position)
            : player.position !== state.mockPositionFilter)
        ) return false;
        if (!search) return true;
        return [player.name, player.position].some(value => String(value || "").toLowerCase().includes(search));
      });
      const canPick = sessionState.status === "active" && (auction
        ? sessionState.phase === "awaiting_human_nomination"
        : currentPick?.teamId === session.teamId);
      const controlledTeam = (draft.teams || []).find(team => team.id === session.teamId);
      const fragment = document.createDocumentFragment();
      players.forEach(player => {
        const row = document.createElement("tr");
        row.dataset.position = player.position || "";
        const values = [
          { label: auction ? "Market value" : "Rank", value: auction
              ? "$" + Math.round(Number(player.expectedPrice || 0))
              : String(player.personalRank || player.leagueExpectedPick || player.rank || "-"), className: "numeric" },
          ...(auction ? [{
            label: "Our value",
            value: "$" + Math.round(Number(player.humanValue ?? player.expectedPrice ?? 0)),
            className: "numeric",
          }] : []),
          { label: "Player", value: player.name, className: "player-name" },
          {
            label: "Position",
            value: player.position || "-",
            className: "position-label",
            position: player.position || "",
          },
          { label: "NFL", value: player.teamAbbreviation || "-" },
          {
            label: "Bye",
            value: player.byeWeek == null ? "-" : String(player.byeWeek),
            className: "numeric",
          },
          { label: "Status", value: "Available" },
        ];
        values.forEach(value => {
          const cell = document.createElement("td");
          cell.dataset.label = value.label;
          cell.textContent = value.value;
          if (value.className) cell.className = value.className;
          if (value.position) cell.dataset.position = value.position;
          row.append(cell);
        });
        const actionCell = document.createElement("td");
        actionCell.dataset.label = "Action";
        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.className = "mock-player-action";
        actionButton.dataset.mockPlayerId = player.id;
        actionButton.textContent = auction ? "Nominate" : "Draft";
        const canRosterPlayer = !auction || canMockTeamRosterPlayer(
          controlledTeam,
          player.position,
          draft.configuration?.positionMaximums,
        );
        actionButton.disabled = !canPick || !canRosterPlayer;
        if (auction && !canRosterPlayer) {
          actionButton.title = "No open roster slot can accept this position.";
        }
        actionCell.append(actionButton);
        row.append(actionCell);
        fragment.append(row);
      });
      mockDraftPlayerRows.replaceChildren(fragment);
      return canPick;
    };

    const renderMockRoster = ({ draft, session, auction }) => {
      const draftTeams = draft.teams || [];
      if (!draftTeams.some(team => team.id === state.mockRosterTeamId)) {
        const defaultRosterTeam = draftTeams.find(team => team.id === session.teamId) || draftTeams[0];
        state.mockRosterTeamId = defaultRosterTeam?.id || null;
      }
      const rosterTeamOptions = document.createDocumentFragment();
      draftTeams.forEach(team => {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = team.name + " roster";
        rosterTeamOptions.append(option);
      });
      mockDraftRosterTeam.replaceChildren(rosterTeamOptions);
      mockDraftRosterTeam.value = state.mockRosterTeamId || "";
      const rosterTeam = draftTeams.find(team => team.id === state.mockRosterTeamId);
      if (auction && rosterTeam) {
        setHidden(mockDraftRosterFacts, false);
        mockRosterBudgetLeft.textContent = auctionMoney(rosterTeam.budgetRemaining);
        mockRosterSpent.textContent = auctionMoney(rosterTeam.spent);
        mockRosterMaxBid.textContent = auctionMoney(rosterTeam.maxBid);
      } else {
        setHidden(mockDraftRosterFacts, true);
        mockRosterBudgetLeft.textContent = "-";
        mockRosterSpent.textContent = "-";
        mockRosterMaxBid.textContent = "-";
      }
      mockDraftRoster.dataset.teamId = rosterTeam?.id || "";

      const rosterPlayers = new Map((rosterTeam?.roster || []).map(player => [player.playerId, player]));
      const rosterFragment = document.createDocumentFragment();
      (rosterTeam?.slots || []).forEach(slot => {
        const item = document.createElement("li");
        const slotName = document.createElement("span");
        slotName.textContent = slot.slot;
        slotName.className = "position-label";
        const slotPosition = mockRosterPositionLabels.find(position => slot.slot.startsWith(position));
        if (slotPosition) slotName.dataset.position = slotPosition;
        const rosterCopy = document.createElement("div");
        rosterCopy.className = "mock-roster-copy";
        const playerName = document.createElement("strong");
        playerName.textContent = slot.playerId ? mockDraftPlayerName(slot.playerId) : "Open";
        rosterCopy.append(playerName);
        const rosterPlayer = slot.playerId ? rosterPlayers.get(slot.playerId) : null;
        if (rosterPlayer) {
          const detail = document.createElement("small");
          if (auction) {
            detail.textContent = auctionMoney(rosterPlayer.price)
              + (rosterPlayer.source === "keeper" ? " · Keeper" : "");
          } else if (rosterPlayer.source === "keeper") {
            detail.textContent = "Keeper";
          }
          if (detail.textContent) rosterCopy.append(detail);
        }
        item.append(slotName, rosterCopy);
        rosterFragment.append(item);
      });
      if (!rosterFragment.childNodes.length) {
        const item = document.createElement("li");
        item.textContent = "This roster will fill as the mock runs.";
        rosterFragment.append(item);
      }
      mockDraftRoster.replaceChildren(rosterFragment);
    };

    const renderMockDraft = () => {
      const draft = state.mockDraft;
      const session = state.mockSession;
      if (!session) return;
      const abandoned = session.status === "abandoned";
      setHidden(mockDraftAbandoned, !abandoned);
      if (abandoned) {
        byId("mock-draft-title").textContent = session.draftMode?.format === "auction"
          ? "Auction mock draft"
          : "Snake mock draft";
        byId("mock-draft-state").textContent = "Abandoned";
        byId("mock-draft-progress").textContent = "-";
        byId("mock-draft-budget-left").textContent = "-";
        byId("mock-draft-spent").textContent = "-";
        byId("mock-draft-open-slots").textContent = "-";
        byId("mock-draft-max-bid").textContent = "-";
        [mockDraftStart, mockDraftUndo, mockDraftComplete, mockDraftAbandon]
          .forEach(control => setHidden(control, true));
        setHidden(mockDraftActive, true);
        setHidden(mockDraftResults, true);
        setHidden(mockAuctionStage, true);
        mockDraftBackToPractice.href = pathWithSeason("/practice", session.seasonId);
        mockDraftStatus.textContent = "Mock abandoned. This mock no longer counts toward your active mock limit.";
        return;
      }
      if (!draft) return;
      const sessionState = draft.session || {};
      const auction = session.draftMode?.format === "auction";
      const completed = sessionState.status === "completed";
      byId("mock-draft-player-head").innerHTML = auction
        ? '<th class="numeric">Market value</th><th class="numeric">Our value</th><th>Player</th><th>Pos</th><th>NFL</th><th class="numeric">Bye</th><th>Status</th><th>Action</th>'
        : '<th class="numeric">Rank</th><th>Player</th><th>Pos</th><th>NFL</th><th class="numeric">Bye</th><th>Status</th><th>Action</th>';
      const picks = draft.board?.picks || [];
      const completedPicks = picks.filter(pick => pick.selection).length;
      const myTeam = draft.teams?.find(team => team.id === session.teamId);
      byId("mock-draft-title").textContent = auction ? "Auction mock draft" : "Snake mock draft";
      byId("mock-draft-state").textContent = titleCase(sessionState.status || session.status || "setup");
      const currentPick = sessionState.currentPick;
      const nomination = sessionState.currentNomination;
      const auctionCapacity = (draft.teams || []).reduce(
        (total, team) => total + (team.roster?.length || 0) + (team.rosterSlotsRemaining || 0),
        0,
      );
      byId("mock-draft-progress").textContent = auction
        ? (draft.sales?.length || 0) + " / " + auctionCapacity + " rostered"
        : completedPicks + " / " + picks.length + " picks";
      byId("mock-draft-budget-left").textContent = auction && myTeam
        ? auctionMoney(myTeam.budgetRemaining)
        : "-";
      byId("mock-draft-spent").textContent = auction && myTeam
        ? auctionMoney(myTeam.spent)
        : "-";
      byId("mock-draft-open-slots").textContent = auction && myTeam
        ? String(myTeam.rosterSlotsRemaining)
        : "-";
      byId("mock-draft-max-bid").textContent = auction && myTeam
        ? auctionMoney(myTeam.maxBid)
        : "-";
      mockDraftStart.disabled = sessionState.status !== "setup";
      setHidden(mockDraftStart, sessionState.status !== "setup");
      mockDraftBuy.disabled = !auction || nomination?.humanCanBuy !== true;
      mockDraftBuy.textContent = nomination?.nextBid ? "Bid $" + nomination.nextBid : "Bid";
      mockDraftPass.disabled = !auction || nomination?.humanCanPass !== true;
      mockDraftUndo.disabled = sessionState.canUndo !== true;
      mockDraftComplete.disabled = sessionState.canComplete !== true;
      setHidden(mockDraftUndo, completed);
      setHidden(mockDraftComplete, completed);
      setHidden(mockDraftAbandon, completed);
      mockDraftAbandon.disabled = completed;
      setHidden(mockDraftAbandoned, true);
      setHidden(mockDraftActive, completed);
      setHidden(mockDraftResults, sessionState.status !== "completed");
      setHidden(mockAuctionStage, !auction || completed);
      if (auction) renderMockAuctionStage(draft, nomination);
      if (completed) renderMockDraftResults();

      const canPick = renderMockPlayerBoard({ draft, session, sessionState, auction, currentPick });
      renderMockRoster({ draft, session, auction });
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

    const pauseMockAuction = duration => new Promise(resolve => window.setTimeout(resolve, duration));

    const selectMockAuctionEventsForAnimation = events => {
      const groupedEvents = [];
      events.forEach(event => {
        const currentGroup = groupedEvents.at(-1);
        if (currentGroup?.[0]?.nominationNumber === event.nominationNumber) {
          currentGroup.push(event);
        } else {
          groupedEvents.push([event]);
        }
      });
      if (groupedEvents.length <= 2) return events;
      return [...groupedEvents[0], ...groupedEvents.at(-1)];
    };

    const animateMockAuctionEvents = async (previousDraft, nextDraft) => {
      const previousSequence = (previousDraft?.auctionEvents || []).at(-1)?.sequence || 0;
      const newEvents = (nextDraft.auctionEvents || [])
        .filter(event => event.sequence > previousSequence);
      if (!newEvents.length || state.mockSession?.draftMode?.format !== "auction") return;

      setHidden(mockAuctionStage, false);
      let visibleEvents = (previousDraft?.auctionEvents || [])
        .filter(event => event.type !== "countdown")
        .slice(-7);
      for (const event of selectMockAuctionEventsForAnimation(newEvents)) {
        const player = nextDraft.board?.players?.find(candidate => candidate.id === event.playerId);
        mockAuctionStage.dataset.position = player?.position || "";
        mockAuctionPlayer.textContent = event.playerName;
        if (event.type === "nomination") {
          byId("mock-auction-label").textContent = "Nominated";
          mockAuctionMeta.textContent = event.teamName + " opened at " + auctionMoney(event.price);
          mockAuctionCurrentBid.textContent = auctionMoney(event.price);
          mockAuctionHighBidder.textContent = event.teamName + " opened the bidding";
        } else if (event.type === "bid") {
          byId("mock-auction-label").textContent = "Bidding";
          mockAuctionMeta.textContent = player?.position || "Live auction";
          mockAuctionCurrentBid.textContent = auctionMoney(event.price);
          mockAuctionHighBidder.textContent = event.teamName + " has the high bid";
        } else if (event.type === "countdown") {
          byId("mock-auction-label").textContent = "Going once";
          mockAuctionCountdown.textContent = String(event.countdown);
          setHidden(mockAuctionCountdown, false);
        } else if (event.type === "sold") {
          byId("mock-auction-label").textContent = "Sold";
          mockAuctionMeta.textContent = event.teamName + " won " + event.playerName;
          mockAuctionCurrentBid.textContent = auctionMoney(event.price);
          mockAuctionHighBidder.textContent = event.text;
          setHidden(mockAuctionCountdown, true);
        }

        if (event.type !== "countdown") {
          visibleEvents = [...visibleEvents, event].slice(-8);
          mockAuctionFeed.replaceChildren(...visibleEvents.map(mockAuctionFeedItem));
        }
        await pauseMockAuction(event.type === "countdown" ? 280 : event.type === "sold" ? 420 : 180);
      }
      setHidden(mockAuctionCountdown, true);
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
        mockDraftAbandon,
        ...mockDraftPlayerRows.querySelectorAll("button"),
      ];
      controls.forEach(control => { control.disabled = true; });
      mockDraftStatus.textContent = "Updating the mock draft...";
      try {
        const previousDraft = state.mockDraft;
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
        await animateMockAuctionEvents(previousDraft, body.state);
        state.mockDraft = body.state;
        state.mockResults = body.results || null;
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
      state.mockResults = null;
      state.mockPositionFilter = "ALL";
      state.mockRosterTeamId = null;
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
      state.mockResults = body.results || null;
      if (!requestedSessionId) {
        query.set("seasonId", selectedLeague.seasonId);
        query.set("mockSessionId", body.mockSession.id);
        window.history.replaceState(null, "", routePath + "?" + query.toString());
      }
      renderMockDraft();
    };

    const clearMockSessionIdFromLocation = () => {
      const query = new URLSearchParams(window.location.search);
      query.delete("mockSessionId");
      window.history.replaceState(null, "", routePath + "?" + query.toString());
    };

    const abandonMockDraft = async () => {
      const selectedLeague = state.selectedLeague;
      const session = state.mockSession;
      if (!selectedLeague || !session || !["setup", "active"].includes(session.status)) return;
      if (!window.confirm("Abandon this mock draft? Your current mock picks will be discarded.")) return;
      mockDraftAbandon.disabled = true;
      mockDraftStatus.textContent = "Abandoning mock...";
      try {
        const body = await readJson(await fetch(
          "/season-mock-drafts/" + encodeURIComponent(session.id) + "/abandon",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
              seasonId: selectedLeague.seasonId,
              expectedRevision: session.revision,
            }),
          },
        ));
        state.mockSession = body.mockSession;
        state.mockDraft = null;
        state.mockResults = null;
        clearMockSessionIdFromLocation();
        renderMockDraft();
        mockDraftAbandoned.focus();
      } catch (error) {
        mockDraftStatus.textContent = error.message;
        renderMockDraft();
      }
    };

    const selectedLeagueFor = onboarding => {
      const search = new URLSearchParams(window.location.search);
      if (routePath === "/league" && search.get("create") === "1") return null;
      const requestedSeasonId = search.get("seasonId") || search.get("contextSeasonId");
      return onboarding.leagues.find(league => league.seasonId === requestedSeasonId)
        || onboarding.leagues[0]
        || null;
    };

    const renderLeagueInvitationDetails = body => {
      state.leagueInvitation = body;
      const league = body.league || {};
      byId("invite-league-title").textContent = league.name || "Join your league";
      byId("invite-league-description").textContent = league.seasonYear
        ? "Choose the team you manage for the " + league.seasonYear + " season."
        : "Choose the team you manage. Your selection is linked to your Mockd account.";
      inviteTeamList.replaceChildren();
      const connectedLeague = state.onboarding?.leagues?.find(candidate =>
        candidate.seasonId === body.invitation?.seasonId && candidate.membership?.teamId
      );
      const connectedTeamId = connectedLeague?.membership?.teamId;
      (body.teams || []).forEach(team => {
        const row = document.createElement("div");
        row.className = "invite-team-row";
        row.setAttribute("role", "listitem");
        const copy = document.createElement("div");
        copy.className = "invite-team-copy";
        const name = document.createElement("strong");
        name.textContent = team.name;
        const managers = document.createElement("span");
        managers.textContent = team.managerNames?.length
          ? team.managerNames.join(", ")
          : "Manager name not provided";
        copy.append(name, managers);
        if (team.status === "available" && !connectedLeague) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "primary";
          button.dataset.inviteTeamId = team.id;
          button.textContent = "Join as this team";
          button.setAttribute("aria-label", "Join as " + team.name);
          row.append(copy, button);
        } else {
          const status = document.createElement("span");
          status.className = "invite-team-status";
          status.textContent = connectedTeamId === team.id
            ? "Your team"
            : team.status === "claimed"
              ? "Claimed"
              : "Available";
          row.append(copy, status);
        }
        inviteTeamList.append(row);
      });
      if (!(body.teams || []).length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No teams are configured for this league.";
        inviteTeamList.append(empty);
      }
      setHidden(inviteOpenLeague, !connectedLeague);
      if (connectedLeague) {
        inviteOpenLeague.href = pathWithSeason("/league", connectedLeague.seasonId);
        inviteStatus.textContent = "Your account is already connected to a team in this league.";
      } else {
        inviteStatus.textContent = "";
      }
    };

    const loadLeagueInvitation = async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      inviteTeamList.replaceChildren();
      setHidden(inviteOpenLeague, true);
      if (!token) {
        inviteStatus.textContent = "This invitation link is missing its token.";
        return;
      }
      inviteStatus.textContent = "Loading league teams...";
      try {
        const body = await readJson(await fetch(
          "/invitations/details?token=" + encodeURIComponent(token),
          { credentials: "same-origin" },
        ));
        renderLeagueInvitationDetails(body);
      } catch (error) {
        inviteStatus.textContent = error.message;
      }
    };

    const renderSelectedLeague = selectedLeague => {
      if (state.selectedLeague?.seasonId !== selectedLeague?.seasonId) {
        state.simulationAbortController?.abort();
        state.simulationAbortController = null;
        clearTaskButtonBusy(simulationRun, true);
        state.workspaceRequestGeneration += 1;
        state.boardRequestGeneration += 1;
        state.currentSeason = null;
        state.claimedTeamIds = new Set();
        state.historicalImportFiles = [];
        state.sharedHistoricalOwnerMappings = new Map();
        state.historicalImportBusy = false;
        state.mockRequestGeneration += 1;
        state.mockSession = null;
        state.mockDraft = null;
        state.mockResults = null;
        state.mockPositionFilter = "ALL";
        state.mockRosterTeamId = null;
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
        keeperAddButton.disabled = true;
        keeperStatus.textContent = "";
        keeperList.replaceChildren();
        setupFinalReview.checked = false;
        setHidden(simulationResults, true);
        simulationStatus.textContent = "";
      }
      state.selectedLeague = selectedLeague;
      hideWorkspaces();
      setHidden(noLeaguePracticeOnboarding, Boolean(selectedLeague));
      standaloneBoardDescription.textContent = selectedLeague
        ? "Build a strategy, run full-league simulations, and practice against your active league."
        : "Explore current player rankings and compare baseline values.";
      if (routePath === "/invite") {
        setHidden(commissionerNavItem, true);
        setHidden(byId("invite-workspace"), false);
        loadLeagueInvitation();
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
          renderLeagueInvitation(selectedLeague.invitations || []);
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
      appStatus.textContent = "";
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

    const signupInvitationToken = () => authenticationInvitationToken();

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

    const normalizeHistoricalOwnerLabel = value => String(value || "")
      .normalize("NFKD")
      .replace(/[\\u0300-\\u036f]/gu, "")
      .toLowerCase()
      .replace(/[\\u0027\\u2019]s\\b/gu, "")
      .replace(/[^a-z0-9]+/gu, " ")
      .replace(/\\s+/gu, " ")
      .trim();

    const sharedHistoricalOwnerMappings = () =>
      [...state.sharedHistoricalOwnerMappings.values()];

    const historicalOwnerMappingsFor = item => {
      const mappingsByLabel = new Map();
      [...(item.ownerMappings || []), ...sharedHistoricalOwnerMappings()].forEach(mapping => {
        const normalizedLabel = normalizeHistoricalOwnerLabel(mapping.sourceOwnerOrTeamLabel);
        if (normalizedLabel) mappingsByLabel.set(normalizedLabel, mapping);
      });
      return [...mappingsByLabel.values()];
    };

    const historicalOwnerMappingAlreadyRendered = (itemId, sourceLabel) => {
      const itemIndex = state.historicalImportFiles.findIndex(item => item.id === itemId);
      const normalizedLabel = normalizeHistoricalOwnerLabel(sourceLabel);
      return state.historicalImportFiles.slice(0, itemIndex).some(item =>
        (item.ownerMappingNeeds || []).some(candidate =>
          normalizeHistoricalOwnerLabel(candidate) === normalizedLabel
        )
      );
    };

    const historicalImportQueueIssue = () => {
      const pendingFiles = pendingHistoricalImportFiles();
      if (pendingFiles.some(item => !Number.isInteger(item.seasonYear) || item.seasonYear < 2000 || item.seasonYear > 2100)) {
        return "Choose a valid draft year for every file.";
      }
      const duplicateYears = duplicateHistoricalImportYears(pendingFiles);
      if (duplicateYears.length > 0) return duplicateHistoricalImportYearMessage(duplicateYears);
      const hasIncompleteOwnerMappings = pendingFiles.some(item =>
        (item.ownerMappingNeeds || []).some(sourceLabel =>
          !historicalOwnerMappingsFor(item).some(mapping =>
            normalizeHistoricalOwnerLabel(mapping.sourceOwnerOrTeamLabel)
              === normalizeHistoricalOwnerLabel(sourceLabel) && mapping.teamId
          )
        )
      );
      if (hasIncompleteOwnerMappings) {
        return "Match every historical team name to a current team before importing again.";
      }
      const hasDuplicateTeamTargets = pendingFiles.some(item => {
        const mappings = historicalOwnerMappingsFor(item).filter(mapping =>
          (item.ownerMappingNeeds || []).some(sourceLabel =>
            normalizeHistoricalOwnerLabel(sourceLabel)
              === normalizeHistoricalOwnerLabel(mapping.sourceOwnerOrTeamLabel)
          )
        );
        return new Set(mappings.map(mapping => mapping.teamId)).size !== mappings.length;
      });
      return hasDuplicateTeamTargets
        ? "Each historical team must map to a different current team."
        : "";
    };

    const updateHistoricalImportControls = () => {
      const unavailable = state.currentSeason?.settings?.draftFormat === "snake" || state.draftHasStarted;
      historicalImportFile.disabled = unavailable;
      historicalImportChoose.disabled = unavailable;
      historicalReplaceInput.disabled = unavailable;
      historicalRowOneKeepersInput.disabled = unavailable;
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
        const visibleMappingNeeds = (item.ownerMappingNeeds || []).filter(sourceLabel =>
          !historicalOwnerMappingAlreadyRendered(item.id, sourceLabel)
        );
        if (visibleMappingNeeds.length > 0) {
          const mappingPanel = document.createElement("div");
          mappingPanel.className = "historical-owner-mappings";
          const heading = document.createElement("strong");
          heading.textContent = "Match historical team names";
          mappingPanel.append(heading);
          const teams = [...(state.currentSeason?.teams || [])]
            .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition);
          visibleMappingNeeds.forEach(sourceLabel => {
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
            select.value = historicalOwnerMappingsFor(item)
              .find(mapping => normalizeHistoricalOwnerLabel(mapping.sourceOwnerOrTeamLabel)
                === normalizeHistoricalOwnerLabel(sourceLabel))?.teamId || "";
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
            inferFirstRosterRowAsKeeper: historicalRowOneKeepersInput.checked,
            requireCompleteTeamMapping: true,
            ownerMappings: historicalOwnerMappingsFor(item),
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
        error.teamCountMismatch = (batch.blockers || []).some(blocker => blocker.code === "team_count_mismatch");
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
      const normalizedLabel = normalizeHistoricalOwnerLabel(select.dataset.historicalOwnerLabel);
      state.sharedHistoricalOwnerMappings.delete(normalizedLabel);
      if (select.value) {
        state.sharedHistoricalOwnerMappings.set(normalizedLabel, {
          sourceOwnerOrTeamLabel: select.dataset.historicalOwnerLabel,
          teamId: select.value,
        });
      }
      state.historicalImportFiles.forEach(candidate => {
        candidate.ownerMappings = historicalOwnerMappingsFor(candidate);
      });
      const allMapped = item.ownerMappingNeeds.every(sourceLabel =>
        historicalOwnerMappingsFor(item).some(mapping =>
          normalizeHistoricalOwnerLabel(mapping.sourceOwnerOrTeamLabel)
            === normalizeHistoricalOwnerLabel(sourceLabel) && mapping.teamId
        )
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
      if (state.historicalImportFiles.length === 0) state.sharedHistoricalOwnerMappings.clear();
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
        + "Draft history is saved. Market now blends baseline projections with up to three years of open-auction sales; keeper rows are excluded. Files with same-season public/AAV values also improve player-level estimates."
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
          item.ownerMappingNeeds = error.teamCountMismatch
            ? []
            : Array.isArray(error.ownerMappingNeeds) ? error.ownerMappingNeeds : [];
          item.ownerMappings = historicalOwnerMappingsFor(item);
          item.message = error.teamCountMismatch
            ? "This file does not match the current league's team count."
            : item.ownerMappingNeeds.length > 0
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
      keeperStatus.textContent = "";
    });

    keeperCommandForm.addEventListener("submit", async event => {
      event.preventDefault();
      const seasonId = byId("setup-season-id-input").value;
      const command = keeperCommandInput.value.trim();
      if (!command) {
        keeperStatus.textContent = "Enter a keeper command first.";
        keeperCommandInput.focus();
        return;
      }
      const previousSaveState = keeperSaveState.textContent;
      keeperCommandInput.disabled = true;
      setTaskButtonBusy(keeperAddButton, "Adding keeper...");
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
        state.playerCatalog = null;
        state.playerCatalogSeasonId = null;
        const value = body.preview.keeper.draftType === "snake"
          ? "round " + body.preview.keeper.keeperRound
          : "$" + body.preview.keeper.auctionCostDollars;
        const updateMessage = body.room
          ? "League values and the draft room are updated."
          : "League values are updated.";
        keeperStatus.textContent = body.preview.team.name + " keeps " + body.preview.player.name
          + " for " + value + ". " + updateMessage;
      } catch (error) {
        keeperStatus.textContent = error.message;
        keeperSaveState.textContent = previousSaveState;
      } finally {
        keeperCommandInput.disabled = state.draftHasStarted;
        clearTaskButtonBusy(keeperAddButton, state.draftHasStarted);
        if (!state.draftHasStarted) keeperCommandInput.focus();
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
      renderLeagueInvitation(body.invitations || []);
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
        appendLabeledTableCells(row, [
          ["Owner", record.ownerDisplayName],
          ["Team", record.teamDisplayName],
          ["Email", record.email || "No email"],
          ["Role", titleCase(record.role)],
        ]);
        setupPreviewBody.append(row);
      });
      setHidden(setupPreviewTable, records.length === 0);
      if (body.invitations) renderLeagueInvitation(body.invitations);
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

    archiveLeagueButton.addEventListener("click", async () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) return;
      if (!window.confirm(
        "Archive this league? It will disappear from every member's active league picker, but its data will remain stored.",
      )) return;
      archiveLeagueButton.disabled = true;
      archiveLeagueStatus.textContent = "Archiving league...";
      try {
        await readJson(await fetch(
          "/leagues/" + encodeURIComponent(selectedLeague.leagueId) + "/archive",
          { method: "POST", credentials: "same-origin" },
        ));
        window.location.assign("/league");
      } catch (error) {
        archiveLeagueStatus.textContent = error.message;
        archiveLeagueButton.disabled = false;
      }
    });

    createLeagueInviteButton.addEventListener("click", async () => {
      const seasonId = byId("setup-season-id-input").value;
      const requestGeneration = state.workspaceRequestGeneration;
      if (!seasonId) return;
      const activeInvitation = state.invitations.find(candidate =>
        candidate.kind === "league"
          && candidate.status === "pending"
          && Date.parse(candidate.expiresAt) >= Date.now()
      );
      if (
        activeInvitation &&
        !window.confirm("Generate a new league link? The current link will stop working.")
      ) return;
      createLeagueInviteButton.disabled = true;
      invitationCreateStatus.textContent = activeInvitation
        ? "Generating a new league link..."
        : "Creating league link...";
      try {
        const body = await readJson(await fetch("/invitations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ seasonId: seasonId }),
        }));
        if (!isCurrentSetupRequest(seasonId, requestGeneration)) return;
        const invitation = body.invitation;
        renderLeagueInvitation([
          ...state.invitations.filter(candidate => !(
            candidate.kind === "league" && candidate.status === "pending"
          )),
          invitation,
        ]);
        invitationCreateStatus.textContent = "League link created. Copy it and share it with your group.";
      } catch (error) {
        if (isCurrentSetupRequest(seasonId, requestGeneration)) {
          invitationCreateStatus.textContent = error.message;
        }
      } finally {
        if (isCurrentSetupRequest(seasonId, requestGeneration)) {
          createLeagueInviteButton.disabled = false;
        }
      }
    });

    copyLeagueInviteButton.addEventListener("click", async () => {
      if (!leagueInviteLinkInput.value) return;
      try {
        await navigator.clipboard.writeText(leagueInviteLinkInput.value);
        invitationCreateStatus.textContent = "League link copied.";
      } catch {
        leagueInviteLinkInput.focus();
        leagueInviteLinkInput.select();
        invitationCreateStatus.textContent = "Copy the selected link.";
      }
    });

    noLeagueInvitationHelp.addEventListener("click", () => {
      const expanded = noLeagueInvitationHelp.getAttribute("aria-expanded") === "true";
      noLeagueInvitationHelp.setAttribute("aria-expanded", String(!expanded));
      setHidden(noLeagueInvitationInstructions, expanded);
      if (!expanded) noLeagueInvitationInstructions.focus();
    });

    inviteTeamList.addEventListener("click", async event => {
      const button = event.target.closest("button[data-invite-team-id]");
      if (!button) return;
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        inviteStatus.textContent = "This invitation link is missing its token.";
        return;
      }
      inviteTeamList.querySelectorAll("button").forEach(candidate => { candidate.disabled = true; });
      inviteStatus.textContent = "Joining league...";
      try {
        const body = await readJson(await fetch("/invitations/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token: token, teamId: button.dataset.inviteTeamId }),
        }));
        const seasonId = body.invitation?.seasonId || state.leagueInvitation?.invitation?.seasonId;
        window.location.assign(pathWithSeason("/league", seasonId));
      } catch (error) {
        await loadLeagueInvitation();
        inviteStatus.textContent = error.message;
      }
    });

    leagueCreateSeason.value = String(new Date().getFullYear());
    byId("league-info-button").addEventListener("click", () => {
      if (!state.leagueCreation) applyLeagueCreationReview(manualLeagueCreationReview());
      cancelLeagueCreationScreenshotRequest();
      state.leagueCreationScreenshotFile = null;
      if (leagueCreationScreenshotAnalysisEnabled) {
        leagueCreateScreenshotFile.value = "";
        leagueCreateScreenshotAnalyze.disabled = true;
        leagueCreateScreenshotStatus.textContent = "";
      }
      showLeagueCreationStep("basics");
      leagueSetupDialog.showModal();
    });
    byId("league-setup-close").addEventListener("click", () => leagueSetupDialog.close());
    leagueSetupDialog.addEventListener("close", () => {
      cancelLeagueCreationScreenshotRequest();
      leagueCreateScreenshotDropzone?.classList.remove("is-dragging");
    });

    if (leagueCreationScreenshotAnalysisEnabled) {
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
    }

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
            outcome.message + " No settings were imported. No form values changed. You can continue by entering the league manually.",
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
          error.message + " No settings were imported. No form values changed. You can continue by entering the league manually.",
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
      const firstTargetCap = simulationTargetList.querySelector("input");
      if (firstTargetCap) firstTargetCap.focus();
      else simulationStrategy.focus();
    });
    mockDraftSearch.addEventListener("input", renderMockDraft);
    mockDraftPositionFilters.addEventListener("click", event => {
      const button = event.target.closest("[data-mock-position]");
      if (!button) return;
      state.mockPositionFilter = button.dataset.mockPosition;
      renderMockDraft();
    });
    mockDraftRosterTeam.addEventListener("change", () => {
      state.mockRosterTeamId = mockDraftRosterTeam.value;
      renderMockDraft();
    });
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
    mockDraftAbandon.addEventListener("click", abandonMockDraft);
    mockDraftStartAnother.addEventListener("click", () => {
      const selectedLeague = state.selectedLeague;
      if (!selectedLeague) return;
      setHidden(mockDraftAbandoned, true);
      clearMockSessionIdFromLocation();
      loadMockDraft(selectedLeague).catch(error => {
        mockDraftStatus.textContent = error.message;
        setHidden(mockDraftAbandoned, false);
      });
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
