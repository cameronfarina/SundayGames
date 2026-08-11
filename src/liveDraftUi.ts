import { leagueConfig } from "../config/league.js";

const rosterMaximumsJson = JSON.stringify(leagueConfig.rosterMaximums);

export const liveDraftHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mockd Draft Room</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #02070d;
      --sidebar: #06101a;
      --workspace: #040b13;
      --surface: #06131f;
      --surface-2: #0a1a2a;
      --surface-3: #0d253b;
      --text: #edf6ff;
      --muted: #9bb8d3;
      --line: #1e5f8e;
      --line-soft: #174b72;
      --accent: #5ba8ff;
      --accent-strong: #2388ff;
      --green: #19e49c;
      --amber: #ffb638;
      --danger: #ff6b78;
      --purple: #ad8cff;
      --pos-rb: #5ba8ff;
      --pos-wr: #ad8cff;
      --pos-te: #19e49c;
      --pos-qb: #ff8845;
      --pos-k: #ffd84d;
      --pos-dst: #ff5470;
      --pos-flex: #20dff4;
      --shadow: 0 12px 28px rgba(0, 0, 0, 0.42);
      --nav-rail-width: 356px;
      --global-menu-width: 260px;
      --global-menu-height: 72px;
    }

    * {
      box-sizing: border-box;
    }

    [hidden] {
      display: none !important;
    }

    .position-rb {
      --position-accent: var(--pos-rb);
      --position-accent-soft: rgba(91, 168, 255, 0.16);
      --position-accent-line: rgba(91, 168, 255, 0.68);
      --position-row-bg: rgba(91, 168, 255, 0.1);
      --position-row-hover-bg: rgba(91, 168, 255, 0.15);
      --position-row-selected-bg: rgba(91, 168, 255, 0.18);
      --position-sticky-bg: #0a2034;
      --position-sticky-hover-bg: #0c2943;
      --position-sticky-selected-bg: #0d3150;
    }

    .position-wr {
      --position-accent: var(--pos-wr);
      --position-accent-soft: rgba(173, 140, 255, 0.16);
      --position-accent-line: rgba(173, 140, 255, 0.68);
      --position-row-bg: rgba(173, 140, 255, 0.1);
      --position-row-hover-bg: rgba(173, 140, 255, 0.15);
      --position-row-selected-bg: rgba(173, 140, 255, 0.18);
      --position-sticky-bg: #171b32;
      --position-sticky-hover-bg: #211f46;
      --position-sticky-selected-bg: #282556;
    }

    .position-te {
      --position-accent: var(--pos-te);
      --position-accent-soft: rgba(25, 228, 156, 0.14);
      --position-accent-line: rgba(25, 228, 156, 0.62);
      --position-row-bg: rgba(25, 228, 156, 0.09);
      --position-row-hover-bg: rgba(25, 228, 156, 0.14);
      --position-row-selected-bg: rgba(25, 228, 156, 0.17);
      --position-sticky-bg: #08271f;
      --position-sticky-hover-bg: #0a3328;
      --position-sticky-selected-bg: #0b4031;
    }

    .position-qb {
      --position-accent: var(--pos-qb);
      --position-accent-soft: rgba(255, 136, 69, 0.14);
      --position-accent-line: rgba(255, 136, 69, 0.62);
      --position-row-bg: rgba(255, 136, 69, 0.09);
      --position-row-hover-bg: rgba(255, 136, 69, 0.14);
      --position-row-selected-bg: rgba(255, 136, 69, 0.17);
      --position-sticky-bg: #2a180e;
      --position-sticky-hover-bg: #39200f;
      --position-sticky-selected-bg: #472811;
    }

    .position-k {
      --position-accent: var(--pos-k);
      --position-accent-soft: rgba(255, 216, 77, 0.13);
      --position-accent-line: rgba(255, 216, 77, 0.58);
      --position-row-bg: rgba(255, 216, 77, 0.08);
      --position-row-hover-bg: rgba(255, 216, 77, 0.13);
      --position-row-selected-bg: rgba(255, 216, 77, 0.16);
      --position-sticky-bg: #241f0b;
      --position-sticky-hover-bg: #332d0f;
      --position-sticky-selected-bg: #403712;
    }

    .position-dst {
      --position-accent: var(--pos-dst);
      --position-accent-soft: rgba(255, 84, 112, 0.14);
      --position-accent-line: rgba(255, 84, 112, 0.62);
      --position-row-bg: rgba(255, 84, 112, 0.09);
      --position-row-hover-bg: rgba(255, 84, 112, 0.14);
      --position-row-selected-bg: rgba(255, 84, 112, 0.17);
      --position-sticky-bg: #2a1018;
      --position-sticky-hover-bg: #3a1521;
      --position-sticky-selected-bg: #481a29;
    }

    .position-flex {
      --position-accent: var(--pos-flex);
      --position-accent-soft: rgba(32, 223, 244, 0.14);
      --position-accent-line: rgba(32, 223, 244, 0.62);
      --position-row-bg: rgba(32, 223, 244, 0.09);
      --position-row-hover-bg: rgba(32, 223, 244, 0.14);
      --position-row-selected-bg: rgba(32, 223, 244, 0.17);
      --position-sticky-bg: #082830;
      --position-sticky-hover-bg: #0a3540;
      --position-sticky-selected-bg: #0c414d;
    }

    html {
      min-width: 100vw;
      min-height: 100%;
      background: var(--bg);
    }

    body {
      margin: 0;
      min-width: 100vw;
      min-height: 100vh;
      overflow-x: hidden;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
    }

    button, input, select {
      font: inherit;
    }

    button {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #071827;
      color: var(--text);
      cursor: pointer;
      transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
    }

    button:hover:not(:disabled) {
      border-color: rgba(91, 168, 255, 0.9);
      background: #0d253b;
      color: #f4f8fc;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.58;
    }

    button.primary {
      border-color: rgba(91, 168, 255, 0.92);
      background: var(--accent);
      color: #06101a;
      font-weight: 750;
    }

    button.primary:hover:not(:disabled) {
      color: #f4f8fc;
    }

    button.primary:disabled {
      color: #b9cbe0;
    }

    button.danger {
      border-color: rgba(255, 113, 106, 0.62);
      background: rgba(255, 113, 106, 0.14);
      color: #ffd7d4;
      font-weight: 750;
    }

    button.danger:hover:not(:disabled) {
      border-color: rgba(255, 113, 106, 0.86);
      background: rgba(255, 113, 106, 0.24);
    }

    button.icon {
      display: inline-grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border-color: rgba(31, 207, 143, 0.74);
      color: var(--green);
      background: rgba(31, 207, 143, 0.08);
      font-weight: 750;
      line-height: 1;
    }

    button.star-button {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border-color: rgba(91, 168, 255, 0.52);
      background: rgba(91, 168, 255, 0.1);
      color: #8fbdf1;
      font-size: 14px;
      line-height: 1;
    }

    button.star-button[aria-pressed="true"] {
      border-color: rgba(242, 169, 59, 0.72);
      background: rgba(242, 169, 59, 0.14);
      color: var(--amber);
    }

    .target-action {
      position: relative;
      display: inline-grid;
      place-items: center;
    }

    button.target-action-trigger[aria-expanded="true"] {
      border-color: rgba(31, 207, 143, 0.9);
      background: rgba(31, 207, 143, 0.16);
      color: #7af0bd;
    }

    .target-action-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      z-index: 40;
      display: grid;
      gap: 2px;
      width: max-content;
      min-width: 142px;
      padding: 5px;
      border: 1px solid var(--line);
      border-radius: 7px;
      background: #07131f;
      box-shadow: var(--shadow);
    }

    .target-action-menu[hidden] {
      display: none;
    }

    .target-action-menu button {
      width: 100%;
      min-height: 30px;
      padding: 0 9px;
      border: 0;
      background: transparent;
      color: #b9cbe0;
      text-align: left;
      white-space: nowrap;
    }

    .target-action-menu button:hover:not(:disabled) {
      background: rgba(91, 168, 255, 0.16);
      color: #f4f8fc;
    }

    .target-action-menu button.target-action-primary {
      color: #7af0bd;
    }

    input, select {
      height: 34px;
      min-width: 0;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 9px;
      background-color: rgba(5, 11, 18, 0.7);
      color: var(--text);
      outline: 0;
    }

    input::placeholder {
      color: #62809e;
    }

    input:focus, select:focus {
      border-color: rgba(91, 168, 255, 0.92);
      box-shadow: 0 0 0 3px rgba(91, 168, 255, 0.14);
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 34px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%237f9ab5' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 16px 16px;
    }

    .app {
      display: grid;
      grid-template-columns: var(--nav-rail-width) minmax(0, 1fr);
      grid-template-rows: var(--global-menu-height) minmax(0, 1fr);
      height: 100vh;
      min-height: 100vh;
      overflow: hidden;
      background: var(--bg);
    }

    .app.draft-active {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }

    .app.draft-active .sidebar {
      display: none;
    }

    .app.draft-active .workspace {
      grid-column: 1;
    }

    .app.platform-prep {
      grid-template-columns: minmax(0, 1fr);
    }

    .app.platform-prep .sidebar {
      display: none;
    }

    .app.platform-prep .workspace {
      grid-column: 1;
    }

    .global-app-menu {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 100;
      display: grid;
      gap: 0;
      width: var(--global-menu-width);
      height: var(--global-menu-height);
      min-height: var(--global-menu-height);
      min-width: 0;
      padding: 16px 22px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--bg);
      box-shadow: none;
    }

    .global-brand-row {
      position: relative;
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      width: 100%;
      min-width: 0;
    }

    .global-app-menu .brand {
      padding: 0;
    }

    .global-app-menu .brand strong {
      font-size: 18px;
    }

    .global-app-menu .brand span {
      font-size: 11px;
      line-height: 1.1;
    }

    .app-header-menu-slot {
      position: relative;
      justify-self: start;
      width: 38px;
      height: 38px;
      min-width: 38px;
    }

    .app-header-menu-slot .global-app-menu {
      position: static;
      z-index: auto;
      width: auto;
      height: auto;
      min-height: 0;
      padding: 0;
      border-bottom: 0;
      background: transparent;
      box-shadow: none;
    }

    .app-header-menu-slot .global-brand-row {
      grid-template-columns: 38px;
      gap: 0;
    }

    .app-header-menu-slot .brand {
      display: none;
    }

    .app-header-menu-slot .app-menu-list {
      top: calc(100% + 10px);
      right: auto;
      width: var(--global-menu-width);
    }

    .sidebar {
      grid-column: 1;
      grid-row: 2;
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
      min-height: 0;
      min-width: 0;
      overflow-y: auto;
      padding: 18px 22px 20px;
      border-right: 1px solid var(--line);
      background: var(--sidebar);
    }

    .brand {
      display: grid;
      gap: 2px;
      padding: 2px 0 4px;
    }

    .brand strong {
      color: #f4f8fc;
      font-size: 20px;
      line-height: 1.1;
    }

    .brand span {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .workspace {
      grid-column: 2;
      grid-row: 2;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-width: 0;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .app-page-header {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto minmax(260px, 1fr);
      align-items: center;
      gap: 14px;
      min-width: 0;
      min-height: var(--global-menu-height);
      padding: 0 24px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.54);
    }

    .draft-header {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .draft-title-group {
      display: flex;
      align-items: center;
      justify-content: center;
      justify-self: center;
      gap: 12px;
      min-width: 0;
      text-align: center;
    }

    h1 {
      margin: 0;
      flex: 0 0 auto;
      color: #f4f8fc;
      font-size: 20px;
      line-height: 1.1;
      letter-spacing: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      justify-self: end;
      gap: 8px;
      width: 100%;
      min-width: 0;
    }

    .header-end-action {
      justify-self: end;
      white-space: nowrap;
    }

    .search {
      width: 100%;
      height: 36px;
      background-color: rgba(8, 24, 38, 0.84);
    }

    .header-search {
      width: min(34vw, 420px);
      min-width: 220px;
    }

    .quick-sale {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      min-width: 0;
    }

    .quick-sale input {
      height: 34px;
    }

    .quick-sale button {
      height: 34px;
      padding: 0 12px;
    }

    .header-sale-command {
      display: grid;
      grid-template-columns: minmax(280px, 440px) auto;
      gap: 8px;
      min-width: 360px;
    }

    .header-draft-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .header-draft-actions button {
      height: 34px;
      padding: 0 10px;
      white-space: nowrap;
    }

    .app.draft-active .draft-header {
      grid-template-columns: 48px minmax(0, 1fr) auto;
      grid-template-rows: auto auto;
      align-content: center;
      column-gap: 16px;
      row-gap: 10px;
      min-height: 108px;
      padding: 14px 18px 16px;
    }

    .app.draft-active .draft-title-group {
      grid-column: 2;
      grid-row: 1;
      max-width: min(100%, 680px);
    }

    .app.draft-active .room-mode-indicator {
      max-width: min(48vw, 430px);
    }

    .app.draft-active .room-mode-indicator span {
      min-width: 0;
      max-width: 330px;
    }

    .app.draft-active .header-actions {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: stretch;
      justify-content: flex-end;
      width: 100%;
      max-width: none;
    }

    .app.draft-active .header-search {
      flex: 1 1 420px;
      width: auto;
      min-width: 260px;
      max-width: 640px;
    }

    .app.draft-active .header-sale-command {
      flex: 1 1 420px;
      min-width: 320px;
      max-width: 560px;
    }

    .app.draft-active .header-end-action {
      grid-column: 3;
      grid-row: 1;
      align-self: center;
    }

    .top-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      align-items: center;
    }

    .top-actions button {
      height: 34px;
      padding: 0 11px;
      color: #b9cbe0;
    }

    .session-picker {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 7px;
      align-items: center;
    }

    .session-picker select,
    .session-picker input {
      width: 100%;
      height: 32px;
    }

    .session-picker select,
    .active-session-label {
      grid-column: 1 / -1;
    }

    .session-picker button {
      height: 32px;
      padding: 0 10px;
      white-space: nowrap;
    }

    .active-session-label {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-tools {
      --section-accent: var(--amber);
      padding: 0;
      overflow: hidden;
    }

    .session-tools-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-width: 0;
      padding: 12px;
      cursor: pointer;
      list-style: none;
    }

    .session-tools-summary::-webkit-details-marker {
      display: none;
    }

    .session-tools-summary::after {
      content: "";
      flex: 0 0 auto;
      width: 9px;
      height: 9px;
      border-right: 2px solid var(--muted);
      border-bottom: 2px solid var(--muted);
      transform: rotate(45deg) translateY(-2px);
      transition: transform 140ms ease;
    }

    .session-tools[open] .session-tools-summary::after {
      transform: rotate(225deg) translateY(-2px);
    }

    .session-tools-summary .section-label {
      min-width: 0;
    }

    .session-summary-label {
      min-width: 0;
      overflow: hidden;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .session-tools-body {
      display: grid;
      gap: 10px;
      min-width: 0;
      padding: 0 12px 12px;
    }

    .app-menu-trigger {
      display: inline-grid;
      place-items: center;
      width: 38px;
      height: 38px;
      padding: 0;
      color: #d9e7f5;
      font-weight: 750;
    }

    .app-menu-icon {
      display: grid;
      gap: 3px;
      width: 17px;
      flex: 0 0 auto;
    }

    .app-menu-icon span {
      display: block;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
    }

    .app-menu-list {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      z-index: 20;
      display: grid;
      gap: 4px;
      min-width: 0;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #07131f;
      box-shadow: var(--shadow);
    }

    .app-menu-list[hidden] {
      display: none;
    }

    .app-menu-item {
      display: grid;
      gap: 2px;
      width: 100%;
      min-height: 48px;
      padding: 8px 9px;
      color: #b9cbe0;
      text-align: left;
    }

    .app-menu-item strong,
    .app-menu-item span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .app-menu-item strong {
      color: #f4f8fc;
      font-size: 13px;
      line-height: 1.15;
    }

    .app-menu-item span {
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.2;
    }

    .app-menu-item[aria-current="page"] {
      border-color: rgba(91, 168, 255, 0.86);
      background: rgba(91, 168, 255, 0.2);
    }

    .mock-batch-control {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      gap: 7px;
    }

    .mock-batch-control input {
      text-align: right;
    }

    #mock-batch-script {
      grid-column: 1 / -1;
      text-align: left;
    }

    #run-mock-batch-button {
      --mock-progress: 0%;
      min-width: 0;
      min-height: 34px;
      background:
        linear-gradient(90deg, rgba(91, 168, 255, 0.78) var(--mock-progress), transparent var(--mock-progress)),
        rgba(12, 32, 51, 0.9);
      color: #d9e7f5;
      font-weight: 750;
    }

    #run-mock-batch-button.mock-batch-running:disabled {
      opacity: 1;
    }

    #run-mock-batch-button.mock-batch-ready {
      border-color: rgba(31, 207, 143, 0.72);
      background:
        linear-gradient(90deg, rgba(25, 228, 156, 0.86) var(--mock-progress), transparent var(--mock-progress)),
        rgba(12, 32, 51, 0.9);
      color: #eafff7;
    }

    #see-mock-results-button {
      min-height: 34px;
      border-color: rgba(31, 207, 143, 0.58);
      color: #7af0bd;
      font-weight: 750;
    }

    .draft-mode-choice {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      min-width: 0;
    }

    .draft-mode-choice button {
      display: grid;
      gap: 2px;
      min-width: 0;
      min-height: 54px;
      padding: 8px 9px;
      color: #b9cbe0;
      text-align: left;
    }

    .draft-mode-choice button strong,
    .draft-mode-choice button span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .draft-mode-choice button strong {
      color: #f4f8fc;
      font-size: 13px;
      line-height: 1.15;
    }

    .draft-mode-choice button span {
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.2;
    }

    .draft-mode-choice button[aria-pressed="true"] {
      border-color: rgba(91, 168, 255, 0.92);
      background: rgba(91, 168, 255, 0.22);
    }

    .mode-status {
      display: grid;
      gap: 2px;
      min-height: 54px;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.34);
    }

    .mode-status strong {
      color: #f4f8fc;
      line-height: 1.15;
    }

    .mode-status span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .start-draft-button {
      width: 100%;
      min-height: 36px;
    }

    .draft-countdown {
      display: grid;
      place-items: center;
      min-height: 54px;
      border: 1px solid rgba(242, 169, 59, 0.48);
      border-radius: 6px;
      background: rgba(242, 169, 59, 0.1);
      color: #ffd38a;
      font-size: 26px;
      font-weight: 850;
      font-variant-numeric: tabular-nums;
    }

    .file-input {
      display: none;
    }

    .sidebar-section {
      position: relative;
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px;
      border: 1px solid rgba(21, 50, 77, 0.82);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.68);
    }

    .sidebar-section::before {
      content: "";
      position: absolute;
      top: 12px;
      bottom: 12px;
      left: -1px;
      width: 2px;
      border-radius: 999px;
      background: var(--section-accent, var(--accent));
      opacity: 0.76;
    }

    .sidebar-section:nth-of-type(1) {
      --section-accent: var(--accent);
    }

    .sidebar-section:nth-of-type(2) {
      --section-accent: var(--purple);
    }

    .sidebar-section:nth-of-type(3) {
      --section-accent: var(--green);
    }

    .sidebar-section:nth-of-type(4) {
      --section-accent: var(--amber);
    }

    .sidebar-section .section-label {
      padding: 0;
    }

    .draft-start-banner {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 58px;
      padding: 12px 24px;
      border-bottom: 1px solid rgba(242, 169, 59, 0.36);
      background: rgba(242, 169, 59, 0.1);
      color: #ffd38a;
      font-size: 14px;
      font-weight: 750;
    }

    .draft-start-banner strong {
      color: #fff3d8;
      font-size: 30px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, 430px);
      gap: 16px;
      min-width: 0;
      height: 100%;
      min-height: 0;
      padding: 16px 24px 22px;
      align-items: stretch;
    }

    .app.draft-active main {
      grid-template-columns: minmax(0, 1fr) clamp(340px, 24vw, 410px);
      gap: 14px;
      padding-right: 16px;
      padding-left: 16px;
    }

    section, aside {
      min-width: 0;
      height: 100%;
      min-height: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #06131f;
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .board-panel {
      background: #06131f;
    }

    .decision-panel {
      background: #06131f;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 48px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: #02070d;
    }

    h2 {
      margin: 0;
      font-size: 13px;
      line-height: 1.2;
      letter-spacing: 0;
      text-transform: uppercase;
      color: #b9cbe0;
    }

    .board-count {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .board-toolbar {
      display: grid;
      grid-template-columns: auto minmax(130px, 160px) minmax(112px, 130px) minmax(132px, 160px) minmax(160px, 190px);
      gap: 8px;
      align-items: center;
      justify-content: end;
      overflow-x: auto;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      background: #06101a;
    }

    .segmented {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
      min-width: 0;
    }

    .filter-chip {
      --chip-accent: var(--accent);
      --chip-wash: rgba(91, 168, 255, 0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 28px;
      padding: 0 9px;
      border-color: var(--line);
      color: var(--muted);
      background: rgba(5, 11, 18, 0.45);
      font-size: 12px;
      font-weight: 650;
    }

    .filter-chip[data-position-filter="RB"] {
      --chip-accent: var(--pos-rb);
      --chip-wash: rgba(91, 168, 255, 0.2);
    }

    .filter-chip[data-position-filter="WR"] {
      --chip-accent: var(--pos-wr);
      --chip-wash: rgba(167, 139, 250, 0.16);
    }

    .filter-chip[data-position-filter="TE"] {
      --chip-accent: var(--pos-te);
      --chip-wash: rgba(31, 207, 143, 0.16);
    }

    .filter-chip[data-position-filter="QB"] {
      --chip-accent: var(--pos-qb);
      --chip-wash: rgba(255, 138, 76, 0.15);
    }

    .filter-chip[data-position-filter="K"] {
      --chip-accent: var(--pos-k);
      --chip-wash: rgba(248, 216, 102, 0.14);
    }

    .filter-chip[data-position-filter="DST"] {
      --chip-accent: var(--pos-dst);
      --chip-wash: rgba(255, 92, 122, 0.14);
    }

    .filter-chip[data-position-filter="FLEX"] {
      --chip-accent: var(--pos-flex);
      --chip-wash: rgba(34, 211, 238, 0.14);
    }

    .filter-chip:not([data-position-filter="ALL"])::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--chip-accent);
    }

    .filter-chip[aria-pressed="true"] {
      border-color: var(--chip-accent);
      background: var(--chip-wash);
      color: #e7f2ff;
    }

    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 28px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    .toggle input {
      width: 14px;
      height: 14px;
      margin: 0;
      accent-color: var(--accent);
    }

    .board-toolbar select {
      width: 100%;
      height: 30px;
      font-size: 12px;
    }

    .board-search-row {
      display: grid;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: #02070d;
    }

    .board-search-input {
      width: min(520px, 100%);
      height: 34px;
      background-color: #07131f;
    }

    .market-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: #02070d;
    }

    .market-pill {
      display: inline-flex;
      gap: 5px;
      align-items: baseline;
      padding: 4px 8px;
      border: 1px solid var(--position-accent-line, rgba(91, 168, 255, 0.68));
      border-radius: 6px;
      background: #06101a;
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    button.market-pill {
      cursor: pointer;
    }

    button.market-pill:hover:not(:disabled) {
      border-color: var(--position-accent, var(--accent));
      background: var(--position-accent-soft, rgba(91, 168, 255, 0.16));
      color: #f4f8fc;
    }

    .market-pill[aria-pressed="true"] {
      border-color: var(--position-accent, var(--accent));
      background: var(--position-accent-soft, rgba(91, 168, 255, 0.16));
      color: #e7f2ff;
    }

    .market-pill::before {
      content: "";
      align-self: center;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: var(--position-accent, var(--accent));
    }

    .market-pill strong {
      color: #f4f8fc;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
    }

    .mock-auction-feed {
      display: grid;
      gap: 8px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: #02070d;
    }

    .mock-auction-feed[hidden] {
      display: none;
    }

    .mock-auction-nomination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 10px;
      border: 1px solid rgba(91, 168, 255, 0.86);
      border-radius: 6px;
      background: #0a2034;
    }

    .mock-auction-nomination strong {
      color: #f4f8fc;
      font-size: 13px;
      line-height: 1.2;
    }

    .mock-auction-phase {
      color: #a9c4df;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .mock-auction-feed-lines {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 1px;
    }

    .mock-feed-line {
      flex: 0 0 auto;
      padding: 5px 7px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #06131f;
      color: #c4daf0;
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
    }

    .mock-feed-line.nomination {
      color: #d9e7f5;
    }

    .mock-feed-line.bid {
      color: #cfe4fb;
    }

    .mock-feed-line.countdown {
      min-width: 26px;
      text-align: center;
      color: var(--amber);
    }

    .mock-feed-line.sold {
      border-color: rgba(25, 228, 156, 0.78);
      color: #77ffd0;
      background: rgba(25, 228, 156, 0.12);
    }

    .scroll {
      overflow: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      max-height: calc(100vh - 236px);
    }

    .scroll::-webkit-scrollbar {
      width: 0;
      height: 0;
    }

    .board-cards {
      display: none;
      padding: 8px;
    }

    .target-card {
      display: grid;
      grid-template-columns: 36px minmax(0, 1fr);
      gap: 8px;
      padding: 10px 0;
      border-bottom: 1px solid var(--line-soft);
    }

    .target-card[class*="position-"] {
      padding-left: 8px;
      border-radius: 6px;
      background: rgba(8, 24, 38, 0.72);
      box-shadow: inset 3px 0 0 var(--position-accent, var(--accent));
    }

    .target-card:last-child {
      border-bottom: 0;
    }

    .target-card.is-nominated {
      margin: 0 -8px;
      padding-inline: 8px;
      border-radius: 6px;
      background: rgba(31, 207, 143, 0.07);
      outline: 1px solid rgba(31, 207, 143, 0.48);
      outline-offset: -1px;
    }

    .target-card-body {
      min-width: 0;
    }

    .target-card-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .target-card-meta {
      color: var(--position-accent, var(--muted));
      font-size: 12px;
      line-height: 1.25;
      white-space: nowrap;
    }

    .target-card-values {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 6px;
      margin-top: 8px;
    }

    .target-card-value {
      min-width: 0;
      padding: 6px 7px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #02070d;
    }

    .target-card-value span {
      display: block;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.1;
    }

    .room-mode-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #06131f;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
    }

    .room-mode-indicator strong {
      color: var(--text);
      white-space: nowrap;
    }

    .room-mode-indicator span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .room-mode-indicator.mock {
      border-color: rgba(91, 168, 255, 0.86);
      background: #0a2034;
    }

    .room-mode-indicator.real {
      border-color: rgba(25, 228, 156, 0.74);
      background: rgba(25, 228, 156, 0.1);
    }

    .target-card-value strong {
      display: block;
      margin-top: 2px;
      font-size: 15px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .board-table {
      width: max-content;
      min-width: 990px;
    }

    .board-table th:first-child,
    .board-table td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      background: #081826;
    }

    .board-table th:nth-child(2),
    .board-table td:nth-child(2) {
      position: sticky;
      left: 42px;
      z-index: 2;
      background: #081826;
      box-shadow: 12px 0 18px rgba(0, 0, 0, 0.18);
    }

    .board-table th:first-child,
    .board-table th:nth-child(2) {
      z-index: 4;
      background: #07131f;
    }

    .board-table tbody tr:hover > td:first-child,
    .board-table tbody tr:hover > td:nth-child(2) {
      background: #0b1c2d;
    }

    .board-table tbody tr.is-selected > td:first-child,
    .board-table tbody tr.is-selected > td:nth-child(2) {
      background: #0b2137;
    }

    .board-table tbody tr.keeper-row > td:first-child,
    .board-table tbody tr.keeper-row > td:nth-child(2) {
      background: #0a1825;
    }

    .board-table tbody tr.target-action-row-open {
      position: relative;
      z-index: 18;
    }

    .board-table tbody tr.target-action-row-open > td:first-child,
    .board-table tbody tr.target-action-row-open > td.target-action-cell-open {
      z-index: 30;
      overflow: visible;
    }

    .board-table tbody tr.target-action-row-open .target-action-menu {
      z-index: 60;
    }

    .board-table tbody tr[class*="position-"] td:first-child {
      box-shadow: inset 3px 0 0 var(--position-accent);
    }

    .board-table tbody td.add-cell {
      padding-top: 8px;
      vertical-align: top;
    }

    .board-table tbody tr[class*="position-"] {
      background: var(--position-row-bg, rgba(91, 168, 255, 0.08));
    }

    .board-table tbody tr[class*="position-"] > td {
      border-bottom-color: var(--position-accent-line, var(--line));
    }

    .board-table tbody tr[class*="position-"] > td:first-child,
    .board-table tbody tr[class*="position-"] > td:nth-child(2) {
      background: var(--position-sticky-bg, #081826);
    }

    .board-table tbody tr[class*="position-"] td:nth-child(3) {
      color: var(--position-accent);
      font-weight: 850;
    }

    .board-table tbody tr[class*="position-"]:hover {
      background: var(--position-row-hover-bg, rgba(91, 168, 255, 0.12));
    }

    .board-table tbody tr[class*="position-"]:hover > td:first-child,
    .board-table tbody tr[class*="position-"]:hover > td:nth-child(2) {
      background: var(--position-sticky-hover-bg, #0b1c2d);
    }

    .board-table tbody tr[class*="position-"].is-selected {
      background: var(--position-row-selected-bg, rgba(91, 168, 255, 0.16));
    }

    .board-table tbody tr[class*="position-"].is-selected > td:first-child,
    .board-table tbody tr[class*="position-"].is-selected > td:nth-child(2) {
      background: var(--position-sticky-selected-bg, #0b2137);
    }

    .board-table tbody tr[class*="position-"].is-nominated {
      background: rgba(31, 207, 143, 0.1);
    }

    .board-table tbody tr[class*="position-"].is-nominated > td:first-child,
    .board-table tbody tr[class*="position-"].is-nominated > td:nth-child(2) {
      background: #08261f;
    }

    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: middle;
      overflow-wrap: normal;
    }

    th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #07131f;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }

    tbody tr:hover {
      background: rgba(91, 168, 255, 0.08);
    }

    tbody tr.is-selected {
      background: rgba(91, 168, 255, 0.14);
    }

    tbody tr.is-nominated {
      outline: 1px solid rgba(31, 207, 143, 0.5);
      outline-offset: -1px;
      background: rgba(31, 207, 143, 0.07);
    }

    tbody tr.keeper-row {
      opacity: 0.56;
      background: rgba(127, 154, 181, 0.045);
    }

    tbody tr.keeper-row:hover {
      background: rgba(127, 154, 181, 0.07);
    }

    td.money, th.money, td.center, th.center {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    td.center, th.center {
      text-align: center;
    }

    .player-name {
      color: #f4f8fc;
      font-weight: 700;
      line-height: 1.18;
      overflow-wrap: normal;
    }

    .player-title {
      display: flex;
      gap: 7px;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-width: 0;
    }

    .player-title .player-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-title .star-button {
      flex: 0 0 auto;
    }

    .market-price-cell {
      line-height: 1.12;
    }

    .market-price-stack {
      display: grid;
      gap: 1px;
      justify-items: end;
    }

    .market-price-detail {
      color: var(--muted);
      font-size: 10px;
      font-weight: 650;
    }

    .subtle {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .tag {
      display: inline-block;
      margin: 3px 4px 0 0;
      padding: 2px 5px;
      border-radius: 4px;
      background: rgba(91, 168, 255, 0.18);
      color: #a9d3ff;
      font-size: 11px;
      line-height: 1.2;
    }

    .tag.value {
      background: rgba(31, 207, 143, 0.13);
      color: #7af0bd;
    }

    .tag.need {
      background: rgba(91, 168, 255, 0.2);
      color: #b8dcff;
    }

    .tag.flex {
      background: rgba(34, 211, 238, 0.13);
      color: #9bedff;
    }

    .tag.strategy {
      background: rgba(167, 139, 250, 0.15);
      color: #d8ccff;
    }

    .tag.warning {
      background: rgba(242, 169, 59, 0.16);
      color: var(--amber);
    }

    .strategy-values {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.2;
    }

    .strategy-value {
      --strategy-accent: var(--accent);
      --strategy-wash: rgba(91, 168, 255, 0.14);
      padding: 2px 5px;
      border: 1px solid rgba(21, 50, 77, 0.76);
      border-radius: 4px;
      background: rgba(5, 11, 18, 0.32);
      white-space: nowrap;
    }

    .strategy-balanced {
      --strategy-accent: var(--pos-rb);
      --strategy-wash: rgba(91, 168, 255, 0.16);
    }

    .strategy-three-rb {
      --strategy-accent: var(--green);
      --strategy-wash: rgba(31, 207, 143, 0.12);
    }

    .strategy-hero-rb {
      --strategy-accent: var(--amber);
      --strategy-wash: rgba(242, 169, 59, 0.13);
    }

    .strategy-wr-heavy {
      --strategy-accent: var(--purple);
      --strategy-wash: rgba(167, 139, 250, 0.13);
    }

    .strategy-value.active {
      border-color: var(--strategy-accent);
      background: var(--strategy-wash);
      color: #e7f2ff;
    }

    .gap-positive {
      color: #7af0bd;
      font-weight: 750;
    }

    .gap-negative {
      color: var(--danger);
      font-weight: 750;
    }

    .side {
      display: grid;
      grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
      height: 100%;
      min-height: 0;
    }

    .team-heading {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
      min-width: 0;
    }

    .team-heading select {
      width: 100%;
      height: 32px;
      font-weight: 750;
    }

    .side-tabs {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.82);
    }

    .side-tabs button {
      height: 30px;
      padding: 0 9px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }

    .side-tabs button[aria-pressed="true"] {
      border-color: rgba(91, 168, 255, 0.86);
      background: rgba(91, 168, 255, 0.2);
      color: #e7f2ff;
    }

    .side-panel-view {
      display: grid;
      align-content: start;
      min-width: 0;
    }

    .side-panel-view[hidden] {
      display: none;
    }

    .add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 90px;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(7, 19, 31, 0.82);
    }

    .selected-player {
      grid-column: 1 / -1;
      min-height: 38px;
      padding: 10px;
      border: 1px solid var(--position-accent-line, rgba(91, 168, 255, 0.58));
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.66);
    }

    .selected-player strong {
      display: block;
      line-height: 1.2;
    }

    .selected-values {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 6px;
      margin-top: 7px;
    }

    .selected-value {
      min-width: 0;
      padding: 5px 6px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: rgba(12, 32, 51, 0.62);
      font-variant-numeric: tabular-nums;
    }

    .selected-value span {
      display: block;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.1;
    }

    .selected-value strong {
      margin-top: 1px;
      font-size: 13px;
    }

    .sale-warning {
      grid-column: 1 / -1;
      min-height: 0;
      color: var(--danger);
      font-size: 12px;
      line-height: 1.25;
    }

    .sale-warning.info {
      color: var(--muted);
    }

    .add-form button {
      grid-column: 1 / 2;
      height: 34px;
      padding: 0 10px;
    }

    .add-form select:last-child {
      grid-column: 2 / 3;
    }

    .roster-toolbar {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    .roster-summary {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
    }

    .mini-metric {
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: rgba(12, 32, 51, 0.7);
    }

    .mini-metric span {
      display: block;
      color: var(--muted);
      font-size: 11px;
    }

    .mini-metric strong {
      display: block;
      margin-top: 2px;
      color: #f4f8fc;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
    }

    .summary-list {
      display: grid;
      gap: 6px;
      padding: 0 10px 8px;
    }

    .import-conflict-review:empty {
      display: none;
    }

    .summary-item {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--position-accent-line, rgba(91, 168, 255, 0.48));
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.54);
    }

    .summary-item strong {
      line-height: 1.15;
    }

    .summary-item.warn {
      border-color: rgba(242, 169, 59, 0.48);
      background: rgba(242, 169, 59, 0.08);
    }

    .summary-item.fail {
      border-color: rgba(255, 113, 106, 0.46);
      background: rgba(255, 113, 106, 0.08);
    }

    .mock-draft-panel {
      display: grid;
      gap: 8px;
      padding: 0 10px 8px;
    }

    .mock-draft-details {
      display: grid;
      gap: 6px;
    }

    .mock-actions {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }

    .mock-auction-actions {
      grid-template-columns: repeat(auto-fit, minmax(86px, 1fr));
    }

    .mock-actions button,
    .mock-actions input {
      min-height: 32px;
      padding: 0 7px;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.15;
    }

    .mock-actions input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #02070d;
      color: var(--text);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .raw-command {
      display: block;
      margin-top: 4px;
      padding: 3px 5px;
      border-radius: 4px;
      background: rgba(2, 7, 12, 0.58);
      color: #b9cbe0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .side-scroll {
      min-height: 0;
      overflow: auto;
      max-height: none;
    }

    .slot {
      width: 64px;
      padding-right: 16px;
      color: var(--muted);
      font-weight: 650;
      white-space: nowrap;
    }

    .empty {
      color: #5e778f;
    }

    .section-label {
      padding: 12px 12px 7px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      text-transform: uppercase;
    }

    .error {
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 113, 106, 0.46);
      background: rgba(255, 113, 106, 0.08);
      color: var(--danger);
      font-size: 13px;
    }

    .operation-status {
      min-height: 0;
      padding: 0 10px;
      color: var(--green);
      font-size: 13px;
    }

    .operation-status:not(:empty) {
      min-height: 38px;
      padding-top: 9px;
      padding-bottom: 9px;
      border-bottom: 1px solid rgba(74, 211, 149, 0.42);
      background: rgba(74, 211, 149, 0.08);
    }

    .operation-status[role="alert"]:not(:empty) {
      border-color: rgba(255, 113, 106, 0.46);
      background: rgba(255, 113, 106, 0.08);
      color: var(--danger);
    }

    .results-view {
      width: 100%;
      min-width: 100vw;
      min-height: 100vh;
      overflow-x: clip;
      background: var(--bg);
      color: var(--text);
    }

    .results-view[hidden], .app[hidden] {
      display: none;
    }

    .results-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 80;
      height: var(--global-menu-height);
      background: var(--bg);
      box-shadow: none;
    }

    .results-title-block {
      display: grid;
      gap: 4px;
      justify-items: center;
      justify-self: center;
      min-width: 0;
      text-align: center;
    }

    .results-header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      justify-self: end;
      width: 100%;
      min-width: 0;
    }

    .results-header-actions button {
      min-height: 34px;
      padding: 0 12px;
      font-weight: 650;
    }

    .results-main {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      width: 100%;
      min-width: 0;
      min-height: auto;
      padding: calc(var(--global-menu-height) + 18px) 24px 28px;
    }

    .player-news-view .results-main {
      max-width: 1520px;
      margin: 0 auto;
      padding-right: 32px;
      padding-left: 32px;
    }

    .results-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    .simulation-panel {
      display: grid;
      grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
      gap: 10px 14px;
      align-items: center;
      max-width: 960px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel);
    }

    .simulation-panel label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
    }

    .simulation-panel .results-header-actions,
    .simulation-panel #mock-batch-results {
      grid-column: 2;
    }

    .run-selector {
      position: relative;
      min-width: 220px;
    }

    #mock-results-run-button {
      width: 100%;
      min-height: 36px;
      padding: 0 12px;
      text-align: left;
      font-weight: 750;
    }

    .run-options {
      position: absolute;
      z-index: 5;
      top: calc(100% + 6px);
      left: 0;
      display: grid;
      width: min(320px, 84vw);
      max-height: 340px;
      overflow: auto;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #07131f;
      box-shadow: var(--shadow);
    }

    .run-options[hidden] {
      display: none;
    }

    .run-option {
      width: 100%;
      min-height: 32px;
      padding: 0 9px;
      border: 0;
      background: transparent;
      color: var(--muted);
      text-align: left;
    }

    .run-option[aria-selected="true"] {
      background: rgba(91, 168, 255, 0.2);
      color: #e7f2ff;
    }

    .results-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(220px, 1fr));
      gap: 12px;
      align-items: stretch;
    }

    .results-analytics, .results-intelligence {
      display: grid;
      grid-template-columns: repeat(3, minmax(220px, 1fr));
      gap: 12px;
    }

    .insight-card {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .insight-card strong {
      color: #f4f8fc;
      line-height: 1.15;
    }

    .insight-card span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.25;
    }

    .mock-results-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      min-width: 0;
      min-height: 430px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .mock-results-card-header {
      display: grid;
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
      background: rgba(5, 11, 18, 0.34);
    }

    .mock-results-card-header strong {
      color: #f4f8fc;
      font-size: 15px;
      line-height: 1.1;
    }

    .mock-results-reason {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.28;
    }

    .mock-results-scoreline {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
    }

    .mock-results-scoreline span {
      min-width: 0;
      padding: 5px 6px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: rgba(12, 32, 51, 0.62);
      color: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      line-height: 1.15;
    }

    .mock-results-scoreline b {
      display: block;
      margin-top: 2px;
      color: #f4f8fc;
      font-size: 13px;
    }

    .mock-results-breakdown {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
    }

    .mock-results-breakdown-title {
      grid-column: 1 / -1;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .mock-results-breakdown-item {
      min-width: 0;
      padding: 4px 5px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      background: rgba(5, 11, 18, 0.34);
      color: var(--muted);
      font-size: 10px;
      line-height: 1.15;
      font-variant-numeric: tabular-nums;
    }

    .mock-results-breakdown-item b {
      display: block;
      margin-top: 1px;
      color: #d9e7f5;
      font-size: 12px;
    }

    .mock-results-player-list {
      display: grid;
      align-content: start;
      gap: 5px;
      min-height: 0;
      overflow: auto;
      padding: 8px;
    }

    .mock-results-player {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 38px 44px;
      gap: 6px;
      align-items: center;
      min-height: 28px;
      padding: 5px 6px;
      border: 1px solid rgba(21, 50, 77, 0.72);
      border-radius: 5px;
      background: rgba(5, 11, 18, 0.28);
      font-size: 12px;
    }

    .mock-results-player.bench {
      opacity: 0.72;
    }

    .mock-results-slot {
      color: var(--accent);
      font-weight: 750;
      white-space: nowrap;
    }

    .mock-results-name {
      min-width: 0;
      overflow: hidden;
      color: #d9e7f5;
      font-weight: 650;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mock-results-money, .mock-results-score {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .mock-results-score {
      color: var(--muted);
    }

    .rankings-card .mock-results-player {
      grid-template-columns: 28px minmax(0, 1fr) 48px 54px;
      align-items: start;
    }

    .mock-results-ranking-labels {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) 48px 54px;
      gap: 6px;
      padding: 0 6px 1px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 750;
      line-height: 1.1;
      text-transform: uppercase;
    }

    .mock-results-ranking-labels span:nth-child(3),
    .mock-results-ranking-labels span:nth-child(4) {
      text-align: right;
    }

    .mock-results-name small {
      display: block;
      margin-top: 2px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 500;
      line-height: 1.2;
      white-space: normal;
    }

    .player-news-toolbar {
      position: sticky;
      top: 72px;
      z-index: 70;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) 160px 150px 170px 112px;
      gap: 9px;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #081826;
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
    }

    .player-news-toolbar input,
    .player-news-filter-button {
      width: 100%;
      height: 34px;
    }

    .player-news-toolbar button {
      min-height: 34px;
      padding: 0 12px;
      font-weight: 750;
    }

    #player-news-status {
      min-width: 112px;
      overflow: hidden;
      text-align: right;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .player-news-filter {
      position: relative;
      min-width: 0;
    }

    .player-news-filter-button {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
      padding: 0 34px 0 10px;
      color: var(--text);
      text-align: left;
      white-space: nowrap;
    }

    .player-news-filter-button span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-news-filter-button::after {
      content: "";
      position: absolute;
      right: 12px;
      width: 16px;
      height: 16px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%237f9ab5' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 16px 16px;
      pointer-events: none;
    }

    .player-news-filter-options {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      z-index: 120;
      display: grid;
      gap: 2px;
      max-height: 240px;
      overflow-y: auto;
      padding: 5px;
      border: 1px solid rgba(91, 168, 255, 0.62);
      border-radius: 8px;
      background: #07131f;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.38);
    }

    .player-news-filter-options[hidden] {
      display: none;
    }

    .player-news-filter-option {
      width: 100%;
      min-height: 32px;
      padding: 0 9px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #d9e7f5;
      font-size: 12px;
      font-weight: 650;
      text-align: left;
    }

    .player-news-filter-option:hover,
    .player-news-filter-option:focus {
      background: rgba(91, 168, 255, 0.16);
    }

    .player-news-filter-option[aria-selected="true"] {
      background: rgba(91, 168, 255, 0.22);
      color: #e7f2ff;
    }

    .player-news-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      align-items: start;
    }

    .player-news-feed {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .player-news-card {
      display: grid;
      gap: 9px;
      min-width: 0;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .player-news-card-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: start;
      min-width: 0;
    }

    .player-news-player {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: baseline;
      min-width: 0;
      color: #f4f8fc;
      font-size: 15px;
      font-weight: 750;
      line-height: 1.15;
    }

    .player-news-meta {
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .player-news-headline {
      color: #d9e7f5;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.28;
      overflow-wrap: anywhere;
    }

    .player-news-impact {
      color: #a9bfd5;
      line-height: 1.42;
    }

    .player-news-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .player-news-chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      max-width: 100%;
      padding: 0 8px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.34);
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.1;
      white-space: nowrap;
    }

    .player-news-action.move-up {
      border-color: rgba(31, 207, 143, 0.62);
      color: #7af0bd;
      background: rgba(31, 207, 143, 0.08);
    }

    .player-news-action.fade {
      border-color: rgba(255, 113, 106, 0.62);
      color: #ff9a94;
      background: rgba(255, 113, 106, 0.08);
    }

    .player-news-action.watch {
      border-color: rgba(242, 169, 59, 0.62);
      color: #ffd28a;
      background: rgba(242, 169, 59, 0.08);
    }

    .player-news-date-chip {
      border-color: rgba(91, 168, 255, 0.68);
      color: #cfe5ff;
      background: rgba(91, 168, 255, 0.14);
    }

    .player-news-source {
      max-width: 100%;
      color: var(--accent);
      font-size: 12px;
      font-weight: 650;
      overflow-wrap: anywhere;
      text-decoration: none;
      word-break: break-word;
    }

    .player-news-source:hover {
      text-decoration: underline;
    }

    .player-news-source-stack {
      display: grid;
      gap: 4px;
      justify-items: end;
      min-width: 0;
      text-align: right;
    }

    .player-news-date {
      color: var(--muted);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.15;
      white-space: nowrap;
    }

    .player-news-side {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      min-width: 0;
    }

    .player-news-summary,
    .player-news-providers {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .player-news-provider {
      display: grid;
      gap: 3px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line-soft);
    }

    .player-news-provider:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .player-news-provider strong {
      color: #f4f8fc;
      font-size: 12px;
      line-height: 1.15;
    }

    .player-news-provider span {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.28;
    }

    .player-news-stat {
      display: grid;
      gap: 3px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--line-soft);
    }

    .player-news-stat:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }

    .player-news-stat strong {
      color: #f4f8fc;
      font-size: 12px;
      line-height: 1.15;
    }

    .player-news-stat b {
      color: #d9e7f5;
      font-size: 18px;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }

    .player-news-stat span {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.28;
    }

    .my-expert-view .results-main {
      max-width: 1520px;
      margin: 0 auto;
      padding-right: 32px;
      padding-left: 32px;
    }

    .my-expert-context-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      min-width: 0;
      color: var(--muted);
      font-size: 12px;
      font-weight: 650;
      line-height: 1.25;
    }

    .my-expert-context-row strong {
      color: #f4f8fc;
      font-size: 12px;
      line-height: 1.15;
    }

    .my-expert-context-row span {
      white-space: nowrap;
    }

    .my-expert-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      gap: 14px;
      align-items: start;
    }

    .my-expert-connect-panel {
      display: grid;
      gap: 10px;
      min-width: 0;
      margin-bottom: 14px;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.82);
      box-shadow: var(--shadow);
    }

    .my-expert-connect-panel[hidden] {
      display: none;
    }

    .my-expert-connect-header {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .my-expert-connect-title {
      color: #f4f8fc;
      font-size: 13px;
      font-weight: 800;
      line-height: 1.15;
    }

    .my-expert-connect-detail {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.3;
    }

    .my-expert-provider-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 8px;
      min-width: 0;
    }

    .my-expert-provider-card {
      display: grid;
      gap: 7px;
      min-width: 0;
      padding: 10px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.32);
    }

    .my-expert-provider-top {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      min-width: 0;
    }

    .my-expert-provider-top strong {
      min-width: 0;
      overflow: hidden;
      color: #f4f8fc;
      line-height: 1.15;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .my-expert-provider-status {
      flex: 0 0 auto;
      padding: 2px 6px;
      border: 1px solid var(--line-soft);
      border-radius: 5px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .my-expert-provider-status-active,
    .my-expert-provider-status-available {
      border-color: rgba(31, 207, 143, 0.62);
      color: #7af0bd;
      background: rgba(31, 207, 143, 0.08);
    }

    .my-expert-provider-status-setup-required {
      border-color: rgba(242, 169, 59, 0.62);
      color: #ffd28a;
      background: rgba(242, 169, 59, 0.08);
    }

    .my-expert-provider-card p {
      margin: 0;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.34;
    }

    .my-expert-provider-meta {
      color: #a9bfd5;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.25;
    }

    .my-expert-provider-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      justify-self: start;
      min-height: 34px;
      padding: 0 10px;
      color: #d9e7f5;
      font-size: 12px;
      font-weight: 750;
      line-height: 1.2;
    }

    .my-expert-provider-action-connect {
      width: 100%;
      justify-self: stretch;
    }

    .my-expert-provider-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      min-width: 0;
    }

    .my-expert-provider-form input {
      height: 30px;
      font-size: 12px;
    }

    .my-expert-provider-form button {
      min-height: 30px;
      padding: 0 10px;
      font-size: 12px;
      font-weight: 750;
      white-space: nowrap;
    }

    .my-expert-provider-feedback {
      min-height: 16px;
      color: #a9bfd5;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.35;
    }

    .my-expert-provider-feedback[hidden] {
      display: none;
    }

    .my-expert-provider-feedback-error {
      color: #ffd28a;
    }

    .my-expert-provider-action-static {
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(12, 32, 51, 0.5);
      color: var(--muted);
    }

    .my-expert-recommendations,
    .my-expert-side {
      display: grid;
      gap: 10px;
      min-width: 0;
    }

    .my-expert-card {
      display: grid;
      gap: 9px;
      min-width: 0;
      padding: 13px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .my-expert-card-header {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
      justify-content: space-between;
      min-width: 0;
    }

    .my-expert-card h2 {
      color: #f4f8fc;
      font-size: 15px;
      text-transform: none;
    }

    .my-expert-detail {
      color: #a9bfd5;
      line-height: 1.42;
    }

    .my-expert-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }

    .my-expert-chip {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      max-width: 100%;
      padding: 0 8px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.34);
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.1;
      white-space: nowrap;
    }

    .my-expert-priority-high {
      border-color: rgba(255, 113, 106, 0.62);
      color: #ff9a94;
      background: rgba(255, 113, 106, 0.08);
    }

    .my-expert-priority-medium {
      border-color: rgba(242, 169, 59, 0.62);
      color: #ffd28a;
      background: rgba(242, 169, 59, 0.08);
    }

    .my-expert-priority-low {
      border-color: rgba(31, 207, 143, 0.62);
      color: #7af0bd;
      background: rgba(31, 207, 143, 0.08);
    }

    .my-expert-panel {
      display: grid;
      gap: 8px;
      min-width: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(8, 24, 38, 0.92);
      box-shadow: var(--shadow);
    }

    .my-expert-panel h2 {
      color: #b9cbe0;
      font-size: 12px;
    }

    .my-expert-list {
      display: grid;
      gap: 6px;
      min-width: 0;
    }

    .my-expert-list-item {
      display: grid;
      gap: 2px;
      min-width: 0;
      padding: 8px 9px;
      border: 1px solid var(--line-soft);
      border-radius: 6px;
      background: rgba(5, 11, 18, 0.32);
    }

    .my-expert-list-item strong {
      color: #f4f8fc;
      line-height: 1.15;
    }

    .my-expert-list-item span {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.28;
    }

    .delta-up {
      color: #ff9a94;
      font-weight: 700;
    }

    .delta-down {
      color: #7af0bd;
      font-weight: 700;
    }

    @media (max-width: 1200px) {
      .results-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .results-analytics, .results-intelligence {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 1160px) {
      .app {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto auto;
        height: auto;
        overflow: visible;
      }

      .app.draft-active {
        grid-template-rows: auto auto;
        height: auto;
        min-height: 100vh;
        overflow: visible;
      }

      .draft-header {
        position: sticky;
        top: 0;
        z-index: 60;
        grid-template-columns: auto minmax(0, 1fr) auto;
        min-height: 56px;
        padding: 0 12px;
        background: var(--bg);
      }

      .draft-title-group {
        justify-self: center;
      }

      .sidebar {
        grid-column: 1;
        grid-row: auto;
        border-right: 0;
        border-bottom: 1px solid var(--line);
        height: auto;
      }

      .workspace {
        grid-column: 1;
        grid-row: auto;
        height: auto;
        min-height: 100vh;
        overflow: visible;
      }

      .app.draft-active .workspace {
        grid-row: 2;
        height: auto;
        min-height: 0;
        overflow: visible;
      }

      .draft-header {
        min-height: 56px;
      }

      .board-toolbar {
        grid-template-columns: 1fr 1fr;
      }

      .segmented {
        grid-column: 1 / -1;
      }

      .top-actions {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .player-news-toolbar,
      .player-news-layout,
      .my-expert-provider-grid,
      .my-expert-layout {
        grid-template-columns: 1fr;
      }

      main {
        grid-template-columns: 1fr;
      }

      .app.draft-active main {
        grid-template-columns: 1fr;
        grid-auto-rows: max-content;
      }

      .app.draft-active .decision-panel {
        order: -1;
      }

      .app.draft-active section,
      .app.draft-active aside {
        height: auto;
        overflow: visible;
      }

      .scroll, .side-scroll {
        max-height: none;
      }
    }

    @media (max-width: 760px) {
      .global-app-menu {
        width: 100%;
      }

      .draft-title-group {
        gap: 6px;
      }

      .room-mode-indicator {
        padding-right: 7px;
        padding-left: 7px;
      }

      .room-mode-indicator strong {
        display: none;
      }

      .results-header {
        grid-template-columns: 38px minmax(0, 1fr);
        grid-template-rows: auto auto;
        align-items: start;
        gap: 10px;
        height: auto;
        min-height: 118px;
        padding: 12px;
      }

      .results-header .results-title-block {
        grid-column: 2;
        grid-row: 1;
        justify-items: start;
        justify-self: stretch;
        text-align: left;
      }

      .results-header > .results-header-actions {
        grid-column: 1 / -1;
        grid-row: 2;
        justify-content: flex-start;
        justify-self: stretch;
      }

      .results-main {
        padding: 136px 12px 20px;
      }

      .results-grid {
        grid-template-columns: 1fr;
      }

      .simulation-panel {
        grid-template-columns: 1fr;
        padding: 14px;
      }

      .simulation-panel .results-header-actions,
      .simulation-panel #mock-batch-results {
        grid-column: 1;
      }

      .player-news-card-header {
        grid-template-columns: 1fr;
      }

      .player-news-source-stack {
        justify-items: start;
        text-align: left;
      }

      .player-news-side {
        grid-template-columns: 1fr;
      }

      main {
        padding: 10px;
      }

      .board-toolbar {
        grid-template-columns: 1fr;
      }

      .scroll {
        display: none;
      }

      .board-cards {
        display: block;
        max-height: 62vh;
        overflow: auto;
        overscroll-behavior: contain;
      }
    }
  </style>
</head>
<body data-active-route="draft-room">
  <div class="app" id="draft-room-view">
    <header class="draft-header app-page-header">
      <div class="app-header-menu-slot" id="draft-header-menu-slot">
        <div class="global-app-menu" id="app-menu">
          <div class="global-brand-row">
            <button type="button" class="app-menu-trigger" id="app-menu-button" aria-haspopup="menu" aria-expanded="false" aria-controls="app-menu-list" aria-label="Open app menu">
              <span class="app-menu-icon" aria-hidden="true"><span></span><span></span><span></span></span>
            </button>
            <div class="brand">
              <strong>Mockd</strong>
              <span id="app-menu-current-label">Real draft</span>
            </div>
            <div class="app-menu-list" id="app-menu-list" role="menu" hidden>
              <button type="button" class="app-menu-item" id="league-home-button" role="menuitem" hidden>
                <strong>League home</strong>
                <span>Back to your league</span>
              </button>
              <button type="button" class="app-menu-item" id="start-real-draft-button" role="menuitem" aria-current="page" data-menu-key="real-draft" data-menu-label="Real draft" aria-label="Start real draft">
                <strong>Real draft</strong>
                <span>Draft-night logger</span>
              </button>
              <button type="button" class="app-menu-item" id="start-mock-draft-button" role="menuitem" data-menu-key="mock-draft" data-menu-label="Mock draft" aria-label="Start mock draft">
                <strong>Mock draft</strong>
                <span>Interactive practice room</span>
              </button>
              <button type="button" class="app-menu-item" id="my-expert-button" role="menuitem" data-menu-key="my-expert" data-menu-label="My expert">
                <strong>My expert</strong>
                <span>Roster advice</span>
              </button>
              <button type="button" class="app-menu-item" id="player-news-button" role="menuitem" data-menu-key="player-news" data-menu-label="Player news">
                <strong>Player news</strong>
                <span>Fantasy updates feed</span>
              </button>
              <button type="button" class="app-menu-item" id="mock-simulations-button" role="menuitem" data-menu-key="mock-simulations" data-menu-label="Mock simulations">
                <strong>Mock simulations</strong>
                <span>Compare AI draft outcomes</span>
              </button>
              <button type="button" class="app-menu-item" id="see-mock-results-button" role="menuitem" data-menu-key="mock-results" data-menu-label="Mock results" hidden>
                <strong>Mock results</strong>
                <span>Latest simulation report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="draft-title-group">
        <h1 id="room-title">Dashboard</h1>
        <div class="room-mode-indicator" id="room-mode-indicator"></div>
      </div>
      <div class="header-actions">
        <input class="search header-search" id="header-board-search" autocomplete="off" placeholder="Search player, position, or team" hidden>
        <form class="quick-sale header-sale-command" id="header-quick-sale-form" hidden>
          <input id="header-quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
          <button class="primary" type="submit">Log</button>
        </form>
        <div class="header-draft-actions" id="header-draft-actions" hidden>
          <button type="button" id="header-export-json-button">JSON</button>
          <button type="button" id="header-export-csv-button">CSV</button>
          <button type="button" id="header-export-bundle-button">Bundle</button>
          <button type="button" id="header-import-log-button">Import</button>
          <button type="button" id="header-undo-button">Undo</button>
          <button type="button" id="header-reset-button">Reset</button>
        </div>
      </div>
      <button class="danger header-end-action" type="button" id="end-draft-button" aria-label="End active draft" hidden>End draft</button>
    </header>
    <nav class="sidebar" aria-label="Draft room controls">
      <div class="sidebar-section">
        <div class="section-label">Draft mode</div>
        <div class="draft-mode-choice" aria-label="Draft mode">
          <button type="button" id="draft-mode-real-button" data-draft-mode-choice="real" aria-pressed="true">
            <strong>Real draft</strong>
            <span>Sale logger</span>
          </button>
          <button type="button" id="draft-mode-mock-button" data-draft-mode-choice="interactive-mock" aria-pressed="false">
            <strong>Mock draft</strong>
            <span>Practice auction</span>
          </button>
        </div>
        <div class="mode-status" id="draft-mode-status">
          <strong>Real draft</strong>
          <span>Draft-night logger. Writes to the real sale log.</span>
        </div>
        <button class="primary start-draft-button" type="button" id="confirm-start-draft-button" aria-label="Confirm start draft" hidden>Start draft</button>
        <div class="draft-countdown" id="draft-countdown" hidden>5</div>
      </div>
      <div class="sidebar-section" id="sidebar-sale-command-section">
        <div class="section-label">Sale Command</div>
        <form class="quick-sale" id="quick-sale-form">
          <input id="quick-sale-command" autocomplete="off" placeholder="Quick sale: jakub kittle 28">
          <button class="primary" type="submit">Log</button>
        </form>
      </div>
      <details class="sidebar-section session-tools">
        <summary class="session-tools-summary">
          <span class="section-label">Session tools</span>
          <span class="session-summary-label" id="session-summary-label">Live</span>
        </summary>
        <div class="session-tools-body">
          <div class="session-picker">
            <select id="draft-session-select" aria-label="Draft session">
              <option value="live">Live</option>
              <option value="practice-3rb">Practice 3RB</option>
              <option value="practice-wr-heavy">Practice WR Heavy</option>
            </select>
            <input id="scratch-session-name" autocomplete="off" placeholder="Scratch room">
            <button type="button" id="open-scratch-session-button">Open</button>
            <div class="active-session-label" id="active-session-label">Live session</div>
            <div class="active-session-label" id="draft-lock-status">Live session locked</div>
          </div>
          <div class="top-actions">
            <button type="button" id="export-json-button">Export JSON</button>
            <button type="button" id="export-csv-button">CSV</button>
            <button type="button" id="export-bundle-button">Bundle</button>
            <button type="button" id="import-log-button">Import</button>
            <input class="file-input" id="import-log-file" type="file" accept=".json,.csv,application/json,text/csv">
            <button type="button" id="undo-button">Undo</button>
            <button type="button" id="reset-button">Reset</button>
          </div>
        </div>
      </details>
    </nav>
    <div class="workspace">
      <div class="draft-start-banner" id="draft-start-banner" hidden>
        <span id="draft-start-label">Draft starts in</span>
        <strong id="draft-countdown-value">5</strong>
      </div>
      <main>
      <section class="board-panel">
        <div class="panel-header">
          <h2>Board</h2>
          <div class="board-count" id="board-count"></div>
        </div>
        <div class="board-toolbar">
          <label class="toggle"><input type="checkbox" id="my-needs-filter"> My needs</label>
          <select id="team-filter" aria-label="NFL team filter"></select>
          <select id="bye-filter" aria-label="Bye week filter"></select>
          <select id="strategy-select" aria-label="Draft strategy">
            <option value="balanced">Balanced</option>
            <option value="three-rb" selected>True 3RB</option>
            <option value="hero-rb">Hero RB</option>
            <option value="wr-heavy">WR Heavy</option>
          </select>
          <select id="sort-select" aria-label="Board sort">
            <option value="liveExpectedPrice">Market price</option>
            <option value="seasonProjection">Season points</option>
            <option value="week1Projection">Week 1 points</option>
            <option value="valueGap">Best value gap</option>
            <option value="tierDrop">Biggest tier drop</option>
            <option value="personalValue">Our value</option>
            <option value="recommendedMaxBid">Max bid</option>
            <option value="expectedPrice">Base price</option>
            <option value="byeWeek">Bye week</option>
            <option value="position">Position</option>
            <option value="teamAbbreviation">NFL team</option>
          </select>
        </div>
        <div class="market-strip" id="position-market"></div>
        <div class="board-search-row">
          <input class="search board-search-input" id="board-search" autocomplete="off" placeholder="Search player, position, or team">
        </div>
        <div class="mock-auction-feed" id="mock-auction-feed" hidden>
          <div class="mock-auction-nomination" id="mock-active-nomination"></div>
          <div class="mock-actions mock-auction-actions">
            <input type="number" id="mock-nomination-price" min="1" step="1" value="1" placeholder="Open $" aria-label="Opening nomination bid" hidden disabled>
            <button type="button" id="mock-advance-button" disabled>Advance AI Sale</button>
            <button type="button" id="mock-nominate-button" disabled>Nominate</button>
            <button type="button" id="mock-cam-win-button" disabled>Bid</button>
            <button type="button" id="mock-pass-button" disabled>Pass</button>
            <button type="button" id="mock-next-decision-button" disabled>Next action</button>
            <button type="button" id="mock-next-round-button" disabled>Next Round</button>
            <button type="button" id="mock-complete-button" disabled>Complete</button>
          </div>
          <div class="mock-auction-feed-lines" id="mock-auction-feed-lines" role="log" aria-live="polite" aria-relevant="additions text"></div>
        </div>
        <div class="scroll">
          <table class="board-table">
            <thead>
              <tr>
                <th class="center" style="width:56px">Actions</th>
                <th style="width:350px">Player</th>
                <th style="width:52px">Pos</th>
                <th style="width:62px">Team</th>
                <th class="center" style="width:54px">Bye</th>
                <th class="money" style="width:64px">W1</th>
                <th class="money" style="width:78px">Season</th>
                <th class="money" style="width:76px">Market</th>
                <th class="money" style="width:66px">Our</th>
                <th class="money" style="width:66px">Gap</th>
                <th class="money" style="width:66px">Max</th>
              </tr>
            </thead>
            <tbody id="board"></tbody>
          </table>
        </div>
        <div class="board-cards" id="board-cards"></div>
      </section>
      <aside class="side decision-panel">
        <div class="panel-header">
          <div class="team-heading">
            <h2>Team</h2>
            <select id="roster-owner" aria-label="Roster owner"></select>
          </div>
          <span class="subtle" id="sale-count"></span>
        </div>
        <div class="side-tabs" id="side-panel-tabs" aria-label="Team panel view">
          <button type="button" data-side-panel="lineup" aria-pressed="true">Lineup</button>
          <button type="button" data-side-panel="shortlist" aria-pressed="false">My shortlist</button>
          <button type="button" data-side-panel="draft-path" aria-pressed="false">Draft path</button>
        </div>
        <div id="errors" role="alert"></div>
        <div class="operation-status" id="operation-status" role="status" aria-live="polite" tabindex="-1"></div>
        <div class="summary-list import-conflict-review" id="import-conflict-review"></div>
        <div class="side-scroll">
          <div class="side-panel-view" id="lineup-panel" data-side-panel-view="lineup">
            <form class="add-form" id="add-form">
              <div class="selected-player" id="selected-player"></div>
              <select id="add-owner" aria-label="Sale owner"></select>
              <input id="add-price" inputmode="numeric" pattern="[0-9]*" aria-label="Sale price">
              <div class="sale-warning" id="sale-warning" role="alert"></div>
              <button class="primary" id="add-submit" type="submit">Add</button>
            </form>
            <div class="roster-toolbar">
              <div class="roster-summary" id="roster-summary"></div>
            </div>
            <div class="section-label">Roster</div>
            <table>
              <tbody id="roster-slots"></tbody>
            </table>
            <div class="section-label">Budgets</div>
            <table>
              <thead>
                <tr>
                  <th>Owner</th>
                  <th class="money">Left</th>
                  <th class="money">Max</th>
                  <th class="money">Slots</th>
                </tr>
              </thead>
              <tbody id="owners"></tbody>
            </table>
            <div class="section-label">Sales</div>
            <table>
              <tbody id="events"></tbody>
            </table>
          </div>
          <div class="side-panel-view" id="shortlist-panel" data-side-panel-view="shortlist" hidden>
            <div class="section-label">My Shortlist</div>
            <div class="summary-list" id="manual-shortlist"></div>
            <div class="section-label">Model Shortlist</div>
            <div class="summary-list" id="model-shortlist"></div>
            <div id="shortlist" hidden></div>
          </div>
          <div class="side-panel-view" id="draft-path-panel" data-side-panel-view="draft-path" hidden>
            <div class="section-label">Draft Path</div>
            <div class="summary-list" id="draft-path"></div>
            <div class="section-label">Needs / Blockers</div>
            <div class="summary-list" id="position-context"></div>
            <div class="section-label">Mock Draft</div>
            <div class="mock-draft-panel" id="mock-draft-panel">
              <div class="mock-draft-details" id="mock-draft-details">
                <div class="summary-item">
                  <strong>Loading</strong>
                  <span class="subtle">Preparing the interactive mock.</span>
                </div>
              </div>
            </div>
            <div class="section-label">Post Draft Audit</div>
            <div class="summary-list" id="post-draft-audit"></div>
            <div class="section-label">Readiness</div>
            <div class="summary-list" id="readiness-checks"></div>
          </div>
        </div>
      </aside>
      </main>
    </div>
  </div>
  <div class="results-view" id="mock-simulations-view" hidden>
    <header class="results-header app-page-header">
      <div class="app-header-menu-slot" id="mock-simulations-header-menu-slot"></div>
      <div class="results-title-block">
        <h1>Mock Simulations</h1>
        <div class="subtle">Compare strategies across many AI drafts.</div>
      </div>
      <div class="results-header-actions">
        <button type="button" id="mock-simulations-back-button">Draft room</button>
      </div>
    </header>
    <main class="results-main">
      <section class="simulation-panel">
        <label for="mock-simulation-strategy">Draft strategy</label>
        <select id="mock-simulation-strategy">
          <option value="balanced">Balanced</option>
          <option value="three-rb">True 3RB</option>
          <option value="hero-rb">Hero RB</option>
          <option value="wr-heavy">WR Heavy</option>
        </select>
        <label for="mock-batch-runs">Number of drafts</label>
        <input id="mock-batch-runs" inputmode="numeric" pattern="[0-9]*" value="25" aria-label="Mock draft run count">
        <label for="mock-batch-script">Scenario instructions</label>
        <input id="mock-batch-script" autocomplete="off" placeholder="Example: Build around Omarion Hampton at $46 to $52" aria-label="Mock draft scenario">
        <div class="results-header-actions">
          <button class="primary" type="button" id="run-mock-batch-button">Run simulations</button>
        </div>
        <div class="summary-list" id="mock-batch-results" role="status" aria-live="polite">
          <div class="summary-item">
            <strong>No simulations yet</strong>
            <span class="subtle">Run a set of drafts to compare outcomes for this strategy.</span>
          </div>
        </div>
      </section>
    </main>
  </div>
  <div class="results-view" id="mock-results-view" hidden>
    <header class="results-header app-page-header">
      <div class="app-header-menu-slot" id="mock-results-header-menu-slot"></div>
      <div class="results-title-block">
        <h1>Mock Results</h1>
        <div class="subtle" id="mock-results-title">No completed mock batch yet.</div>
      </div>
      <div class="results-header-actions">
        <button type="button" id="mock-results-run-new-button">Run new mocks</button>
        <button type="button" id="back-to-draft-room-button">Draft room</button>
      </div>
    </header>
    <main class="results-main">
      <div class="results-toolbar">
        <div class="run-selector">
          <button type="button" id="mock-results-run-button">Run results</button>
          <div class="run-options" id="mock-results-run-list" hidden></div>
        </div>
        <div class="subtle" id="mock-results-status"></div>
      </div>
      <div class="results-analytics" id="mock-results-analytics"></div>
      <div class="results-intelligence" id="mock-results-intelligence"></div>
      <div class="results-grid" id="mock-results-grid"></div>
    </main>
  </div>
  <div class="results-view my-expert-view" id="my-expert-view" hidden>
    <header class="results-header app-page-header">
      <div class="app-header-menu-slot" id="my-expert-header-menu-slot"></div>
      <div class="results-title-block">
        <h1>My Expert</h1>
        <div class="subtle" id="my-expert-title">Loading roster advice.</div>
      </div>
      <div class="results-header-actions">
        <button type="button" id="my-expert-refresh-button">Refresh</button>
        <button type="button" id="my-expert-back-button">Draft room</button>
      </div>
    </header>
    <main class="results-main">
      <div class="my-expert-context-row" id="my-expert-context-row">
        <strong id="my-expert-roster-title">Your roster</strong>
        <span id="my-expert-status">Read-only advice</span>
        <span id="my-expert-source">Mockd draft</span>
      </div>
      <div class="my-expert-connect-panel" id="my-expert-connect-panel"></div>
      <div class="my-expert-layout">
        <div class="my-expert-recommendations" id="my-expert-recommendations"></div>
        <aside class="my-expert-side">
          <div class="my-expert-panel">
            <h2>Lineup</h2>
            <div class="my-expert-list" id="my-expert-lineup"></div>
          </div>
          <div class="my-expert-panel">
            <h2>Roster</h2>
            <div class="my-expert-list" id="my-expert-roster"></div>
          </div>
          <div class="my-expert-panel">
            <h2>Sync Providers</h2>
            <div class="my-expert-list" id="my-expert-integrations"></div>
          </div>
        </aside>
      </div>
    </main>
  </div>
  <div class="results-view player-news-view" id="player-news-view" hidden>
    <header class="results-header app-page-header">
      <div class="app-header-menu-slot" id="player-news-header-menu-slot"></div>
      <div class="results-title-block">
        <h1>Player News</h1>
        <div class="subtle" id="player-news-title">Loading player news.</div>
      </div>
      <div class="results-header-actions">
        <button type="button" id="player-news-refresh-button">Refresh</button>
        <button type="button" id="player-news-back-button">Draft room</button>
      </div>
    </header>
    <main class="results-main">
      <div class="player-news-toolbar">
        <input id="player-news-search" autocomplete="off" placeholder="Search player, team, tag">
        <div class="player-news-filter">
          <button type="button" class="player-news-filter-button" id="player-news-source-filter" aria-label="News source: All sources" aria-haspopup="listbox" aria-expanded="false" aria-controls="player-news-source-options" data-player-news-filter-key="source">
            <span id="player-news-source-label">All sources</span>
          </button>
          <div class="player-news-filter-options" id="player-news-source-options" role="listbox" aria-label="News source" hidden>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="source" data-player-news-value="local">Local evidence</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="source" data-player-news-value="rotowire-rss">RotoWire RSS</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="source" data-player-news-value="all">All sources</button>
          </div>
        </div>
        <div class="player-news-filter">
          <button type="button" class="player-news-filter-button" id="player-news-category-filter" aria-label="News category: All categories" aria-haspopup="listbox" aria-expanded="false" aria-controls="player-news-category-options" data-player-news-filter-key="category">
            <span id="player-news-category-label">All categories</span>
          </button>
          <div class="player-news-filter-options" id="player-news-category-options" role="listbox" aria-label="News category" hidden>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="All">All categories</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Injury">Injury</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Practice">Practice</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Transaction">Transaction</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Depth chart">Depth chart</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Role">Role</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Matchup">Matchup</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Team context">Team context</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="Market">Market</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="category" data-player-news-value="News">News</button>
          </div>
        </div>
        <div class="player-news-filter">
          <button type="button" class="player-news-filter-button" id="player-news-action-filter" aria-label="Draft action: All actions" aria-haspopup="listbox" aria-expanded="false" aria-controls="player-news-action-options" data-player-news-filter-key="action">
            <span id="player-news-action-label">All actions</span>
          </button>
          <div class="player-news-filter-options" id="player-news-action-options" role="listbox" aria-label="Draft action" hidden>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="action" data-player-news-value="All">All actions</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="action" data-player-news-value="Move up">Move up</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="action" data-player-news-value="Watch">Watch</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="action" data-player-news-value="Fade">Fade</button>
            <button type="button" class="player-news-filter-option" role="option" data-player-news-option-key="action" data-player-news-value="No model change">No model change</button>
          </div>
        </div>
        <div class="subtle" id="player-news-status"></div>
      </div>
      <div class="player-news-layout">
        <div class="player-news-feed" id="player-news-feed"></div>
        <aside class="player-news-side">
          <div class="player-news-summary" id="player-news-summary"></div>
          <div class="player-news-providers" id="player-news-providers"></div>
        </aside>
      </div>
    </main>
  </div>
  <script>
    let currentState = null;
    let selectedTargetName = null;
    let selectedRosterOwner = 'Cam';
    let currentWatchOwner = 'Cam';
    let boardPositionFilter = 'ALL';
    let boardSortKey = 'liveExpectedPrice';
    let currentStrategyKey = 'three-rb';
    let currentDraftMode = 'real';
    let currentDraftSession = 'live';
    let draftLifecycle = 'setup';
    let draftCountdownValue = 0;
    let draftCountdownTimer = null;
    let activeSidePanel = 'lineup';
    let pendingCamNominationName = null;
    let pendingCamNominationPrice = 1;
    let currentMockDraft = null;
    let mockAdvanceRequestInFlight = false;
    let mockAdvanceRequestAction = null;
    let mockAutoAdvanceTimer = null;
    let latestMockBatchReport = null;
    let latestMockBatchJob = null;
    let selectedMockResultsRunIndex = 0;
    let manualShortlistNames = [];
    let latestMyExpertReport = null;
    let myExpertWeek = 1;
    let latestPlayerNewsFeed = null;
    let playerNewsSource = 'all';
    let playerNewsCategory = 'All';
    let playerNewsAction = 'All';
    let playerNewsQuery = '';
    let playerNewsSearchTimer = null;
    let playerNewsPollTimer = null;
    let playerNewsRequestId = 0;
    let playerNewsBackgroundRefreshInFlight = false;

    const boardPositions = ['ALL', 'RB', 'WR', 'TE', 'QB', 'FLEX', 'K', 'DST'];
    const strategyKeys = ['balanced', 'three-rb', 'hero-rb', 'wr-heavy'];
    const draftLifecycles = ['setup', 'ready', 'countdown', 'active'];
    const draftCountdownSeconds = 5;
    const strategyValueLabels = {
      balanced: 'Bal',
      'three-rb': '3RB',
      'hero-rb': 'Hero',
      'wr-heavy': 'WR'
    };
    const draftModes = ['real', 'interactive-mock'];
    const platformDraftToolPaths = ['/board', '/mock-drafts', '/simulations', '/strategy'];
    const isPlatformDraftToolsContext = () =>
      platformDraftToolPaths.includes(window.location.pathname) || new URLSearchParams(window.location.search).has('seasonId');
    const isPlatformBoardRoute = () => window.location.pathname === '/board';
    const platformSeasonId = () => new URLSearchParams(window.location.search).get('seasonId') || 'standalone';
    const platformOwnerScope = () => new URLSearchParams(window.location.search).get('owner') || currentWatchOwner;
    const platformStorageScope = () => platformSeasonId() + ':' + platformOwnerScope();
    const draftLifecycleStorageKey = () => 'mockd-draft-lifecycle:' + platformStorageScope();
    const playerNewsSources = ['local', 'rotowire-rss', 'all'];
    const draftModeCopy = {
      real: {
        label: 'Real draft',
        detail: 'Draft-night logger. Writes to the real sale log.'
      },
      'interactive-mock': {
        label: 'Mock draft',
        detail: 'Practice room. You control your team while AI owners bid.'
      }
    };
    const flexPositions = ['RB', 'WR', 'TE'];
    const rosterMaximums = ${rosterMaximumsJson};
    const positionOrder = { RB: 1, WR: 2, TE: 3, QB: 4, K: 5, DST: 6 };
    const sortLabels = {
      position: 'Pos',
      teamAbbreviation: 'Team',
      byeWeek: 'Bye',
      week1Projection: 'W1',
      seasonProjection: 'Season',
      expectedPrice: 'Exp',
      liveExpectedPrice: 'Market',
      personalValue: 'Our',
      valueGap: 'Gap',
      recommendedMaxBid: 'Max',
      tierDrop: 'Tier drop'
    };
    const boardSortKeys = Object.keys(sortLabels);

    const byId = id => document.getElementById(id);
    const money = value => '$' + Math.round(Number(value || 0));
    const nominationPriceValue = () => {
      const price = Number(byId('mock-nomination-price').value);
      return Number.isInteger(price) && price > 0 ? price : 1;
    };
    const scoreText = value => Number(value || 0).toFixed(1);
    const deltaMoney = value => {
      const rounded = Math.round(Number(value || 0));
      if (rounded === 0) return '$0';
      return (rounded > 0 ? '+' : '-') + '$' + Math.abs(rounded);
    };
    const cleanText = value => String(value == null ? '' : value);
    const safeFilePart = value => cleanText(value).replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'draft';
    const safeClassPart = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
    const positionClassFor = position => 'position-' + safeClassPart(position || 'unknown');
    const valueGapFor = target => target.personalValue - target.liveExpectedPrice;
    const canNominateTarget = target =>
      currentDraftMode === 'interactive-mock' &&
      currentMockDraft &&
      currentMockDraft.phase === 'human-nomination' &&
      target &&
      target.draftable !== false;
    const activeBidPriceFor = target => {
      const price = priceInputValue();
      return Number.isFinite(price) && price > 0 ? price : target.recommendedMaxBid;
    };
    const selectedMockAuctionPriceFor = target => {
      if (!isActiveDraft() || currentDraftMode !== 'interactive-mock' || !currentMockDraft || !currentMockDraft.auction) return null;
      const auction = currentMockDraft.auction;
      if (auction.player !== target.name) return null;
      return auction.resolution && auction.resolution.price != null
        ? auction.resolution.price
        : auction.currentBid;
    };
    const selectedBidPriceFor = target => {
      const mockAuctionPrice = selectedMockAuctionPriceFor(target);
      if (mockAuctionPrice != null) return mockAuctionPrice;
      return activeBidPriceFor(target);
    };
    const selectedBidLabelFor = target => {
      if (selectedMockAuctionPriceFor(target) != null) return 'Current';
      return isActiveDraft() && currentDraftMode === 'interactive-mock' ? 'Path max' : 'Bid';
    };
    const valueGapAtPriceFor = (target, price) => target.personalValue - price;
    const isFlexPosition = position => flexPositions.includes(position);
    const selectedTarget = () => currentState && currentState.availableTargets.find(target => target.name === selectedTargetName);
    const ownerByName = name => currentState.owners.find(owner => owner.owner === name) || currentState.watchOwner;
    const currentOwner = () => ownerByName(selectedRosterOwner);
    const currentCommandCount = () => currentState && currentState.session ? currentState.session.commandCount : 0;
    const isLiveRealDraftRoom = () => currentDraftSession === 'live' && currentDraftMode === 'real';
    const priceInputValue = () => Number(byId('add-price').value);
    const gapClassFor = gap => gap > 0 ? 'gap-positive' : gap < 0 ? 'gap-negative' : '';
    const sessionQuery = () => {
      const params = new URLSearchParams({ draftSession: currentDraftSession, owner: currentWatchOwner });
      if (isPlatformDraftToolsContext()) params.set('seasonId', platformSeasonId());
      return '&' + params.toString();
    };
    const scopedApiUrl = url => {
      if (!isPlatformDraftToolsContext() || url.includes('seasonId=')) return url;
      const seasonId = platformSeasonId();
      if (!seasonId) return url;
      return url + (url.includes('?') ? '&' : '?') + 'seasonId=' + encodeURIComponent(seasonId);
    };
    const setBoardPositionFilter = nextPosition => {
      if (!boardPositions.includes(nextPosition)) return;
      boardPositionFilter = boardPositionFilter === nextPosition ? 'ALL' : nextPosition;
      if (currentState) renderBoard(currentState);
    };
    const stateUrl = () => '/api/state?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery();
    const mockDraftUrl = () =>
      '/api/mock/state?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery() + '&seed=live-ui' +
      (pendingCamNominationName ? '&nominatedPlayer=' + encodeURIComponent(pendingCamNominationName) + '&nominatedPrice=' + encodeURIComponent(String(pendingCamNominationPrice)) : '');
    const draftNightLockFor = state => {
      if (state && state.activeDraftSession && state.activeDraftSession.key !== currentDraftSession) return currentDraftSession === 'live';
      if (state && state.draftNightLock) return Boolean(state.draftNightLock.locked);
      return currentDraftSession === 'live';
    };
    const draftNightLockReasonFor = state =>
      state && state.draftNightLock && state.draftNightLock.reason
        ? state.draftNightLock.reason
        : 'Live session locked. Switch to a practice session to run mocks.';
    const practiceSessionForStrategy = strategyKey =>
      strategyKey === 'wr-heavy' ? 'practice-wr-heavy' : 'practice-3rb';
    const draftSessionKeys = ['live', 'practice-3rb', 'practice-wr-heavy'];
    const normalizeDraftSession = (value, mode = currentDraftMode, strategyKey = currentStrategyKey) => {
      const session = cleanText(value).trim();
      if (draftSessionKeys.includes(session)) return session;
      if (session.startsWith('scratch:')) return session;
      return mode === 'interactive-mock' ? practiceSessionForStrategy(strategyKey) : 'live';
    };
    const draftModeForSession = (session, mode) =>
      session === 'live' && mode === 'interactive-mock' ? 'real' : mode;
    const draftLifecycleContext = () => ({
      mode: currentDraftMode,
      session: currentDraftSession,
      strategy: currentStrategyKey,
      owner: currentWatchOwner
    });
    const sameDraftLifecycleContext = context =>
      context &&
      context.mode === currentDraftMode &&
      context.session === currentDraftSession &&
      context.strategy === currentStrategyKey &&
      context.owner === currentWatchOwner;
    const isActiveDraft = () => draftLifecycle === 'active';
    const isStartingDraft = () => draftLifecycle === 'countdown';
    const normalizeDraftLifecycle = value => {
      if (value === 'countdown') return 'ready';
      if (draftLifecycles.includes(value)) return value;
      return 'setup';
    };
    const persistDraftLifecycle = () => {
      try {
        if (!window.localStorage) return;
        window.localStorage.setItem(draftLifecycleStorageKey(), JSON.stringify({
          lifecycle: draftLifecycle,
          mode: currentDraftMode,
          session: currentDraftSession,
          strategy: currentStrategyKey,
          owner: currentWatchOwner
        }));
      } catch {
        // The draft state still renders correctly without local storage.
      }
    };
    const loadDraftLifecycle = () => {
      try {
        if (!window.localStorage) return;
        const stored = window.localStorage.getItem(draftLifecycleStorageKey());
        if (!stored) return;
        const parsed = JSON.parse(stored);
        if (strategyKeys.includes(parsed.strategy)) currentStrategyKey = parsed.strategy;
        if (draftModes.includes(parsed.mode)) currentDraftMode = parsed.mode;
        if (typeof parsed.owner === 'string' && parsed.owner.trim()) currentWatchOwner = parsed.owner.trim();
        if (typeof parsed.session === 'string' && parsed.session) {
          currentDraftSession = normalizeDraftSession(parsed.session, currentDraftMode, currentStrategyKey);
        }
        currentDraftMode = draftModeForSession(currentDraftSession, currentDraftMode);
        draftLifecycle = normalizeDraftLifecycle(parsed.lifecycle);
      } catch {
        draftLifecycle = 'setup';
      }
    };
    const realDraftHasStarted = state => currentDraftMode === 'real' && (isActiveDraft() || state.events.length > 0);
    const visibleBoardTargets = state => [
      ...(!realDraftHasStarted(state) ? (state.keeperTargets || []) : []),
      ...(state.availableTargets || [])
    ];
    const shortlistStorageKey = () => 'mockd-shortlist:' + platformStorageScope() + ':' + currentDraftSession;
    const loadManualShortlist = () => {
      try {
        const stored = window.localStorage ? window.localStorage.getItem(shortlistStorageKey()) : null;
        const parsed = stored ? JSON.parse(stored) : [];
        manualShortlistNames = Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string') : [];
      } catch {
        manualShortlistNames = [];
      }
    };
    const saveManualShortlist = () => {
      try {
        if (window.localStorage) window.localStorage.setItem(shortlistStorageKey(), JSON.stringify(manualShortlistNames));
      } catch {
        // Draft-room shortcuts should keep working even when storage is unavailable.
      }
    };
    const isShortlisted = target => manualShortlistNames.includes(target.name);

    const preservePlatformSeason = params => {
      if (!isPlatformDraftToolsContext()) return;
      const seasonId = new URLSearchParams(window.location.search).get('seasonId');
      if (seasonId) params.set('seasonId', seasonId);
    };
    const playerNewsQueryString = () => {
      const params = new URLSearchParams();
      params.set('strategy', currentStrategyKey);
      params.set('mode', currentDraftMode);
      params.set('draftSession', currentDraftSession);
      params.set('owner', currentWatchOwner);
      params.set('source', playerNewsSource);
      if (playerNewsQuery) params.set('q', playerNewsQuery);
      if (playerNewsCategory !== 'All') params.set('category', playerNewsCategory);
      if (playerNewsAction !== 'All') params.set('action', playerNewsAction);
      preservePlatformSeason(params);
      return params.toString();
    };
    const playerNewsUrl = () => '/api/player-news?' + playerNewsQueryString();
    const playerNewsRouteUrl = () => '/player-news?' + playerNewsQueryString();
    const myExpertQueryString = () => {
      const params = new URLSearchParams();
      params.set('strategy', currentStrategyKey);
      params.set('mode', currentDraftMode);
      params.set('draftSession', currentDraftSession);
      params.set('owner', currentWatchOwner);
      params.set('week', String(myExpertWeek));
      preservePlatformSeason(params);
      return params.toString();
    };
    const myExpertUrl = () => '/api/my-expert?' + myExpertQueryString();
    const myExpertRouteUrl = () => '/my-expert?' + myExpertQueryString();
    const mockSimulationsRouteUrl = scenario => {
      const params = new URLSearchParams();
      params.set('strategy', currentStrategyKey);
      params.set('mode', currentDraftMode);
      params.set('draftSession', currentDraftSession);
      params.set('owner', currentWatchOwner);
      if (scenario) params.set('scenario', scenario);
      preservePlatformSeason(params);
      return (isPlatformDraftToolsContext() ? '/simulations?' : '/mock-simulations?') + params.toString();
    };
    const mockResultsRouteUrl = () => {
      const params = new URLSearchParams();
      params.set('strategy', currentStrategyKey);
      params.set('mode', currentDraftMode);
      params.set('draftSession', currentDraftSession);
      params.set('owner', currentWatchOwner);
      preservePlatformSeason(params);
      return '/mock-results?' + params.toString();
    };
    const draftSessionForMode = mode =>
      mode === 'interactive-mock' && currentDraftSession === 'live' ? practiceSessionForStrategy(currentStrategyKey) : currentDraftSession;
    const draftRoomRouteUrl = mode => {
      const nextMode = draftModes.includes(mode) ? mode : currentDraftMode;
      const params = new URLSearchParams();
      params.set('mode', nextMode);
      params.set('strategy', currentStrategyKey);
      params.set('draftSession', draftSessionForMode(nextMode));
      params.set('owner', currentWatchOwner);
      preservePlatformSeason(params);
      const platformPath = window.location.pathname === '/strategy' && nextMode === 'interactive-mock'
        ? '/strategy'
        : nextMode === 'interactive-mock'
          ? '/mock-drafts'
          : '/board';
      const routePath = isPlatformDraftToolsContext()
        ? platformPath
        : '/';
      return routePath + '?' + params.toString();
    };
    const leagueHomeUrl = () => {
      const seasonId = new URLSearchParams(window.location.search).get('seasonId');
      return seasonId ? '/app?seasonId=' + encodeURIComponent(seasonId) : '/app';
    };
    const configurePlatformWorkspaceChrome = () => {
      const isPlatform = isPlatformDraftToolsContext();
      const leagueHomeButton = byId('league-home-button');
      leagueHomeButton.hidden = !isPlatform;
      if (!isPlatform) return;

      const menuButton = byId('start-real-draft-button');
      menuButton.dataset.menuLabel = 'Board';
      menuButton.setAttribute('aria-label', 'Open board');
      menuButton.querySelector('strong').textContent = 'Board';
      menuButton.querySelector('span').textContent = 'Player prep';
      const modeButton = byId('draft-mode-real-button');
      modeButton.querySelector('strong').textContent = 'Board';
      modeButton.querySelector('span').textContent = 'Player prep';
    };
    const platformDraftModeForPath = path => {
      if (path === '/board') return 'real';
      if (['/mock-drafts', '/simulations', '/strategy'].includes(path)) return 'interactive-mock';
      return null;
    };
    const hydrateDraftRoomFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const strategy = params.get('strategy');
      const mode = params.get('mode');
      const draftSession = params.get('draftSession');
      const owner = params.get('owner');
      const platformDraftMode = platformDraftModeForPath(window.location.pathname);
      const previousContext = draftLifecycleContext();

      if (strategyKeys.includes(strategy)) currentStrategyKey = strategy;
      if (draftModes.includes(mode)) currentDraftMode = mode;
      else if (platformDraftMode) currentDraftMode = platformDraftMode;
      if (owner && owner.trim()) currentWatchOwner = owner.trim();
      if (draftSession) currentDraftSession = normalizeDraftSession(draftSession, currentDraftMode, currentStrategyKey);
      else if (platformDraftMode === 'real') currentDraftSession = 'live';
      else if (platformDraftMode === 'interactive-mock') currentDraftSession = practiceSessionForStrategy(currentStrategyKey);
      else currentDraftSession = normalizeDraftSession(currentDraftSession, currentDraftMode, currentStrategyKey);
      currentDraftMode = draftModeForSession(currentDraftSession, currentDraftMode);
      if (isPlatformBoardRoute()) {
        draftLifecycle = 'setup';
        draftCountdownValue = 0;
        persistDraftLifecycle();
      } else if (!sameDraftLifecycleContext(previousContext) && !isStartingDraft()) {
        draftLifecycle = 'setup';
        draftCountdownValue = 0;
        persistDraftLifecycle();
      }
    };
    const hydrateMyExpertFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const strategy = params.get('strategy');
      const mode = params.get('mode');
      const draftSession = params.get('draftSession');
      const owner = params.get('owner');
      const week = Number(params.get('week') || 1);

      if (strategyKeys.includes(strategy)) currentStrategyKey = strategy;
      if (draftModes.includes(mode)) currentDraftMode = mode;
      if (draftSession) currentDraftSession = draftSession;
      if (owner && owner.trim()) currentWatchOwner = owner.trim();
      myExpertWeek = Number.isInteger(week) && week > 0 ? week : 1;
    };

    const textElement = (tagName, text, className) => {
      const element = document.createElement(tagName);
      element.textContent = cleanText(text);
      if (className) element.className = className;
      return element;
    };

    const commandInput = () => {
      if (isActiveDraft() && currentDraftMode === 'real') return byId('header-quick-sale-command');
      if (isActiveDraft() && currentDraftMode === 'interactive-mock') return null;
      return byId('quick-sale-command');
    };

    const boardSearchQuery = () => {
      const boardSearch = byId('board-search').value.trim();
      return boardSearch.toLowerCase();
    };

    const appMenuSlotIdsByRoute = {
      'draft-room': 'draft-header-menu-slot',
      'mock-simulations': 'mock-simulations-header-menu-slot',
      'mock-results': 'mock-results-header-menu-slot',
      'my-expert': 'my-expert-header-menu-slot',
      'player-news': 'player-news-header-menu-slot'
    };

    const appMenuSlotForRoute = route =>
      byId(appMenuSlotIdsByRoute[route] || appMenuSlotIdsByRoute['draft-room']);

    const syncAppMenuHostForRoute = route => {
      const appMenu = byId('app-menu');
      const menuSlot = appMenuSlotForRoute(route);
      if (!appMenu || !menuSlot) return;
      if (appMenu.parentElement !== menuSlot) menuSlot.append(appMenu);
    };

    const setActiveRouteShell = route => {
      syncAppMenuHostForRoute(route);
      document.body.dataset.activeRoute = route;
    };

    const showOnlyAppView = activeId => {
      for (const id of ['draft-room-view', 'mock-simulations-view', 'mock-results-view', 'my-expert-view', 'player-news-view']) {
        byId(id).hidden = id !== activeId;
      }
    };

    const setAppMenuOpen = isOpen => {
      byId('app-menu-list').hidden = !isOpen;
      byId('app-menu-button').setAttribute('aria-expanded', String(isOpen));
    };

    const closeAppMenu = () => setAppMenuOpen(false);

    const setAppMenuCurrent = (key, label) => {
      byId('app-menu-current-label').textContent = label;
      for (const item of document.querySelectorAll('#app-menu-list [data-menu-key]')) {
        if (item.dataset.menuKey === key) {
          item.setAttribute('aria-current', 'page');
        } else {
          item.removeAttribute('aria-current');
        }
      }
    };

    const playerNewsFilterLabels = {
      source: {
        local: 'Local evidence',
        'rotowire-rss': 'RotoWire RSS',
        all: 'All sources'
      },
      category: {
        All: 'All categories',
        Injury: 'Injury',
        Practice: 'Practice',
        Transaction: 'Transaction',
        'Depth chart': 'Depth chart',
        Role: 'Role',
        Matchup: 'Matchup',
        'Team context': 'Team context',
        Market: 'Market',
        News: 'News'
      },
      action: {
        All: 'All actions',
        'Move up': 'Move up',
        Watch: 'Watch',
        Fade: 'Fade',
        'No model change': 'No model change'
      }
    };

    const playerNewsFilterControlLabels = {
      source: 'News source',
      category: 'News category',
      action: 'Draft action'
    };

    const playerNewsFilterValue = (key, value, fallback) => {
      const labels = playerNewsFilterLabels[key] || {};
      return value && Object.prototype.hasOwnProperty.call(labels, value) ? value : fallback;
    };

    const playerNewsFilterOptionsFor = key =>
      Array.from(document.querySelectorAll('[data-player-news-option-key="' + key + '"]'));

    const syncPlayerNewsFilterControl = (key, value) => {
      const labels = playerNewsFilterLabels[key] || {};
      const safeValue = playerNewsFilterValue(key, value, Object.keys(labels)[0] || '');
      const optionLabel = labels[safeValue] || safeValue;
      const button = byId('player-news-' + key + '-filter');
      byId('player-news-' + key + '-label').textContent = optionLabel;
      button.dataset.playerNewsValue = safeValue;
      button.setAttribute('aria-label', playerNewsFilterControlLabels[key] + ': ' + optionLabel);
      for (const option of playerNewsFilterOptionsFor(key)) {
        const isSelected = option.dataset.playerNewsValue === safeValue;
        option.setAttribute('aria-selected', String(isSelected));
      }
    };

    const closePlayerNewsFilters = () => {
      for (const list of document.querySelectorAll('.player-news-filter-options')) {
        list.hidden = true;
      }
      for (const button of document.querySelectorAll('.player-news-filter-button')) {
        button.setAttribute('aria-expanded', 'false');
      }
    };

    const setPlayerNewsFilterOpen = (key, isOpen) => {
      closePlayerNewsFilters();
      byId('player-news-' + key + '-options').hidden = !isOpen;
      byId('player-news-' + key + '-filter').setAttribute('aria-expanded', String(isOpen));
    };

    const focusPlayerNewsFilterOption = (key, value, direction = 0) => {
      const options = playerNewsFilterOptionsFor(key);
      if (!options.length) return;
      const selectedIndex = options.findIndex(option => option.dataset.playerNewsValue === value);
      const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = (baseIndex + direction + options.length) % options.length;
      options[nextIndex].focus();
    };

    const focusPlayerNewsFilterBoundaryOption = (key, boundary) => {
      const options = playerNewsFilterOptionsFor(key);
      const option = boundary === 'last' ? options[options.length - 1] : options[0];
      if (option) option.focus();
    };

    const focusPlayerNewsFilterTypeahead = (key, character, currentValue) => {
      const options = playerNewsFilterOptionsFor(key);
      const query = cleanText(character).toLowerCase();
      if (!query || !options.length) return;
      const currentIndex = options.findIndex(option => option.dataset.playerNewsValue === currentValue);
      const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
      const orderedOptions = [...options.slice(startIndex), ...options.slice(0, startIndex)];
      const match = orderedOptions.find(option => cleanText(option.textContent).trim().toLowerCase().startsWith(query));
      if (match) match.focus();
    };

    const handlePlayerNewsFilterButtonKeydown = event => {
      const key = event.currentTarget.dataset.playerNewsFilterKey;
      if (!key) return;
      const value = event.currentTarget.dataset.playerNewsValue;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const options = byId('player-news-' + key + '-options');
        setPlayerNewsFilterOpen(key, options.hidden);
        if (options.hidden === false) focusPlayerNewsFilterOption(key, value);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setPlayerNewsFilterOpen(key, true);
        focusPlayerNewsFilterOption(key, value, event.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      if (event.key.length === 1) {
        setPlayerNewsFilterOpen(key, true);
        focusPlayerNewsFilterTypeahead(key, event.key, value);
      }
    };

    const setPlayerNewsFilterValue = async (key, value) => {
      const fallback = key === 'source' ? 'local' : 'All';
      const safeValue = playerNewsFilterValue(key, value, fallback);
      if (key === 'source') playerNewsSource = safeValue;
      if (key === 'category') playerNewsCategory = safeValue;
      if (key === 'action') playerNewsAction = safeValue;
      closePlayerNewsFilters();
      syncPlayerNewsControls();
      await refreshPlayerNewsIfCurrentRoute();
    };

    const handlePlayerNewsFilterOptionKeydown = event => {
      const key = event.currentTarget.dataset.playerNewsOptionKey;
      const value = event.currentTarget.dataset.playerNewsValue;
      if (!key) return;

      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void setPlayerNewsFilterValue(key, value);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        closePlayerNewsFilters();
        byId('player-news-' + key + '-filter').focus();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        focusPlayerNewsFilterOption(key, value, event.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        focusPlayerNewsFilterBoundaryOption(key, event.key === 'End' ? 'last' : 'first');
        return;
      }

      if (event.key.length === 1) {
        focusPlayerNewsFilterTypeahead(key, event.key, value);
      }
    };

    const syncPlayerNewsControls = () => {
      syncPlayerNewsFilterControl('source', playerNewsSource);
      syncPlayerNewsFilterControl('category', playerNewsCategory);
      syncPlayerNewsFilterControl('action', playerNewsAction);
      byId('player-news-search').value = playerNewsQuery;
    };

    const hydratePlayerNewsFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const strategy = params.get('strategy');
      const mode = params.get('mode');
      const draftSession = params.get('draftSession');
      const owner = params.get('owner');

      if (strategyKeys.includes(strategy)) currentStrategyKey = strategy;
      if (draftModes.includes(mode)) currentDraftMode = mode;
      if (draftSession) currentDraftSession = draftSession;
      if (owner && owner.trim()) currentWatchOwner = owner.trim();

      playerNewsSource = playerNewsFilterValue('source', params.get('source'), 'all');
      playerNewsCategory = playerNewsFilterValue('category', params.get('category'), 'All');
      playerNewsAction = playerNewsFilterValue('action', params.get('action'), 'All');
      playerNewsQuery = params.get('q') || '';
      syncPlayerNewsControls();
    };

    const replacePlayerNewsRoute = () => {
      if (window.location.pathname === '/player-news') window.history.replaceState(null, '', playerNewsRouteUrl());
    };

    const safePlayerNewsSourceUrl = value => {
      const raw = cleanText(value).trim();
      if (!raw) return '';

      try {
        const url = new URL(raw);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
      } catch (error) {
        return '';
      }
    };

    const focusCommandInput = () => {
      requestAnimationFrame(() => {
        if (byId('draft-room-view').hidden) return;
        const input = commandInput();
        if (input) {
          if (input.id === 'quick-sale-command') byId('quick-sale-command').focus();
          else input.focus();
          return;
        }
        byId('header-board-search').focus();
      });
    };

    const focusPriceInput = () => {
      requestAnimationFrame(() => byId('add-price').focus());
    };

    const focusNominationPriceInput = () => {
      requestAnimationFrame(() => byId('mock-nomination-price').focus());
    };

    const announceOperation = (message, { assertive = false, focus = false } = {}) => {
      const status = byId('operation-status');
      if (!status) return;
      status.setAttribute('role', assertive ? 'alert' : 'status');
      status.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
      status.textContent = cleanText(message);
      if (focus) requestAnimationFrame(() => status.focus());
    };

    const postJson = async (url, body) => {
      try {
        const response = await fetch(scopedApiUrl(url), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            strategyKey: currentStrategyKey,
            mode: currentDraftMode,
            draftSession: currentDraftSession,
            owner: currentWatchOwner,
            ...(body || {})
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && !Array.isArray(data.errors)) {
          const message = typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error.message === 'string'
              ? data.error.message
              : 'Could not update draft room.';
          data.errors = [{ input: '', message }];
        }
        if (data.availableTargets && data.owners) render(data);
        else if (!response.ok) renderErrors(data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not reach the draft room.';
        announceOperation(message, { assertive: true, focus: true });
        return { errors: [{ input: '', message }] };
      }
    };

    const alertCommandErrors = data => {
      const messages = (data && Array.isArray(data.errors) ? data.errors : [])
        .map(error => error && error.message)
        .filter(Boolean);
      if (messages.length) announceOperation(messages.join(' '), { assertive: true, focus: true });
    };

    const tableCell = (row, text, className) => {
      const element = document.createElement('td');
      element.textContent = cleanText(text);
      if (className) element.className = className;
      row.appendChild(element);
      return element;
    };

    const marketPriceCell = (row, target) => {
      const element = document.createElement('td');
      element.className = 'money market-price-cell';
      const livePrice = money(target.liveExpectedPrice);
      const expectedPrice = money(target.expectedPrice);
      if (target.liveExpectedPrice === target.expectedPrice) {
        element.textContent = livePrice;
      } else {
        const stack = document.createElement('div');
        stack.className = 'market-price-stack';
        stack.append(
          textElement('span', livePrice),
          textElement('span', 'exp ' + expectedPrice, 'market-price-detail')
        );
        element.replaceChildren(stack);
      }
      row.appendChild(element);
      return element;
    };

    const metricTile = (label, value, className) => {
      const element = document.createElement('div');
      element.className = className;
      element.append(textElement('span', label), textElement('strong', value));
      return element;
    };

    const shortPlayerName = name => {
      const parts = cleanText(name).split(' ').filter(Boolean);
      return parts[parts.length - 1] || cleanText(name);
    };

    const renderSidePanel = state => {
      for (const button of document.querySelectorAll('[data-side-panel]')) {
        button.setAttribute('aria-pressed', String(button.dataset.sidePanel === activeSidePanel));
      }
      for (const panel of document.querySelectorAll('[data-side-panel-view]')) {
        panel.hidden = panel.dataset.sidePanelView !== activeSidePanel;
      }
      if (state && activeSidePanel === 'shortlist') renderShortlist(state);
    };

    const setSidePanel = panel => {
      activeSidePanel = ['lineup', 'shortlist', 'draft-path'].includes(panel) ? panel : 'lineup';
      if (currentState) renderSidePanel(currentState);
    };

    const selectTargetForSale = target => {
      if (!target || target.draftable === false) return;
      selectedTargetName = target.name;
      byId('add-price').value = String(target.recommendedMaxBid);
      setSidePanel('lineup');
      renderSelected(currentState);
      renderBoard(currentState);
      if (currentDraftMode === 'interactive-mock' && currentMockDraft && currentMockDraft.phase === 'human-nomination') {
        focusNominationPriceInput();
      } else if (currentDraftMode === 'interactive-mock') focusCommandInput();
      else focusPriceInput();
    };

    const selectTargetForNomination = target => {
      selectTargetForSale(target);
      if (!target || target.draftable === false) return;
      pendingCamNominationName = target.name;
      if (currentMockDraft) renderMockDraft(currentMockDraft);
      focusNominationPriceInput();
    };

    const toggleShortlist = target => {
      if (!target || target.draftable === false) return;
      manualShortlistNames = isShortlisted(target)
        ? manualShortlistNames.filter(name => name !== target.name)
        : [...manualShortlistNames, target.name];
      saveManualShortlist();
      setSidePanel('shortlist');
      if (currentState) {
        renderShortlist(currentState);
        renderBoard(currentState);
      }
    };

    const buildAroundAnchorPriceFor = target => {
      const candidates = [
        target.liveExpectedPrice,
        target.expectedPrice,
        target.personalValue,
        target.recommendedMaxBid
      ];
      const anchor = candidates
        .map(value => Number(value))
        .find(value => Number.isFinite(value) && value > 0);
      return Math.max(1, Math.round(anchor || 1));
    };

    const buildAroundPriceSweepFor = target => {
      const anchor = Math.min(80, buildAroundAnchorPriceFor(target));
      const step = anchor >= 8 ? 2 : 1;
      const spread = anchor >= 50 ? 6 : anchor >= 20 ? 4 : Math.max(2, step);
      const low = Math.min(anchor, Math.max(1, anchor - spread));
      const high = Math.max(low, Math.min(80, anchor + spread));
      return { low, high, step };
    };

    const buildAroundScriptForTarget = target => {
      const sweep = buildAroundPriceSweepFor(target);
      return 'Build around ' + target.name + ':' + sweep.low + '-' + sweep.high + ':' + sweep.step;
    };

    const selectTargetForBuildAround = target => {
      if (!target || target.draftable === false) return;
      selectedTargetName = target.name;
      window.location.assign(mockSimulationsRouteUrl(buildAroundScriptForTarget(target)));
    };

    const starTargetButton = target => {
      const button = document.createElement('button');
      button.className = 'star-button';
      button.type = 'button';
      button.textContent = isShortlisted(target) ? '★' : '☆';
      button.title = isShortlisted(target) ? 'Remove from shortlist' : 'Add to shortlist';
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(isShortlisted(target)));
      button.disabled = target.draftable === false;
      button.addEventListener('click', event => {
        event.stopPropagation();
        toggleShortlist(target);
      });
      return button;
    };

    const closeTargetActionMenus = () => {
      for (const menu of document.querySelectorAll('.target-action-menu')) {
        menu.hidden = true;
      }
      for (const trigger of document.querySelectorAll('.target-action-trigger')) {
        trigger.setAttribute('aria-expanded', 'false');
      }
      for (const cell of document.querySelectorAll('.target-action-cell-open')) {
        cell.classList.remove('target-action-cell-open');
      }
      for (const row of document.querySelectorAll('.target-action-row-open')) {
        row.classList.remove('target-action-row-open');
      }
    };

    const targetActionMenuButton = (label, disabled, onClick, className = '') => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'menuitem';
      button.textContent = label;
      button.disabled = disabled;
      if (className) button.className = className;
      button.addEventListener('click', event => {
        event.stopPropagation();
        closeTargetActionMenus();
        onClick();
      });
      return button;
    };

    const addTargetButton = (target, className) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'target-action';

      const button = document.createElement('button');
      button.className = className + ' target-action-trigger';
      button.type = 'button';
      button.textContent = '+';
      button.title = 'Actions for ' + target.name;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      if (target.draftable === false) button.disabled = true;
      button.addEventListener('click', event => {
        event.stopPropagation();
        const menu = wrapper.querySelector('.target-action-menu');
        const shouldOpen = Boolean(menu && menu.hidden);
        closeTargetActionMenus();
        if (menu) menu.hidden = !shouldOpen;
        button.setAttribute('aria-expanded', String(shouldOpen));
        if (shouldOpen) {
          const cell = wrapper.closest('td');
          if (cell) cell.classList.add('target-action-cell-open');
          const row = wrapper.closest('tr');
          if (row) row.classList.add('target-action-row-open');
        }
      });

      const menu = document.createElement('div');
      menu.className = 'target-action-menu';
      menu.role = 'menu';
      menu.hidden = true;
      menu.addEventListener('click', event => event.stopPropagation());

      const shortlistLabel = isShortlisted(target) ? 'Remove from shortlist' : 'Add to shortlist';
      const shortlistAction = targetActionMenuButton(shortlistLabel, target.draftable === false, () => toggleShortlist(target));
      const buildAroundAction = targetActionMenuButton('Build around', target.draftable === false, () => selectTargetForBuildAround(target));
      const secondaryAction = currentDraftMode === 'interactive-mock'
        ? targetActionMenuButton('Nominate', !canNominateTarget(target), () => {
            selectTargetForNomination(target);
          }, 'target-action-primary')
        : targetActionMenuButton('Select for sale', target.draftable === false, () => selectTargetForSale(target), 'target-action-primary');

      const menuActions = [shortlistAction];
      if (!isActiveDraft()) menuActions.push(buildAroundAction);
      if (!isPlatformBoardRoute()) menuActions.push(secondaryAction);
      menu.replaceChildren(...menuActions);
      wrapper.replaceChildren(button, menu);
      return wrapper;
    };

    const ownerNeedsFor = owner => {
      const starterNeeds = owner.slots
        .filter(slot => !slot.player && !slot.slot.startsWith('BENCH'))
        .map(slot => slot.slot);
      if (starterNeeds.length) return starterNeeds;
      return owner.rosterSlotsRemaining > 0 ? ['BENCH x' + owner.rosterSlotsRemaining] : ['Roster full'];
    };

    const targetFitsOwnerNeed = (target, owner) => {
      if (owner.rosterSlotsRemaining <= 0) return false;
      if (owner.positionCounts[target.position] >= rosterMaximums[target.position]) return false;
      const openSlots = owner.slots.filter(slot => !slot.player).map(slot => slot.slot);
      if (openSlots.includes(target.position)) return true;
      if (target.position === 'RB' && (openSlots.includes('RB1') || openSlots.includes('RB2') || owner.positionCounts.RB < 3)) return true;
      if (target.position === 'WR' && (openSlots.includes('WR1') || openSlots.includes('WR2') || owner.positionCounts.WR < 3)) return true;
      if (target.position === 'TE' && openSlots.includes('TE')) return true;
      return openSlots.includes('FLEX') && isFlexPosition(target.position);
    };

    const saleWarningsFor = (target, owner, price) => {
      if (!target) return [];
      const warnings = [];
      if (!Number.isInteger(price) || price <= 0) warnings.push('Enter a positive whole-dollar price.');
      if (owner.rosterSlotsRemaining <= 0) warnings.push(owner.owner + ' has no open roster slots.');
      if (price > owner.maxBid) warnings.push(owner.owner + ' can only bid up to ' + money(owner.maxBid) + '.');
      if (owner.positionCounts[target.position] >= rosterMaximums[target.position]) {
        warnings.push(owner.owner + ' cannot buy ' + target.name + ': roster limit is ' + rosterMaximums[target.position] + ' ' + target.position + 's.');
      }
      return warnings;
    };

    const tierDropsFor = targets => {
      const drops = new Map();
      for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DST']) {
        const samePosition = targets
          .filter(target => target.position === position)
          .sort((left, right) =>
            right.liveExpectedPrice - left.liveExpectedPrice ||
            right.valueScore - left.valueScore ||
            left.name.localeCompare(right.name)
          );
        samePosition.forEach((target, index) => {
          const next = samePosition[index + 1];
          drops.set(target.name, next ? Math.max(0, target.liveExpectedPrice - next.liveExpectedPrice) : 0);
        });
      }
      return drops;
    };

    const targetTagData = (target, tierDrop) => {
      if (target.draftable === false) {
        return target.tags.map(label => ({ label, className: 'tag warning' }));
      }
      const tags = target.tags.map(label => ({ label, className: tagClassFor(label) }));
      const gap = valueGapFor(target);
      if (gap >= 6) tags.unshift({ label: 'value ' + deltaMoney(gap), className: 'tag value' });
      if (gap <= -6) tags.unshift({ label: 'tax ' + deltaMoney(gap), className: 'tag warning' });
      if (tierDrop >= 6) tags.push({ label: 'next ' + target.position + ' -' + money(tierDrop), className: 'tag warning' });
      if (target.recommendedMaxBid >= currentOwner().maxBid) tags.push({ label: 'max bid cap', className: 'tag warning' });
      return tags.slice(0, 5);
    };

    const tagClassFor = label => {
      const lower = cleanText(label).toLowerCase();
      if (lower.includes('not affordable')) return 'tag warning';
      if (lower.includes('starter')) return 'tag need';
      if (lower.includes('flex')) return 'tag flex';
      if (lower.includes('3rb')) return 'tag strategy';
      return 'tag';
    };

    const targetTags = (target, tierDrop) => {
      const tagData = targetTagData(target, tierDrop);
      if (!tagData.length) return null;
      const tags = document.createElement('div');
      tags.className = 'subtle';
      tags.replaceChildren(...tagData.map(tag => {
        const element = document.createElement('span');
        element.className = tag.className;
        element.textContent = tag.label;
        return element;
      }));
      return tags;
    };

    const renderStrategyValues = target => {
      if (!target.strategyValues) return null;
      const row = document.createElement('div');
      row.className = 'strategy-values';
      row.replaceChildren(...strategyKeys.map(strategyKey => {
        const value = target.strategyValues[strategyKey];
        const item = document.createElement('span');
        item.className = 'strategy-value strategy-' + strategyKey + (strategyKey === currentStrategyKey ? ' active' : '');
        item.textContent = strategyValueLabels[strategyKey] + ' ' + money(value);
        return item;
      }));
      return row;
    };

    const optionList = state => state.owners.map(owner => {
      const option = document.createElement('option');
      option.value = owner.owner;
      option.textContent = owner.owner;
      return option;
    });

    const syncOwnerSelects = state => {
      const addOwner = byId('add-owner');
      const rosterOwner = byId('roster-owner');
      if (addOwner.options.length !== state.owners.length) {
        addOwner.replaceChildren(...optionList(state));
        rosterOwner.replaceChildren(...optionList(state));
      }
      addOwner.value = selectedRosterOwner;
      rosterOwner.value = selectedRosterOwner;
    };

    const syncSelectOptions = (select, values, allLabel) => {
      const previous = select.value;
      const options = [textElement('option', allLabel)];
      options[0].value = '';
      for (const value of values) {
        const option = textElement('option', value);
        option.value = value;
        options.push(option);
      }
      select.replaceChildren(...options);
      select.value = values.includes(previous) ? previous : '';
    };

    const syncBoardFilterOptions = state => {
      const targets = visibleBoardTargets(state);
      const teams = [...new Set(targets.map(target => target.teamAbbreviation).filter(Boolean))].sort();
      const byes = [...new Set(targets.map(target => target.byeWeek).filter(Boolean))]
        .sort((left, right) => left - right)
        .map(String);
      syncSelectOptions(byId('team-filter'), teams, 'All teams');
      syncSelectOptions(byId('bye-filter'), byes, 'All byes');
    };

    const syncBoardControls = () => {
      for (const button of document.querySelectorAll('[data-position-filter]')) {
        button.setAttribute('aria-pressed', String(button.dataset.positionFilter === boardPositionFilter));
      }

      byId('strategy-select').value = currentStrategyKey;
      byId('sort-select').value = boardSortKey;
    };

    const syncStrategy = state => {
      const key = state.strategy && strategyKeys.includes(state.strategy.key) ? state.strategy.key : currentStrategyKey;
      currentStrategyKey = key;
      byId('strategy-select').value = currentStrategyKey;
    };

    const syncDraftSession = state => {
      if (state && state.activeDraftSession && state.activeDraftSession.key) {
        currentDraftSession = state.activeDraftSession.key;
      }

      const select = byId('draft-session-select');
      const sessions = state && Array.isArray(state.draftSessions) ? state.draftSessions : [];
      const selectedSession = sessions.find(session => session.key === currentDraftSession) ||
        { key: currentDraftSession, label: currentDraftSession };
      const options = sessions.map(session => {
        const option = document.createElement('option');
        option.value = session.key;
        option.textContent = session.label;
        return option;
      });
      if (!sessions.some(session => session.key === currentDraftSession)) {
        const option = document.createElement('option');
        option.value = currentDraftSession;
        option.textContent = selectedSession.label;
        options.push(option);
      }
      select.replaceChildren(...options);
      select.value = currentDraftSession;
      byId('session-summary-label').textContent = selectedSession.label;
      byId('active-session-label').textContent = selectedSession.label + ' - ' + (selectedSession.description || 'Isolated draft room.');
    };

    const activeSessionLabelFor = state => {
      const session = state && state.activeDraftSession;
      return session && session.label ? session.label : currentDraftSession;
    };

    const draftLifecycleLabel = () => {
      if (isActiveDraft()) return 'Active';
      if (isStartingDraft()) return 'Starting';
      if (draftLifecycle === 'ready') return 'Ready';
      return 'Setup';
    };

    const roomTitleFor = isMock => {
      if (isActiveDraft()) return isMock ? 'Mock Draft Room' : 'Live Draft Room';
      if (isStartingDraft()) return 'Starting Draft';
      return isMock ? 'Mock Draft' : 'Draft Setup';
    };

    const draftModeStatusDetailFor = copy => {
      if (draftLifecycle === 'ready') return 'Ready to start. Click Start draft for the countdown.';
      if (isStartingDraft()) return 'Starting now. Draft controls will unlock when the countdown finishes.';
      if (isActiveDraft()) return 'Draft is active. Setup controls are hidden until the draft ends.';
      return copy.detail;
    };

    const renderRoomModeIndicator = state => {
      if (isPlatformBoardRoute()) {
        const indicator = byId('room-mode-indicator');
        byId('room-title').textContent = 'Draft Board';
        indicator.className = 'room-mode-indicator real';
        indicator.replaceChildren(
          textElement('strong', 'Private prep'),
          textElement('span', currentWatchOwner + ' only')
        );
        return;
      }
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const isMock = currentDraftMode === 'interactive-mock';
      const indicator = byId('room-mode-indicator');
      byId('room-title').textContent = roomTitleFor(isMock);
      indicator.className = 'room-mode-indicator ' + (isMock ? 'mock' : 'real');
      indicator.replaceChildren(
        textElement('strong', copy.label),
        textElement('span', draftLifecycleLabel() + ' - ' + activeSessionLabelFor(state))
      );
    };

    const renderDraftLifecycle = state => {
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const isMock = currentDraftMode === 'interactive-mock';
      const isPlatformPrep = isPlatformBoardRoute();
      const canStartDraft = draftLifecycle === 'setup' || draftLifecycle === 'ready';
      const countdownText = String(draftCountdownValue || draftCountdownSeconds);

      byId('draft-room-view').classList.toggle('platform-prep', isPlatformPrep);
      byId('draft-room-view').classList.toggle('draft-active', !isPlatformPrep && isActiveDraft());
      byId('header-board-search').hidden = true;
      byId('header-quick-sale-form').hidden = isPlatformPrep || !(isActiveDraft() && currentDraftMode === 'real');
      byId('header-draft-actions').hidden = isPlatformPrep || !isActiveDraft();
      byId('header-import-log-button').hidden = isPlatformPrep || !(isActiveDraft() && currentDraftMode === 'real');
      byId('end-draft-button').hidden = isPlatformPrep || !isActiveDraft();
      byId('end-draft-button').textContent = isMock ? 'End mock draft' : 'End real draft';
      byId('sidebar-sale-command-section').hidden = isMock;
      byId('add-form').hidden = isPlatformPrep || isMock;

      byId('confirm-start-draft-button').hidden = isPlatformPrep || !canStartDraft;
      byId('confirm-start-draft-button').disabled = !canStartDraft;
      byId('confirm-start-draft-button').textContent = isMock && currentCommandCount() > 0 ? 'Resume mock draft' : 'Start draft';
      byId('draft-countdown').hidden = !isStartingDraft();
      byId('draft-countdown').textContent = countdownText;
      byId('draft-start-banner').hidden = isPlatformPrep || !isStartingDraft();
      byId('draft-start-label').textContent = copy.label + ' starts in';
      byId('draft-countdown-value').textContent = countdownText;
      byId('mock-draft-panel').hidden = !(isActiveDraft() && currentDraftMode === 'interactive-mock');

      byId('header-board-search').placeholder = isMock
        ? 'Search players during mock draft'
        : 'Search player, position, or team';
      if (state) renderRoomModeIndicator(state);
    };

    const renderDraftMode = state => {
      if (state && draftModes.includes(state.draftMode)) currentDraftMode = state.draftMode;
      const locked = draftNightLockFor(state);
      if (locked && currentDraftMode === 'interactive-mock') currentDraftMode = 'real';
      const copy = draftModeCopy[currentDraftMode] || draftModeCopy.real;
      const status = byId('draft-mode-status');
      const startMock = byId('start-mock-draft-button');
      renderDraftLifecycle(state);
      renderDraftModeChoice();
      const lifecycleCopy = draftModeStatusDetailFor(copy);
      status.replaceChildren(textElement('strong', copy.label), textElement('span', lifecycleCopy));
      setAppMenuCurrent(
        currentDraftMode === 'interactive-mock' ? 'mock-draft' : 'real-draft',
        isPlatformBoardRoute() ? 'Board' : copy.label
      );
      startMock.disabled = false;
      startMock.title = locked ? 'Opens a practice session for mocks.' : '';
      byId('draft-lock-status').textContent = locked
        ? 'Live session locked - practice rooms only for mocks.'
        : 'Practice room unlocked for mocks.';
    };

    const renderDraftModeChoice = () => {
      for (const button of document.querySelectorAll('[data-draft-mode-choice]')) {
        button.setAttribute('aria-pressed', String(button.dataset.draftModeChoice === currentDraftMode));
      }
    };

    const scriptOutcomeText = outcome => {
      if (!outcome) return '';
      const hitRate = Math.round((outcome.draftedByOwnerRate || 0) * 100);
      const saleRange = outcome.minimumSalePrice || outcome.maximumSalePrice
        ? ' / sale range ' + money(outcome.minimumSalePrice) + '-' + money(outcome.maximumSalePrice)
        : '';
      const ownerResult = outcome.owner + ' won ' + outcome.draftedByOwnerCount + '/' + outcome.runCount + ' (' + hitRate + '%)';
      const teamResult = outcome.averageOwnerRankWhenDrafted
        ? ' / avg rank when landed ' + scoreText(outcome.averageOwnerRankWhenDrafted)
        : '';
      const scoringResult = outcome.averageOwnerWeek1WhenDrafted
        ? ' / W1 ' + scoreText(outcome.averageOwnerWeek1WhenDrafted) +
          ' / Season ' + scoreText(outcome.averageOwnerSeasonStrengthWhenDrafted)
        : '';
      return outcome.player + ' up to ' + money(outcome.maxBid) + ': ' + ownerResult + saleRange + teamResult + scoringResult;
    };

    const buildAroundOutcomeText = outcome => {
      if (!outcome) return '';
      const hitRate = Math.round((outcome.draftedByOwnerRate || 0) * 100);
      const saleRange = outcome.minimumSalePrice || outcome.maximumSalePrice
        ? ' / sale range ' + money(outcome.minimumSalePrice) + '-' + money(outcome.maximumSalePrice)
        : '';
      return money(outcome.price) + ': ' +
        outcome.draftedByOwnerCount + '/' + outcome.runCount + ' landed (' + hitRate + '%)' +
        saleRange +
        ' / avg rank ' + scoreText(outcome.averageCamRank) +
        ' / W1 ' + scoreText(outcome.averageCamWeek1Score) +
        ' / Season ' + scoreText(outcome.averageCamSeasonStrengthScore) +
        ' / left ' + money(outcome.averageCamBudgetRemaining);
    };

    const bestBuildAroundOutcomeFor = outcomes => {
      const safeOutcomes = outcomes || [];
      return [...safeOutcomes].sort((left, right) =>
        left.averageCamRank - right.averageCamRank ||
        right.averageCamSeasonStrengthScore - left.averageCamSeasonStrengthScore ||
        right.averageCamWeek1Score - left.averageCamWeek1Score ||
        left.price - right.price
      )[0];
    };

    const renderMockBatchResults = report => {
      const root = byId('mock-batch-results');
      latestMockBatchReport = report || latestMockBatchReport;
      if (latestMockBatchReport && latestMockBatchReport.watchOwner) currentWatchOwner = latestMockBatchReport.watchOwner;
      if (!latestMockBatchReport) {
        root.replaceChildren(mockDraftItem('No simulations yet', 'Run simulations to compare team outcomes for the selected strategy.'));
        return;
      }

      const cam = latestMockBatchReport.cam;
      const items = [
        mockDraftItem(
          'Simulation summary',
          latestMockBatchReport.summary.runCount + ' runs - ' + latestMockBatchReport.options.strategyKey + ' - expected keepers'
        )
      ];

      const scriptOutcomes = latestMockBatchReport.script && latestMockBatchReport.script.targetOutcomes
        ? latestMockBatchReport.script.targetOutcomes
        : [];
      const buildAroundOutcomes = latestMockBatchReport.script && latestMockBatchReport.script.buildAroundOutcomes
        ? latestMockBatchReport.script.buildAroundOutcomes
        : [];
      if (latestMockBatchReport.script && latestMockBatchReport.script.buildAround) {
        const buildAround = latestMockBatchReport.script.buildAround;
        const bestBuildAround = bestBuildAroundOutcomeFor(buildAroundOutcomes);
        items.push(mockDraftItem(
          'Build around',
          bestBuildAround
            ? buildAround.player + ' best at ' + money(bestBuildAround.price) + ' - ' + buildAroundOutcomeText(bestBuildAround)
            : buildAround.player + ' at ' + buildAround.prices.map(price => money(price)).join(' / ') +
              ' - ' + latestMockBatchReport.summary.runCount + ' simulated drafts'
        ));
        if (buildAroundOutcomes.length) {
          items.push(mockDraftItem(
            'Price sweep',
            buildAroundOutcomes.map(buildAroundOutcomeText).join(' / ')
          ));
        }
      }
      if (scriptOutcomes.length) {
        items.push(mockDraftItem(
          'Script result',
          scriptOutcomes.map(scriptOutcomeText).join(' / ')
        ));
      }

      if (cam) {
        items.push(mockDraftItem(
          currentWatchOwner + ' average roster',
          money(cam.averageSpend) + ' spend / ' + money(cam.averageBudgetRemaining) + ' left / ' + cam.averageWeeks1To4Score + ' Weeks 1-4'
        ));
      }

      const exposures = (latestMockBatchReport.camTopExposures || []).slice(0, 5);
      if (exposures.length) {
        items.push(mockDraftItem(
          'Likely ' + currentWatchOwner + ' targets',
          exposures.map(exposure => exposure.player + ' ' + Math.round(exposure.draftedRate * 100) + '% at ' + money(exposure.averagePrice)).join(' / ')
        ));
      }

      const topPlayers = (latestMockBatchReport.topPlayers || []).slice(0, 4);
      if (topPlayers.length) {
        items.push(mockDraftItem(
          'Top room prices',
          topPlayers.map(player => player.name + ' ' + money(player.averageSalePrice)).join(' / ')
        ));
      }

      root.replaceChildren(...items);
    };

    const renderMockBatchResultsForJob = job => {
      if (!job || !job.result) {
        renderMockBatchResults(null);
        return;
      }
      if (!mockBatchJobMatchesCurrentControls(job)) {
        const previousLabel = job.script && job.script.label ? 'Previous: ' + job.script.label + '. ' : '';
        byId('mock-batch-results').replaceChildren(mockDraftItem(
          'Previous results',
          previousLabel + 'Run simulations to apply the current strategy, run count, and scenario.'
        ));
        return;
      }
      renderMockBatchResults(job.result);
    };

    const insightCard = (label, headline, details) => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      card.replaceChildren(
        textElement('strong', label),
        textElement('span', headline || '-'),
        textElement('span', details || '-')
      );
      return card;
    };

    const playerNewsActionClass = action =>
      cleanText(action).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    const playerNewsDateText = value => {
      if (!value) return '';
      const isDateOnly = /^\\d{4}-\\d{2}-\\d{2}$/.test(value);
      const date = new Date(isDateOnly ? value + 'T00:00:00' : value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        ...(isDateOnly ? {} : { hour: 'numeric', minute: '2-digit' })
      });
    };

    const playerNewsDateLabel = item => {
      if (item && item.sourceDate) return 'Written ' + playerNewsDateText(item.sourceDate);
      return 'No source date';
    };

    const playerNewsSourceLink = item => {
      const safeUrl = safePlayerNewsSourceUrl(item.source && item.source.url);
      if (!safeUrl) return textElement('span', item.source ? item.source.provider : 'Source', 'player-news-source');

      const link = document.createElement('a');
      link.className = 'player-news-source';
      link.href = safeUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = item.source.provider || 'Source';
      return link;
    };

    const playerNewsSourceStack = item => {
      const stack = document.createElement('div');
      stack.className = 'player-news-source-stack';
      stack.replaceChildren(
        playerNewsSourceLink(item),
        textElement('span', playerNewsDateLabel(item), 'player-news-date')
      );
      return stack;
    };

    const playerNewsChip = (text, className) => {
      const chip = textElement('span', text, 'player-news-chip' + (className ? ' ' + className : ''));
      return chip;
    };

    const playerNewsCard = item => {
      const card = document.createElement('article');
      card.className = 'player-news-card';

      const header = document.createElement('div');
      header.className = 'player-news-card-header';

      const player = document.createElement('div');
      player.className = 'player-news-player';
      player.appendChild(textElement('span', item.player));
      player.appendChild(textElement(
        'span',
        [item.position, item.teamAbbreviation].filter(Boolean).join(' / '),
        'player-news-meta'
      ));

      header.replaceChildren(player, playerNewsSourceStack(item));

      const tags = document.createElement('div');
      tags.className = 'player-news-tags';
      tags.replaceChildren(
        playerNewsChip(item.category),
        playerNewsChip(item.draftAction, 'player-news-action ' + playerNewsActionClass(item.draftAction)),
        playerNewsChip(playerNewsDateLabel(item), 'player-news-date-chip'),
        playerNewsChip(item.availability.detail)
      );

      const priceText = item.auction && item.auction.status === 'available'
        ? 'Exp ' + money(item.auction.expectedPrice) + ' / Live ' + money(item.auction.liveExpectedPrice) + ' / Max ' + money(item.auction.recommendedMaxBid)
        : item.auction.status;
      const modelTags = item.auction && item.auction.tags && item.auction.tags.length
        ? item.auction.tags.slice(0, 3).join(' / ')
        : priceText;

      card.replaceChildren(
        header,
        textElement('div', item.headline, 'player-news-headline'),
        textElement('div', item.fantasyImpact || '-', 'player-news-impact'),
        tags,
        textElement('div', modelTags, 'player-news-meta')
      );
      return card;
    };

    const renderPlayerNewsSummary = feed => {
      const rows = [
        ['Shown', String(feed.summary.filteredCount), feed.summary.totalCount + ' total updates'],
        ['Move up', String(feed.summary.moveUpCount), 'Positive draft-impact signals'],
        ['Watch', String(feed.summary.watchCount), 'Needs attention before bidding'],
        ['Fade', String(feed.summary.fadeCount), 'Risk-heavy updates']
      ].map(([label, value, detail]) => {
        const row = document.createElement('div');
        row.className = 'player-news-stat';
        row.replaceChildren(
          textElement('strong', label),
          textElement('b', value),
          textElement('span', detail)
        );
        return row;
      });
      byId('player-news-summary').replaceChildren(...rows);
    };

    const renderPlayerNewsProviders = feed => {
      const providers = (feed.providers || []).map(provider => {
        const row = document.createElement('div');
        row.className = 'player-news-provider';
        row.replaceChildren(
          textElement('strong', provider.label + ' - ' + provider.status),
          textElement('span', provider.detail)
        );
        return row;
      });
      byId('player-news-providers').replaceChildren(...providers);
    };

    const playerNewsSourceModeLabel = sourceMode => {
      if (sourceMode === 'local') return 'Local evidence';
      if (sourceMode === 'rotowire-rss') return 'RotoWire RSS';
      return 'All sources';
    };

    const playerNewsUpdatedTime = value => {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const playerNewsUpdatedLabel = feed => {
      const updatedTime = feed ? playerNewsUpdatedTime(feed.generatedAt) : '';
      return updatedTime ? 'Updated ' + updatedTime : playerNewsSourceModeLabel(playerNewsSource);
    };

    const myExpertReadOnlyLabel = report =>
      report && report.readOnly ? 'Read-only advice' : 'Review advice before acting';

    const myExpertPriorityClass = priority => {
      if (priority === 'high') return 'my-expert-priority-high';
      if (priority === 'medium') return 'my-expert-priority-medium';
      return 'my-expert-priority-low';
    };

    const myExpertChip = (text, className) =>
      textElement('span', text, 'my-expert-chip' + (className ? ' ' + className : ''));

    const myExpertPlayerText = player => {
      if (!player) return '';
      if (typeof player === 'string') return player;
      return [player.name, player.position, player.teamAbbreviation, player.byeWeek ? 'bye ' + player.byeWeek : '']
        .filter(Boolean)
        .join(' / ');
    };

    const myExpertListItem = (label, detail) => {
      const row = document.createElement('div');
      row.className = 'my-expert-list-item';
      row.replaceChildren(textElement('strong', label), textElement('span', detail));
      return row;
    };

    const myExpertProviderStatusLabel = status => {
      if (status === 'setup-required') return 'Setup';
      if (status === 'available') return 'Ready';
      if (status === 'active') return 'Active';
      return status || 'Provider';
    };

    const myExpertProviderAuthLabel = provider => {
      const type = provider && provider.auth && provider.auth.type;
      if (type === 'oauth2') return 'OAuth2';
      if (type === 'manual-cookie') return 'Local credentials';
      return 'No OAuth';
    };

    const myExpertProviderActionLabel = provider => {
      if (provider && provider.key === 'sleeper') return 'Find leagues';
      if (provider && provider.key === 'yahoo') return provider.auth && provider.auth.configured ? 'Connect Yahoo' : 'Setup Yahoo';
      if (provider && provider.key === 'espn') return provider.auth && provider.auth.configured ? 'Use ESPN config' : 'Show setup';
      if (provider && provider.connectUrl) return 'Connect';
      if (provider && provider.status === 'setup-required') return 'Setup required';
      if (provider && provider.status === 'active') return 'Active';
      return 'Read-only';
    };

    const myExpertProviderSetupText = provider => {
      const steps = provider && Array.isArray(provider.setupSteps) ? provider.setupSteps : [];
      return steps.length ? steps[0] : provider.detail || '';
    };

    const setMyExpertProviderFeedback = (card, message, className) => {
      const feedback = card ? card.querySelector('.my-expert-provider-feedback') : null;
      if (!feedback) return;
      feedback.className = 'my-expert-provider-feedback' + (className ? ' ' + className : '');
      feedback.hidden = !message;
      feedback.textContent = message || '';
    };

    const myExpertProviderSetupStepsText = provider => {
      const steps = provider && Array.isArray(provider.setupSteps) ? provider.setupSteps : [];
      return steps.length ? steps.join(' ') : provider.detail || 'No setup details loaded yet.';
    };

    const submitMyExpertSleeperConnect = async (provider, card) => {
      const input = card ? card.querySelector('#my-expert-sleeper-identifier') : null;
      const action = card ? card.querySelector('#my-expert-sleeper-connect-button') : null;
      const identifier = input && typeof input.value === 'string' ? input.value.trim() : '';
      if (!identifier) {
        setMyExpertProviderFeedback(card, 'Enter a Sleeper username or league ID first.', 'my-expert-provider-feedback-error');
        return;
      }

      const season = String(new Date().getFullYear());
      const search = new URLSearchParams({ identifier, season });
      preservePlatformSeason(search);
      const previousLabel = action ? action.textContent : '';
      if (action) {
        action.disabled = true;
        action.textContent = 'Checking';
      }
      setMyExpertProviderFeedback(card, 'Checking Sleeper read-only league access...');
      try {
        const response = await fetch('/api/sync/sleeper/preview?' + search.toString());
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not preview Sleeper sync.');
        const leagues = Array.isArray(data.leagues) ? data.leagues : [];
        const leagueNames = leagues
          .slice(0, 3)
          .map(league => league.name || league.leagueId)
          .filter(Boolean)
          .join(', ');
        setMyExpertProviderFeedback(
          card,
          (data.message || 'Sleeper preview loaded.') + (leagueNames ? ' ' + leagueNames : '')
        );
      } catch (error) {
        setMyExpertProviderFeedback(
          card,
          error instanceof Error ? error.message : 'Could not preview Sleeper sync.',
          'my-expert-provider-feedback-error'
        );
      } finally {
        if (action) {
          action.disabled = false;
          action.textContent = previousLabel || myExpertProviderActionLabel(provider);
        }
      }
    };

    const handleMyExpertProviderAction = async (provider, card) => {
      if (!provider) return;
      if (provider.key === 'espn') {
        setMyExpertProviderFeedback(card, myExpertProviderSetupStepsText(provider));
        return;
      }
      if (!provider.connectUrl) {
        setMyExpertProviderFeedback(card, myExpertProviderSetupStepsText(provider));
        return;
      }

      setMyExpertProviderFeedback(card, 'Starting read-only sync setup...');
      try {
        const response = await fetch(provider.connectUrl);
        const data = await response.json();
        if (data.authorizationUrl) {
          window.location.assign(data.authorizationUrl);
          return;
        }
        const message = data.error || data.nextStep || data.message || myExpertProviderSetupStepsText(provider);
        setMyExpertProviderFeedback(
          card,
          message + (Array.isArray(data.setupSteps) ? ' ' + data.setupSteps.join(' ') : ''),
          response.ok ? '' : 'my-expert-provider-feedback-error'
        );
      } catch (error) {
        setMyExpertProviderFeedback(
          card,
          error instanceof Error ? error.message : 'Could not start provider sync.',
          'my-expert-provider-feedback-error'
        );
      }
    };

    const myExpertSleeperConnectForm = (provider, card) => {
      const form = document.createElement('form');
      form.className = 'my-expert-provider-form';
      form.addEventListener('submit', event => {
        event.preventDefault();
        submitMyExpertSleeperConnect(provider, card);
      });

      const input = document.createElement('input');
      input.id = 'my-expert-sleeper-identifier';
      input.name = 'sleeper-identifier';
      input.type = 'search';
      input.placeholder = 'Username or league ID';
      input.autocomplete = 'off';

      const action = document.createElement('button');
      action.id = 'my-expert-sleeper-connect-button';
      action.type = 'submit';
      action.textContent = myExpertProviderActionLabel(provider);

      form.replaceChildren(input, action);
      return form;
    };

    const myExpertProviderCard = provider => {
      const row = document.createElement('div');
      row.className = 'my-expert-provider-card';
      row.setAttribute('data-sync-provider-key', provider.key || 'provider');

      const top = document.createElement('div');
      top.className = 'my-expert-provider-top';
      top.replaceChildren(
        textElement('strong', provider.label || 'Provider'),
        textElement(
          'span',
          myExpertProviderStatusLabel(provider.status),
          'my-expert-provider-status my-expert-provider-status-' + (provider.status || 'unknown')
        )
      );

      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'my-expert-provider-action my-expert-provider-action-connect';
      action.textContent = myExpertProviderActionLabel(provider);
      action.setAttribute('data-sync-provider-key', provider.key || 'provider');
      action.addEventListener('click', () => handleMyExpertProviderAction(provider, row));

      const feedback = textElement('div', '', 'my-expert-provider-feedback');
      feedback.hidden = true;

      row.replaceChildren(
        top,
        textElement('div', myExpertProviderAuthLabel(provider), 'my-expert-provider-meta'),
        textElement('p', myExpertProviderSetupText(provider)),
        provider.key === 'sleeper' ? myExpertSleeperConnectForm(provider, row) : action,
        feedback
      );
      return row;
    };

    const myExpertLineupScoreText = selection =>
      selection && Number.isFinite(selection.adjustedScore) ? ' - ' + selection.adjustedScore.toFixed(1) + ' adj' : '';

    const myExpertLineupSelectionText = selection =>
      selection ? myExpertPlayerText(selection) + myExpertLineupScoreText(selection) : 'No player loaded';

    const renderMyExpertLineup = report => {
      const recommendations = report && Array.isArray(report.recommendations) ? report.recommendations : [];
      const lineupRecommendation = recommendations.find(recommendation => recommendation.type === 'lineup' && recommendation.lineup);
      const lineup = lineupRecommendation ? lineupRecommendation.lineup : null;
      const flexChoice = lineup && lineup.flexChoice;
      const starters = lineup && Array.isArray(lineup.starters) ? lineup.starters : [];
      const alternatives = lineup && Array.isArray(lineup.flexCandidates)
        ? lineup.flexCandidates.filter(candidate => !flexChoice || candidate.playerId !== flexChoice.playerId).slice(0, 3)
        : [];
      byId('my-expert-lineup').replaceChildren(
        ...(lineup
          ? [
              myExpertListItem('Start FLEX', myExpertLineupSelectionText(flexChoice)),
              ...(flexChoice && flexChoice.risk ? [myExpertListItem('Risk', flexChoice.risk)] : []),
              ...starters.map(selection => myExpertListItem(selection.slot || 'Starter', myExpertLineupSelectionText(selection))),
              ...(alternatives.length
                ? [myExpertListItem('Flex alternatives', alternatives.map(myExpertLineupSelectionText).join(', '))]
                : [])
            ]
          : [myExpertListItem('No lineup advice', 'Sync or draft a complete roster with multiple flex options.')]
        )
      );
    };

    const myExpertAdviceCard = recommendation => {
      const card = document.createElement('article');
      card.className = 'my-expert-card';

      const header = document.createElement('div');
      header.className = 'my-expert-card-header';
      header.replaceChildren(
        textElement('h2', recommendation.title || 'Roster advice'),
        myExpertChip(recommendation.priority || 'low', myExpertPriorityClass(recommendation.priority))
      );

      const chips = document.createElement('div');
      chips.className = 'my-expert-chip-row';
      chips.replaceChildren(
        myExpertChip(recommendation.type || 'advice'),
        myExpertChip(recommendation.readOnly ? 'Advice only' : 'Review'),
        ...((recommendation.players || []).slice(0, 4).map(player => myExpertChip(myExpertPlayerText(player))))
      );

      const adds = (recommendation.suggestedAdds || [])
        .slice(0, 3)
        .map(player => myExpertPlayerText(player));
      const drops = (recommendation.suggestedDrops || [])
        .slice(0, 3)
        .map(player => myExpertPlayerText(player));
      const actions = document.createElement('div');
      actions.className = 'my-expert-list';
      actions.replaceChildren(
        ...(adds.length ? [myExpertListItem('Consider adding', adds.join(', '))] : []),
        ...(drops.length ? [myExpertListItem('Drop candidates', drops.join(', '))] : []),
        ...((recommendation.reasons || []).slice(0, 2).map(reason => myExpertListItem('Why', reason)))
      );

      card.replaceChildren(
        header,
        textElement('div', recommendation.detail || '-', 'my-expert-detail'),
        chips,
        actions
      );
      return card;
    };

    const renderMyExpertRoster = report => {
      const players = report && report.team && Array.isArray(report.team.players) ? report.team.players : [];
      byId('my-expert-roster').replaceChildren(
        ...(players.length
          ? players.map(player => myExpertListItem(player.name, myExpertPlayerText(player)))
          : [myExpertListItem('No roster loaded', 'Draft through Mockd or sync a platform roster.')]
        )
      );
    };

    const renderMyExpertIntegrations = report => {
      const integrations = report && Array.isArray(report.integrations) ? report.integrations : [];
      byId('my-expert-integrations').replaceChildren(
        ...(integrations.length
          ? integrations.map(provider => myExpertListItem(
              provider.label + ' - ' + myExpertProviderStatusLabel(provider.status),
              myExpertProviderAuthLabel(provider) + ' / ' + (provider.detail || myExpertProviderSetupText(provider))
            ))
          : [myExpertListItem('No providers loaded', 'Provider contracts are ready for sync integrations.')]
        )
      );
    };

    const renderMyExpertConnectPanel = report => {
      const integrations = report && Array.isArray(report.integrations) ? report.integrations : [];
      const externalProviders = integrations.filter(provider => provider.key !== 'mockd-draft');
      const panel = byId('my-expert-connect-panel');
      if (!externalProviders.length) {
        panel.hidden = true;
        panel.replaceChildren();
        return;
      }

      panel.hidden = false;
      const header = document.createElement('div');
      header.className = 'my-expert-connect-header';
      header.replaceChildren(
        textElement('strong', 'Connect a league', 'my-expert-connect-title'),
        textElement('span', 'Read-only provider connections for roster, matchup, waiver, and transaction context.', 'my-expert-connect-detail')
      );
      const providerGrid = document.createElement('div');
      providerGrid.className = 'my-expert-provider-grid';
      providerGrid.replaceChildren(...externalProviders.map(myExpertProviderCard));
      panel.replaceChildren(
        header,
        providerGrid
      );
    };

    const renderMyExpertRoute = report => {
      latestMyExpertReport = report || latestMyExpertReport;
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = false;
      byId('player-news-view').hidden = true;

      if (!latestMyExpertReport) {
        byId('my-expert-title').textContent = 'No roster advice loaded.';
        byId('my-expert-status').textContent = '';
        byId('my-expert-recommendations').replaceChildren(mockDraftItem('No advice loaded', 'Refresh My Expert.'));
        byId('my-expert-connect-panel').hidden = true;
        byId('my-expert-connect-panel').replaceChildren();
        byId('my-expert-lineup').replaceChildren();
        byId('my-expert-roster').replaceChildren();
        byId('my-expert-integrations').replaceChildren();
        return;
      }

      const reportTeam = latestMyExpertReport.team || {};
      const summary = latestMyExpertReport.summary || {};
      byId('my-expert-title').textContent =
        (summary.recommendationCount || 0) + ' recommendations / Week ' + (summary.currentWeek || myExpertWeek);
      byId('my-expert-roster-title').textContent =
        (reportTeam.owner || currentWatchOwner) + ' roster - ' + (reportTeam.rosteredCount || 0) + ' players';
      byId('my-expert-status').textContent = myExpertReadOnlyLabel(latestMyExpertReport);
      byId('my-expert-source').textContent =
        latestMyExpertReport.source ? latestMyExpertReport.source.label : 'Mockd draft';

      const cards = (latestMyExpertReport.recommendations || []).map(myExpertAdviceCard);
      const rosteredCount = Number(reportTeam.rosteredCount || 0);
      const emptyAdvice = rosteredCount < 9
        ? mockDraftItem('Connect a league or finish a roster', 'My Expert needs a complete roster before it can rank lineup, bye, waiver, and trade advice.')
        : mockDraftItem('No urgent moves', 'Your roster has no high-priority advice right now.');
      byId('my-expert-recommendations').replaceChildren(
        ...(cards.length ? cards : [emptyAdvice])
      );
      renderMyExpertConnectPanel(latestMyExpertReport);
      renderMyExpertLineup(latestMyExpertReport);
      renderMyExpertRoster(latestMyExpertReport);
      renderMyExpertIntegrations(latestMyExpertReport);
    };

    const renderMyExpertError = message => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = false;
      byId('player-news-view').hidden = true;
      byId('my-expert-title').textContent = 'My Expert unavailable.';
      byId('my-expert-status').textContent = message;
      byId('my-expert-recommendations').replaceChildren(mockDraftItem('Could not load My Expert', message));
      byId('my-expert-connect-panel').hidden = true;
      byId('my-expert-connect-panel').replaceChildren();
      byId('my-expert-lineup').replaceChildren();
      byId('my-expert-roster').replaceChildren();
      byId('my-expert-integrations').replaceChildren();
    };

    const loadMyExpertReport = async () => {
      try {
        const response = await fetch(myExpertUrl());
        const report = await response.json();
        if (!response.ok) throw new Error(report.error || 'Could not load My Expert.');
        renderMyExpertRoute(report);
      } catch (error) {
        renderMyExpertError(error instanceof Error ? error.message : 'Could not load My Expert.');
      }
    };

    const renderPlayerNewsRoute = feed => {
      latestPlayerNewsFeed = feed || latestPlayerNewsFeed;
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = true;
      byId('player-news-view').hidden = false;

      if (!latestPlayerNewsFeed) {
        byId('player-news-title').textContent = 'No player news loaded.';
        byId('player-news-status').textContent = '';
        byId('player-news-feed').replaceChildren(mockDraftItem('No updates', 'Refresh player news.'));
        byId('player-news-summary').replaceChildren();
        byId('player-news-providers').replaceChildren();
        return;
      }

      byId('player-news-title').textContent =
        latestPlayerNewsFeed.summary.filteredCount + ' shown / ' + latestPlayerNewsFeed.summary.totalCount + ' updates';
      byId('player-news-status').textContent = playerNewsUpdatedLabel(latestPlayerNewsFeed);

      const cards = (latestPlayerNewsFeed.items || []).map(playerNewsCard);
      byId('player-news-feed').replaceChildren(
        ...(cards.length ? cards : [mockDraftItem('No matching updates', 'Adjust filters or refresh.')])
      );
      renderPlayerNewsSummary(latestPlayerNewsFeed);
      renderPlayerNewsProviders(latestPlayerNewsFeed);
    };

    const renderPlayerNewsError = message => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = true;
      byId('player-news-view').hidden = false;
      byId('player-news-title').textContent = 'Player news unavailable.';
      byId('player-news-status').textContent = message;
      byId('player-news-feed').replaceChildren(mockDraftItem('Could not load player news', message));
      byId('player-news-summary').replaceChildren();
      byId('player-news-providers').replaceChildren();
    };

    const playerNewsPollIntervalMs = () =>
      currentDraftMode === 'real' ? 5 * 60 * 1000 : 10 * 60 * 1000;

    const stopPlayerNewsPolling = () => {
      if (playerNewsPollTimer) window.clearTimeout(playerNewsPollTimer);
      playerNewsPollTimer = null;
    };

    const schedulePlayerNewsPolling = () => {
      stopPlayerNewsPolling();
      if (window.location.pathname !== '/player-news') return;
      if (document.visibilityState === 'hidden') return;
      playerNewsPollTimer = window.setTimeout(() => {
        void refreshPlayerNewsIfCurrentRoute({ background: true });
      }, playerNewsPollIntervalMs());
    };

    const loadPlayerNewsFeed = async ({ background = false } = {}) => {
      if (background && playerNewsBackgroundRefreshInFlight) return;

      const requestId = ++playerNewsRequestId;
      const hadFeed = Boolean(latestPlayerNewsFeed);
      if (background) {
        playerNewsBackgroundRefreshInFlight = true;
        if (hadFeed) byId('player-news-status').textContent = 'Refreshing...';
      }

      try {
        const response = await fetch(playerNewsUrl());
        const feed = await response.json();
        if (!response.ok) throw new Error(feed.error || 'Could not load player news.');
        if (requestId === playerNewsRequestId) renderPlayerNewsRoute(feed);
      } catch (error) {
        if (requestId === playerNewsRequestId) {
          const message = error instanceof Error ? error.message : 'Could not load player news.';
          if (background && hadFeed) byId('player-news-status').textContent = playerNewsUpdatedLabel(latestPlayerNewsFeed);
          else renderPlayerNewsError(message);
        }
      } finally {
        if (background) playerNewsBackgroundRefreshInFlight = false;
        schedulePlayerNewsPolling();
      }
    };

    const mockResultsIntelligencePanel = run => {
      const root = byId('mock-results-intelligence');
      if (!run) {
        root.replaceChildren();
        return;
      }

      const cam = run.camOutcome;
      const best = run.bestBuild;
      const worst = run.worstBuild;
      root.replaceChildren(
        insightCard(
          currentWatchOwner + ' outcome',
          cam ? cam.headline : currentWatchOwner + ' outcome unavailable',
          cam ? [...(cam.strengths || []).slice(0, 2), ...(cam.risks || []).slice(0, 1)].join(' / ') : '-'
        ),
        insightCard(
          'Best build',
          best ? best.headline : 'Best build unavailable',
          best ? 'Core: ' + best.corePlayers.join(' / ') : '-'
        ),
        insightCard(
          'Worst build',
          worst ? worst.headline : 'Worst build unavailable',
          worst ? 'Core: ' + worst.corePlayers.join(' / ') : '-'
        )
      );
    };

    const strategyLabel = strategyKey => {
      const labels = {
        balanced: 'Balanced',
        'three-rb': '3RB',
        'hero-rb': 'Hero RB',
        'wr-heavy': 'WR heavy'
      };
      return labels[strategyKey] || strategyKey;
    };

    const mockResultsAnalyticsPanel = report => {
      const root = byId('mock-results-analytics');
      if (!report || !report.analytics) {
        root.replaceChildren();
        return;
      }

      const strategyLeader = report.analytics.strategyLeaderboard[0];
      const camScoreRange = report.analytics.camScoreRange;
      const commonPath = report.analytics.topCamRosterPaths[0];
      const strategyCoach = report.analytics.strategyCoach;
      const buildAround = report.script && report.script.buildAround
        ? report.script.buildAround
        : null;
      const buildAroundOutcomes = report.script && report.script.buildAroundOutcomes
        ? report.script.buildAroundOutcomes
        : [];
      const bestBuildAround = bestBuildAroundOutcomeFor(buildAroundOutcomes);
      const scriptOutcome = report.script && report.script.targetOutcomes
        ? report.script.targetOutcomes[0]
        : null;
      root.replaceChildren(
        ...(buildAround ? [
          insightCard(
            'Build around',
            bestBuildAround
              ? buildAround.player + ' best at ' + money(bestBuildAround.price)
              : buildAround.player + ' price sweep',
            buildAroundOutcomes.length
              ? buildAroundOutcomes.map(buildAroundOutcomeText).join(' / ')
              : buildAround.prices.map(price => money(price)).join(' / ') + ' across ' + report.summary.runCount + ' simulated drafts'
          )
        ] : []),
        ...(scriptOutcome ? [
          insightCard(
            'Script result',
            report.script.label,
            scriptOutcomeText(scriptOutcome)
          )
        ] : []),
        insightCard(
          'Strategy edge',
          strategyLeader
            ? strategyLabel(strategyLeader.strategyKey) + ' avg rank ' + scoreText(strategyLeader.averageCamRank)
            : 'No strategy data',
          strategyLeader
            ? strategyLeader.runCount + ' runs / W1 ' + scoreText(strategyLeader.averageCamWeek1Score) + ' / Season ' + scoreText(strategyLeader.averageCamSeasonStrengthScore)
            : '-'
        ),
        insightCard(
          currentWatchOwner + ' score range',
          camScoreRange
            ? scoreText(camScoreRange.minimumWeek1Score) + '-' + scoreText(camScoreRange.maximumWeek1Score) + ' W1'
            : 'No score range',
          camScoreRange
            ? scoreText(camScoreRange.minimumWeeks1To4Score) + '-' + scoreText(camScoreRange.maximumWeeks1To4Score) + ' W1-4 / best ' + camScoreRange.bestRunLabel
            : '-'
        ),
        insightCard(
          'Common ' + currentWatchOwner + ' path',
          commonPath ? commonPath.path : 'No common path yet',
          commonPath
            ? Math.round(commonPath.draftedRate * 100) + '% of runs / avg rank ' + scoreText(commonPath.averageRank)
            : '-'
        ),
        insightCard(
          'Strategy coach',
          strategyCoach ? strategyCoach.headline : 'Run 3RB mocks for a coach view',
          strategyCoach
            ? (strategyCoach.blueprint || []).slice(0, 4).map(slot =>
              slot.slot + ' ' + slot.priceBand + ' - ' + [
                ...(slot.lockedNames || []).map(name => name + ' locked'),
                ...(slot.targetNames || []).slice(0, 2)
              ].join(' / ') + (
                slot.fallbackNames && slot.fallbackNames.length
                  ? ' / fallback ' + slot.fallbackPriceBand + ': ' + slot.fallbackNames.slice(0, 2).join(' / ')
                  : ''
              )
            ).join(' / ')
            : '-'
        )
      );
    };

    const mockResultsPlayerRow = player => {
      const row = document.createElement('div');
      row.className = 'mock-results-player' + (player.starter ? '' : ' bench');
      row.replaceChildren(
        textElement('span', player.slot, 'mock-results-slot'),
        textElement('span', player.name, 'mock-results-name'),
        textElement('span', money(player.price), 'mock-results-money'),
        textElement('span', scoreText(player.week1), 'mock-results-score')
      );
      return row;
    };

    const mockResultsSeasonParts = team => {
      const parts = document.createElement('div');
      parts.className = 'mock-results-breakdown';
      parts.appendChild(textElement('span', 'Season parts', 'mock-results-breakdown-title'));

      for (const [label, value] of [
        ['Starters', scoreText(team.starterSeasonScore || team.weeks1To4Score)],
        ['Depth', scoreText(team.depthScore)],
        ['Consistency', scoreText(team.consistencyScore)]
      ]) {
        const item = document.createElement('span');
        item.className = 'mock-results-breakdown-item';
        item.replaceChildren(document.createTextNode(label), textElement('b', value));
        parts.appendChild(item);
      }

      return parts;
    };

    const mockResultsTeamCard = team => {
      const card = document.createElement('div');
      card.className = 'mock-results-card';

      const header = document.createElement('div');
      header.className = 'mock-results-card-header';
      const scoreline = document.createElement('div');
      scoreline.className = 'mock-results-scoreline';
      for (const [label, value] of [
        ['Week 1', scoreText(team.week1Score)],
        ['Season', scoreText(team.seasonStrengthScore || team.projectedFinishScore || team.weeks1To4Score)],
        ['Spend', money(team.spend)]
      ]) {
        const metric = document.createElement('span');
        metric.replaceChildren(document.createTextNode(label), textElement('b', value));
        scoreline.appendChild(metric);
      }
      header.replaceChildren(
        textElement('strong', team.owner + (team.projectedFinishLabel ? ' - season rank ' + team.projectedFinishLabel : '')),
        textElement('div', team.rankExplanation || '-', 'mock-results-reason'),
        scoreline,
        mockResultsSeasonParts(team)
      );

      const players = document.createElement('div');
      players.className = 'mock-results-player-list';
      players.replaceChildren(...team.players.map(mockResultsPlayerRow));
      card.replaceChildren(header, players);
      return card;
    };

    const mockResultsRankingLabels = () => {
      const labels = document.createElement('div');
      labels.className = 'mock-results-ranking-labels';
      labels.replaceChildren(
        textElement('span', 'Rank'),
        textElement('span', 'Owner'),
        textElement('span', 'Week 1'),
        textElement('span', 'Season')
      );
      return labels;
    };

    const renderMockResultsRankingsCard = rankings => {
      const card = document.createElement('div');
      card.className = 'mock-results-card rankings-card';

      const header = document.createElement('div');
      header.className = 'mock-results-card-header';
      const topScore = rankings.length ? scoreText(Math.max(...rankings.map(ranking => ranking.week1Score))) : '0.0';
      const scoreline = document.createElement('div');
      scoreline.className = 'mock-results-scoreline';
      const metric = document.createElement('span');
      metric.replaceChildren(document.createTextNode('Best W1'), textElement('b', topScore));
      scoreline.appendChild(metric);
      header.replaceChildren(textElement('strong', 'Season Rankings'), scoreline);

      const list = document.createElement('div');
      list.className = 'mock-results-player-list';
      list.replaceChildren(mockResultsRankingLabels(), ...rankings.map(ranking => {
        const row = document.createElement('div');
        row.className = 'mock-results-player';
        const owner = document.createElement('span');
        owner.className = 'mock-results-name';
        owner.replaceChildren(
          textElement('span', ranking.owner),
          textElement('small', ranking.explanation)
        );
        row.replaceChildren(
          textElement('span', '#' + ranking.rank, 'mock-results-slot'),
          owner,
          textElement('span', scoreText(ranking.week1Score), 'mock-results-score'),
          textElement('span', scoreText(ranking.seasonStrengthScore || ranking.projectedFinishScore), 'mock-results-score')
        );
        return row;
      }));

      card.replaceChildren(header, list);
      return card;
    };

    const renderMockResultsGrid = run => {
      const root = byId('mock-results-grid');
      if (!run) {
        mockResultsIntelligencePanel(null);
        root.replaceChildren(mockDraftItem('No run selected', 'Run simulations first.'));
        return;
      }

      mockResultsIntelligencePanel(run);
      const resultTeams = [...run.teams].sort((left, right) =>
        (left.owner === currentWatchOwner ? -1 : 0) - (right.owner === currentWatchOwner ? -1 : 0)
      );
      root.replaceChildren(
        ...resultTeams.map(mockResultsTeamCard),
        renderMockResultsRankingsCard(run.rankings)
      );
    };

    const renderMockResultsRunSelector = report => {
      const runs = report && report.runs ? report.runs : [];
      const selectedRun = runs[selectedMockResultsRunIndex] || runs[0];
      const button = byId('mock-results-run-button');
      const list = byId('mock-results-run-list');
      button.textContent = selectedRun ? selectedRun.label : 'Run results';
      button.disabled = !selectedRun;
      list.replaceChildren(...runs.map((run, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'run-option';
        option.textContent = run.label;
        option.setAttribute('aria-selected', String(index === selectedMockResultsRunIndex));
        option.addEventListener('click', () => {
          selectedMockResultsRunIndex = index;
          list.hidden = true;
          renderMockResultsRoute(latestMockBatchReport);
        });
        return option;
      }));
    };

    const renderMockResultsRoute = report => {
      latestMockBatchReport = report || latestMockBatchReport;
      if (latestMockBatchReport && latestMockBatchReport.watchOwner) currentWatchOwner = latestMockBatchReport.watchOwner;
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;

      if (!latestMockBatchReport || !latestMockBatchReport.runs || !latestMockBatchReport.runs.length) {
        byId('mock-results-title').textContent = 'No completed mock batch yet.';
        byId('mock-results-status').textContent = 'Start simulations from the simulations page.';
        byId('mock-results-run-button').textContent = 'No runs yet';
        byId('mock-results-run-button').disabled = true;
        byId('mock-results-run-list').hidden = true;
        byId('mock-results-run-list').replaceChildren();
        byId('mock-results-analytics').replaceChildren();
        byId('mock-results-intelligence').replaceChildren();
        byId('mock-results-grid').replaceChildren(mockDraftItem('No results yet', 'Run simulations and wait for them to finish.'));
        return;
      }

      selectedMockResultsRunIndex = Math.min(selectedMockResultsRunIndex, latestMockBatchReport.runs.length - 1);
      const run = latestMockBatchReport.runs[selectedMockResultsRunIndex];
      const strategyNames = [...new Set(latestMockBatchReport.runs.map(candidate => candidate.strategyKey))];
      const strategySummary = strategyNames.length > 1 ? 'strategy comparison' : latestMockBatchReport.options.strategyKey;
      const scriptSummary = latestMockBatchReport.script ? ' - ' + latestMockBatchReport.script.label : '';
      byId('mock-results-title').textContent =
        latestMockBatchReport.summary.runCount + ' completed runs - ' + strategySummary + ' - expected keepers' + scriptSummary;
      byId('mock-results-status').textContent =
        run.label + ' / ' + run.scenarioLabel + ' / seed ' + run.seed;
      renderMockResultsRunSelector(latestMockBatchReport);
      mockResultsAnalyticsPanel(latestMockBatchReport);
      renderMockResultsGrid(run);
    };

    const renderMockResultsLoading = job => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;
      byId('mock-results-title').textContent = 'Simulations running.';
      byId('mock-results-status').textContent = String(job.percent || 0) + '% complete';
      byId('mock-results-run-button').textContent = 'Waiting for results';
      byId('mock-results-run-button').disabled = true;
      byId('mock-results-run-list').hidden = true;
      byId('mock-results-run-list').replaceChildren();
      byId('mock-results-analytics').replaceChildren();
      byId('mock-results-intelligence').replaceChildren();
      byId('mock-results-grid').replaceChildren(mockDraftItem('Running mocks', String(job.percent || 0) + '% complete'));
    };

    const renderMockResultsError = message => {
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;
      byId('mock-results-title').textContent = 'Mock results unavailable.';
      byId('mock-results-status').textContent = message;
      byId('mock-results-run-button').textContent = 'No runs yet';
      byId('mock-results-run-button').disabled = true;
      byId('mock-results-run-list').hidden = true;
      byId('mock-results-run-list').replaceChildren();
      byId('mock-results-analytics').replaceChildren();
      byId('mock-results-intelligence').replaceChildren();
      byId('mock-results-grid').replaceChildren(mockDraftItem('Could not load results', message));
    };

    const targetMatchesQuery = (target, query) => {
      if (!query) return true;
      const haystack = [
        target.name,
        target.position,
        target.teamAbbreviation || '',
        String(target.byeWeek || '')
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    };

    const targetMatchesPosition = target => {
      if (boardPositionFilter === 'ALL') return true;
      if (boardPositionFilter === 'FLEX') return isFlexPosition(target.position);
      return target.position === boardPositionFilter;
    };

    const targetMatchesFilters = (target, query, owner) => {
      if (!targetMatchesQuery(target, query)) return false;
      if (!targetMatchesPosition(target)) return false;
      if (byId('team-filter').value && target.teamAbbreviation !== byId('team-filter').value) return false;
      if (byId('bye-filter').value && String(target.byeWeek || '') !== byId('bye-filter').value) return false;
      if (target.draftable === false && byId('my-needs-filter').checked) return false;
      if (byId('my-needs-filter').checked && !targetFitsOwnerNeed(target, owner)) return false;
      return true;
    };

    const sortValueFor = (target, tierDrops) => {
      if (boardSortKey === 'valueGap') return valueGapFor(target);
      if (boardSortKey === 'tierDrop') return tierDrops.get(target.name) || 0;
      if (boardSortKey === 'position') return positionOrder[target.position] || 99;
      if (boardSortKey === 'teamAbbreviation') return target.teamAbbreviation || 'ZZZ';
      if (boardSortKey === 'byeWeek') return target.byeWeek || 99;
      return target[boardSortKey] == null ? 0 : target[boardSortKey];
    };

    const sortedTargets = (targets, tierDrops) => [...targets].sort((left, right) => {
      const leftValue = sortValueFor(left, tierDrops);
      const rightValue = sortValueFor(right, tierDrops);
      const defaultTieBreak =
        right.liveExpectedPrice - left.liveExpectedPrice ||
        right.seasonProjection - left.seasonProjection ||
        left.name.localeCompare(right.name);
      if ((left.draftable === false) !== (right.draftable === false)) {
        return left.draftable === false ? 1 : -1;
      }
      if (typeof leftValue === 'string' || typeof rightValue === 'string') {
        return cleanText(rightValue).localeCompare(cleanText(leftValue)) || defaultTieBreak;
      }
      return (rightValue - leftValue) || defaultTieBreak;
    });

    const renderPositionMarket = state => {
      const saleDeltaByPosition = new Map();
      for (const event of state.events) {
        saleDeltaByPosition.set(event.position, (saleDeltaByPosition.get(event.position) || 0) + event.saleVsExpected);
      }

      const pills = ['RB', 'WR', 'TE', 'QB', 'K', 'DST'].map(position => {
        const targets = state.availableTargets.filter(target => target.position === position);
        const expected = targets.reduce((total, target) => total + target.expectedPrice, 0);
        const live = targets.reduce((total, target) => total + target.liveExpectedPrice, 0);
        const factor = expected > 0 ? (live / expected).toFixed(2) + 'x' : '-';
        const delta = saleDeltaByPosition.get(position) || 0;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'market-pill ' + positionClassFor(position);
        pill.dataset.positionFilter = position;
        pill.setAttribute('aria-pressed', String(boardPositionFilter === position));
        pill.title = boardPositionFilter === position ? 'Show all positions' : 'Show only ' + position;
        pill.append(
          textElement('strong', position),
          document.createTextNode(factor + ' - ' + targets.length + ' left' + (delta ? ' - ' + deltaMoney(delta) : ''))
        );
        return pill;
      });

      byId('position-market').replaceChildren(...pills);
    };

    const renderReadiness = state => {
      const checks = state.readiness && state.readiness.checks ? state.readiness.checks : [];
      byId('readiness-checks').replaceChildren(...checks.map(check => {
        const item = document.createElement('div');
        item.className = 'summary-item ' + check.status;
        item.replaceChildren(
          textElement('strong', check.label + ' - ' + check.status.toUpperCase()),
          textElement('span', check.detail, 'subtle')
        );
        return item;
      }));
    };

    const mockRangeText = mockRange => {
      if (!mockRange) return '-';
      return money(mockRange.minimumSalePrice) + '-' + money(mockRange.maximumSalePrice) +
        ' avg ' + money(mockRange.averageSalePrice) +
        ' / ' + Math.round(Number(mockRange.draftedRate || 0) * 100) + '% drafted';
    };

    const auditClassFor = audit => {
      if (audit.verdict === 'overpay') return 'summary-item warn';
      if (audit.verdict === 'deal') return 'summary-item';
      return 'summary-item';
    };

    const renderPostDraftAudit = state => {
      const audits = Array.isArray(state.postDraftAudit) ? state.postDraftAudit.slice().reverse() : [];
      if (!audits.length) {
        byId('post-draft-audit').replaceChildren(mockDraftItem('No sales yet', 'Audit appears after purchases are logged.'));
        return;
      }

      byId('post-draft-audit').replaceChildren(...audits.slice(0, 8).map(audit => {
        const item = document.createElement('div');
        item.className = auditClassFor(audit);
        const mockLine = 'Mock ' + mockRangeText(audit.mockRange);
        item.replaceChildren(
          textElement('strong', audit.player + ' - ' + audit.owner + ' ' + money(audit.price) + ' - ' + audit.verdict),
          textElement('span', 'Exp ' + deltaMoney(audit.expectedDelta) + ' / Live ' + deltaMoney(audit.liveDelta) + ' / Our ' + deltaMoney(audit.personalDelta), 'subtle'),
          textElement('span', mockLine, 'subtle')
        );
        return item;
      }));
    };

    const renderImportConflictReview = state => {
      const root = byId('import-conflict-review');
      const review = state.conflictReview;
      if (!review || !Array.isArray(review.issues) || !review.issues.length) {
        root.replaceChildren();
        return;
      }

      const summary = mockDraftItem(
        review.title || 'Import needs review',
        review.issueCount + ' issue' + (review.issueCount === 1 ? '' : 's') + ' across ' + review.importedCount + ' command' + (review.importedCount === 1 ? '' : 's') + '. Current room was not replaced.'
      );
      summary.classList.add('warn');

      const issues = review.issues.map(issue => {
        const item = document.createElement('div');
        item.className = 'summary-item warn';
        const rawCommand = document.createElement('code');
        rawCommand.className = 'raw-command';
        rawCommand.textContent = issue.input || '-';
        item.replaceChildren(
          textElement('strong', '#' + issue.index + ' - ' + cleanText(issue.type).replaceAll('-', ' ')),
          textElement('span', issue.message, 'subtle'),
          rawCommand
        );
        if (issue.matchOptions && issue.matchOptions.length) {
          item.appendChild(textElement('span', 'Options: ' + issue.matchOptions.join(' / '), 'subtle'));
        }
        return item;
      });

      root.replaceChildren(summary, ...issues);
    };

    const renderDraftPath = state => {
      const path = state.draftPath;
      if (!path) {
        byId('draft-path').replaceChildren(mockDraftItem('Path', 'No draft path loaded.'));
        return;
      }

      const nextBand = (path.maxPriceBands || []).find(band => band.status === 'next');
      const target = (path.targetClusters || [])[0];
      const pivot = (path.pivotRules || [])[0];
      const risks = (path.riskAlerts || []).slice(0, 3);
      const deadZone = (path.deadZoneWarnings || [])[0];
      const rows = [
        mockDraftItem('Path', path.summary),
        mockDraftItem(
          'Max',
          nextBand
            ? nextBand.slot + ' ' + money(nextBand.minimumPrice) + '-' + money(nextBand.maximumPrice)
            : 'Follow live max bid discipline.'
        ),
        mockDraftItem(
          'Target',
          target
            ? target.position + ' ' + target.priceBand + ' - ' + (target.targetNames || []).slice(0, 4).join(' / ')
            : 'No target cluster available.'
        ),
        mockDraftItem(
          'Pivot',
          pivot ? pivot.trigger + ' ' + pivot.action : 'No pivot needed yet.'
        ),
        ...risks.map(risk => mockDraftItem('Risk - ' + risk.label, risk.detail)),
        mockDraftItem(
          'Dead zone',
          deadZone || 'None'
        )
      ];

      byId('draft-path').replaceChildren(...rows);
    };

    const renderShortlist = state => {
      const targetByName = new Map((state.availableTargets || []).map(target => [target.name, target]));
      const manualRows = manualShortlistNames
        .map(name => targetByName.get(name))
        .filter(Boolean)
        .map(target => {
          const item = document.createElement('div');
          item.className = 'summary-item';
          item.replaceChildren(
            textElement('strong', target.name + ' - ' + target.position + ' ' + money(target.recommendedMaxBid)),
            textElement(
              'span',
              (target.teamAbbreviation || '-') + ' bye ' + (target.byeWeek || '-') + ' - live ' + money(target.liveExpectedPrice) + ' - gap ' + deltaMoney(valueGapFor(target)),
              'subtle'
            )
          );
          item.addEventListener('click', () => selectTargetForSale(target));
          return item;
        });
      const modelRows = (state.shortlist || []).slice(0, 8).map(target => {
        const item = document.createElement('div');
        item.className = 'summary-item';
        item.replaceChildren(
          textElement('strong', target.name + ' - ' + target.position + ' ' + money(target.personalValue)),
          textElement(
            'span',
            (target.teamAbbreviation || '-') + ' bye ' + (target.byeWeek || '-') + ' - live ' + money(target.liveExpectedPrice) + ' - gap ' + deltaMoney(target.valueGap),
            'subtle'
          ),
          textElement('span', target.reasons.join(' - '), 'subtle')
        );
        item.addEventListener('click', () => {
          const fullTarget = targetByName.get(target.name);
          if (fullTarget) selectTargetForSale(fullTarget);
        });
        return item;
      });

      byId('manual-shortlist').replaceChildren(
        ...(manualRows.length ? manualRows : [mockDraftItem('No starred players yet', 'Use the star next to a player name to keep them here.')])
      );
      byId('model-shortlist').replaceChildren(...modelRows);
      byId('shortlist').replaceChildren(...modelRows.map(row => row.cloneNode(true)));
    };

    const renderPositionContext = state => {
      const rows = (state.positionContexts || []).map(context => {
        const item = document.createElement('div');
        item.className = 'summary-item ' + positionClassFor(context.position);
        item.replaceChildren(
          textElement('strong', context.position + ' - ' + context.ownersNeeding.length + ' need'),
          textElement(
            'span',
            'Blockers: ' + (context.blockers.length ? context.blockers.join(', ') + ' up to ' + money(context.strongestBlockerMaxBid) : 'none'),
            'subtle'
          ),
          textElement('span', 'Needs: ' + (context.ownersNeeding.length ? context.ownersNeeding.join(', ') : 'none'), 'subtle')
        );
        return item;
      });

      byId('position-context').replaceChildren(...rows);
    };

    const mockDraftItem = (label, value) => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      item.replaceChildren(textElement('strong', label), textElement('span', value || '-', 'subtle'));
      return item;
    };

    const mockDraftCommandItem = command => {
      const item = document.createElement('div');
      item.className = 'summary-item';
      const rawCommand = document.createElement('code');
      rawCommand.className = 'raw-command';
      rawCommand.textContent = command || '-';
      item.replaceChildren(textElement('strong', 'AI sale command'), rawCommand);
      return item;
    };

    const bidText = bid => {
      const amount = bid.recommendedBid ?? bid.amount ?? bid.bid ?? bid.price ?? bid.maxBid;
      return bid.owner + (amount == null ? '' : ' ' + money(amount));
    };

    const mockAuctionFeedLines = mockDraft =>
      mockDraft && mockDraft.auction && Array.isArray(mockDraft.auction.feed)
        ? mockDraft.auction.feed
        : [];

    const mockNominationIdeaEvents = mockDraft =>
      (mockDraft && Array.isArray(mockDraft.topTargets) ? mockDraft.topTargets : [])
        .slice(0, 5)
        .map(target => ({
          type: 'nomination',
          text: 'Idea: ' + target.name + ' ' + money(target.liveExpectedPrice)
        }));

    const mockAuctionResolutionEvents = auction => {
      if (!auction) return [];
      const resolution = auction.resolution || (
        auction.currentBidOwner && auction.currentBid
          ? { owner: auction.currentBidOwner, price: auction.currentBid }
          : null
      );
      if (!resolution) return [];
      const soldText = 'Sold to ' + resolution.owner + ' for ' + money(resolution.price);
      return [5, 4, 3, 2, 1].map(countdown => ({
        type: 'countdown',
        text: String(countdown),
        countdown
      })).concat([{
        type: 'sold',
        text: soldText,
        owner: resolution.owner,
        amount: resolution.price
      }]);
    };

    const auctionEventFor = (owner, amount) => ({
      type: 'bid',
      text: cleanText(owner) + ' bid ' + money(amount),
      owner,
      amount
    });

    const mockAuctionCamBidEvents = mockDraft => {
      if (!mockDraft || !mockDraft.auction || !mockDraft.camDecision) return [];
      const auction = mockDraft.auction;
      const camBid = auction.nextCamBid || mockDraft.camDecision.recommendedBid;
      const maxBid = mockDraft.camDecision.maxBid;
      if (!camBid || camBid > maxBid) return [];

      const events = [auctionEventFor(mockDraft.watchOwner || currentWatchOwner, camBid)];
      const aiRaise = (mockDraft.aiBids || [])
        .filter(bid => bid.amount >= camBid + 1)
        .sort((left, right) => right.amount - left.amount || cleanText(left.owner).localeCompare(cleanText(right.owner)))[0];

      if (!aiRaise) {
        return events.concat(mockAuctionResolutionEvents({
          ...auction,
          resolution: {
            owner: mockDraft.watchOwner || currentWatchOwner,
            price: camBid
          }
        }));
      }

      const aiResponseAmount = camBid + 1;
      events.push(auctionEventFor(aiRaise.owner, aiResponseAmount));
      if (aiResponseAmount + 1 <= maxBid) return events;

      return events.concat(mockAuctionResolutionEvents({
        ...auction,
        currentBidOwner: aiRaise.owner,
        currentBid: aiResponseAmount,
        resolution: {
          owner: aiRaise.owner,
          price: aiResponseAmount
        }
      }));
    };

    const mockDraftNominationText = mockDraft => {
      if (!mockDraft || !mockDraft.auction) return '';
      const auction = mockDraft.auction;
      return (auction.nominator || mockDraft.nominator || 'AI') + ' nominated ' + (auction.player || '-');
    };

    const mockDraftPhaseLabel = mockDraft => {
      if (!mockDraft || !mockDraft.auction) return '';
      const auction = mockDraft.auction;
      if (auction.status === 'sold' && auction.resolution) {
        return 'Sold to ' + auction.resolution.owner + ' for ' + money(auction.resolution.price);
      }
      if (mockDraft.phase === 'human-decision' && auction.nextCamBid != null) {
        return 'Current ' + money(auction.currentBid) + ' - ' + currentWatchOwner + ' can bid ' + money(auction.nextCamBid);
      }
      if (mockDraft.phase === 'ai-sale' && auction.resolution) {
        return 'Current high bid ' + money(auction.resolution.price) + ' - AI sale will continue automatically';
      }
      return cleanText(mockDraft.phase || 'Mock auction');
    };

    const clearMockAutoAdvance = () => {
      if (!mockAutoAdvanceTimer) return;
      window.clearTimeout(mockAutoAdvanceTimer);
      mockAutoAdvanceTimer = null;
    };

    const mockAutoAdvanceActionFor = mockDraft => {
      if (!isActiveDraft() || currentDraftMode !== 'interactive-mock' || mockAdvanceRequestInFlight) return null;
      if (!mockDraft || mockDraft.phase === 'complete' || mockDraft.phase === 'blocked') return null;
      if (mockDraft.phase === 'ai-sale') return 'advance';
      if (mockDraft.phase !== 'human-decision') return null;

      const nextCamBid = Number(mockDraft.auction && mockDraft.auction.nextCamBid);
      const camMaxBid = Number(mockDraft.camDecision && mockDraft.camDecision.maxBid);
      if (!Number.isFinite(nextCamBid) || !Number.isFinite(camMaxBid)) return null;
      return camMaxBid < nextCamBid ? 'pass' : null;
    };

    const scheduleMockAutoAdvance = mockDraft => {
      clearMockAutoAdvance();
      const action = mockAutoAdvanceActionFor(mockDraft);
      if (!action) return;

      mockAutoAdvanceTimer = window.setTimeout(() => {
        mockAutoAdvanceTimer = null;
        if (!mockAdvanceRequestInFlight) void advanceMockDraft(action);
      }, 350);
    };

    const renderMockAuctionFeedEvents = events => {
      byId('mock-auction-feed-lines').replaceChildren(...events.map(event => {
        const item = document.createElement('span');
        item.className = 'mock-feed-line ' + event.type;
        item.textContent = cleanText(event.text);
        return item;
      }));
    };

    const renderMockAuctionFeed = mockDraft => {
      const root = byId('mock-auction-feed');
      const active = byId('mock-active-nomination');
      const lines = byId('mock-auction-feed-lines');
      const shouldShow = currentDraftMode === 'interactive-mock' && mockDraft && (mockDraft.phase === 'human-nomination' || Boolean(mockDraft.auction));
      root.hidden = !shouldShow;
      if (!shouldShow) {
        active.replaceChildren();
        lines.replaceChildren();
        return;
      }

      if (mockDraft.phase === 'human-nomination') {
        const target = selectedTarget();
        active.replaceChildren(
          textElement('strong', currentWatchOwner + ' is nominating'),
          textElement('span', target ? 'Ready to nominate ' + target.name + ' at ' + money(nominationPriceValue()) : 'Select a player from the board', 'mock-auction-phase')
        );
        renderMockAuctionFeedEvents(mockNominationIdeaEvents(mockDraft));
        return;
      }

      active.replaceChildren(
        textElement('strong', mockDraftNominationText(mockDraft)),
        textElement('span', mockDraftPhaseLabel(mockDraft), 'mock-auction-phase')
      );
      renderMockAuctionFeedEvents(mockAuctionFeedLines(mockDraft));
    };

    const animateMockAuctionResolution = async () => {
      const auction = currentMockDraft && currentMockDraft.auction;
      const resolutionEvents = mockAuctionResolutionEvents(auction);
      if (!resolutionEvents.length) return;

      const baseEvents = mockAuctionFeedLines(currentMockDraft);
      for (let index = 0; index < resolutionEvents.length; index += 1) {
        renderMockAuctionFeedEvents(baseEvents.concat(resolutionEvents.slice(0, index + 1)));
        await wait(index < resolutionEvents.length - 1 ? 180 : 260);
      }
    };

    const animateMockCamBid = async () => {
      const camBidEvents = mockAuctionCamBidEvents(currentMockDraft);
      if (!camBidEvents.length) return;

      const baseEvents = mockAuctionFeedLines(currentMockDraft);
      for (let index = 0; index < camBidEvents.length; index += 1) {
        renderMockAuctionFeedEvents(baseEvents.concat(camBidEvents.slice(0, index + 1)));
        const event = camBidEvents[index];
        await wait(event && (event.type === 'countdown' || event.type === 'sold') ? 180 : 240);
      }
    };

    const syncMockNominationSelection = mockDraft => {
      if (!currentState || !mockDraft || !mockDraft.nomination || !mockDraft.nomination.player) return;

      const target = currentState.availableTargets.find(candidate => candidate.name === mockDraft.nomination.player);
      if (!target || selectedTargetName === target.name) return;

      selectedTargetName = target.name;
      const nominationPrice = mockDraft.camDecision ? mockDraft.camDecision.recommendedBid : target.recommendedMaxBid;
      byId('add-price').value = String(nominationPrice);
      renderSelected(currentState);
      renderBoard(currentState);
    };

    const renderMockDraft = mockDraft => {
      currentMockDraft = mockDraft;
      renderMockAuctionFeed(mockDraft);
      const details = byId('mock-draft-details');
      byId('mock-draft-panel').dataset.phase = mockDraft && mockDraft.phase ? mockDraft.phase : '';
      const isMockMode = currentDraftMode === 'interactive-mock';
      const phase = mockDraft ? mockDraft.phase : '';
      const camBidButton = byId('mock-cam-win-button');
      const advanceButton = byId('mock-advance-button');
      const nominateButton = byId('mock-nominate-button');
      const nextDecisionButton = byId('mock-next-decision-button');
      const nextRoundButton = byId('mock-next-round-button');
      const completeButton = byId('mock-complete-button');
      const nominationPriceInput = byId('mock-nomination-price');
      const target = selectedTarget();
      const nominationTarget = nominationTargetForMockControls();
      const terminal = phase === 'complete' || phase === 'blocked';
      const humanStop = phase === 'human-decision' || phase === 'human-nomination';
      const canNominate = isMockMode && phase === 'human-nomination' && Boolean(nominationTarget);
      const mockAdvanceBusy = mockAdvanceRequestInFlight;
      advanceButton.disabled = mockAdvanceBusy || !isMockMode || phase !== 'ai-sale';
      advanceButton.textContent = phase === 'ai-sale' ? 'Continue AI sale' : 'Advance AI Sale';
      nominationPriceInput.hidden = !canNominate;
      nominationPriceInput.disabled = mockAdvanceBusy || !canNominate;
      if (canNominate && nominationPriceValue() <= 0) nominationPriceInput.value = String(pendingCamNominationPrice || 1);
      nominateButton.disabled = mockAdvanceBusy || !canNominate;
      nominateButton.textContent = nominationTarget ? 'Nominate ' + shortPlayerName(nominationTarget.name) : 'Choose nominee';
      camBidButton.disabled = mockAdvanceBusy || !isMockMode || phase !== 'human-decision' || !mockDraft.camDecision;
      camBidButton.textContent = mockDraft && mockDraft.auction && mockDraft.auction.nextCamBid != null ? 'Bid ' + money(mockDraft.auction.nextCamBid) : 'Bid';
      const canPass = isMockMode && (phase === 'human-decision' || phase === 'ai-sale');
      byId('mock-pass-button').disabled = mockAdvanceBusy || !canPass;
      byId('mock-pass-button').textContent = 'Pass';
      nextDecisionButton.textContent = mockAdvanceRequestAction === 'next-cam-decision' ? 'Simming to ' + currentWatchOwner + '...' : 'Sim to ' + currentWatchOwner + ' action';
      nextDecisionButton.disabled = mockAdvanceBusy || !isMockMode || terminal || humanStop;
      nextRoundButton.textContent = 'Sim to next round';
      nextRoundButton.disabled = mockAdvanceBusy || !isMockMode || terminal || humanStop;
      completeButton.textContent = mockAdvanceRequestAction === 'complete-mock' ? 'Completing mock...' : 'Complete mock draft';
      completeButton.disabled = mockAdvanceBusy || !isMockMode || terminal;
      scheduleMockAutoAdvance(mockDraft);

      if (!isMockMode) {
        details.replaceChildren(mockDraftItem('Mock draft', 'Start mock draft to enter the practice room.'));
        return;
      }

      if (!mockDraft) {
        details.replaceChildren(mockDraftItem('Mock draft', 'Loading interactive state.'));
        return;
      }

      if (mockAdvanceBusy && mockAdvanceRequestAction === 'complete-mock') {
        details.replaceChildren(mockDraftItem('Completing mock', 'Simulating the remaining auction and writing the completed practice log.'));
        return;
      }

      if (phase === 'human-nomination') {
        const ideas = (mockDraft.topTargets || []).slice(0, 5);
        details.replaceChildren(
          mockDraftItem(currentWatchOwner + ' nomination', target ? 'Nominate ' + target.name + ' from the board.' : 'Select a player from the board.'),
          mockDraftItem('Nomination ideas', ideas.length ? ideas.map(candidate => candidate.name + ' ' + money(candidate.liveExpectedPrice)).join(' / ') : '-')
        );
        if (currentState) renderBoard(currentState);
        renderSaleControls(currentState);
        return;
      }

      if (terminal) {
        details.replaceChildren(
          mockDraftItem(phase === 'complete' ? 'Mock complete' : 'Mock blocked', phase === 'complete' ? 'All roster slots have been filled.' : 'The mock draft cannot continue.')
        );
        renderSaleControls(currentState);
        if (currentState) renderBoard(currentState);
        return;
      }

      const nomination = mockDraft.nomination || {};
      const nominationText = nomination.player || nomination.name || mockDraft.nominatedPlayer || '-';
      const aiBids = (mockDraft.aiBids || []).slice(0, 5);
      const currentNomination = mockDraft.nominator && nominationText !== '-'
        ? mockDraft.nominator + ' nominated ' + nominationText
        : nominationText;
      const items = [
        mockDraftItem('Current nomination', currentNomination),
        mockDraftCommandItem(mockDraft.aiSaleCommand),
        mockDraftItem('Top AI bids', aiBids.length ? aiBids.map(bidText).join(' / ') : '-')
      ];

      if (mockDraft.camDecision) {
        const recommended = mockDraft.camDecision.recommendedBid == null
          ? '-'
          : money(mockDraft.camDecision.recommendedBid);
        const maxBid = mockDraft.camDecision.maxBid == null ? '-' : money(mockDraft.camDecision.maxBid);
        const topAiOwner = mockDraft.camDecision.topAiBidOwner || (aiBids[0] && aiBids[0].owner) || 'AI';
        const topAiBid = mockDraft.camDecision.topAiBid == null ? '-' : money(mockDraft.camDecision.topAiBid);
        items.push(mockDraftItem(currentWatchOwner + ' bid', recommended + ' now / ' + topAiOwner + ' can chase to ' + topAiBid + ' / ' + currentWatchOwner + ' max ' + maxBid));
      } else if (aiBids.length) {
        items.push(mockDraftItem(currentWatchOwner + ' bid', aiBids[0].owner + ' can go to ' + money(aiBids[0].amount) + '. Use AI sale unless you want to manually override.'));
      }

      details.replaceChildren(...items);
      syncMockNominationSelection(mockDraft);
      renderSaleControls(currentState);
      if (currentState) renderBoard(currentState);
    };

    const renderBoard = state => {
      syncBoardControls();
      const owner = currentOwner();
      const query = boardSearchQuery();
      const tierDrops = tierDropsFor(state.availableTargets);
      const allTargets = visibleBoardTargets(state);
      const filtered = allTargets.filter(target => targetMatchesFilters(target, query, owner));
      const matches = sortedTargets(filtered, tierDrops).slice(0, 120);
      const keeperCount = allTargets.length - state.availableTargets.length;
      const matchCount = filtered.length === allTargets.length ? '' : String(filtered.length) + ' matched / ';
      byId('board-count').textContent = String(matches.length) + ' shown / ' + matchCount + String(state.availableTargets.length) + ' loaded' + (keeperCount ? ' / ' + keeperCount + ' keepers' : '');

      const rows = matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const row = document.createElement('tr');
        row.classList.add(positionClassFor(target.position));
        if (target.name === selectedTargetName) row.classList.add('is-selected');
        if (currentMockDraft && currentMockDraft.auction && target.name === currentMockDraft.auction.player) row.classList.add('is-nominated');
        if (target.draftable === false) row.classList.add('keeper-row');
        const addCell = tableCell(row, '', 'center add-cell');
        addCell.appendChild(addTargetButton(target, 'icon'));

        const playerCell = tableCell(row, '', '');
        const title = document.createElement('div');
        title.className = 'player-title';
        title.append(textElement('div', target.name, 'player-name'), starTargetButton(target));
        playerCell.appendChild(title);
        if (target.draftable === false) {
          playerCell.appendChild(textElement('div', target.keeperOwner + ' keeper' + ' at ' + money(target.keeperCost), 'subtle'));
        }
        const strategyValues = renderStrategyValues(target);
        if (strategyValues) playerCell.appendChild(strategyValues);
        const tags = targetTags(target, tierDrop);
        if (tags) playerCell.appendChild(tags);

        tableCell(row, target.position);
        tableCell(row, target.teamAbbreviation || '-');
        tableCell(row, target.byeWeek || '-', 'center');
        tableCell(row, scoreText(target.week1Projection), 'money');
        tableCell(row, scoreText(target.seasonProjection), 'money');
        marketPriceCell(row, target);
        tableCell(row, money(target.personalValue), 'money');
        tableCell(row, deltaMoney(valueGapFor(target)), 'money ' + gapClassFor(valueGapFor(target)));
        tableCell(row, money(target.recommendedMaxBid), 'money');
        return row;
      });

      byId('board').replaceChildren(...rows);
      byId('board-cards').replaceChildren(...matches.map(target => {
        const tierDrop = tierDrops.get(target.name) || 0;
        const card = document.createElement('div');
        card.className = 'target-card ' + positionClassFor(target.position);
        if (currentMockDraft && currentMockDraft.auction && target.name === currentMockDraft.auction.player) card.classList.add('is-nominated');
        const add = document.createElement('div');
        add.appendChild(addTargetButton(target, 'icon'));
        const body = document.createElement('div');
        body.className = 'target-card-body';
        const top = document.createElement('div');
        top.className = 'target-card-top';
        const title = document.createElement('div');
        title.className = 'player-title';
        title.append(textElement('div', target.name, 'player-name'), starTargetButton(target));
        top.append(
          title,
          textElement('div', target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'), 'target-card-meta')
        );

        const values = document.createElement('div');
        values.className = 'target-card-values';
        for (const [label, value, className] of [
          ['Exp', money(target.expectedPrice), ''],
          ['Live', money(target.liveExpectedPrice), ''],
          ['Our', money(target.personalValue), ''],
          ['Gap', deltaMoney(valueGapFor(target)), gapClassFor(valueGapFor(target))],
          ['W1', scoreText(target.week1Projection), ''],
          ['Season', scoreText(target.seasonProjection), '']
        ]) {
          const cell = document.createElement('div');
          cell.className = 'target-card-value ' + className;
          cell.append(textElement('span', label), textElement('strong', value));
          values.appendChild(cell);
        }

        const tags = targetTags(target, tierDrop);
        body.append(top);
        if (target.draftable === false) {
          body.appendChild(textElement('div', target.keeperOwner + ' keeper' + ' at ' + money(target.keeperCost), 'subtle'));
        }
        const strategyValues = renderStrategyValues(target);
        if (strategyValues) body.appendChild(strategyValues);
        if (tags) body.appendChild(tags);
        body.appendChild(values);
        card.append(add, body);
        return card;
      }));
    };

    const renderSaleControls = state => {
      const target = selectedTarget();
      const owner = ownerByName(byId('add-owner').value || selectedRosterOwner);
      const price = priceInputValue();
      const warnings = saleWarningsFor(target, owner, price);
      const submit = byId('add-submit');
      const priceInput = byId('add-price');
      const ownerInput = byId('add-owner');
      const warning = byId('sale-warning');
      const isMockMode = currentDraftMode === 'interactive-mock';
      ownerInput.disabled = isMockMode;
      priceInput.disabled = isMockMode;
      warning.classList.toggle('info', isMockMode);

      if (isMockMode) {
        const auction = currentMockDraft && currentMockDraft.auction;
        const isAuctionTarget = Boolean(target && auction && auction.player === target.name);
        submit.disabled = true;
        submit.textContent = target ? 'Mock mode - use auction controls' : 'Mock mode';
        if (isAuctionTarget && auction.status === 'sold' && auction.resolution) {
          warning.textContent =
            'Mock auction sold ' + target.name + ' to ' + auction.resolution.owner + ' for ' + money(auction.resolution.price) + '. Advance to the next nomination.';
        } else if (isAuctionTarget && auction.nextCamBid != null) {
          warning.textContent = 'Use the Bid ' + money(auction.nextCamBid) + ' button in the mock auction controls.';
        } else if (currentMockDraft && currentMockDraft.phase === 'human-nomination') {
          warning.textContent = target ? 'Use Nominate ' + shortPlayerName(target.name) + ' above the board, or open the + menu on any player.' : 'Select a player to nominate.';
        } else {
          warning.textContent = 'Mock mode uses the auction controls below. Manual sale logging is disabled here.';
        }
        return;
      }

      ownerInput.disabled = false;
      priceInput.disabled = false;
      submit.disabled = warnings.length > 0;
      submit.textContent = target ? 'Add ' + shortPlayerName(target.name) + ' to ' + owner.owner + ' for ' + money(price || target.recommendedMaxBid) : 'Add';
      warning.textContent = warnings.join(' ');
    };

    const renderSelected = state => {
      const target = selectedTarget();
      const root = byId('selected-player');
      if (!target) {
        const first = state.availableTargets[0];
        selectedTargetName = first ? first.name : null;
        if (first) byId('add-price').value = String(first.recommendedMaxBid);
        if (first) renderSelected(state);
        return;
      }

      root.className = 'selected-player ' + positionClassFor(target.position);
      const meta = textElement(
        'span',
        target.position + ' ' + (target.teamAbbreviation || '-') + ' - bye ' + (target.byeWeek || '-'),
        'subtle'
      );
      const bidPrice = selectedBidPriceFor(target);
      const values = document.createElement('div');
      values.className = 'selected-values';
      for (const [label, value, className] of [
        ['Exp', money(target.expectedPrice), ''],
        ['Live', money(target.liveExpectedPrice), ''],
        [selectedBidLabelFor(target), money(bidPrice), ''],
        ['Our', money(target.personalValue), ''],
        ['Bid gap', deltaMoney(valueGapAtPriceFor(target, bidPrice)), gapClassFor(valueGapAtPriceFor(target, bidPrice))],
        ['Season', scoreText(target.seasonProjection), '']
      ]) {
        const cell = document.createElement('div');
        cell.className = 'selected-value ' + className;
        cell.append(textElement('span', label), textElement('strong', value));
        values.appendChild(cell);
      }

      root.replaceChildren(textElement('strong', target.name), meta, values);
      renderSaleControls(state);
    };

    const nominationTargetForMockControls = () => {
      if (!pendingCamNominationName || !currentState) return null;
      return currentState.availableTargets.find(target => target.name === pendingCamNominationName) || null;
    };

    const rosterSlotLabelFor = slot => cleanText(slot).startsWith('BENCH') ? 'BENCH' : slot;

    const renderRoster = state => {
      const owner = currentOwner();
      const summary = [
        ['Left', money(owner.budgetRemaining)],
        ['Max', money(owner.maxBid)],
        ['Slots', String(owner.rosterSlotsRemaining)]
      ];
      byId('roster-summary').replaceChildren(...summary.map(([label, value]) => metricTile(label, value, 'mini-metric')));

      const rows = owner.slots.map(slot => {
        const row = document.createElement('tr');
        tableCell(row, rosterSlotLabelFor(slot.slot), 'slot');
        const playerCell = tableCell(row, '', slot.player ? '' : 'empty');
        if (slot.player) {
          playerCell.replaceChildren(
            textElement('div', slot.player.name, 'player-name'),
            textElement('div', slot.player.position + ' ' + (slot.player.teamAbbreviation || '-') + ' - bye ' + (slot.player.byeWeek || '-'), 'subtle')
          );
          tableCell(row, money(slot.player.price), 'money');
        } else {
          playerCell.textContent = '-';
          tableCell(row, '', 'money');
        }
        return row;
      });
      byId('roster-slots').replaceChildren(...rows);
    };

    const renderOwners = state => {
      const rows = state.owners.map(owner => {
        const row = document.createElement('tr');
        tableCell(row, owner.owner, 'player-name');
        tableCell(row, money(owner.budgetRemaining), 'money');
        tableCell(row, money(owner.maxBid), 'money');
        tableCell(row, String(owner.rosterSlotsRemaining), 'money');
        return row;
      });
      byId('owners').replaceChildren(...rows);
    };

    const renderEvents = state => {
      byId('sale-count').textContent = String(state.events.length) + ' sales';
      const rows = state.events.slice().reverse().map(event => {
        const row = document.createElement('tr');
        const sale = tableCell(row, '', '');
        const rawCommand = document.createElement('code');
        rawCommand.className = 'raw-command';
        rawCommand.textContent = event.input;
        sale.replaceChildren(
          textElement('div', event.owner + ' - ' + event.player, 'player-name'),
          textElement('div', event.position + ' - exp ' + money(event.expectedPrice) + ' - ' + event.playerSource, 'subtle'),
          rawCommand
        );
        tableCell(row, money(event.price), 'money');
        const delta = tableCell(row, deltaMoney(event.saleVsExpected), 'money');
        delta.classList.add(event.saleVsExpected >= 0 ? 'delta-up' : 'delta-down');
        return row;
      });
      byId('events').replaceChildren(...rows);
    };

    const renderErrors = state => {
      const message = (state.errors || []).map(error => error.message).filter(Boolean).join(' ');
      const errors = (state.errors || []).map(error => {
        const element = document.createElement('div');
        element.className = 'error';
        element.textContent = error.message;
        return element;
      });
      byId('errors').replaceChildren(...errors);
      if (message) announceOperation(message, { assertive: true, focus: true });
    };

    const renderStateLoadError = message => {
      renderErrors({ errors: [{ message }] });
      byId('board-count').textContent = 'Draft room unavailable';
      byId('board').replaceChildren();
      byId('board-cards').replaceChildren();
      byId('position-market').replaceChildren();
      byId('selected-player').replaceChildren();
      byId('roster-summary').replaceChildren();
      byId('roster-slots').replaceChildren();
      byId('owners').replaceChildren();
      byId('events').replaceChildren();
      byId('import-conflict-review').replaceChildren();
      renderMockDraft(null);
    };

    const render = state => {
      const isInitialRender = currentState === null;
      const previousWatchOwner = currentWatchOwner;
      currentState = state;
      if (state.watchOwner && state.watchOwner.owner) currentWatchOwner = state.watchOwner.owner;
      syncStrategy(state);
      syncDraftSession(state);
      loadManualShortlist();
      renderDraftMode(state);
      if (
        isInitialRender ||
        selectedRosterOwner === previousWatchOwner ||
        !state.owners.some(owner => owner.owner === selectedRosterOwner)
      ) selectedRosterOwner = currentWatchOwner;
      syncOwnerSelects(state);
      syncBoardFilterOptions(state);
      renderPositionMarket(state);
      renderBoard(state);
      renderSelected(state);
      renderReadiness(state);
      renderPostDraftAudit(state);
      renderDraftPath(state);
      renderShortlist(state);
      renderRoster(state);
      renderOwners(state);
      renderPositionContext(state);
      renderEvents(state);
      renderErrors(state);
      renderImportConflictReview(state);
      renderSidePanel(state);
      if (state.mockDraft) renderMockDraft(state.mockDraft);
      else renderMockDraft(null);
      renderMockBatchResults(latestMockBatchReport);
    };

    const refreshMockDraft = async () => {
      if (!isActiveDraft() || currentDraftMode !== 'interactive-mock' || draftNightLockFor(currentState)) {
        renderMockDraft(null);
        return null;
      }
      renderMockDraft(null);
      try {
        const response = await fetch(mockDraftUrl());
        const data = await response.json();
        if (!response.ok) {
          const message = typeof data.error === 'string'
            ? data.error
            : data.error && typeof data.error.message === 'string'
              ? data.error.message
              : 'Could not load mock draft.';
          throw new Error(message);
        }
        renderMockDraft(data.mockDraft || data);
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load mock draft.';
        announceOperation(message, { assertive: true, focus: true });
        byId('mock-draft-details').replaceChildren(mockDraftItem('Mock draft unavailable', message));
        byId('mock-advance-button').disabled = true;
        byId('mock-nominate-button').disabled = true;
        byId('mock-cam-win-button').disabled = true;
        byId('mock-pass-button').disabled = true;
        byId('mock-next-decision-button').disabled = true;
        byId('mock-next-round-button').disabled = true;
        byId('mock-complete-button').disabled = true;
        return null;
      }
    };

    const refreshState = async () => {
      try {
        const response = await fetch(stateUrl());
        const state = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message = typeof state.error === 'string'
            ? state.error
            : state.error && typeof state.error.message === 'string'
              ? state.error.message
              : 'Could not load draft room.';
          renderStateLoadError(message);
          return null;
        }
        render(state);
        return state;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not reach the draft room.';
        renderStateLoadError(message);
        return null;
      }
    };

    const refreshDraftRoom = async () => {
      const state = await refreshState();
      if (!state) return null;
      await refreshMockDraft();
      return state;
    };

    const clearDraftCountdownTimer = () => {
      if (!draftCountdownTimer) return;
      window.clearTimeout(draftCountdownTimer);
      draftCountdownTimer = null;
    };

    const activateDraft = async () => {
      clearDraftCountdownTimer();
      draftLifecycle = 'active';
      draftCountdownValue = 0;
      pendingCamNominationName = null;
      pendingCamNominationPrice = 1;
      persistDraftLifecycle();

      const state = await refreshDraftRoom();
      if (!state) {
        draftLifecycle = 'ready';
        persistDraftLifecycle();
        return;
      }
      announceOperation(currentDraftMode === 'interactive-mock' ? 'Mock draft ready.' : 'Real draft ready.');
      focusCommandInput();
    };

    const beginDraftCountdown = () => {
      if (isActiveDraft()) return;
      clearDraftCountdownTimer();
      draftLifecycle = 'countdown';
      draftCountdownValue = draftCountdownSeconds;
      persistDraftLifecycle();
      renderDraftMode(currentState);

      const tick = () => {
        draftCountdownValue -= 1;
        if (draftCountdownValue <= 0) {
          void activateDraft();
          return;
        }
        renderDraftLifecycle(currentState);
        draftCountdownTimer = window.setTimeout(tick, 1000);
      };

      draftCountdownTimer = window.setTimeout(tick, 1000);
    };

    const endActiveDraft = async () => {
      if (!isActiveDraft() && !isStartingDraft()) return;
      const isMock = currentDraftMode === 'interactive-mock';
      const message = isMock
        ? 'End this mock draft and return to setup? This keeps the practice log until you reset it.'
        : 'End the active real draft view? This will not change logged sales.';
      if (!window.confirm(message)) {
        focusCommandInput();
        return;
      }

      clearDraftCountdownTimer();
      draftLifecycle = 'setup';
      draftCountdownValue = 0;
      pendingCamNominationName = null;
      pendingCamNominationPrice = 1;
      persistDraftLifecycle();
      await refreshDraftRoom();
      announceOperation(isMock ? 'Mock draft ended. Your picks are saved.' : 'Real draft view ended.', { focus: true });
    };

    const setDraftMode = async (mode, options = {}) => {
      const nextMode = draftModes.includes(mode) ? mode : 'real';
      if (!guardDraftModeSwitch(nextMode)) return;
      if (nextMode === 'real') currentDraftSession = 'live';
      if (nextMode === 'interactive-mock' && (currentDraftSession === 'live' || draftNightLockFor(currentState))) {
        currentDraftSession = practiceSessionForStrategy(currentStrategyKey);
      }
      currentDraftMode = nextMode;
      if (options.prepareStart) draftLifecycle = 'ready';
      else if (!isActiveDraft()) draftLifecycle = 'setup';
      selectedTargetName = null;
      pendingCamNominationName = null;
      pendingCamNominationPrice = 1;
      persistDraftLifecycle();
      await refreshDraftRoom();
      if (window.location.pathname === '/') {
        window.history.replaceState(null, '', draftRoomRouteUrl(currentDraftMode));
      }
      focusCommandInput();
    };

    const guardDraftModeSwitch = nextMode => {
      if (nextMode === currentDraftMode && (isActiveDraft() || isStartingDraft())) return false;
      if (nextMode === currentDraftMode) return true;
      if (!isActiveDraft() && !isStartingDraft()) return true;
      window.alert('End the active draft before switching draft modes.');
      focusCommandInput();
      return false;
    };

    const openDraftRoomMode = async mode => {
      closeAppMenu();
      if (window.location.pathname !== '/') {
        window.location.assign(draftRoomRouteUrl(mode));
        return;
      }

      await setDraftMode(mode, { prepareStart: true });
    };

    const setDraftSession = async draftSession => {
      currentDraftSession = normalizeDraftSession(draftSession, currentDraftMode);
      currentDraftMode = draftModeForSession(currentDraftSession, currentDraftMode);
      if (!isActiveDraft()) draftLifecycle = 'setup';
      selectedTargetName = null;
      pendingCamNominationName = null;
      pendingCamNominationPrice = 1;
      persistDraftLifecycle();
      await refreshDraftRoom();
      focusCommandInput();
    };

    const openScratchSession = async () => {
      const scratchName = byId('scratch-session-name').value.trim();
      if (!scratchName) {
        byId('active-session-label').textContent = 'Enter a scratch room name.';
        byId('scratch-session-name').focus();
        return;
      }
      await setDraftSession('scratch:' + scratchName);
    };

    const currentInteractiveMockResultsReady = () =>
      currentDraftMode === 'interactive-mock' &&
      currentState &&
      currentCommandCount() > 0 &&
      Array.isArray(currentState.owners) &&
      currentState.owners.every(owner => Number(owner.rosterSlotsRemaining || 0) === 0);

    const syncMockResultsMenuItem = (job, forceVisible = false) => {
      const button = byId('see-mock-results-button');
      const isReady =
        currentInteractiveMockResultsReady() ||
        (job && job.status === 'complete' && job.result && mockBatchJobMatchesCurrentControls(job));
      const isVisible = forceVisible || isReady;
      button.hidden = !isVisible;
      button.disabled = !isVisible;
    };

    const currentMockBatchRuns = () => {
      const value = Number(byId('mock-batch-runs').value || 25);
      return Number.isInteger(value) && value > 0 ? value : 25;
    };

    const mockBatchJobMatchesCurrentControls = job => {
      if (!job) return false;
      if (job.source === 'interactive-complete') {
        return currentDraftMode === 'interactive-mock' &&
          job.draftSessionKey === currentDraftSession &&
          job.watchOwner === currentWatchOwner &&
          job.strategyKey === currentStrategyKey &&
          Number(job.commandCount || 0) === currentCommandCount();
      }
      const currentScript = mockBatchScript();
      const jobScript = job.script && job.script.raw ? job.script.raw : '';
      const scriptRunsControlTheBatch = Boolean(job.script && job.script.runsPerScenario !== undefined);
      return job.strategyKey === currentStrategyKey &&
        job.draftSessionKey === currentDraftSession &&
        job.watchOwner === currentWatchOwner &&
        jobScript === currentScript &&
        (scriptRunsControlTheBatch || Number(job.runsPerScenario || 25) === currentMockBatchRuns());
    };

    const renderMockBatchButtonState = job => {
      const button = byId('run-mock-batch-button');
      const resultsRunNewButton = byId('mock-results-run-new-button');
      const input = byId('mock-batch-runs');
      const scriptInput = byId('mock-batch-script');
      const status = job ? job.status : '';
      const percent = Math.max(0, Math.min(100, Number(job && job.percent ? job.percent : 0)));
      const isRunning = status === 'queued' || status === 'running';
      const isReady =
        currentInteractiveMockResultsReady() ||
        (status === 'complete' && job && job.result && mockBatchJobMatchesCurrentControls(job));
      const hasPreviousResults = status === 'complete' && job && job.result;

      button.style.setProperty('--mock-progress', isRunning || hasPreviousResults || isReady ? (isReady ? '100%' : percent + '%') : '0%');
      button.classList.toggle('mock-batch-running', isRunning);
      button.classList.toggle('mock-batch-ready', isReady);
      button.disabled = isRunning;
      input.disabled = isRunning;
      scriptInput.disabled = isRunning;
      syncMockResultsMenuItem(job, window.location.pathname === '/mock-results');
      resultsRunNewButton.disabled = isRunning;

      if (isRunning) {
        button.textContent = percent > 0 ? percent + '% complete' : 'Starting simulations';
        resultsRunNewButton.textContent = percent > 0 ? percent + '% complete' : 'Starting simulations';
        return;
      }

      resultsRunNewButton.textContent = 'Run new mocks';
      if (isReady) {
        button.textContent = 'See results';
        return;
      }
      button.textContent = 'Run simulations';
    };

    const publishCurrentMockResults = async () => {
      const data = await postJson('/api/mock/session-results', {
        mode: 'interactive-mock',
        seed: 'live-ui-session-results',
        expectedCommandCount: currentCommandCount()
      });
      alertCommandErrors(data);
      if ((data.errors || []).length) {
        throw new Error(data.errors[0].message || 'Could not build results from this mock draft.');
      }
      if (!data.mockBatchJob || !data.mockBatchJob.result) {
        throw new Error('Could not build results from this mock draft.');
      }

      latestMockBatchJob = data.mockBatchJob;
      latestMockBatchReport = data.mockBatchJob.result;
      renderMockBatchButtonState(data.mockBatchJob);
      renderMockBatchResultsForJob(data.mockBatchJob);
      return data.mockBatchJob;
    };

    const openMockResults = async () => {
      closeAppMenu();
      try {
        if (currentInteractiveMockResultsReady()) {
          await publishCurrentMockResults();
        } else if (!(
          latestMockBatchJob &&
          latestMockBatchJob.status === 'complete' &&
          latestMockBatchJob.result &&
          mockBatchJobMatchesCurrentControls(latestMockBatchJob)
        )) {
          throw new Error('Run simulations or complete the current mock draft before opening results.');
        }

        window.location.assign(mockResultsRouteUrl());
      } catch (error) {
        announceOperation(error instanceof Error ? error.message : 'Could not open mock results.', { assertive: true, focus: true });
        renderMockBatchButtonState(latestMockBatchJob);
        focusCommandInput();
      }
    };

    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    const fetchMockBatchJob = async jobId => {
      const response = await fetch('/api/mock-batch/' + encodeURIComponent(jobId) + '?mode=' + currentDraftMode + sessionQuery());
      const job = await response.json();
      if (!response.ok) throw new Error(job.error || 'Could not load mock batch job.');
      return job;
    };

    const pollMockBatchJob = async jobId => {
      const job = await fetchMockBatchJob(jobId);
      latestMockBatchJob = job;
      if (job.result) {
        latestMockBatchReport = job.result;
        renderMockBatchResultsForJob(job);
      }
      renderMockBatchButtonState(job);

      if (window.location.pathname === '/mock-results') {
        if (job.status === 'complete' && job.result) renderMockResultsRoute(job.result);
        else renderMockResultsLoading(job);
      }

      if (job.status === 'complete') return job;
      if (job.status === 'failed') throw new Error(job.error || 'Simulation failed.');

      await wait(250);
      return pollMockBatchJob(jobId);
    };

    const loadLatestMockBatchJob = async () => {
      const response = await fetch('/api/mock-batch/latest?mode=' + currentDraftMode + sessionQuery());
      const job = await response.json();
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(job.error || 'Could not load mock batch results.');
      return job;
    };

    const syncLatestMockBatchJob = async (forceVisible = false) => {
      const job = await loadLatestMockBatchJob();
      latestMockBatchJob = job;
      if (job && job.result) {
        latestMockBatchReport = job.result;
        renderMockBatchResultsForJob(job);
      }
      renderMockBatchButtonState(job);
      syncMockResultsMenuItem(job, forceVisible);
      return job;
    };

    const mockBatchSeedPrefix = () =>
      'live-ui-' + currentStrategyKey + '-' + Date.now().toString(36);

    const mockBatchScript = () =>
      byId('mock-batch-script').value.trim();

    const runMockBatch = async () => {
      const runs = Number(byId('mock-batch-runs').value || 25);
      selectedMockResultsRunIndex = 0;
      try {
        const response = await fetch('/api/mock-batch?mode=' + currentDraftMode + sessionQuery(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            strategyKey: currentStrategyKey,
            draftSession: currentDraftSession,
            owner: currentWatchOwner,
            runs,
            seedPrefix: mockBatchSeedPrefix(),
            script: mockBatchScript()
          })
        });
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || 'Could not run mock batch.');
        latestMockBatchJob = job;
        renderMockBatchButtonState(job);
        await pollMockBatchJob(job.jobId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not run mock batch.';
        byId('mock-batch-results').replaceChildren(mockDraftItem('Simulation failed', message));
        latestMockBatchJob = { status: 'failed', percent: 0, error: message };
        renderMockBatchButtonState(latestMockBatchJob);
      }

      if (window.location.pathname !== '/mock-results') {
        focusCommandInput();
      }
    };

    const renderDraftRoomRoute = async () => {
      stopPlayerNewsPolling();
      setActiveRouteShell('draft-room');
      hydrateDraftRoomFromLocation();
      showOnlyAppView('draft-room-view');
      byId('draft-room-view').hidden = false;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = true;
      byId('player-news-view').hidden = true;
      await refreshDraftRoom();
      try {
        await syncLatestMockBatchJob();
      } catch (error) {
        renderMockBatchButtonState(latestMockBatchJob);
      }
      focusCommandInput();
    };

    const renderMockSimulationsPage = async () => {
      stopPlayerNewsPolling();
      hydrateDraftRoomFromLocation();
      setActiveRouteShell('mock-simulations');
      setAppMenuCurrent('mock-simulations', 'Mock simulations');
      showOnlyAppView('mock-simulations-view');
      byId('mock-simulation-strategy').value = currentStrategyKey;
      const scenario = new URLSearchParams(window.location.search).get('scenario');
      if (scenario) byId('mock-batch-script').value = scenario;
      try {
        await syncLatestMockBatchJob();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load simulations.';
        byId('mock-batch-results').replaceChildren(mockDraftItem('Simulations unavailable', message));
        announceOperation(message, { assertive: true, focus: true });
      }
    };

    const renderMockResultsPage = async () => {
      stopPlayerNewsPolling();
      hydrateDraftRoomFromLocation();
      setActiveRouteShell('mock-results');
      setAppMenuCurrent('mock-results', 'Mock results');
      showOnlyAppView('mock-results-view');
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = false;
      byId('my-expert-view').hidden = true;
      byId('player-news-view').hidden = true;

      try {
        const job = await syncLatestMockBatchJob(true);
        if (!job) {
          renderMockResultsRoute(null);
          return;
        }

        if (job.result) latestMockBatchReport = job.result;
        if (job.status === 'complete' && job.result) {
          renderMockResultsRoute(job.result);
          return;
        }

        renderMockResultsLoading(job);
        await pollMockBatchJob(job.jobId);
      } catch (error) {
        syncMockResultsMenuItem(latestMockBatchJob, true);
        renderMockResultsError(error instanceof Error ? error.message : 'Could not load mock results.');
      }
    };

    const renderMyExpertPage = async () => {
      stopPlayerNewsPolling();
      setActiveRouteShell('my-expert');
      hydrateMyExpertFromLocation();
      setAppMenuCurrent('my-expert', 'My expert');
      showOnlyAppView('my-expert-view');
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = false;
      byId('player-news-view').hidden = true;
      if (!latestMyExpertReport) byId('my-expert-title').textContent = 'Loading roster advice.';
      byId('my-expert-status').textContent = myExpertReadOnlyLabel(latestMyExpertReport);

      try {
        await syncLatestMockBatchJob();
      } catch (error) {
        syncMockResultsMenuItem(latestMockBatchJob);
      }

      await loadMyExpertReport();
    };

    const renderPlayerNewsPage = async () => {
      setActiveRouteShell('player-news');
      hydratePlayerNewsFromLocation();
      setAppMenuCurrent('player-news', 'Player news');
      showOnlyAppView('player-news-view');
      byId('draft-room-view').hidden = true;
      byId('mock-results-view').hidden = true;
      byId('my-expert-view').hidden = true;
      byId('player-news-view').hidden = false;
      if (!latestPlayerNewsFeed) byId('player-news-title').textContent = 'Loading player news.';
      byId('player-news-status').textContent = playerNewsUpdatedLabel(latestPlayerNewsFeed);

      try {
        await syncLatestMockBatchJob();
      } catch (error) {
        syncMockResultsMenuItem(latestMockBatchJob);
      }

      await loadPlayerNewsFeed();
    };

    const renderCurrentRoute = async () => {
      if (window.location.pathname === '/mock-simulations' || window.location.pathname === '/simulations') {
        await renderMockSimulationsPage();
        return;
      }

      if (window.location.pathname === '/player-news') {
        await renderPlayerNewsPage();
        return;
      }

      if (window.location.pathname === '/my-expert') {
        await renderMyExpertPage();
        return;
      }

      if (window.location.pathname === '/mock-results') {
        await renderMockResultsPage();
        return;
      }

      await renderDraftRoomRoute();
    };

    const refreshPlayerNewsIfCurrentRoute = async ({ background = false } = {}) => {
      if (window.location.pathname === '/player-news') {
        replacePlayerNewsRoute();
        if (background) await loadPlayerNewsFeed({ background: true });
        else await renderPlayerNewsPage();
      }
    };

    const refreshMyExpertIfCurrentRoute = async () => {
      if (window.location.pathname === '/my-expert') {
        window.history.replaceState(null, '', myExpertRouteUrl());
        await renderMyExpertPage();
      }
    };

    const schedulePlayerNewsRefresh = () => {
      if (playerNewsSearchTimer) window.clearTimeout(playerNewsSearchTimer);
      playerNewsSearchTimer = window.setTimeout(() => {
        void refreshPlayerNewsIfCurrentRoute();
      }, 160);
    };

    const renderMutationState = data => {
      if (data && data.availableTargets && data.owners) render(data);
    };

    const postJsonAndRefresh = async (url, body) => {
      const data = await postJson(url, body);
      renderMutationState(data);
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const submitCommand = async command => {
      const data = await postJson('/api/events', { command });
      alertCommandErrors(data);
      if (!data.errors.length) {
        pendingCamNominationName = null;
        pendingCamNominationPrice = 1;
        selectedTargetName = data.availableTargets[0] ? data.availableTargets[0].name : null;
        render(data);
      }
      await refreshMockDraft();
      focusCommandInput();
      return data;
    };

    const confirmLiveDraftMutation = action => {
      if (!isLiveRealDraftRoom()) return true;
      return window.confirm('This will ' + action + ' the real live draft room. Export a bundle first if you are not sure.');
    };

    const confirmDraftReset = () =>
      currentDraftMode === 'interactive-mock'
        ? window.confirm('Reset this mock draft and permanently remove all practice picks?')
        : confirmLiveDraftMutation('reset');

    const confirmDraftUndo = () =>
      currentDraftMode === 'interactive-mock'
        ? window.confirm('Undo the most recent mock draft sale?')
        : confirmLiveDraftMutation('undo the last command in');

    const advanceMockDraft = async (action, nominatedPlayerName = selectedTargetName, nominatedPrice = nominationPriceValue()) => {
      if (mockAdvanceRequestInFlight) return null;
      if (action === 'complete-mock' && !window.confirm('Complete this mock draft by simulating every remaining sale?')) return null;
      mockAdvanceRequestInFlight = true;
      mockAdvanceRequestAction = action;
      if (currentMockDraft) renderMockDraft(currentMockDraft);
      if (draftNightLockFor(currentState)) {
        window.alert(draftNightLockReasonFor(currentState));
        currentDraftMode = 'real';
        if (currentState) renderDraftMode(currentState);
        focusCommandInput();
        mockAdvanceRequestInFlight = false;
        mockAdvanceRequestAction = null;
        return null;
      }
      try {
        if (currentDraftMode !== 'interactive-mock') {
          await setDraftMode('interactive-mock');
        }
        if (action === 'cam-nominate') {
          pendingCamNominationName = nominatedPlayerName;
          pendingCamNominationPrice = nominatedPrice;
          selectedTargetName = nominatedPlayerName;
        }
        if (action === 'cam-bid') {
          byId('mock-cam-win-button').disabled = true;
          byId('mock-pass-button').disabled = true;
          await animateMockCamBid();
        }
        if (['advance', 'pass'].includes(action) && currentMockDraft && currentMockDraft.auction) {
          byId('mock-advance-button').disabled = true;
          byId('mock-pass-button').disabled = true;
          await animateMockAuctionResolution();
        }
        if (action === 'complete-mock') {
          const completeButton = byId('mock-complete-button');
          completeButton.disabled = true;
          completeButton.textContent = 'Completing mock...';
          byId('mock-advance-button').disabled = true;
          byId('mock-nominate-button').disabled = true;
          byId('mock-cam-win-button').disabled = true;
          byId('mock-pass-button').disabled = true;
          byId('mock-next-decision-button').disabled = true;
          byId('mock-next-round-button').disabled = true;
        }
        const data = await postJson('/api/mock/advance', {
          strategyKey: currentStrategyKey,
          mode: 'interactive-mock',
          draftSession: currentDraftSession,
          seed: 'live-ui',
          action,
          nominatedPlayer: pendingCamNominationName,
          nominatedPrice: pendingCamNominationPrice,
          mockAuction: currentMockDraft && currentMockDraft.auction
        });
        alertCommandErrors(data);
        if (action !== 'cam-nominate' && !(data.errors || []).length) {
          pendingCamNominationName = null;
          pendingCamNominationPrice = nominationPriceValue();
        }
        if (data.mockBatchJob && data.mockBatchJob.result) {
          latestMockBatchJob = data.mockBatchJob;
          latestMockBatchReport = data.mockBatchJob.result;
          renderMockBatchButtonState(data.mockBatchJob);
          renderMockBatchResultsForJob(data.mockBatchJob);
          if (action === 'complete-mock' && !(data.errors || []).length) {
            window.location.assign(mockResultsRouteUrl());
            return data;
          }
        }
        if (data.availableTargets && data.owners) render(data);
        else await refreshMockDraft();
        focusCommandInput();
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update the mock draft.';
        announceOperation(message, { assertive: true, focus: true });
        return null;
      } finally {
        mockAdvanceRequestInFlight = false;
        mockAdvanceRequestAction = null;
        if (currentMockDraft) renderMockDraft(currentMockDraft);
      }
    };

    const downloadText = (filename, content, contentType) => {
      const blob = new Blob([content], { type: contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    };

    const exportLog = async format => {
      const response = await fetch('/api/export?mode=' + currentDraftMode + '&format=' + format + sessionQuery());
      const content = await response.text();
      if (!response.ok) {
        if (currentState) render({ ...currentState, errors: [{ input: '', message: content || 'Could not export draft log.' }] });
        await refreshMockDraft();
        focusCommandInput();
        return;
      }

      downloadText(
        'mockd-' + currentDraftMode + '-draft-log.' + format,
        content,
        format === 'csv' ? 'text/csv' : 'application/json'
      );
      await refreshMockDraft();
      focusCommandInput();
    };

    const exportSessionBundle = async () => {
      const response = await fetch('/api/export-bundle?mode=' + currentDraftMode + '&strategy=' + currentStrategyKey + sessionQuery());
      const content = await response.text();
      if (!response.ok) {
        if (currentState) render({ ...currentState, errors: [{ input: '', message: content || 'Could not export draft bundle.' }] });
        await refreshMockDraft();
        focusCommandInput();
        return;
      }

      downloadText('mockd-' + safeFilePart(currentDraftSession) + '-' + currentDraftMode + '-bundle.json', content, 'application/json');
      await refreshMockDraft();
      focusCommandInput();
    };

    const importDraftLogFile = async file => {
      if (!file) return;
      const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
      const content = await file.text();
      if (!confirmLiveDraftMutation('import over')) {
        byId('import-log-file').value = '';
        focusCommandInput();
        return;
      }
      const importGuard = isLiveRealDraftRoom()
        ? { confirmImport: true, expectedCommandCount: currentCommandCount() }
        : {};
      const data = await postJson('/api/import', { format, content, ...importGuard });
      alertCommandErrors(data);
      renderMutationState(data);
      await refreshMockDraft();
      byId('import-log-file').value = '';
      focusCommandInput();
    };

    const resetDraftRoom = async () => {
      if (!confirmDraftReset()) {
        focusCommandInput();
        return;
      }
      const resetGuard = isLiveRealDraftRoom()
        ? { confirmReset: true, expectedCommandCount: currentCommandCount() }
        : {};
      const data = await postJsonAndRefresh('/api/reset', resetGuard);
      alertCommandErrors(data);
      if (!(data.errors || []).length) {
        if (currentDraftMode === 'interactive-mock') {
          announceOperation('Mock draft reset. Start again when you are ready.', { focus: true });
        } else {
          announceOperation('Real draft reset.', { focus: true });
        }
      }
    };

    const undoDraftRoom = async () => {
      if (!confirmDraftUndo()) {
        focusCommandInput();
        return;
      }
      const undoGuard = isLiveRealDraftRoom()
        ? { confirmUndo: true, expectedCommandCount: currentCommandCount() }
        : {};
      const data = await postJsonAndRefresh('/api/undo', undoGuard);
      alertCommandErrors(data);
      if (!(data.errors || []).length) announceOperation('Last draft action undone.', { focus: true });
    };

    const syncBoardSearchInput = source => {
      const other = source.id === 'board-search' ? byId('header-board-search') : byId('board-search');
      other.value = source.value;
      if (currentState) renderBoard(currentState);
    };

    const submitQuickSaleCommand = async input => {
      const command = input.value.trim();
      if (!command) return;
      const data = await submitCommand(command);
      if (!data.errors.length) input.value = '';
    };

    byId('board-search').addEventListener('input', event => {
      syncBoardSearchInput(event.target);
    });

    byId('header-board-search').addEventListener('input', event => {
      syncBoardSearchInput(event.target);
    });

    byId('quick-sale-form').addEventListener('submit', async event => {
      event.preventDefault();
      await submitQuickSaleCommand(byId('quick-sale-command'));
    });

    byId('header-quick-sale-form').addEventListener('submit', async event => {
      event.preventDefault();
      await submitQuickSaleCommand(byId('header-quick-sale-command'));
    });

    byId('position-market').addEventListener('click', event => {
      const button = event.target.closest('[data-position-filter]');
      if (!button) return;
      setBoardPositionFilter(button.dataset.positionFilter);
    });

    for (const input of [byId('my-needs-filter'), byId('team-filter'), byId('bye-filter')]) {
      input.addEventListener('input', () => {
        if (currentState) renderBoard(currentState);
      });
    }

    for (const button of document.querySelectorAll('[data-side-panel]')) {
      button.addEventListener('click', event => setSidePanel(event.currentTarget.dataset.sidePanel));
    }

    byId('sort-select').addEventListener('change', event => {
      boardSortKey = boardSortKeys.includes(event.target.value) ? event.target.value : 'liveExpectedPrice';
      if (currentState) renderBoard(currentState);
    });

    byId('strategy-select').addEventListener('change', async event => {
      currentStrategyKey = strategyKeys.includes(event.target.value) ? event.target.value : 'three-rb';
      pendingCamNominationName = null;
      pendingCamNominationPrice = 1;
      persistDraftLifecycle();
      window.history.replaceState(null, '', draftRoomRouteUrl(currentDraftMode));
      await refreshDraftRoom();
      focusCommandInput();
    });

    byId('add-price').addEventListener('input', () => {
      if (currentState) renderSelected(currentState);
    });

    byId('add-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('roster-owner').value = selectedRosterOwner;
      if (currentState) {
        renderSelected(currentState);
        renderRoster(currentState);
        renderBoard(currentState);
      }
    });

    byId('roster-owner').addEventListener('change', event => {
      selectedRosterOwner = event.target.value;
      byId('add-owner').value = selectedRosterOwner;
      if (currentState) {
        renderSelected(currentState);
        renderRoster(currentState);
        renderBoard(currentState);
      }
    });

    byId('add-form').addEventListener('submit', async event => {
      event.preventDefault();
      if (currentDraftMode === 'interactive-mock') {
        renderSaleControls(currentState);
        focusCommandInput();
        return;
      }
      const target = selectedTarget();
      if (!target) return;
      const owner = byId('add-owner').value;
      const price = Number(byId('add-price').value);
      if (saleWarningsFor(target, ownerByName(owner), price).length) {
        renderSaleControls(currentState);
        focusCommandInput();
        return;
      }
      const command = owner + ' drafted ' + target.name + ' for ' + price;
      await submitCommand(command);
    });

    byId('export-json-button').addEventListener('click', () => exportLog('json'));
    byId('export-csv-button').addEventListener('click', () => exportLog('csv'));
    byId('export-bundle-button').addEventListener('click', () => exportSessionBundle());
    byId('import-log-button').addEventListener('click', () => byId('import-log-file').click());
    byId('header-export-json-button').addEventListener('click', () => exportLog('json'));
    byId('header-export-csv-button').addEventListener('click', () => exportLog('csv'));
    byId('header-export-bundle-button').addEventListener('click', () => exportSessionBundle());
    byId('header-import-log-button').addEventListener('click', () => byId('import-log-file').click());
    byId('import-log-file').addEventListener('change', event => importDraftLogFile(event.target.files[0]));
    byId('draft-session-select').addEventListener('change', event => setDraftSession(event.target.value));
    byId('open-scratch-session-button').addEventListener('click', () => openScratchSession());
    byId('scratch-session-name').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        openScratchSession();
      }
    });
    byId('app-menu-button').addEventListener('click', event => {
      event.stopPropagation();
      setAppMenuOpen(byId('app-menu-list').hidden);
    });
    byId('app-menu-list').addEventListener('click', event => event.stopPropagation());
    byId('league-home-button').addEventListener('click', () => window.location.assign(leagueHomeUrl()));
    byId('start-real-draft-button').addEventListener('click', () => openDraftRoomMode('real'));
    byId('start-mock-draft-button').addEventListener('click', () => openDraftRoomMode('interactive-mock'));
    byId('draft-mode-real-button').addEventListener('click', () => openDraftRoomMode('real'));
    byId('draft-mode-mock-button').addEventListener('click', () => openDraftRoomMode('interactive-mock'));
    byId('confirm-start-draft-button').addEventListener('click', () => beginDraftCountdown());
    byId('end-draft-button').addEventListener('click', () => endActiveDraft());
    byId('run-mock-batch-button').addEventListener('click', () => {
      if (
        currentInteractiveMockResultsReady() ||
        latestMockBatchJob &&
        latestMockBatchJob.status === 'complete' &&
        latestMockBatchJob.result &&
        mockBatchJobMatchesCurrentControls(latestMockBatchJob)
      ) {
        void openMockResults();
        return;
      }
      runMockBatch();
    });
    byId('mock-batch-runs').addEventListener('input', () => {
      renderMockBatchButtonState(latestMockBatchJob);
      renderMockBatchResultsForJob(latestMockBatchJob);
    });
    byId('mock-batch-script').addEventListener('input', () => {
      renderMockBatchButtonState(latestMockBatchJob);
      renderMockBatchResultsForJob(latestMockBatchJob);
    });
    byId('see-mock-results-button').addEventListener('click', () => void openMockResults());
    byId('mock-simulations-button').addEventListener('click', () => {
      closeAppMenu();
      window.location.assign(mockSimulationsRouteUrl());
    });
    byId('my-expert-button').addEventListener('click', () => {
      closeAppMenu();
      window.location.assign(myExpertRouteUrl());
    });
    byId('player-news-button').addEventListener('click', () => {
      closeAppMenu();
      window.location.assign(playerNewsRouteUrl());
    });
    byId('undo-button').addEventListener('click', () => undoDraftRoom());
    byId('reset-button').addEventListener('click', () => resetDraftRoom());
    byId('header-undo-button').addEventListener('click', () => undoDraftRoom());
    byId('header-reset-button').addEventListener('click', () => resetDraftRoom());
    byId('mock-advance-button').addEventListener('click', () => advanceMockDraft('advance'));
    byId('mock-nominate-button').addEventListener('click', () => advanceMockDraft('cam-nominate', selectedTargetName, nominationPriceValue()));
    byId('mock-nomination-price').addEventListener('input', () => {
      pendingCamNominationPrice = nominationPriceValue();
      if (currentMockDraft && currentMockDraft.phase === 'human-nomination') renderMockAuctionFeed(currentMockDraft);
    });
    byId('mock-cam-win-button').addEventListener('click', () => advanceMockDraft('cam-bid'));
    byId('mock-pass-button').addEventListener('click', () => advanceMockDraft('pass'));
    byId('mock-next-decision-button').addEventListener('click', () => advanceMockDraft('next-cam-decision'));
    byId('mock-next-round-button').addEventListener('click', () => advanceMockDraft('next-round'));
    byId('mock-complete-button').addEventListener('click', () => advanceMockDraft('complete-mock'));
    byId('mock-simulations-back-button').addEventListener('click', () => window.location.assign(draftRoomRouteUrl(currentDraftMode)));
    byId('back-to-draft-room-button').addEventListener('click', () => window.location.assign(draftRoomRouteUrl(currentDraftMode)));
    byId('my-expert-back-button').addEventListener('click', () => window.location.assign(draftRoomRouteUrl(currentDraftMode)));
    byId('my-expert-refresh-button').addEventListener('click', () => refreshMyExpertIfCurrentRoute());
    byId('player-news-back-button').addEventListener('click', () => window.location.assign(draftRoomRouteUrl(currentDraftMode)));
    byId('player-news-refresh-button').addEventListener('click', () => refreshPlayerNewsIfCurrentRoute({ background: true }));
    for (const button of document.querySelectorAll('.player-news-filter-button')) {
      button.addEventListener('click', event => {
        event.stopPropagation();
        const key = event.currentTarget.dataset.playerNewsFilterKey;
        const options = byId('player-news-' + key + '-options');
        setPlayerNewsFilterOpen(key, options.hidden);
      });
      button.addEventListener('keydown', handlePlayerNewsFilterButtonKeydown);
    }
    for (const option of document.querySelectorAll('.player-news-filter-option')) {
      option.addEventListener('click', event => {
        event.stopPropagation();
        void setPlayerNewsFilterValue(
          event.currentTarget.dataset.playerNewsOptionKey,
          event.currentTarget.dataset.playerNewsValue
        );
      });
      option.addEventListener('keydown', handlePlayerNewsFilterOptionKeydown);
    }
    byId('player-news-search').addEventListener('input', event => {
      playerNewsQuery = event.target.value.trim();
      schedulePlayerNewsRefresh();
    });
    byId('mock-results-run-button').addEventListener('click', () => {
      if (byId('mock-results-run-button').disabled) return;
      const list = byId('mock-results-run-list');
      list.hidden = !list.hidden;
    });
    byId('mock-results-run-new-button').addEventListener('click', () => window.location.assign(mockSimulationsRouteUrl()));
    byId('mock-simulation-strategy').addEventListener('change', event => {
      currentStrategyKey = strategyKeys.includes(event.target.value) ? event.target.value : 'three-rb';
      latestMockBatchJob = null;
      latestMockBatchReport = null;
      window.history.replaceState(null, '', mockSimulationsRouteUrl(mockBatchScript()));
      renderMockBatchButtonState(null);
      renderMockBatchResults(null);
    });
    document.addEventListener('click', event => {
      if (!event.target.closest || !event.target.closest('.run-selector')) byId('mock-results-run-list').hidden = true;
      if (!event.target.closest || !event.target.closest('#app-menu')) closeAppMenu();
      if (!event.target.closest || !event.target.closest('.player-news-filter')) closePlayerNewsFilters();
      if (!event.target.closest || !event.target.closest('.target-action')) closeTargetActionMenus();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeAppMenu();
        closePlayerNewsFilters();
        closeTargetActionMenus();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') stopPlayerNewsPolling();
      else schedulePlayerNewsPolling();
    });

    configurePlatformWorkspaceChrome();
    loadDraftLifecycle();
    renderCurrentRoute();
  </script>
</body>
</html>`;
