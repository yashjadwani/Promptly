import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fillTemplate, loadCatalog, ValidationError } from "./_lib/catalog.js";
import { createCompiler, type Compiler } from "./_lib/compiler.js";
import { checkQuota, clientIp, commitQuota } from "./_lib/quota.js";
import { generateRequestSchema } from "./_lib/schema.js";
import {
  recordMetrics,
  recordSample,
  type GenerationMetrics,
  type GenerationSample,
} from "./_lib/telemetry.js";
import { needsCurrentInfo } from "./_lib/tools.js";

export interface GenerateDeps {
  compiler: Compiler;
  checkQuota: (ip: string) => Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  commitQuota: (ip: string) => Promise<void>;
  recordMetrics: (metrics: GenerationMetrics) => Promise<void>;
  recordSample: (sample: GenerationSample) => Promise<void>;
}

export interface GenerateOutcome {
  status: number;
  payload: Record<string, unknown>;
}

function invalid(message: string): GenerateOutcome {
  return { status: 400, payload: { error: "VALIDATION_ERROR", message } };
}

export async function generate(
  body: unknown,
  ip: string,
  deps: GenerateDeps,
): Promise<GenerateOutcome> {
  const request = generateRequestSchema.safeParse(body);
  if (!request.success) {
    const issue = request.error.issues[0];
    return invalid(
      issue.path[0] === "targetProvider"
        ? "Choose Claude, GPT, or Gemini."
        : `Invalid request: ${issue.path.join(".") || "body"}.`,
    );
  }

  const { targetProvider, templateId, saveForResearch } = request.data;
  const path = request.data.input ? "freeform" : "template";
  const startedAt = Date.now();
  let filledPrompt: string;
  let allowSearch: boolean;

  if (request.data.input) {
    filledPrompt = request.data.input;
    // Free-form: search only when the request actually depends on current information.
    allowSearch = needsCurrentInfo(request.data.input);
  } else {
    const template = loadCatalog().find((t) => t.id === request.data.templateId);
    if (!template) return invalid("That template does not exist.");

    try {
      filledPrompt = fillTemplate(template, request.data.values);
      allowSearch = template.allowSearch;
    } catch (error) {
      if (error instanceof ValidationError) return invalid(error.message);
      throw error;
    }
  }

  const base = { path, templateId, targetProvider } as const;

  // Quota is checked before the expensive work but committed only after it validates.
  const quota = await deps.checkQuota(ip);
  if (!quota.allowed) {
    await deps.recordMetrics({ ...base, outcome: "rate_limited" });
    return {
      status: 429,
      payload: {
        error: "RATE_LIMITED",
        message: "You have reached the generation limit. Try again later.",
        retryAfterSeconds: quota.retryAfterSeconds,
      },
    };
  }

  let result;
  try {
    result = await deps.compiler.compile({
      filledPrompt,
      targetProvider,
      allowSearch,
    });
  } catch (error) {
    console.error("compile failed", error);
    await deps.recordMetrics({
      ...base,
      outcome: "compiler_failed",
      latencyMs: Date.now() - startedAt,
    });
    return {
      status: 502,
      payload: {
        error: "COMPILER_UNAVAILABLE",
        message: "The prompt compiler could not be reached. Your inputs are still here — try again.",
      },
    };
  }

  await deps.commitQuota(ip);

  const metrics: GenerationMetrics = {
    ...base,
    outcome: "ok",
    hop: result.hop,
    latencyMs: Date.now() - startedAt,
    promptChars: result.prompt.length,
    searched: result.toolsUsed.includes("web_search"),
  };
  await deps.recordMetrics(metrics);

  // Content is kept only when the user asked for it on this specific request.
  if (saveForResearch) {
    await deps.recordSample({ ...metrics, request: filledPrompt, prompt: result.prompt });
  }

  return {
    status: 200,
    payload: {
      prompt: result.prompt,
      targetProvider,
      sources: result.sources,
      toolsUsed: result.toolsUsed,
      saved: saveForResearch,
    },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use POST." });
  }

  try {
    const outcome = await generate(req.body, clientIp(req.headers), {
      compiler: createCompiler(),
      checkQuota,
      commitQuota,
      recordMetrics,
      recordSample,
    });
    return res.status(outcome.status).json(outcome.payload);
  } catch (error) {
    console.error("generate failed", error);
    return res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Something went wrong. Try again." });
  }
}
