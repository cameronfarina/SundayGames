export const titleForPath = (path: string): string => {
  if (path.startsWith("/mock-drafts") || /\/leagues\/[^/]+\/mock-drafts$/u.test(path)) return "Mock draft | Sunday Games";
  if (/\/leagues\/[^/]+\/draft$/u.test(path)) return "Live draft | Sunday Games";
  if (/\/leagues\/[^/]+\/practice$/u.test(path)) return "Draft lab | Sunday Games";
  if (/\/leagues\/[^/]+\/my-team$/u.test(path)) return "My team | Sunday Games";
  if (/\/leagues\/[^/]+\/player-news$/u.test(path)) return "Player news | Sunday Games";
  if (/\/leagues\/[^/]+\/commissioner$/u.test(path)) return "Commissioner | Sunday Games";
  if (/\/leagues\/[^/]+$/u.test(path)) return "League | Sunday Games";
  switch (path) {
    case "/draft-room": return "Live draft | Sunday Games";
    case "/practice": return "Draft lab | Sunday Games";
    case "/league": return "League | Sunday Games";
    case "/my-team": return "My team | Sunday Games";
    case "/player-news": return "Player news | Sunday Games";
    case "/commissioner": return "Commissioner | Sunday Games";
    case "/login": return "Sign in | Sunday Games";
    case "/signup": return "Create account | Sunday Games";
    default: return "Sunday Games";
  }
};
