import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate, type GenerateDeps } from "./generate.js";
import { CompilerError } from "./_lib/compiler.js";
import { clientIp } from "./_lib/quota.js";

const VALUES = {
  product: "A project management app",
  audience: "Small agencies",
  tone: "professional",
  key_benefit: "Fewer status meetings",
  format: "email",
};

function makeDeps(overrides: Partial<GenerateDeps> = {}): GenerateDeps {
  return {
    compiler: {
      compile: vi.fn(async () => ({
        prompt: "A compiled prompt long enough to satisfy the schema.".padEnd(80, "."),
        sources: [],
        toolsUsed: [],
        hop: "hop-1",
      })),
    },
    checkQuota: vi.fn(async () => ({ allowed: true, retryAfterSeconds: 0 })),
    commitQuota: vi.fn(async () => {}),
    recordMetrics: vi.fn(async () => {}),
    recordSample: vi.fn(async () => {}),
    ...overrides,
  };
}

const body = (extra: Record<string, unknown> = {}) => ({
  templateId: "marketing-copy",
  values: VALUES,
  targetProvider: "claude",
  ...extra,
});

let deps: GenerateDeps;

beforeEach(() => {
  deps = makeDeps();
});

describe("POST /api/generate", () => {
  it("accepts a free-form chat request without a template", async () => {
    const outcome = await generate(
      { input: "Help me plan a launch announcement.", targetProvider: "gpt" },
      "1.1.1.1",
      deps,
    );

    expect(outcome.status).toBe(200);
    expect(deps.compiler.compile).toHaveBeenCalledWith(
      expect.objectContaining({
        filledPrompt: "Help me plan a launch announcement.",
        targetProvider: "gpt",
        // An ordinary request does not need search, so it does not pay for one.
        allowSearch: false,
      }),
    );
  });

  it("enables search on a free-form request that depends on current information", async () => {
    await generate(
      { input: "summarise the latest research on solid state batteries", targetProvider: "claude" },
      "1.1.1.1",
      deps,
    );

    expect(deps.compiler.compile).toHaveBeenCalledWith(
      expect.objectContaining({ allowSearch: true }),
    );
  });

  it("returns the prompt and echoes the target provider", async () => {
    const outcome = await generate(body(), "1.1.1.1", deps);

    expect(outcome.status).toBe(200);
    expect(outcome.payload.targetProvider).toBe("claude");
    expect(outcome.payload.sources).toEqual([]);
    expect(String(outcome.payload.prompt).length).toBeGreaterThan(40);
  });

  it("passes each target provider through to the compiler unchanged", async () => {
    for (const provider of ["claude", "gpt", "gemini"] as const) {
      const outcome = await generate(body({ targetProvider: provider }), "1.1.1.1", deps);
      expect(outcome.payload.targetProvider).toBe(provider);
    }
    expect(deps.compiler.compile).toHaveBeenCalledTimes(3);
  });

  it("tells the compiler whether the template permits search", async () => {
    await generate(body(), "1.1.1.1", deps);
    expect(deps.compiler.compile).toHaveBeenCalledWith(
      expect.objectContaining({ allowSearch: false }),
    );

    await generate(
      { templateId: "research-summary", values: { topic: "t", audience: "a", depth: "overview" }, targetProvider: "gemini" },
      "1.1.1.1",
      deps,
    );
    expect(deps.compiler.compile).toHaveBeenLastCalledWith(
      expect.objectContaining({ allowSearch: true }),
    );
  });

  it("rejects an unknown template", async () => {
    const outcome = await generate(body({ templateId: "does-not-exist" }), "1.1.1.1", deps);
    expect(outcome.status).toBe(400);
    expect(outcome.payload.error).toBe("VALIDATION_ERROR");
  });

  it("rejects an unknown provider", async () => {
    const outcome = await generate(body({ targetProvider: "llama" }), "1.1.1.1", deps);
    expect(outcome.status).toBe(400);
    expect(outcome.payload.message).toMatch(/Claude, GPT, or Gemini/);
  });

  it("rejects a missing required field and names it", async () => {
    const { audience: _drop, ...rest } = VALUES;
    const outcome = await generate(body({ values: rest }), "1.1.1.1", deps);
    expect(outcome.status).toBe(400);
    expect(outcome.payload.message).toMatch(/Target audience is required/);
  });

  it("rejects a select value outside its options", async () => {
    const outcome = await generate(
      body({ values: { ...VALUES, tone: "sarcastic" } }),
      "1.1.1.1",
      deps,
    );
    expect(outcome.status).toBe(400);
    expect(outcome.payload.message).toMatch(/must be one of/);
  });

  it("rejects a malformed body", async () => {
    expect((await generate(null, "1.1.1.1", deps)).status).toBe(400);
    expect((await generate({ templateId: "marketing-copy" }, "1.1.1.1", deps)).status).toBe(400);
  });

  it("returns 502 when every compiler hop fails", async () => {
    const outcome = await generate(
      body(),
      "1.1.1.1",
      makeDeps({
        compiler: {
          compile: vi.fn(async () => {
            throw new CompilerError("all hops failed");
          }),
        },
      }),
    );

    expect(outcome.status).toBe(502);
    expect(JSON.stringify(outcome.payload)).not.toMatch(/hop|api[_-]?key/i);
  });
});

describe("consent and telemetry", () => {
  it("never stores content unless the request asked for it", async () => {
    await generate(body(), "1.1.1.1", deps);
    expect(deps.recordSample).not.toHaveBeenCalled();
    expect(deps.recordMetrics).toHaveBeenCalled();
  });

  it("treats a missing consent flag as no", async () => {
    await generate({ input: "write me a poem", targetProvider: "gpt" }, "1.1.1.1", deps);
    expect(deps.recordSample).not.toHaveBeenCalled();
  });

  it("ignores a non-boolean consent value rather than coercing it", async () => {
    const outcome = await generate(body({ saveForResearch: "yes" }), "1.1.1.1", deps);
    expect(outcome.status).toBe(400);
    expect(deps.recordSample).not.toHaveBeenCalled();
  });

  it("stores the request and the prompt when consent is given", async () => {
    await generate(body({ saveForResearch: true }), "1.1.1.1", deps);

    expect(deps.recordSample).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.stringContaining("A project management app"),
        prompt: expect.stringContaining("A compiled prompt"),
        templateId: "marketing-copy",
        targetProvider: "claude",
        outcome: "ok",
      }),
    );
  });

  it("tells the client whether the prompt was saved", async () => {
    expect((await generate(body(), "1.1.1.1", deps)).payload.saved).toBe(false);
    expect((await generate(body({ saveForResearch: true }), "1.1.1.1", deps)).payload.saved).toBe(
      true,
    );
  });

  it("does not store content when the generation failed, even with consent", async () => {
    const failing = makeDeps({
      compiler: {
        compile: vi.fn(async () => {
          throw new CompilerError("down");
        }),
      },
    });
    await generate(body({ saveForResearch: true }), "1.1.1.1", failing);

    expect(failing.recordSample).not.toHaveBeenCalled();
    expect(failing.recordMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "compiler_failed" }),
    );
  });

  it("records which hop served the request", async () => {
    await generate(body(), "1.1.1.1", deps);
    expect(deps.recordMetrics).toHaveBeenCalledWith(expect.objectContaining({ hop: "hop-1" }));
  });

  it("records rate limits without touching the compiler", async () => {
    const limited = makeDeps({
      checkQuota: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 60 })),
    });
    await generate(body({ saveForResearch: true }), "1.1.1.1", limited);

    expect(limited.recordMetrics).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "rate_limited" }),
    );
    expect(limited.recordSample).not.toHaveBeenCalled();
  });

  it("keeps metrics free of prompt content", async () => {
    await generate(body(), "1.1.1.1", deps);
    const recorded = JSON.stringify(
      (deps.recordMetrics as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    expect(recorded).not.toMatch(/project management app|Small agencies|compiled prompt/i);
  });
});

describe("quota semantics", () => {
  it("commits only after a validated prompt", async () => {
    await generate(body(), "1.1.1.1", deps);
    expect(deps.commitQuota).toHaveBeenCalledWith("1.1.1.1");
  });

  it("does not commit on a validation failure", async () => {
    await generate(body({ templateId: "nope" }), "1.1.1.1", deps);
    expect(deps.checkQuota).not.toHaveBeenCalled();
    expect(deps.commitQuota).not.toHaveBeenCalled();
  });

  it("does not commit when the compiler fails", async () => {
    const failing = makeDeps({
      compiler: {
        compile: vi.fn(async () => {
          throw new CompilerError("down");
        }),
      },
    });
    await generate(body(), "1.1.1.1", failing);
    expect(failing.checkQuota).toHaveBeenCalled();
    expect(failing.commitQuota).not.toHaveBeenCalled();
  });

  it("returns 429 with a retry estimate once the window is full", async () => {
    const limited = makeDeps({
      checkQuota: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 1800 })),
    });
    const outcome = await generate(body(), "1.1.1.1", limited);

    expect(outcome.status).toBe(429);
    expect(outcome.payload.error).toBe("RATE_LIMITED");
    expect(outcome.payload.retryAfterSeconds).toBe(1800);
    expect(limited.compiler.compile).not.toHaveBeenCalled();
  });

  it("keys the quota on the caller's IP", async () => {
    await generate(body(), "9.9.9.9", deps);
    expect(deps.checkQuota).toHaveBeenCalledWith("9.9.9.9");
  });
});

describe("clientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(clientIp({ "x-forwarded-for": "203.0.113.4, 70.41.3.18" })).toBe("203.0.113.4");
  });

  it("falls back to x-real-ip, then to a placeholder", () => {
    expect(clientIp({ "x-real-ip": "198.51.100.7" })).toBe("198.51.100.7");
    expect(clientIp({})).toBe("unknown");
  });

  it("does not let two IPs share a key", () => {
    expect(clientIp({ "x-forwarded-for": "1.1.1.1" })).not.toBe(
      clientIp({ "x-forwarded-for": "2.2.2.2" }),
    );
  });
});
