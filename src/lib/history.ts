import type { Source, TargetProvider } from "../types";

const KEY = "promptly:history";
export const HISTORY_LIMIT = 20;

export interface HistoryEntry {
  id: string;
  prompt: string;
  targetProvider: TargetProvider;
  label: string;
  sources: Source[];
  createdAt: number;
  /** What the user actually asked for. Optional: entries saved before this existed lack it. */
  request?: string;
}

export type NewHistoryEntry = Omit<HistoryEntry, "id" | "createdAt">;

function isEntry(value: unknown): value is HistoryEntry {
  const e = value as HistoryEntry;
  return (
    typeof e === "object" &&
    e !== null &&
    typeof e.id === "string" &&
    typeof e.prompt === "string" &&
    typeof e.label === "string" &&
    typeof e.createdAt === "number" &&
    Array.isArray(e.sources)
  );
}

/**
 * Every access is guarded. Safari's private mode throws on setItem, and storage
 * being unavailable must never break a generation that already succeeded — history
 * is a convenience, not part of the critical path.
 */
function read(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded or storage blocked. The in-memory list still stands.
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function list(): HistoryEntry[] {
  return read();
}

/** Newest first, capped on write so the stored array never grows past the limit. */
export function save(entry: NewHistoryEntry): HistoryEntry[] {
  const entries = [
    { ...entry, id: newId(), createdAt: Date.now() },
    ...read(),
  ].slice(0, HISTORY_LIMIT);
  write(entries);
  return entries;
}

export function remove(id: string): HistoryEntry[] {
  const entries = read().filter((e) => e.id !== id);
  write(entries);
  return entries;
}

export function clear(): HistoryEntry[] {
  write([]);
  return [];
}

/** Template title, or a trimmed snippet of a free-form request. */
export function labelFor(input: string, max = 60): string {
  const clean = input.trim().replace(/\s+/g, " ");
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
