import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatSearchContext,
  getCurrentDateTime,
  needsCurrentInfo,
  SearchError,
  webSearch,
} from "./tools.js";

describe("getCurrentDateTime", () => {
  const fixed = new Date("2026-08-15T09:30:00Z");

  it("returns valid ISO data in the configured zone", () => {
    const result = getCurrentDateTime(fixed, "UTC");
    expect(result.iso).toBe("2026-08-15T09:30:00.000Z");
    expect(result.timezone).toBe("UTC");
    expect(result.readable).toContain("2026");
  });

  it("shifts the readable form with the zone", () => {
    const utc = getCurrentDateTime(fixed, "UTC").readable;
    const kolkata = getCurrentDateTime(fixed, "Asia/Kolkata").readable;
    expect(kolkata).not.toBe(utc);
  });
});

describe("needsCurrentInfo", () => {
  it("stays off for ordinary requests that never go stale", () => {
    for (const input of [
      "write a launch announcement for our new pricing page",
      "explain how a hash map handles collisions",
      "help me draft a resignation letter",
      "review this function for correctness",
      "brainstorm names for a coffee shop",
    ]) {
      expect(needsCurrentInfo(input)).toBe(false);
    }
  });

  it("fires when the request depends on information that changes", () => {
    for (const input of [
      "summarise the latest research on battery chemistry",
      "what are the current best practices for React state",
      "write a post about this week's AI news",
      "explain the state of the art in speech recognition",
      "compare object storage pricing right now",
      "what happened with the EU AI Act",
      "summarise developments in 2026",
    ]) {
      expect(needsCurrentInfo(input)).toBe(true);
    }
  });

  it("is case insensitive and tolerates surrounding text", () => {
    expect(needsCurrentInfo("Give me the LATEST figures, please.")).toBe(true);
  });

  it("does not fire on words that merely contain a signal", () => {
    expect(needsCurrentInfo("write about a currency exchange")).toBe(false);
    expect(needsCurrentInfo("explain the concept of updating a record")).toBe(false);
  });

  it("does not treat the user's own product words as a request for news", () => {
    // These cost a wasted model round trip and a search that adds nothing.
    expect(needsCurrentInfo("write a launch announcement for our new pricing page")).toBe(false);
    expect(needsCurrentInfo("draft release notes for version 2")).toBe(false);
    expect(needsCurrentInfo("write an update email to my team")).toBe(false);
  });
});

describe("webSearch", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TAVILY_API_KEY", "tavily-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normalises results to title, url, and snippet", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ title: "T", url: "https://example.com", content: "body text" }],
      }),
    } as Response);

    await expect(webSearch("query")).resolves.toEqual([
      { title: "T", url: "https://example.com", snippet: "body text" },
    ]);
  });

  it("drops malformed results instead of failing the whole search", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { title: "Good", url: "https://example.com", content: "x" },
          { title: "Bad", url: "not-a-url", content: "x" },
        ],
      }),
    } as Response);

    const results = await webSearch("query");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Good");
  });

  it("rejects an empty query without calling out", async () => {
    await expect(webSearch("   ")).rejects.toBeInstanceOf(SearchError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("raises SearchError on an HTTP failure", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    await expect(webSearch("query")).rejects.toThrow(/503/);
  });
});

describe("formatSearchContext", () => {
  it("numbers sources and keeps URLs intact", () => {
    const context = formatSearchContext([
      { title: "One", url: "https://a.test", snippet: "first" },
      { title: "Two", url: "https://b.test", snippet: "second" },
    ]);
    expect(context).toContain("[1] One");
    expect(context).toContain("https://b.test");
  });

  it("returns an empty string for no sources", () => {
    expect(formatSearchContext([])).toBe("");
  });
});
