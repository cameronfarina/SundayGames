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

    button, input, textarea {
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
      grid-template-columns: minmax(240px, 420px);
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
      justify-content: space-between;
      min-height: 56px;
      padding: 0 14px;
      text-decoration: none;
    }

    .section-link[data-active="true"] {
      border-color: var(--line-hot);
      color: #f5c4ff;
    }

    .setup-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: minmax(280px, 460px) minmax(280px, 1fr);
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

    @media (max-width: 920px) {
      .page { padding: 18px; }
      .grid, .cards, .setup-grid { grid-template-columns: 1fr; }
      .topbar { align-items: flex-start; flex-direction: column; }
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
      <div class="row">
        <span id="session-label" class="muted">Signed out</span>
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
        <div class="row">
          <button id="signin-button" class="btn primary" type="submit">Sign in</button>
          <button id="create-account-button" class="btn" type="button">Create account</button>
        </div>
        <div id="auth-error" class="error" role="alert"></div>
      </form>
    </section>

    <section id="app-shell" class="hidden stack">
      <div class="cards">
        <article class="panel hot">
          <h2>Live draft room</h2>
          <a class="section-link" data-active="true" href="/draft-room">Open draft room <span>></span></a>
        </article>
        <article class="panel">
          <h2>Commissioner setup</h2>
          <a class="section-link" href="/setup">Open setup <span>></span></a>
        </article>
      </div>
      <div class="setup-grid">
        <form id="setup-form" class="panel stack">
          <h2>Commissioner setup</h2>
          <label for="setup-season-id-input">Season id</label>
          <input id="setup-season-id-input" autocomplete="off" name="seasonId">
          <label for="setup-rows-input">Owner rows</label>
          <textarea id="setup-rows-input" name="setupRows" spellcheck="false">owner,team,email,role
Cam,Cam,cam@example.com,owner</textarea>
          <div class="row">
            <button id="setup-preview-button" class="btn" type="button">Preview</button>
            <button id="setup-apply-button" class="btn green" type="button" disabled>Apply</button>
          </div>
          <div id="setup-status" class="muted"></div>
        </form>
        <article class="panel stack">
          <h3>Blockers</h3>
          <ul id="setup-blockers" class="result-list"></ul>
          <h3>pending invites</h3>
          <ul id="setup-pending-invites" class="result-list"></ul>
        </article>
      </div>
    </section>
  </main>

  <script type="module">
    const currentSessionRequest = "GET /session";
    const authPanel = document.getElementById("auth-panel");
    const appShell = document.getElementById("app-shell");
    const sessionLabel = document.getElementById("session-label");
    const logoutButton = document.getElementById("logout-button");
    const authForm = document.getElementById("auth-form");
    const authError = document.getElementById("auth-error");
    const emailInput = document.getElementById("email-input");
    const passwordInput = document.getElementById("password-input");
    const createAccountButton = document.getElementById("create-account-button");
    const setupSeasonIdInput = document.getElementById("setup-season-id-input");
    const setupRowsInput = document.getElementById("setup-rows-input");
    const setupPreviewButton = document.getElementById("setup-preview-button");
    const setupApplyButton = document.getElementById("setup-apply-button");
    const setupStatus = document.getElementById("setup-status");
    const setupBlockers = document.getElementById("setup-blockers");
    const setupPendingInvites = document.getElementById("setup-pending-invites");
    const setupPreviewSuffix = "/setup-import/preview";
    const setupApplySuffix = "/setup-import/apply";

    const setSignedIn = account => {
      authPanel.classList.add("hidden");
      appShell.classList.remove("hidden");
      logoutButton.classList.remove("hidden");
      sessionLabel.textContent = account.email;
    };

    const setSignedOut = () => {
      authPanel.classList.remove("hidden");
      appShell.classList.add("hidden");
      logoutButton.classList.add("hidden");
      sessionLabel.textContent = "Signed out";
    };

    const readJson = async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Request failed.");
      return body;
    };

    const readSetupJson = async response => {
      const body = await response.json();
      if (!response.ok && !body.import) throw new Error(body.error?.message || "Request failed.");
      return body;
    };

    const replaceListItems = (list, items, emptyText, renderText) => {
      const values = items.length === 0 ? [emptyText] : items.map(renderText);
      list.replaceChildren(...values.map(value => {
        const item = document.createElement("li");
        item.textContent = value;
        return item;
      }));
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

    const signIn = async () => {
      authError.textContent = "";
      const body = await readJson(await fetch("/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: emailInput.value,
          password: passwordInput.value,
        }),
      }));
      setSignedIn(body.account);
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

    logoutButton.addEventListener("click", () => {
      fetch("/session", { method: "DELETE" })
        .finally(setSignedOut);
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
