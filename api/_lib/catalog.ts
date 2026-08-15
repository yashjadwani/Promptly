import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import {
  frontmatterSchema,
  MAX_FIELD_LENGTH,
  TEMPLATE_ID,
  type Frontmatter,
  type TemplateField,
} from "./schema.js";

export class ValidationError extends Error {}

export interface Template extends Frontmatter {
  id: string;
  body: string;
}

/** The subset the browser is allowed to see: no body, no compiler instructions. */
export interface PublicTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  fields: Array<{
    name: string;
    label: string;
    type: TemplateField["type"];
    required: boolean;
    options: string[];
  }>;
}

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

export function parseTemplate(id: string, raw: string): Template {
  if (!TEMPLATE_ID.test(id)) {
    throw new Error(`Template "${id}": file name must be lowercase kebab-case.`);
  }

  const { data, content } = matter(raw);
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Template "${id}": ${detail}`);
  }

  const body = content.trim();
  if (!body) throw new Error(`Template "${id}": body is empty.`);

  const declared = new Set(parsed.data.fields.map((f) => f.name));
  const used = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER)) used.add(match[1]);

  for (const name of used) {
    if (!declared.has(name)) {
      throw new Error(`Template "${id}": body uses {{${name}}} but no such field is declared.`);
    }
  }
  for (const name of declared) {
    if (!used.has(name)) {
      throw new Error(`Template "${id}": field "${name}" is declared but never used in the body.`);
    }
  }

  const names = parsed.data.fields.map((f) => f.name);
  if (new Set(names).size !== names.length) {
    throw new Error(`Template "${id}": duplicate field names.`);
  }

  return { id, ...parsed.data, body };
}

let cache: Template[] | null = null;

export function loadCatalog(dir = join(process.cwd(), "templates")): Template[] {
  if (cache) return cache;

  const templates = readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseTemplate(file.replace(/\.md$/, ""), readFileSync(join(dir, file), "utf8")));

  const titles = new Set<string>();
  for (const template of templates) {
    if (titles.has(template.title)) throw new Error(`Duplicate template title: ${template.title}`);
    titles.add(template.title);
  }

  cache = templates;
  return cache;
}

export function resetCatalogCache(): void {
  cache = null;
}

export function toPublic(template: Template): PublicTemplate {
  return {
    id: template.id,
    title: template.title,
    category: template.category,
    description: template.description,
    fields: template.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options ?? [],
    })),
  };
}

/**
 * Substitutes user values as inert text. Values are never parsed, evaluated, or allowed
 * to introduce new placeholders — a value containing "{{other}}" stays literal.
 */
export function fillTemplate(template: Template, values: Record<string, string>): string {
  const declared = new Map(template.fields.map((f) => [f.name, f]));

  for (const name of Object.keys(values)) {
    if (!declared.has(name)) {
      throw new ValidationError(`Unknown field "${name}" for template "${template.id}".`);
    }
  }

  const resolved = new Map<string, string>();
  for (const field of template.fields) {
    const value = (values[field.name] ?? "").trim();

    if (!value) {
      if (field.required) throw new ValidationError(`${field.label} is required.`);
      resolved.set(field.name, "Not specified.");
      continue;
    }
    if (value.length > MAX_FIELD_LENGTH) {
      throw new ValidationError(`${field.label} must be ${MAX_FIELD_LENGTH} characters or fewer.`);
    }
    if (field.type === "select" && !field.options!.includes(value)) {
      throw new ValidationError(`${field.label} must be one of: ${field.options!.join(", ")}.`);
    }
    resolved.set(field.name, value);
  }

  return template.body.replace(PLACEHOLDER, (_, name: string) => resolved.get(name)!);
}
