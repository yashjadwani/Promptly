import type { TargetProvider } from "./schema.js";

/**
 * Provider-specific guidance used by the prompt compiler.
 *
 * These rules shape how the final prompt is written for the target model.
 * They are compiler instructions, not instructions that should appear in
 * the user's final prompt unless explicitly relevant.
 */
const RULES: Record<
  TargetProvider,
  { name: string; conventions: string }
> = {
  claude: {
    name: "Claude",
    conventions: [
      "Establish the relevant role, context, and objective before giving the task.",
      "Use XML-style tags such as <context>, <task>, <constraints>, and <output> to clearly separate major instruction sections.",
      "Every XML tag must close with its matching tag name. Never create mismatched or unclosed tags.",
      "These XML tags organise the instructions only. Do not ask Claude to respond using XML unless the user explicitly requires tagged output.",
      "For genuinely multi-stage work, use numbered steps or an explicit sequence. Keep simple tasks compact.",
      "State important exclusions or failure conditions explicitly when they prevent a likely mistake. Do not add negative constraints unnecessarily.",
      "Keep reference material, instructions, constraints, and expected output clearly distinguishable.",
    ].join("\n"),
  },

  gpt: {
    name: "GPT",
    conventions: [
      "Start with a concise role or objective when it improves task clarity.",
      "State the task directly using clear imperative language.",
      "Separate important context, task requirements, constraints, and expected output using concise Markdown headings or bullets.",
      "Do not use XML tags unless the user's task specifically calls for them.",
      "Prefer concise, information-dense instructions over unnecessary prompt scaffolding.",
      "Specify the desired output length, level of detail, or format when those requirements materially affect the result.",
      "Do not add constraints or sections that do not help accomplish the user's actual objective.",
    ].join("\n"),
  },

  gemini: {
    name: "Gemini",
    conventions: [
      "Provide the relevant context and background before the main task when that context affects the desired result.",
      "State the objective clearly and explain the intended audience or purpose when relevant.",
      "Use concise Markdown headings or bullets to distinguish context, task, constraints, and expected output.",
      "Do not use XML tags unless the user's task specifically calls for them.",
      "Be explicit about what the response should accomplish rather than prescribing an unnecessarily rigid response structure.",
      "Keep the requested output format simple and proportional to the complexity of the task.",
      "Do not repeat context or introduce formatting requirements that do not improve the result.",
    ].join("\n"),
  },
};

export function providerRules(provider: TargetProvider): string {
  const { name, conventions } = RULES[provider];

  return [
    `The finished prompt will be pasted into ${name}.`,
    `Optimise the prompt for ${name}'s instruction conventions:`,
    conventions,
  ].join("\n");
}

export function providerName(provider: TargetProvider): string {
  return RULES[provider].name;
}