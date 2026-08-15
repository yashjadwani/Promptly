import { redis } from "./redis.js";
import type { TargetProvider } from "./schema.js";

/**
 * Two separate things live here, and the distinction is the whole point.
 *
 * METRICS are counters. No prompt text, ever. Recorded on every request so operational
 * questions — which hop actually serves traffic, how often search fails, which
 * templates get used — have an answer.
 *
 * SAMPLES are the request and the generated prompt. Recorded ONLY when the user ticks
 * the consent box, expire after 90 days, and are capped so the set stays a working eval
 * corpus rather than an archive.
 */

const SAMPLE_TTL_SECONDS = 60 * 60 * 24 * 90;
const SAMPLE_INDEX_LIMIT = 1000;
const METRICS_TTL_SECONDS = 60 * 60 * 24 * 90;

export type Outcome = "ok" | "compiler_failed" | "rate_limited" | "validation_error";

export interface GenerationMetrics {
  path: "template" | "freeform";
  templateId?: string;
  targetProvider: TargetProvider;
  outcome: Outcome;
  hop?: string;
  latencyMs?: number;
  promptChars?: number;
  searched?: boolean;
}

export interface GenerationSample extends GenerationMetrics {
  /** What the user gave us: the filled template body, or their free-form text. */
  request: string;
  /** What the compiler produced. */
  prompt: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Never throws and never blocks the caller's result. A telemetry outage must not turn
 * a successful generation into an error.
 */
export async function recordMetrics(m: GenerationMetrics): Promise<void> {
  try {
    const key = `promptly:metrics:${today()}`;
    const pipeline = redis().pipeline();

    pipeline.hincrby(key, "total", 1);
    pipeline.hincrby(key, `outcome:${m.outcome}`, 1);
    pipeline.hincrby(key, `path:${m.path}`, 1);
    pipeline.hincrby(key, `provider:${m.targetProvider}`, 1);
    if (m.templateId) pipeline.hincrby(key, `template:${m.templateId}`, 1);
    if (m.hop) pipeline.hincrby(key, `hop:${m.hop}`, 1);
    if (m.searched) pipeline.hincrby(key, "searched", 1);
    if (typeof m.latencyMs === "number") {
      pipeline.hincrby(key, "latency_ms_total", Math.round(m.latencyMs));
    }
    if (typeof m.promptChars === "number") {
      pipeline.hincrby(key, "prompt_chars_total", m.promptChars);
    }
    pipeline.expire(key, METRICS_TTL_SECONDS);

    await pipeline.exec();
  } catch (error) {
    console.warn("metrics write failed", (error as Error).message);
  }
}

/** Called only with explicit consent. Same no-throw contract as recordMetrics. */
export async function recordSample(sample: GenerationSample): Promise<void> {
  try {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const pipeline = redis().pipeline();

    // Individual keys so each sample expires on its own 90-day clock.
    pipeline.set(`promptly:sample:${id}`, JSON.stringify({ ...sample, savedAt: Date.now() }), {
      ex: SAMPLE_TTL_SECONDS,
    });
    pipeline.lpush("promptly:samples", id);
    pipeline.ltrim("promptly:samples", 0, SAMPLE_INDEX_LIMIT - 1);

    await pipeline.exec();
  } catch (error) {
    console.warn("sample write failed", (error as Error).message);
  }
}

/** Reads the eval corpus back. Ids whose payload has expired are skipped. */
export async function listSamples(limit = 100): Promise<GenerationSample[]> {
  const ids = (await redis().lrange("promptly:samples", 0, limit - 1)) as string[];
  if (!ids.length) return [];

  const rows = await redis().mget<(GenerationSample | null)[]>(
    ...ids.map((id) => `promptly:sample:${id}`),
  );
  return rows.filter((row): row is GenerationSample => row !== null);
}
