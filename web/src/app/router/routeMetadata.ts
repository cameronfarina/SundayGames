export const titleForPath = (path: string): string => {
  if (path.startsWith("/mock-drafts") || /\/leagues\/[^/]+\/mock-drafts$/u.test(path)) return "Mock draft | Mockd";
  if (/\/leagues\/[^/]+\/draft$/u.test(path)) return "Live draft | Mockd";
  if (/\/leagues\/[^/]+\/practice$/u.test(path)) return "Draft lab | Mockd";
  if (/\/leagues\/[^/]+\/my-team$/u.test(path)) return "My team | Mockd";
  if (/\/leagues\/[^/]+\/player-news$/u.test(path)) return "Player news | Mockd";
  if (/\/leagues\/[^/]+\/commissioner$/u.test(path)) return "Commissioner | Mockd";
  if (/\/leagues\/[^/]+$/u.test(path)) return "League | Mockd";
  switch (path) {
    case "/draft-room": return "Live draft | Mockd";
    case "/practice": return "Draft lab | Mockd";
    case "/league": return "League | Mockd";
    case "/my-team": return "My team | Mockd";
    case "/player-news": return "Player news | Mockd";
    case "/commissioner": return "Commissioner | Mockd";
    case "/login": return "Sign in | Mockd";
    case "/signup": return "Create account | Mockd";
    default: return "Mockd";
  }
};
