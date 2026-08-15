export type FieldType = "text" | "textarea" | "select";

export interface TemplateField {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
}

export interface Template {
  id: string;
  title: string;
  category: string;
  description: string;
  fields: TemplateField[];
}

export type TargetProvider = "claude" | "gpt" | "gemini";

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

/**
 * One generation as the workspace shows it — the latest result, or a past one reopened
 * from Recent. Single source of truth for the Prompt tab so both routes render the same.
 */
export interface Shown {
  prompt: string;
  targetProvider: TargetProvider;
  sources: Source[];
  request: string;
  origin?: { title: string; description: string };
}

export interface GenerateResponse {
  prompt: string;
  targetProvider: TargetProvider;
  sources: Source[];
  toolsUsed: string[];
}

export interface ApiError {
  error: string;
  message: string;
  retryAfterSeconds?: number;
}

/**
 * The glyph is the syntax that provider's prompt is actually built from — XML tags for
 * Claude, bullets for GPT, markdown headings for Gemini. It previews the shape of the
 * output rather than decorating the option.
 */
export const PROVIDERS: Array<{
  id: TargetProvider;
  label: string;
  glyph: string;
  hint: string;
}> = [
  { id: "claude", label: "Claude", glyph: "< >", hint: "Role framing and XML sections" },
  { id: "gpt", label: "GPT", glyph: "—", hint: "Direct, compact instructions" },
  { id: "gemini", label: "Gemini", glyph: "#", hint: "Context first, format spelled out" },
];

export const CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  communication: "Communication",
  engineering: "Engineering",
  research: "Research",
  ideation: "Ideation",
  product: "Product",
};

export function categoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}
