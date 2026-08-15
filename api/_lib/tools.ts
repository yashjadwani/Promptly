import { sanitiseSnippet } from "./guardrails.js";
import { searchResultSchema, type SearchResult } from "./schema.js";
import { tavilyKey, timezone } from "./env.js";

export interface CurrentDateTime {
  iso: string;
  timezone: string;
  readable: string;
}

/**
 * ponytail: this is computed server-side and injected into every compile rather than
 * exposed as a model-callable tool. The value is deterministic, so a round trip to ask
 * for it could only make it wrong or slow. Promote it to a real tool only if the
 * compiler ever needs date arithmetic it cannot do inline.
 */
export function getCurrentDateTime(now = new Date(), zone = timezone()): CurrentDateTime {
  return {
    iso: now.toISOString(),
    timezone: zone,
    readable: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: zone,
    }).format(now),
  };
}

/**
 * Signals that a free-form request depends on information that changes over time.
 *
 * Deterministic on purpose: asking the model whether to search costs an extra round
 * trip on every request, and most requests ("write me an email") never need one. Same
 * reasoning as the allowSearch frontmatter flag on templates — cheap, testable, and
 * predictable beats clever.
 *
 * ponytail: a keyword heuristic will miss phrasings that imply freshness without
 * saying so. That failure is quiet — the prompt is still good, just not enriched.
 * Revisit if users report stale context, not before.
 */
const FRESHNESS_SIGNALS = [
  /\b(latest|newest|current|currently|recent|recently|today|tonight|yesterday|nowadays)\b/i,
  /\b(this|last|next)\s+(week|month|year|quarter)\b/i,
  // Deliberately narrow. "launch", "announcement" and "released" are product-copy
  // words people use about their own work, not requests for news.
  /\b(news|headlines|trending|trends)\b/i,
  /\b(price|pricing|cost|stock|market|rate)s?\b.{0,40}\b(today|right now|currently|this year)\b/i,
  /\b(state of the art|what happened (to|with)|as of|up to date)\b/i,
  /\bwho is\b.{0,30}\b(now|currently|these days)\b/i,
  /\b20[2-9]\d\b/,
];

export function needsCurrentInfo(input: string): boolean {
  return FRESHNESS_SIGNALS.some((pattern) => pattern.test(input));
}

export class SearchError extends Error {}

const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 5;

export async function webSearch(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) throw new SearchError("Empty search query.");

  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tavilyKey()}`,
      },
      body: JSON.stringify({
        query: trimmed,
        max_results: MAX_RESULTS,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new SearchError(`Search request failed: ${(cause as Error).message}`);
  }

  if (!response.ok) throw new SearchError(`Search returned HTTP ${response.status}.`);

  const payload = (await response.json()) as { results?: unknown[] };
  if (!Array.isArray(payload.results)) throw new SearchError("Search returned no result list.");

  const results: SearchResult[] = [];
  for (const raw of payload.results.slice(0, MAX_RESULTS)) {
    const item = raw as Record<string, unknown>;
    const parsed = searchResultSchema.safeParse({
      title: item.title,
      url: item.url,
      snippet: typeof item.content === "string" ? item.content.slice(0, 1200) : "",
    });
    if (parsed.success) results.push(parsed.data);
  }

  return results;
}

/** Snippets are third-party text, so they are sanitised before the model ever sees them. */
export function formatSearchContext(results: SearchResult[]): string {
  return results
    .map((r, i) => `[${i + 1}] ${sanitiseSnippet(r.title, 160)}\n${r.url}\n${sanitiseSnippet(r.snippet)}`)
    .join("\n\n");
}
