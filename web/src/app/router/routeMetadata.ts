export const titleForPath = (path: string): string => {
  if (path.startsWith("/mock-drafts")) return "Mock draft | Mockd";
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
