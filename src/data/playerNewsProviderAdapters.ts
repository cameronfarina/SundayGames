import { XMLParser } from "fast-xml-parser";

export type RawPlayerNewsProvider = "rotowire-rss" | "espn";

export interface RawPlayerNewsItem {
  provider: RawPlayerNewsProvider;
  providerItemId: string;
  canonicalUrl?: string;
  playerName?: string;
  title: string;
  summary: string;
  publishedAt?: string;
  fetchedAt: string;
  tags: string[];
  raw: unknown;
}

export interface ParseRotowireRssNewsOptions {
  content: string;
  fetchedAt?: string;
}

const rotowireNflRssUrl = "https://www.rotowire.com/rss/news.php?sport=NFL";
const parser = new XMLParser({
  ignoreAttributes: false,
  processEntities: true,
  trimValues: true,
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const textValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const cleanSummary = (value: unknown): string =>
  textValue(value)
    .replace(/\s*Visit RotoWire\.com for more analysis on this update\.\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

export const isoDateFrom = (value: unknown): string | undefined => {
  const parsed = Date.parse(textValue(value));
  if (!Number.isFinite(parsed)) return undefined;
  return new Date(parsed).toISOString();
};

const titleParts = (title: string): { playerName?: string; title: string } => {
  const [playerName, ...rest] = title.split(":");
  if (!playerName || rest.length === 0) return { title };
  return {
    playerName: playerName.trim(),
    title: rest.join(":").trim(),
  };
};

export const tagsForNewsText = (title: string, summary: string): string[] => {
  const text = `${title} ${summary}`.toLowerCase();
  const tags: string[] = [];

  if (/practice|participant|uniform|drill|camp/.test(text)) tags.push("Practice");
  if (/injur|hamstring|knee|ankle|shoulder|foot|undisclosed|limited|out|recovery/.test(text)) tags.push("Injury");
  if (/sign|trade|waiver|release|claim|roster|contract/.test(text)) tags.push("Transaction");
  if (/depth|starter|backup|first-team|role|snap|target|carry|workload/.test(text)) tags.push("Role");

  return tags.length ? tags : ["News"];
};

const itemValueFor = (raw: Record<string, unknown>, fetchedAt: string): RawPlayerNewsItem => {
  const rawTitle = textValue(raw.title);
  const parts = titleParts(rawTitle);
  const summary = cleanSummary(raw.description);
  const canonicalUrl = textValue(raw.link);
  const providerItemId = textValue(raw.guid) || canonicalUrl || rawTitle;
  const publishedAt = isoDateFrom(raw.pubDate);

  return {
    provider: "rotowire-rss",
    providerItemId,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(parts.playerName ? { playerName: parts.playerName } : {}),
    title: parts.title,
    summary,
    ...(publishedAt ? { publishedAt } : {}),
    fetchedAt,
    tags: tagsForNewsText(rawTitle, summary),
    raw,
  };
};

export const parseRotowireRssNews = ({
  content,
  fetchedAt = new Date().toISOString(),
}: ParseRotowireRssNewsOptions): RawPlayerNewsItem[] => {
  const parsed: unknown = parser.parse(content);
  if (!isRecord(parsed) || !isRecord(parsed.rss) || !isRecord(parsed.rss.channel)) return [];
  const items = Array.isArray(parsed.rss.channel.item)
    ? parsed.rss.channel.item.filter(isRecord)
    : isRecord(parsed.rss.channel.item) ? [parsed.rss.channel.item] : [];
  return items.map(item => itemValueFor(item, fetchedAt));
};

export const fetchRotowireRssNews = async ({
  url = rotowireNflRssUrl,
  fetchedAt = new Date().toISOString(),
}: {
  url?: string;
  fetchedAt?: string;
} = {}): Promise<RawPlayerNewsItem[]> => {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`RotoWire RSS request failed with ${response.status}.`);
  }

  return parseRotowireRssNews({
    content: await response.text(),
    fetchedAt,
  });
};
