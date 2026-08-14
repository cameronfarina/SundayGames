const syntheticLeagueId = "100001";
const syntheticOwnerPattern = /^Owner\d{2}$/u;
const approvedLocalEmails = new Set([
  "commissioner@mockd.local",
  "manager@mockd.local",
]);
const approvedKeeperPlayers = new Set([
  "Ashton Jeanty",
  "Justin Jefferson",
  "Kyren Williams",
  "Mark Andrews",
  "Quinshon Judkins",
  "Rico Dowdle",
  "Trey McBride",
]);

const normalizedPath = (filePath: string): string => filePath.replaceAll("\\", "/");

const capturedValues = (content: string, pattern: RegExp): string[] =>
  [...content.matchAll(pattern)].flatMap(match => match[1] === undefined ? [] : [match[1]]);

const configLeagueViolations = (content: string): string[] => {
  const ownerOrderBlock = /\bownerOrder\b[^=]*=\s*\[([\s\S]*?)\]/u.exec(content)?.[1] ?? "";
  const owners = capturedValues(ownerOrderBlock, /["']([^"']+)["']/gu);
  const leagueIds = capturedValues(content, /\bleagueId\s*(?::|=)\s*(\d+)/gu);
  const violations: string[] = [];
  if (owners.some(owner => !syntheticOwnerPattern.test(owner))) {
    violations.push("non-synthetic owner fixture");
  }
  if (leagueIds.some(leagueId => leagueId !== syntheticLeagueId)) {
    violations.push("non-synthetic external league identifier");
  }
  return violations;
};

const configKeeperViolations = (content: string): string[] => {
  const owners = capturedValues(content, /\bowner\s*:\s*["']([^"']+)["']/gu);
  const players = capturedValues(content, /\bplayer\s*:\s*["']([^"']+)["']/gu);
  const violations: string[] = [];
  if (owners.some(owner => !syntheticOwnerPattern.test(owner))) {
    violations.push("non-synthetic keeper owner");
  }
  if (players.some(player => !approvedKeeperPlayers.has(player))) {
    violations.push("non-synthetic keeper fixture");
  }
  return violations;
};

const localFixtureViolations = (content: string): string[] => {
  const emails = capturedValues(content, /["']([^"']+@mockd\.local)["']/gu);
  const leagueIds = capturedValues(content, /\bleague-(\d{6,})\b/gu);
  const violations: string[] = [];
  if (emails.some(email => !approvedLocalEmails.has(email))) {
    violations.push("non-synthetic local account email");
  }
  if (leagueIds.some(leagueId => leagueId !== syntheticLeagueId)) {
    violations.push("non-synthetic local league identifier");
  }
  return violations;
};

export const privateConfigurationViolations = (
  filePath: string,
  content: string,
): string[] => {
  const path = normalizedPath(filePath);
  if (/(?:^|\/)config\/league\.(?:js|ts)$/u.test(path)) {
    return configLeagueViolations(content);
  }
  if (/(?:^|\/)config\/keepers\.(?:js|ts)$/u.test(path)) {
    return configKeeperViolations(content);
  }
  if (/(?:localDemoFixtures|seedLocalE2e)\.(?:js|ts)$/u.test(path)) {
    return localFixtureViolations(content);
  }
  return [];
};
