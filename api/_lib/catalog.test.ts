import { describe, expect, it } from "vitest";
import { fillTemplate, loadCatalog, parseTemplate, toPublic, ValidationError } from "./catalog.js";

const VALID = `---
title: Example
category: marketing
description: An example template.
fields:
  - name: subject
    label: Subject
    type: text
  - name: tone
    label: Tone
    type: select
    options: [warm, direct]
  - name: notes
    label: Notes
    type: textarea
    required: false
---
Write about {{subject}} in a {{tone}} tone. Notes: {{notes}}
`;

function withFrontmatter(body: string) {
  return VALID.replace(/---\n[\s\S]*?\n---\n/, `---\n${body}\n---\n`);
}

describe("parseTemplate", () => {
  it("parses a valid template", () => {
    const template = parseTemplate("example", VALID);
    expect(template.id).toBe("example");
    expect(template.fields).toHaveLength(3);
    expect(template.allowSearch).toBe(false);
  });

  it("defaults required to true and honours an explicit false", () => {
    const template = parseTemplate("example", VALID);
    expect(template.fields.find((f) => f.name === "subject")!.required).toBe(true);
    expect(template.fields.find((f) => f.name === "notes")!.required).toBe(false);
  });

  it("rejects a missing title", () => {
    const raw = withFrontmatter(
      "category: marketing\ndescription: d\nfields:\n  - name: a\n    label: A\n    type: text",
    );
    expect(() => parseTemplate("example", raw)).toThrow(/title/);
  });

  it("rejects fewer than three fields", () => {
    const raw = withFrontmatter(
      "title: T\ncategory: marketing\ndescription: d\nfields:\n  - name: subject\n    label: S\n    type: text",
    );
    expect(() => parseTemplate("example", raw)).toThrow(/fields/);
  });

  it("rejects an unsupported field type", () => {
    expect(() => parseTemplate("example", VALID.replace("type: text", "type: date"))).toThrow(
      /type/,
    );
  });

  it("rejects a select without options", () => {
    expect(() =>
      parseTemplate("example", VALID.replace("    options: [warm, direct]\n", "")),
    ).toThrow(/at least two options/);
  });

  it("rejects options on a non-select field", () => {
    expect(() =>
      parseTemplate("example", VALID.replace("    label: Subject", "    label: Subject\n    options: [a, b]")),
    ).toThrow(/only valid on select/);
  });

  it("rejects a placeholder with no matching field", () => {
    expect(() => parseTemplate("example", VALID.replace("{{subject}}", "{{mystery}}"))).toThrow(
      /no such field/,
    );
  });

  it("rejects a field that never appears in the body", () => {
    expect(() => parseTemplate("example", VALID.replace(" Notes: {{notes}}", ""))).toThrow(
      /never used/,
    );
  });

  it("rejects a non-kebab-case id", () => {
    expect(() => parseTemplate("Example_One", VALID)).toThrow(/kebab-case/);
  });

  it("rejects a non-snake_case field name", () => {
    expect(() =>
      parseTemplate("example", VALID.replace("name: subject", "name: Subject").replace("{{subject}}", "{{Subject}}")),
    ).toThrow(/snake_case|no such field/);
  });

  it("rejects an empty body", () => {
    expect(() => parseTemplate("example", VALID.replace(/---\n[^]*$/, "---\n"))).toThrow();
  });
});

describe("fillTemplate", () => {
  const template = parseTemplate("example", VALID);

  it("substitutes values", () => {
    const filled = fillTemplate(template, { subject: "pricing", tone: "warm", notes: "short" });
    expect(filled).toContain("Write about pricing in a warm tone.");
    expect(filled).toContain("Notes: short");
  });

  it("marks an omitted optional field rather than leaving a placeholder", () => {
    const filled = fillTemplate(template, { subject: "pricing", tone: "warm" });
    expect(filled).toContain("Notes: Not specified.");
    expect(filled).not.toContain("{{");
  });

  it("rejects a missing required field", () => {
    expect(() => fillTemplate(template, { tone: "warm" })).toThrow(ValidationError);
  });

  it("rejects a whitespace-only required field", () => {
    expect(() => fillTemplate(template, { subject: "   ", tone: "warm" })).toThrow(/required/);
  });

  it("rejects an oversized value", () => {
    expect(() =>
      fillTemplate(template, { subject: "x".repeat(2001), tone: "warm" }),
    ).toThrow(/2000 characters/);
  });

  it("rejects a select value outside its options", () => {
    expect(() => fillTemplate(template, { subject: "a", tone: "sarcastic" })).toThrow(/must be one of/);
  });

  it("rejects an unknown field name", () => {
    expect(() =>
      fillTemplate(template, { subject: "a", tone: "warm", sneaky: "x" }),
    ).toThrow(/Unknown field/);
  });

  it("treats a value containing a placeholder as literal text", () => {
    const filled = fillTemplate(template, { subject: "{{tone}}", tone: "warm", notes: "n" });
    expect(filled).toContain("Write about {{tone}} in a warm tone.");
  });
});

describe("shipped catalog", () => {
  const catalog = loadCatalog();

  it("loads all ten templates", () => {
    expect(catalog).toHaveLength(10);
    expect(catalog.map((t) => t.id).sort()).toEqual([
      "brainstorm-ideas",
      "code-review",
      "data-analysis",
      "marketing-copy",
      "meeting-agenda",
      "product-requirements-brief",
      "professional-email",
      "research-summary",
      "social-media-post",
      "technical-explainer",
    ]);
  });

  it("enables search only where freshness matters", () => {
    expect(catalog.filter((t) => t.allowSearch).map((t) => t.id)).toEqual(["research-summary"]);
  });

  it("exposes no body or compiler detail to the browser", () => {
    const publicShape = toPublic(catalog[0]);
    expect(publicShape).not.toHaveProperty("body");
    expect(publicShape).not.toHaveProperty("allowSearch");
  });

  it("fills every template from its own select options", () => {
    for (const template of catalog) {
      const values = Object.fromEntries(
        template.fields.map((f) => [f.name, f.type === "select" ? f.options![0] : "sample value"]),
      );
      expect(fillTemplate(template, values)).not.toContain("{{");
    }
  });
});
