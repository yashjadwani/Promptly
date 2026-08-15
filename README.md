# Promptly

Turns a short form or a sentence into a prompt written for Claude, GPT, or Gemini. Promptly writes the prompt — you paste it into the assistant yourself.

For how the whole thing works and why, see **[EXPLANATION.md](EXPLANATION.md)**.

## Running it

```bash
npm install
cp .env.example .env
npm test
```

156 tests, no keys required — they run against mocked HTTP. If this is red, stop here.

The API functions are Vercel serverless functions, so `npm run dev` serves only the frontend and `/api/*` will 404. For the full stack:

```bash
npx vercel dev
```

That runs everything **locally** on `localhost:3000` — nothing is deployed.

## Environment

| Variable | Required for | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | `/api/generate` | Free models need the account's data policy set to allow prompt training, or valid IDs return 404. |
| `OPENROUTER_LLM_PRIMARY` / `_FALLBACK` | `/api/generate` | Must support tool-calling and `response_format`. |
| `OPENCODE_API_KEY` | optional | Third failover hop. Omit it and the chain is two hops. |
| `TAVILY_API_KEY` | search-enabled requests | Only `research-summary` and freshness-flagged freeform input use it. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `/api/generate` | Rate-limit counter and telemetry. |
| `PROMPTLY_TIMEZONE` | optional | Defaults to UTC. |

`/api/templates` needs none of these and works on a bare deployment.

## Before shipping

- **Set `GITHUB_URL` in `src/components/SiteFooter.tsx`** — it is a placeholder, and three footer links depend on it.
- Replace the provider marks in `src/components/ProviderMark.tsx` with official assets if the app goes public (see below).
- Run the checks in `internal/SHIP.md`.

## What's in it

**Two ways in.** Type a sentence into the composer, or fill in one of ten Markdown templates.

**Three targets.** Claude, GPT, and Gemini each get a structurally different prompt — XML sections, Markdown bullets, or front-loaded context.

**A workspace, not a page.** The right rail opens on Templates and Recent. Generating adds a Prompt tab and lands you on it, in place — no navigation. Past prompts reopen in the same workspace.

**History** is kept in your browser only, capped at 20, and survives a reload.

**Rate limited** to 15 successful generations per IP per hour. Failures never consume quota.

**Guardrails.** User text and web results are fenced as quoted data, search snippets are sanitised, and any output echoing the compiler's own instructions is rejected and retried on the next model.

**Opt-in eval storage.** Nothing you type leaves your browser unless you tick the save box. Metrics (counters, no prompt text) are always recorded; the request and prompt are stored only with consent, for 90 days.

## Adding a template

Drop a `.md` file in `templates/`. The filename becomes the ID. See `internal/TEMPLATE_SPEC.md` for the frontmatter contract — the parser rejects anything malformed at load time rather than hiding it from the picker. Set `allowSearch: true` to let the compiler run one web search for that template.

No form code changes — `src/App.test.tsx` has a test that proves it.

## Changing how prompts are written

| To change | Edit |
|---|---|
| One provider's style | `RULES` in `api/_lib/providers.ts` |
| Rules for all providers | `SYSTEM_PROMPT` in `api/_lib/compiler.ts` |
| What counts as needing search | `FRESHNESS_SIGNALS` in `api/_lib/tools.ts` |
| Leak markers | `LEAK_MARKERS` in `api/_lib/guardrails.ts` |

Tests pin the current wording, so they fail loudly and name what to update. After any change here, generate by hand against a live endpoint — prompt quality is model behaviour and no test can catch a regression in it.

## Provider marks

`src/components/ProviderMark.tsx` holds simplified inline SVGs — **drawn in-house, not the vendors' logos** — using approximations of each brand's colour: Claude `#D97757`, GPT `#10A37F`, Gemini a `#4285F4 → #9B72CB → #D96570` gradient.

Before shipping publicly, replace them with official assets and exact colours from each vendor's brand page ([Anthropic on Brandfolder](https://brandfolder.com/anthropic/), OpenAI brand guidelines, Google Gemini brand assets). Identifying where you'll paste a prompt is nominative use, but each vendor sets rules on clear space, colour and minimum size — 14px may be below some minimums.

## Layout

```
templates/       product content, 10 templates
api/             Vercel functions
  _lib/          catalog, compiler, providers, guardrails, tools, quota, telemetry
src/             React app
  components/    composer, side panel, forms, output, footer
  lib/           localStorage history
internal/        specs and ship checklist (gitignored)
```
