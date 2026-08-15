import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clear, HISTORY_LIMIT, labelFor, list, remove, save } from "./history";

const entry = (label: string) => ({
  prompt: "A generated prompt.",
  targetProvider: "claude" as const,
  label,
  sources: [],
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("history", () => {
  it("starts empty", () => {
    expect(list()).toEqual([]);
  });

  it("round-trips an entry through storage", () => {
    save(entry("Marketing Copy"));
    const [restored] = list();

    expect(restored.label).toBe("Marketing Copy");
    expect(restored.prompt).toBe("A generated prompt.");
    expect(restored.targetProvider).toBe("claude");
    expect(typeof restored.id).toBe("string");
    expect(typeof restored.createdAt).toBe("number");
  });

  it("returns newest first", () => {
    save(entry("first"));
    save(entry("second"));
    save(entry("third"));

    expect(list().map((e) => e.label)).toEqual(["third", "second", "first"]);
  });

  it("caps at the limit, dropping the oldest", () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) save(entry(`entry-${i}`));

    const entries = list();
    expect(entries).toHaveLength(HISTORY_LIMIT);
    expect(entries[0].label).toBe(`entry-${HISTORY_LIMIT + 4}`);
    expect(entries.some((e) => e.label === "entry-0")).toBe(false);
  });

  it("gives every entry a distinct id", () => {
    save(entry("a"));
    save(entry("b"));
    const ids = list().map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("removes one entry and leaves the rest", () => {
    save(entry("keep"));
    save(entry("drop"));
    const target = list().find((e) => e.label === "drop")!;

    const after = remove(target.id);
    expect(after.map((e) => e.label)).toEqual(["keep"]);
    expect(list().map((e) => e.label)).toEqual(["keep"]);
  });

  it("clears everything", () => {
    save(entry("a"));
    save(entry("b"));

    expect(clear()).toEqual([]);
    expect(list()).toEqual([]);
  });

  it("recovers from corrupt stored JSON", () => {
    localStorage.setItem("promptly:history", "{not json");
    expect(list()).toEqual([]);
  });

  it("discards stored values that are not entries", () => {
    localStorage.setItem("promptly:history", JSON.stringify([{ nope: true }, "string"]));
    expect(list()).toEqual([]);
  });

  it("discards a stored value that is not an array", () => {
    localStorage.setItem("promptly:history", JSON.stringify({ a: 1 }));
    expect(list()).toEqual([]);
  });

  it("survives storage that throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => save(entry("private mode"))).not.toThrow();
    expect(save(entry("private mode"))[0].label).toBe("private mode");
  });

  it("survives storage that throws on read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(list()).toEqual([]);
  });
});

describe("labelFor", () => {
  it("keeps a short request whole", () => {
    expect(labelFor("Write a launch email")).toBe("Write a launch email");
  });

  it("collapses whitespace", () => {
    expect(labelFor("  Write   a\nlaunch email  ")).toBe("Write a launch email");
  });

  it("truncates a long request with an ellipsis", () => {
    const label = labelFor("x".repeat(200));
    expect(label).toHaveLength(60);
    expect(label.endsWith("…")).toBe(true);
  });
});
