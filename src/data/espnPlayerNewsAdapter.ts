import {
  isRecord,
  isoDateFrom,
  tagsForNewsText,
  textValue,
  type RawPlayerNewsItem,
} from "./playerNewsProviderAdapters.js";

export interface ParseEspnNewsOptions {
  content: unknown;
  fetchedAt?: string;
}

const espnNflNewsUrl = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news";

const espnPlayerNameFor = (article: Record<string, unknown>): string | undefined => {
  const categories = Array.isArray(article.categories) ? article.categories.filter(isRecord) : [];
  const athleteCategory = categories.find(category => isRecord(category.athlete));
  const athlete = isRecord(athleteCategory) ? athleteCategory.athlete : undefined;
  const name = isRecord(athlete) ? textValue(athlete.description) || textValue(athlete.name) : "";
  return name || undefined;
};

const espnCanonicalUrlFor = (article: Record<string, unknown>): string | undefined => {
  const links = article.links;
  const web = isRecord(links) ? links.web : undefined;
  const href = isRecord(web) ? textValue(web.href) : "";
  return href || undefined;
};

const espnItemFor = (article: Record<string, unknown>, fetchedAt: string): RawPlayerNewsItem | undefined => {
  const providerItemId = textValue(article.id) || textValue(article.guid);
  const title = textValue(article.headline);
  if (!providerItemId || !title) return undefined;
  const summary = textValue(article.description);
  const canonicalUrl = espnCanonicalUrlFor(article);
  const playerName = espnPlayerNameFor(article);
  const publishedAt = isoDateFrom(article.published);

  return {
    provider: "espn",
    providerItemId,
    ...(canonicalUrl ? { canonicalUrl } : {}),
    ...(playerName ? { playerName } : {}),
    title,
    summary,
    ...(publishedAt ? { publishedAt } : {}),
    fetchedAt,
    tags: tagsForNewsText(title, summary),
    raw: article,
  };
};

export const parseEspnNews = ({
  content,
  fetchedAt = new Date().toISOString(),
}: ParseEspnNewsOptions): RawPlayerNewsItem[] => {
  if (!isRecord(content) || !Array.isArray(content.articles)) return [];
  return content.articles.filter(isRecord).flatMap(article => {
    const item = espnItemFor(article, fetchedAt);
    return item === undefined ? [] : [item];
  });
};

const espnRequestTimeoutMs = 5_000;

export const fetchEspnNews = async ({
  url = espnNflNewsUrl,
  fetchedAt = new Date().toISOString(),
  timeoutMs = espnRequestTimeoutMs,
}: {
  url?: string;
  fetchedAt?: string;
  timeoutMs?: number;
} = {}): Promise<RawPlayerNewsItem[]> => {
  // Without a deadline a stalled feed holds the news request open forever.
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`ESPN news request failed with ${response.status}.`);
  }

  return parseEspnNews({
    content: await response.json(),
    fetchedAt,
  });
};
