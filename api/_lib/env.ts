/**
 * Env is read through these getters rather than at module load, so GET /api/templates
 * keeps working on a deployment that has no model or Redis credentials configured.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export interface CompilerHop {
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Ordered failover chain. Hops 1 and 2 share a base URL and key and differ only by
 * model; hop 3 is a different vendor, so a provider-wide outage still has a path out.
 */
export function compilerChain(): CompilerHop[] {
  const openrouterKey = required("OPENROUTER_API_KEY");
  const openrouterBase = optional("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");
  const chain: CompilerHop[] = [
    {
      label: "openrouter-primary",
      baseUrl: openrouterBase,
      apiKey: openrouterKey,
      model: optional("OPENROUTER_LLM_PRIMARY", "nvidia/nemotron-3-super-120b-a12b:free"),
    },
    {
      label: "openrouter-fallback",
      baseUrl: openrouterBase,
      apiKey: openrouterKey,
      model: optional("OPENROUTER_LLM_FALLBACK", "google/gemma-4-26b-a4b-it:free"),
    },
  ];
  return chain;
}

export function tavilyKey(): string {
  return required("TAVILY_API_KEY");
}

export function timezone(): string {
  return optional("PROMPTLY_TIMEZONE", "UTC");
}

export function upstash(): { url: string; token: string } {
  return {
    url: required("UPSTASH_REDIS_REST_URL"),
    token: required("UPSTASH_REDIS_REST_TOKEN"),
  };
}
