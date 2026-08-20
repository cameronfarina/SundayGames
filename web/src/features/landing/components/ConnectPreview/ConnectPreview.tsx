import "./ConnectPreview.css";

const platforms: readonly string[] = ["Sleeper", "ESPN"];

const leagues: readonly { readonly detail: string; readonly name: string }[] = [
  { detail: "2026 season · 12 teams", name: "Sunday Funday" },
  { detail: "2026 season · 10 teams", name: "Average Joes" },
  { detail: "2026 season · 10 teams", name: "Barn Formal" },
];

export const ConnectPreview = () => <div className="connect-preview">
  <p className="connect-preview__eyebrow">League sync</p>
  <h3>Connect a league</h3>
  <ul className="connect-preview__platforms">
    {platforms.map(platform => <li
      aria-current={platform === "Sleeper"}
      className={platform === "Sleeper"
        ? "connect-preview__platform connect-preview__platform--selected"
        : "connect-preview__platform"}
      key={platform}
    >{platform}</li>)}
  </ul>
  <p className="connect-preview__field">
    <span>Sleeper username</span>
    <span className="connect-preview__input">ffballers</span>
  </p>
  <p className="connect-preview__button">Find my leagues</p>
  <ul className="connect-preview__leagues">
    {leagues.map(league => <li key={league.name}>
      <strong>{league.name}</strong>
      <span>{league.detail}</span>
    </li>)}
  </ul>
</div>;
