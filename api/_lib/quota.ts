import { redis } from "./redis.js";

export const LIMIT = 15;
export const WINDOW_MS = 60 * 60 * 1000;

export interface QuotaState {
  allowed: boolean;
  retryAfterSeconds: number;
}

function key(ip: string): string {
  return `promptly:quota:${ip}`;
}

/**
 * Sorted-set sliding window. Checked before the work and committed only after the
 * output validates, so a validation error or a dead compiler never costs the user
 * one of their fifteen.
 *
 * ponytail: check and commit are two round trips, not one atomic script, so a
 * simultaneous burst can slip a few requests past the limit. This is a cost guard,
 * not a security boundary. Move to a Lua script if the overshoot ever shows up in
 * the bill.
 */
export async function checkQuota(ip: string, now = Date.now()): Promise<QuotaState> {
  const k = key(ip);
  const windowStart = now - WINDOW_MS;

  const pipeline = redis().pipeline();
  pipeline.zremrangebyscore(k, 0, windowStart);
  pipeline.zcard(k);
  pipeline.zrange(k, 0, 0, { withScores: true });
  const [, count, oldest] = (await pipeline.exec()) as [unknown, number, Array<string | number>];

  if (count < LIMIT) return { allowed: true, retryAfterSeconds: 0 };

  const oldestScore = Number(oldest?.[1] ?? now);
  const retryAfterSeconds = Math.max(1, Math.ceil((oldestScore + WINDOW_MS - now) / 1000));
  return { allowed: false, retryAfterSeconds };
}

/** Called only after a generation has produced a validated, non-empty prompt. */
export async function commitQuota(ip: string, now = Date.now()): Promise<void> {
  const k = key(ip);
  const pipeline = redis().pipeline();
  pipeline.zadd(k, { score: now, member: `${now}-${Math.random().toString(36).slice(2, 10)}` });
  pipeline.pexpire(k, WINDOW_MS);
  await pipeline.exec();
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  return first || (headers["x-real-ip"] as string) || "unknown";
}
