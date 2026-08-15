import { z } from "zod";

export const TEMPLATE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const FIELD_NAME = /^[a-z][a-z0-9_]*$/;

export const MAX_FIELD_LENGTH = 2000;

export const fieldSchema = z
  .object({
    name: z.string().regex(FIELD_NAME, "Field names must be lowercase snake_case."),
    label: z.string().min(1),
    type: z.enum(["text", "textarea", "select"]),
    required: z.boolean().default(true),
    options: z.array(z.string().min(1)).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === "select") {
      if (!field.options || field.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Field "${field.name}": select requires at least two options.`,
        });
      }
    } else if (field.options !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Field "${field.name}": options are only valid on select fields.`,
      });
    }
  });

export const frontmatterSchema = z.object({
  title: z.string().min(1),
  category: z.string().regex(TEMPLATE_ID, "Categories must be lowercase kebab-case."),
  description: z.string().min(1),
  allowSearch: z.boolean().default(false),
  fields: z.array(fieldSchema).min(3).max(5),
});

export const targetProviderSchema = z.enum(["claude", "gpt", "gemini"]);

export const generateRequestSchema = z.object({
  targetProvider: targetProviderSchema,
  templateId: z.string().regex(TEMPLATE_ID).optional(),
  values: z.record(z.string()).default({}),
  input: z.string().trim().min(1).max(MAX_FIELD_LENGTH).optional(),
  /** Explicit consent to keep this request and its prompt for evaluation. Off unless asked for. */
  saveForResearch: z.boolean().default(false),
}).superRefine((request, ctx) => {
  if (!request.templateId && !request.input) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["input"],
      message: "Tell us what you want to create.",
    });
  }
  if (request.templateId && request.input) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["input"],
      message: "Choose a template or write a custom request, not both.",
    });
  }
});

/** Shape the compiler must return. Anything else is a failed hop, not something to repair. */
export const compilerOutputSchema = z.object({
  prompt: z.string().trim().min(40, "Compiler returned an empty or truncated prompt."),
});

export const searchResultSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  snippet: z.string().default(""),
});

export type TemplateField = z.infer<typeof fieldSchema>;
export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type TargetProvider = z.infer<typeof targetProviderSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
