export const platformShellHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #050506;
      --panel: #09090c;
      --panel-2: #101014;
      --line: #292632;
      --line-hot: #d75cff;
      --line-soft: rgba(215, 92, 255, 0.36);
      --blue: #5cc8ff;
      --gold: #ffcf5c;
      --green: #37e89b;
      --text: #f6f0ff;
      --muted: #aaa2b5;
      --danger: #ff5c8a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    button, input, textarea, select {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    .page {
      min-height: 100vh;
      padding: 28px;
    }

    .topbar {
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      display: flex;
      gap: 16px;
      justify-content: space-between;
      margin-bottom: 18px;
      padding: 16px 18px;
    }

    .brand {
      display: grid;
      gap: 2px;
    }

    .brand strong {
      font-size: 26px;
      line-height: 1;
    }

    .brand span, label, .muted {
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
    }

    .cards {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(3, minmax(220px, 1fr));
    }

    .workspace-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(280px, 420px) minmax(320px, 1fr);
    }

    .setup-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(280px, 460px) minmax(280px, 1fr);
    }

    .summary-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(3, minmax(120px, 1fr));
    }

    .summary-item {
      background: #070708;
      border: 1px solid var(--line);
      border-radius: 6px;
      display: grid;
      gap: 4px;
      min-height: 70px;
      padding: 10px 12px;
    }

    .summary-item strong {
      font-size: 17px;
      overflow-wrap: anywhere;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
    }

    .panel.hot {
      border-color: var(--line-hot);
      box-shadow: 0 0 34px rgba(215, 92, 255, 0.16);
    }

    .panel h1, .panel h2, .panel h3 {
      margin: 0;
    }

    .panel h1 {
      font-size: 38px;
      line-height: 1.05;
    }

    .panel h2 {
      font-size: 20px;
      margin-bottom: 14px;
    }

    .panel h3 {
      font-size: 17px;
      margin-bottom: 10px;
    }

    .stack {
      display: grid;
      gap: 12px;
    }

    .row {
      align-items: center;
      display: flex;
      gap: 10px;
    }

    .row.wrap {
      flex-wrap: wrap;
    }

    .row > * {
      min-width: 0;
    }

    input, textarea {
      background: #050506;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      padding: 0 12px;
      width: 100%;
    }

    input {
      min-height: 46px;
    }

    textarea {
      line-height: 1.45;
      min-height: 180px;
      padding-bottom: 12px;
      padding-top: 12px;
      resize: vertical;
    }

    input:focus, textarea:focus {
      border-color: var(--line-hot);
      outline: 2px solid var(--line-soft);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.54;
    }

    .btn {
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      font-weight: 800;
      min-height: 46px;
      padding: 0 16px;
      white-space: nowrap;
    }

    .btn.primary {
      background: #26112f;
      border-color: var(--line-hot);
    }

    .btn.green {
      border-color: var(--green);
      color: #83ffd0;
    }

    .btn.blue {
      border-color: var(--blue);
      color: #bfeeff;
    }

    .btn.gold {
      border-color: var(--gold);
      color: #ffe7a3;
    }

    .error {
      color: var(--danger);
      font-weight: 800;
      min-height: 20px;
    }

    .hidden {
      display: none !important;
    }

    .section-link {
      align-items: center;
      background: #070708;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--text);
      display: flex;
      font-weight: 800;
      justify-content: space-between;
      min-height: 56px;
      padding: 0 14px;
      text-decoration: none;
      width: 100%;
    }

    .section-link[data-active="true"] {
      border-color: var(--line-hot);
      color: #f5c4ff;
    }

    .notice {
      background: #0b0b10;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: var(--muted);
      padding: 12px;
    }

    .notice strong {
      color: var(--text);
    }

    .catalog-list {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .catalog-list li {
      background: #070708;
      border: 1px solid var(--line);
      border-radius: 6px;
      display: grid;
      gap: 4px;
      min-height: 66px;
      padding: 10px 12px;
    }

    .catalog-list strong {
      overflow-wrap: anywhere;
    }

    details.advanced {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 12px;
    }

    details.advanced summary {
      color: var(--muted);
      cursor: pointer;
      font-weight: 800;
    }

    .result-list {
      display: grid;
      gap: 8px;
      list-style: none;
      margin: 0;
      min-height: 32px;
      padding: 0;
    }

    .result-list li {
      background: #070708;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
    }

    .team-claim-row {
      align-items: center;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .team-claim-row span {
      overflow-wrap: anywhere;
    }

    .status-line {
      color: var(--muted);
      font-size: 14px;
      min-height: 22px;
      overflow-wrap: anywhere;
    }

    .status-line strong {
      color: var(--text);
    }

    .event-list {
      max-height: 180px;
      overflow: auto;
    }

    .artifact-preview {
      background: #050506;
      border: 1px solid var(--line);
      border-radius: 6px;
      color: #dbefff;
      max-height: 260px;
      overflow: auto;
      padding: 12px;
      white-space: pre-wrap;
    }

    @media (max-width: 1100px) {
      .cards, .workspace-grid, .setup-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 700px) {
      .page { padding: 18px; }
      .summary-grid { grid-template-columns: 1fr; }
      .topbar { align-items: flex-start; flex-direction: column; }
      .row { align-items: stretch; flex-direction: column; }
      .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="topbar">
      <div class="brand">
        <span>Mockd</span>
        <strong>Draft command center</strong>
      </div>
      <div class="row wrap">
        <span id="session-label" class="muted">Signed out</span>
        <button id="local-demo-topbar-button" class="btn blue hidden" type="button">Use local demo</button>
        <button id="logout-button" class="btn hidden" type="button">Sign out</button>
      </div>
    </header>

    <section id="auth-panel" class="grid">
      <div class="panel hot">
        <h1>Sign in</h1>
      </div>
      <form id="auth-form" class="panel stack">
        <label for="email-input">Email</label>
        <input id="email-input" autocomplete="email" inputmode="email" name="email" type="email">
        <label for="password-input">Password</label>
        <input id="password-input" autocomplete="current-password" name="password" type="password">
        <div class="row wrap">
          <button id="signin-button" class="btn primary" type="submit">Sign in</button>
          <button id="create-account-button" class="btn" type="button">Create account</button>
          <button id="local-demo-button" class="btn blue hidden" type="button">Use local demo</button>
        </div>
        <div id="auth-error" class="error" role="alert"></div>
      </form>
    </section>

    <section id="app-shell" class="hidden stack">
      <div class="cards">
        <article class="panel hot">
          <h2>League home</h2>
          <button id="open-league-section-button" class="section-link" data-active="true" type="button">Open league <span>></span></button>
        </article>
        <article class="panel">
          <h2>Live draft room</h2>
          <button id="draft-room-link" class="section-link" type="button">Open draft room <span>></span></button>
        </article>
        <article class="panel">
          <h2>Commissioner setup</h2>
          <button id="open-setup-section-button" class="section-link" type="button">Open setup <span>></span></button>
        </article>
      </div>

      <div class="workspace-grid">
        <section id="league-section" class="panel stack">
          <h2>League home</h2>
          <div id="local-member-notice" class="notice hidden"></div>
          <label for="season-id-input">Season id</label>
          <div class="row">
            <input id="season-id-input" autocomplete="off" name="seasonId">
            <button id="load-season-button" class="btn blue" type="button">Load</button>
          </div>
          <div id="season-status" class="status-line"></div>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="muted">League</span>
              <strong id="league-name-label">Not loaded</strong>
            </div>
            <div class="summary-item">
              <span class="muted">Season</span>
              <strong id="season-year-label">-</strong>
            </div>
            <div class="summary-item">
              <span class="muted">Teams</span>
              <strong id="team-count-label">-</strong>
            </div>
          </div>
          <h3>Claim team</h3>
          <ul id="team-claim-list" class="result-list"></ul>
        </section>

        <section id="draft-room-section" class="panel hot stack">
          <h2>Live draft room</h2>
          <label for="room-id-input">Room id</label>
          <div class="row">
            <input id="room-id-input" autocomplete="off" name="roomId">
            <button id="open-room-button" class="btn" type="button">Open</button>
            <button id="create-room-button" class="btn blue" type="button">Create</button>
          </div>
          <label>Player catalog</label>
          <ul id="player-catalog-list" class="catalog-list"></ul>
          <details class="advanced">
            <summary>Advanced catalog JSON</summary>
            <textarea id="player-catalog-input" spellcheck="false"></textarea>
          </details>
          <div class="row wrap">
            <button id="start-room-button" class="btn green" type="button" disabled>Start</button>
            <button id="undo-sale-button" class="btn" type="button" disabled>Undo</button>
            <button id="end-room-button" class="btn gold" type="button" disabled>End</button>
          </div>
          <form id="sale-form" class="row">
            <input id="sale-command-input" autocomplete="off" name="saleCommand" placeholder="cam puka 62">
            <button id="log-sale-button" class="btn primary" type="submit" disabled>Log sale</button>
          </form>
          <div id="room-status" class="status-line"></div>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="muted">Status</span>
              <strong id="room-status-label">Not opened</strong>
            </div>
            <div class="summary-item">
              <span class="muted">Revision</span>
              <strong id="room-revision-label">-</strong>
            </div>
            <div class="summary-item">
              <span class="muted">Sales</span>
              <strong id="sale-count-label">-</strong>
            </div>
          </div>
        </section>
      </div>

      <div class="workspace-grid">
        <section class="panel stack">
          <h2>Sale log</h2>
          <ul id="sale-log" class="result-list"></ul>
          <h3>Room events</h3>
          <ul id="room-events" class="result-list event-list"></ul>
        </section>

        <section class="panel stack">
          <h2>Board</h2>
          <ul id="room-board-list" class="result-list"></ul>
          <h3>Teams</h3>
          <ul id="room-team-list" class="result-list"></ul>
        </section>
      </div>

      <section class="panel stack">
        <h2>Final export</h2>
        <div class="row wrap">
          <button id="create-export-artifact-button" class="btn green" type="button" disabled>Create CSV artifact</button>
          <a id="artifact-download-link" class="section-link hidden" href="#" download="mockd-draft-export.csv">Download CSV <span>></span></a>
        </div>
        <div id="artifact-status" class="status-line"></div>
        <pre id="artifact-preview" class="artifact-preview"></pre>
      </section>

      <div class="setup-grid">
        <form id="setup-form" class="panel stack">
          <h2>Commissioner setup</h2>
          <label for="setup-season-id-input">Season id</label>
          <input id="setup-season-id-input" autocomplete="off" name="seasonId">
          <label for="setup-rows-input">Owner import rows</label>
          <textarea id="setup-rows-input" name="setupRows" spellcheck="false">owner,team,email,role
Beaton,Beaton,beaton@example.com,member
Hoody,Hoody,hoody@example.com,member
PJ,PJ,pj@example.com,member
Seth,Seth,seth@example.com,member
Jakub,Jakub,jakub@example.com,member
Tye,Tye,tye@example.com,member
Chip,Chip,chip@example.com,member
CJ,CJ,cj@example.com,member
Kenny,Kenny,kenny@example.com,member
Russ,Russ,russ@example.com,member
Cam,Cam,cam@example.com,owner
Sam,Sam,sam@example.com,member
Martins,Martins,martins@example.com,member
Mello,Mello,mello@example.com,member</textarea>
          <div class="row wrap">
            <button id="setup-preview-button" class="btn" type="button">Preview</button>
            <button id="setup-apply-button" class="btn green" type="button" disabled>Apply</button>
          </div>
          <div id="setup-status" class="status-line"></div>
        </form>
        <article class="panel stack">
          <h3>Setup blockers</h3>
          <ul id="setup-blockers" class="result-list"></ul>
          <h3>Owners without accounts</h3>
          <ul id="setup-pending-invites" class="result-list"></ul>
        </article>
      </div>
    </section>
  </main>

  <script type="module">
    const currentSessionRequest = "GET /session";
    const defaultSeasonId = "league-214674-season-2026";
    const localDemoEmail = "cam@mockd.local";
    const localDemoPassword = "mockd local e2e password";
    const localDemoRoomId = "room_mockd_e2e_2026";
    const defaultPlayerCatalog = [
      { name: "Puka Nacua", position: "WR", expectedPrice: 73, teamAbbreviation: "LAR", byeWeek: 8 },
      { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72, teamAbbreviation: "DET", byeWeek: 8 },
      { name: "Amon-Ra St. Brown", position: "WR", expectedPrice: 67, teamAbbreviation: "DET", byeWeek: 8 },
      { name: "De'Von Achane", position: "RB", expectedPrice: 50, teamAbbreviation: "MIA", byeWeek: 12 },
      { name: "George Kittle", position: "TE", expectedPrice: 28, teamAbbreviation: "SF", byeWeek: 14 },
      { name: "Xavier Legette", position: "WR", expectedPrice: 2, teamAbbreviation: "CAR", byeWeek: 14 },
      { name: "Trevor Lawrence", position: "QB", expectedPrice: 9, teamAbbreviation: "JAC", byeWeek: 8 },
      { name: "Brandon Aubrey", position: "K", expectedPrice: 2, teamAbbreviation: "DAL", byeWeek: 10 },
      { name: "Lions D/ST", position: "DST", expectedPrice: 2, teamAbbreviation: "DET", byeWeek: 8 },
    ];
    const query = new URLSearchParams(window.location.search);
    const initialSeasonId = query.get("seasonId") || query.get("season") || defaultSeasonId;
    const initialRoomId = query.get("roomId") || query.get("room");
    const state = {
      account: null,
      season: null,
      membership: null,
      room: null,
      eventSource: null,
      pollTimer: 0,
      artifactUrl: null,
    };

    const authPanel = document.getElementById("auth-panel");
    const appShell = document.getElementById("app-shell");
    const sessionLabel = document.getElementById("session-label");
    const localDemoTopbarButton = document.getElementById("local-demo-topbar-button");
    const logoutButton = document.getElementById("logout-button");
    const authForm = document.getElementById("auth-form");
    const authError = document.getElementById("auth-error");
    const emailInput = document.getElementById("email-input");
    const passwordInput = document.getElementById("password-input");
    const createAccountButton = document.getElementById("create-account-button");
    const localDemoButton = document.getElementById("local-demo-button");
    const openLeagueSectionButton = document.getElementById("open-league-section-button");
    const leagueSection = document.getElementById("league-section");
    const draftRoomSection = document.getElementById("draft-room-section");
    const openSetupSectionButton = document.getElementById("open-setup-section-button");
    const seasonIdInput = document.getElementById("season-id-input");
    const loadSeasonButton = document.getElementById("load-season-button");
    const seasonStatus = document.getElementById("season-status");
    const localMemberNotice = document.getElementById("local-member-notice");
    const leagueNameLabel = document.getElementById("league-name-label");
    const seasonYearLabel = document.getElementById("season-year-label");
    const teamCountLabel = document.getElementById("team-count-label");
    const teamClaimList = document.getElementById("team-claim-list");
    const draftRoomLink = document.getElementById("draft-room-link");
    const roomIdInput = document.getElementById("room-id-input");
    const openRoomButton = document.getElementById("open-room-button");
    const createRoomButton = document.getElementById("create-room-button");
    const playerCatalogList = document.getElementById("player-catalog-list");
    const playerCatalogInput = document.getElementById("player-catalog-input");
    const startRoomButton = document.getElementById("start-room-button");
    const saleForm = document.getElementById("sale-form");
    const saleCommandInput = document.getElementById("sale-command-input");
    const logSaleButton = document.getElementById("log-sale-button");
    const undoSaleButton = document.getElementById("undo-sale-button");
    const endRoomButton = document.getElementById("end-room-button");
    const roomStatus = document.getElementById("room-status");
    const roomStatusLabel = document.getElementById("room-status-label");
    const roomRevisionLabel = document.getElementById("room-revision-label");
    const saleCountLabel = document.getElementById("sale-count-label");
    const saleLog = document.getElementById("sale-log");
    const roomEvents = document.getElementById("room-events");
    const roomBoardList = document.getElementById("room-board-list");
    const roomTeamList = document.getElementById("room-team-list");
    const createExportArtifactButton = document.getElementById("create-export-artifact-button");
    const artifactDownloadLink = document.getElementById("artifact-download-link");
    const artifactStatus = document.getElementById("artifact-status");
    const artifactPreview = document.getElementById("artifact-preview");
    const setupSeasonIdInput = document.getElementById("setup-season-id-input");
    const setupRowsInput = document.getElementById("setup-rows-input");
    const setupPreviewButton = document.getElementById("setup-preview-button");
    const setupApplyButton = document.getElementById("setup-apply-button");
    const setupStatus = document.getElementById("setup-status");
    const setupBlockers = document.getElementById("setup-blockers");
    const setupPendingInvites = document.getElementById("setup-pending-invites");
    const setupPreviewSuffix = "/setup-import/preview";
    const setupApplySuffix = "/setup-import/apply";

    const cleanIdFragment = value => {
      const cleanValue = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      return cleanValue.length === 0 ? "draft" : cleanValue;
    };

    const defaultRoomIdFor = seasonId => {
      if (seasonId === defaultSeasonId) return localDemoRoomId;

      const match = /^league-([a-z0-9-]+)-season-([0-9]+)$/i.exec(seasonId);
      if (match) return "room_" + cleanIdFragment(match[1]) + "_" + match[2];

      return cleanIdFragment(seasonId) + "_room";
    };

    const isLoopbackHost = () =>
      ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

    const syncLocalDemoButtons = () => {
      const localPreview = isLoopbackHost();
      localDemoButton.classList.toggle("hidden", !localPreview || state.account !== null);
      localDemoTopbarButton.classList.toggle("hidden", !localPreview || state.account === null);
    };

    const selectedSeasonId = () => seasonIdInput.value.trim() || defaultSeasonId;
    const selectedRoomId = () => roomIdInput.value.trim() || defaultRoomIdFor(selectedSeasonId());
    const seasonEndpoint = () => "/seasons/" + encodeURIComponent(selectedSeasonId());
    const roomEndpoint = action => "/live-rooms/" + encodeURIComponent(selectedRoomId()) + (
      action === undefined ? "" : "/" + action
    );

    const jsonRequest = (method, body) => ({
      method,
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

    const readJson = async response => {
      const text = await response.text();
      const body = text.trim().length === 0 ? {} : JSON.parse(text);
      if (!response.ok) throw new Error(body.error?.message || "Request failed.");
      return body;
    };

    const readSetupJson = async response => {
      const text = await response.text();
      const body = text.trim().length === 0 ? {} : JSON.parse(text);
      if (!response.ok && !body.import) throw new Error(body.error?.message || "Request failed.");
      return body;
    };

    const replaceListItems = (list, items, emptyText, renderItem) => {
      const values = items.length === 0 ? [emptyText] : items;
      list.replaceChildren(...values.map(value => {
        const item = document.createElement("li");
        if (typeof value === "string") {
          item.textContent = value;
          return item;
        }

        const rendered = renderItem(value);
        if (typeof rendered === "string") item.textContent = rendered;
        else item.appendChild(rendered);
        return item;
      }));
    };

    const scrollToSection = section => {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const focusCurrentRoute = () => {
      if (window.location.pathname === "/draft-room") {
        scrollToSection(draftRoomSection);
        return;
      }
      if (window.location.pathname === "/setup") {
        scrollToSection(setupSeasonIdInput);
        setupSeasonIdInput.focus();
      }
    };

    const localDemoHelpText = () =>
      "This account is signed in, but it is not a member of the seeded local league. " +
      "Sign out or use the local demo account to open league-214674-season-2026.";

    const friendlySeasonError = error => {
      const message = error instanceof Error ? error.message : String(error);
      return isLoopbackHost() && message.includes("Join this league")
        ? localDemoHelpText()
        : message;
    };

    const renderPlayerCatalog = () => {
      replaceListItems(playerCatalogList, defaultPlayerCatalog, "No catalog players.", player =>
        player.name + " / " + player.position + " / " + player.teamAbbreviation + " / $" + player.expectedPrice
      );
    };

    const setButtonStates = () => {
      const hasSeason = state.season !== null;
      const hasRoom = state.room !== null;
      const roomStatusValue = state.room?.status;
      const isLive = roomStatusValue === "live";
      openRoomButton.disabled = !hasSeason;
      createRoomButton.disabled = !hasSeason;
      startRoomButton.disabled = !hasRoom || (roomStatusValue !== "setup" && roomStatusValue !== "countdown");
      logSaleButton.disabled = !isLive;
      undoSaleButton.disabled = !isLive || ((state.room?.projection?.sales || []).length === 0);
      endRoomButton.disabled = !isLive;
      createExportArtifactButton.disabled = roomStatusValue !== "ended";
    };

    const renderTeamClaims = () => {
      if (state.season === null) {
        replaceListItems(teamClaimList, [], "Load a season to claim a team.", value => value);
        return;
      }

      replaceListItems(teamClaimList, state.season.teams || [], "No teams.", team => {
        const row = document.createElement("div");
        row.className = "team-claim-row";
        const label = document.createElement("span");
        const claimed = state.membership?.teamId === team.id ? " claimed" : "";
        label.textContent = team.draftOrderPosition + ". " + team.displayName + " / " + team.ownerDisplayName + claimed;
        const button = document.createElement("button");
        button.className = "btn";
        button.type = "button";
        button.textContent = state.membership?.teamId === team.id ? "Claimed" : "Claim";
        button.disabled = state.membership?.teamId === team.id;
        button.addEventListener("click", () => {
          claimTeam(team).catch(error => { seasonStatus.textContent = error.message; });
        });
        row.append(label, button);
        return row;
      });
    };

    const renderSeason = season => {
      state.season = season;
      state.membership = null;
      localMemberNotice.classList.add("hidden");
      localMemberNotice.textContent = "";
      leagueNameLabel.textContent = season?.league?.name || "Not loaded";
      seasonYearLabel.textContent = season?.seasonYear === undefined ? "-" : String(season.seasonYear);
      teamCountLabel.textContent = season?.teams === undefined ? "-" : String(season.teams.length);
      if (season !== null) {
        seasonIdInput.value = season.id;
        setupSeasonIdInput.value = season.id;
        if (roomIdInput.value.trim().length === 0 || initialRoomId === null) {
          roomIdInput.value = defaultRoomIdFor(season.id);
        }
      }
      renderTeamClaims();
      setButtonStates();
    };

    const clearArtifact = () => {
      if (state.artifactUrl !== null) URL.revokeObjectURL(state.artifactUrl);
      state.artifactUrl = null;
      artifactDownloadLink.classList.add("hidden");
      artifactDownloadLink.removeAttribute("href");
      artifactPreview.textContent = "";
      artifactStatus.textContent = "";
    };

    const renderRoomReadModel = model => {
      roomStatusLabel.textContent = model.status || "Not opened";
      roomRevisionLabel.textContent = model.revision === undefined ? "-" : String(model.revision);
      saleCountLabel.textContent = String((model.salesLog || []).length);

      replaceListItems(
        saleLog,
        model.salesLog || [],
        "No sales logged.",
        sale => "r" + sale.revision + " " + sale.ownerDisplayName + " bought " + sale.playerName + " for $" + sale.price
      );
      replaceListItems(
        roomBoardList,
        (model.board || []).slice(0, 10),
        "No board players.",
        player => player.name + " / " + player.position + " / $" + player.expectedPrice
      );
      replaceListItems(
        roomTeamList,
        model.teamSummaries || [],
        "No team states.",
        team => team.ownerDisplayName + ": $" + team.budgetRemaining + " left, max bid $" + team.maxBid
      );
      setButtonStates();
    };

    const readModelForRoom = room => {
      const saleEvents = room.events || [];
      const salesLog = (room.projection?.sales || []).map(sale => {
        const event = saleEvents.find(candidate =>
          candidate.type === "sale_logged" && candidate.sale?.saleEventId === sale.saleEventId
        );
        return {
          ...sale,
          revision: event?.revision || room.revision,
          occurredAt: event?.occurredAt || room.updatedAt,
        };
      });

      return {
        roomId: room.roomId,
        leagueId: room.leagueId,
        seasonId: room.seasonId,
        status: room.status,
        revision: room.revision,
        board: room.projection?.board || [],
        teamSummaries: room.projection?.teams || [],
        salesLog,
      };
    };

    const renderRoom = room => {
      state.room = room;
      roomIdInput.value = room.roomId;
      clearArtifact();
      renderRoomReadModel(readModelForRoom(room));
      replaceListItems(
        roomEvents,
        (room.events || []).slice(-8).reverse(),
        "No room events.",
        event => "r" + event.revision + " " + event.type
      );
    };

    const appendRoomEvent = text => {
      const item = document.createElement("li");
      item.textContent = text;
      roomEvents.prepend(item);
    };

    const stopRoomUpdates = () => {
      if (state.eventSource !== null) {
        state.eventSource.close();
        state.eventSource = null;
      }
      if (state.pollTimer !== 0) {
        window.clearTimeout(state.pollTimer);
        state.pollTimer = 0;
      }
    };

    const refreshRoom = async () => {
      const body = await readJson(await fetch(roomEndpoint(), { credentials: "same-origin" }));
      renderRoom(body.room);
      return body.room;
    };

    const pollRoomEvents = async () => {
      state.pollTimer = 0;
      if (state.room === null) return;

      try {
        const afterRevision = state.room.revision || 0;
        const body = await readJson(await fetch(roomEndpoint("events") + "?afterRevision=" + encodeURIComponent(afterRevision), {
          credentials: "same-origin",
        }));
        const payloads = body.events?.events || [];
        if (payloads.length > 0) {
          appendRoomEvent("Fetched " + payloads.length + " update(s).");
          await refreshRoom();
        }
      } catch (error) {
        roomStatus.textContent = error.message;
      }

      if (state.room !== null && state.eventSource === null) {
        state.pollTimer = window.setTimeout(pollRoomEvents, 5000);
      }
    };

    const scheduleRoomEventPoll = () => {
      if (state.pollTimer !== 0 || state.room === null) return;

      state.pollTimer = window.setTimeout(pollRoomEvents, 1000);
    };

    const connectRoomUpdates = () => {
      stopRoomUpdates();
      if (state.room === null) return;

      if (!("EventSource" in window)) {
        scheduleRoomEventPoll();
        return;
      }

      const afterRevision = state.room.revision || 0;
      const eventSource = new EventSource(roomEndpoint("event-stream") + "?afterRevision=" + encodeURIComponent(afterRevision));
      state.eventSource = eventSource;
      const refreshFromStream = event => {
        const data = JSON.parse(event.data);
        appendRoomEvent(event.type + " r" + data.revision);
        refreshRoom()
          .then(() => { connectRoomUpdates(); })
          .catch(error => {
            roomStatus.textContent = error.message;
            scheduleRoomEventPoll();
          });
      };
      eventSource.addEventListener("room.snapshot", refreshFromStream);
      eventSource.addEventListener("room.started", refreshFromStream);
      eventSource.addEventListener("room.sale", refreshFromStream);
      eventSource.addEventListener("room.ended", refreshFromStream);
      eventSource.onerror = () => {
        if (state.eventSource === eventSource) {
          eventSource.close();
          state.eventSource = null;
          scheduleRoomEventPoll();
        }
      };
    };

    const currentRevision = () => {
      const revision = state.room?.revision;
      if (typeof revision !== "number") throw new Error("Open or create a room first.");

      return revision;
    };

    const idempotencyKeyFor = (action, detail) =>
      action + ":" + selectedRoomId() + ":" + currentRevision() + ":" + cleanIdFragment(detail) + ":" + Date.now();

    const playerCatalogFor = () => {
      const playerCatalog = JSON.parse(playerCatalogInput.value);
      if (!Array.isArray(playerCatalog)) throw new Error("Player catalog must be a JSON array.");

      return playerCatalog;
    };

    const loadSeason = async () => {
      seasonStatus.textContent = "Loading season...";
      const body = await readJson(await fetch(seasonEndpoint(), { credentials: "same-origin" }));
      renderSeason(body.season);
      seasonStatus.textContent = "Loaded " + body.season.league.name + " " + body.season.seasonYear + ".";
      return body.season;
    };

    const claimTeam = async team => {
      seasonStatus.textContent = "Claiming " + team.displayName + "...";
      const body = await readJson(await fetch(seasonEndpoint() + "/team-claims", jsonRequest("POST", {
        ownerId: team.ownerId,
        teamId: team.id,
      })));
      state.membership = body.membership;
      renderTeamClaims();
      seasonStatus.textContent = "Claimed " + team.displayName + ".";
    };

    const openRoom = async () => {
      roomStatus.textContent = "Opening room...";
      await refreshRoom();
      roomStatus.textContent = "Room opened.";
      connectRoomUpdates();
    };

    const createRoom = async () => {
      roomStatus.textContent = "Creating room...";
      try {
        const body = await readJson(await fetch("/live-rooms", jsonRequest("POST", {
          seasonId: selectedSeasonId(),
          roomId: selectedRoomId(),
          viewerPasswordHashRef: "browser-viewer",
          playerCatalog: playerCatalogFor(),
        })));
        renderRoom(body.room);
        roomStatus.textContent = "Room created.";
        connectRoomUpdates();
      } catch (error) {
        if (error.message.includes("already exists")) {
          await openRoom();
          return;
        }

        throw error;
      }
    };

    const startRoom = async () => {
      roomStatus.textContent = "Starting room...";
      const body = await readJson(await fetch(roomEndpoint("start"), jsonRequest("POST", {
        expectedRevision: currentRevision(),
        idempotencyKey: idempotencyKeyFor("start", "room"),
      })));
      renderRoom(body.room);
      connectRoomUpdates();
      roomStatus.textContent = "Room started.";
    };

    const logSale = async () => {
      const command = saleCommandInput.value.trim();
      if (command.length === 0) throw new Error("Sale command is required.");

      roomStatus.textContent = "Logging sale...";
      const body = await readJson(await fetch(roomEndpoint("sales"), jsonRequest("POST", {
        expectedRevision: currentRevision(),
        idempotencyKey: idempotencyKeyFor("sale", command),
        command,
      })));
      renderRoom(body.room);
      connectRoomUpdates();
      roomStatus.textContent = "Sale logged.";
    };

    const undoSale = async () => {
      roomStatus.textContent = "Undoing sale...";
      const body = await readJson(await fetch(roomEndpoint("undo"), jsonRequest("POST", {
        expectedRevision: currentRevision(),
        idempotencyKey: idempotencyKeyFor("undo", "latest"),
      })));
      renderRoom(body.room);
      connectRoomUpdates();
      roomStatus.textContent = "Sale undone.";
    };

    const endRoom = async () => {
      roomStatus.textContent = "Ending room...";
      const body = await readJson(await fetch(roomEndpoint("end"), jsonRequest("POST", {
        expectedRevision: currentRevision(),
        idempotencyKey: idempotencyKeyFor("end", "room"),
      })));
      renderRoom(body.room);
      connectRoomUpdates();
      roomStatus.textContent = "Room ended.";
    };

    const renderArtifact = body => {
      const artifact = body.artifact || {};
      const content = body.content || "";
      if (state.artifactUrl !== null) URL.revokeObjectURL(state.artifactUrl);
      state.artifactUrl = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
      artifactDownloadLink.href = state.artifactUrl;
      artifactDownloadLink.download = artifact.storageKey?.split("/").pop() || "mockd-draft-export.csv";
      artifactDownloadLink.classList.remove("hidden");
      artifactStatus.textContent = "Created " + (artifact.id || "CSV artifact") + ".";
      artifactPreview.textContent = content;
    };

    const createExportArtifact = async () => {
      artifactStatus.textContent = "Creating artifact...";
      const body = await readJson(await fetch(roomEndpoint("export-artifacts"), jsonRequest("POST", {
        exportedAt: new Date().toISOString(),
      })));
      renderArtifact(body);
    };

    const setSignedIn = account => {
      state.account = account;
      authPanel.classList.add("hidden");
      appShell.classList.remove("hidden");
      logoutButton.classList.remove("hidden");
      sessionLabel.textContent = account.email;
      syncLocalDemoButtons();
      loadSeason().then(() => {
        return openRoom().catch(error => {
          roomStatus.textContent = error.message;
        });
      }).then(() => {
        focusCurrentRoute();
      }).catch(error => {
        const message = friendlySeasonError(error);
        renderSeason(null);
        seasonStatus.textContent = message;
        localMemberNotice.textContent = message;
        localMemberNotice.classList.toggle("hidden", !isLoopbackHost());
      });
    };

    const setSignedOut = () => {
      state.account = null;
      state.season = null;
      state.membership = null;
      state.room = null;
      stopRoomUpdates();
      authPanel.classList.remove("hidden");
      appShell.classList.add("hidden");
      logoutButton.classList.add("hidden");
      sessionLabel.textContent = "Signed out";
      syncLocalDemoButtons();
      renderSeason(null);
      renderRoomReadModel({ status: "Not opened", revision: undefined, salesLog: [], board: [], teamSummaries: [] });
      replaceListItems(roomEvents, [], "No room events.", value => value);
      clearArtifact();
    };

    const setupEndpoint = action => {
      const seasonId = setupSeasonIdInput.value.trim();
      if (seasonId.length === 0) throw new Error("Season id is required.");

      return "/seasons/" + encodeURIComponent(seasonId) + (
        action === "preview" ? setupPreviewSuffix : setupApplySuffix
      );
    };

    const renderSetupResult = body => {
      const setupImport = body.import || {};
      const blockers = setupImport.blockers || [];
      const pendingInvites = body.pendingInvites || [];
      setupApplyButton.disabled = setupImport.status !== "ready";
      setupStatus.textContent = body.season
        ? "Setup applied."
        : setupImport.status === "ready"
          ? "Ready to apply."
          : blockers.length + " blockers";
      replaceListItems(
        setupBlockers,
        blockers,
        "No blockers.",
        blocker => blocker.message || blocker.code || "Blocked row."
      );
      replaceListItems(
        setupPendingInvites,
        pendingInvites,
        "No pending invites.",
        invite => invite.email + " - " + invite.ownerDisplayName + " - " + invite.role
      );
      if (body.season) {
        renderSeason(body.season);
        state.membership = (body.memberships || []).find(membership => membership.userId === state.account?.id) || null;
        renderTeamClaims();
      }
    };

    const submitSetupImport = async action => {
      setupStatus.textContent = action === "preview" ? "Previewing..." : "Applying...";
      const body = await readSetupJson(await fetch(setupEndpoint(action), {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ content: setupRowsInput.value }),
      }));
      renderSetupResult(body);
    };

    const loginWithCredentials = async (email, password) => {
      authError.textContent = "";
      const body = await readJson(await fetch("/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email,
          password,
        }),
      }));
      setSignedIn(body.account);
    };

    const signIn = async () => {
      await loginWithCredentials(emailInput.value, passwordInput.value);
    };

    const useLocalDemo = async () => {
      await fetch("/session", { method: "DELETE" }).catch(() => undefined);
      emailInput.value = localDemoEmail;
      passwordInput.value = localDemoPassword;
      await loginWithCredentials(localDemoEmail, localDemoPassword);
    };

    authForm.addEventListener("submit", event => {
      event.preventDefault();
      signIn().catch(error => { authError.textContent = error.message; });
    });

    createAccountButton.addEventListener("click", () => {
      authError.textContent = "";
      fetch("/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value,
        }),
      })
        .then(response => readJson(response))
        .then(() => signIn())
        .catch(error => { authError.textContent = error.message; });
    });

    localDemoButton.addEventListener("click", () => {
      useLocalDemo().catch(error => { authError.textContent = error.message; });
    });

    localDemoTopbarButton.addEventListener("click", () => {
      useLocalDemo().catch(error => {
        seasonStatus.textContent = error.message;
      });
    });

    logoutButton.addEventListener("click", () => {
      fetch("/session", { method: "DELETE" })
        .finally(setSignedOut);
    });

    openLeagueSectionButton.addEventListener("click", () => {
      scrollToSection(leagueSection);
    });

    draftRoomLink.addEventListener("click", () => {
      scrollToSection(draftRoomSection);
      if (state.room === null) {
        const openAfterSeason = state.season === null
          ? loadSeason()
          : Promise.resolve(state.season);
        openAfterSeason
          .then(() => openRoom())
          .catch(error => { roomStatus.textContent = friendlySeasonError(error); });
      }
    });

    openSetupSectionButton.addEventListener("click", () => {
      scrollToSection(setupSeasonIdInput);
      setupSeasonIdInput.focus();
    });

    loadSeasonButton.addEventListener("click", () => {
      loadSeason().catch(error => {
        renderSeason(null);
        const message = friendlySeasonError(error);
        seasonStatus.textContent = message;
        localMemberNotice.textContent = message;
        localMemberNotice.classList.toggle("hidden", !isLoopbackHost());
      });
    });

    openRoomButton.addEventListener("click", () => {
      openRoom().catch(error => { roomStatus.textContent = error.message; });
    });

    createRoomButton.addEventListener("click", () => {
      createRoom().catch(error => { roomStatus.textContent = error.message; });
    });

    startRoomButton.addEventListener("click", () => {
      startRoom().catch(error => { roomStatus.textContent = error.message; });
    });

    saleForm.addEventListener("submit", event => {
      event.preventDefault();
      logSale().catch(error => { roomStatus.textContent = error.message; });
    });

    undoSaleButton.addEventListener("click", () => {
      undoSale().catch(error => { roomStatus.textContent = error.message; });
    });

    endRoomButton.addEventListener("click", () => {
      endRoom().catch(error => { roomStatus.textContent = error.message; });
    });

    createExportArtifactButton.addEventListener("click", () => {
      createExportArtifact().catch(error => { artifactStatus.textContent = error.message; });
    });

    setupPreviewButton.addEventListener("click", () => {
      submitSetupImport("preview").catch(error => {
        setupStatus.textContent = error.message;
        setupApplyButton.disabled = true;
      });
    });

    setupApplyButton.addEventListener("click", () => {
      submitSetupImport("apply").catch(error => {
        setupStatus.textContent = error.message;
      });
    });

    seasonIdInput.value = initialSeasonId;
    setupSeasonIdInput.value = initialSeasonId;
    roomIdInput.value = initialRoomId || defaultRoomIdFor(initialSeasonId);
    playerCatalogInput.value = JSON.stringify(defaultPlayerCatalog, null, 2);
    saleCommandInput.value = "cam puka 62";
    syncLocalDemoButtons();
    renderPlayerCatalog();
    renderSeason(null);
    renderRoomReadModel({ status: "Not opened", revision: undefined, salesLog: [], board: [], teamSummaries: [] });
    replaceListItems(roomEvents, [], "No room events.", value => value);

    fetch("/session", { credentials: "same-origin" })
      .then(response => response.ok ? response.json() : null)
      .then(body => {
        if (body?.account) setSignedIn(body.account);
        else setSignedOut();
      })
      .catch(() => setSignedOut());

    void currentSessionRequest;
  </script>
</body>
</html>`;
