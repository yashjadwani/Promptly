import { useMemo, useState } from "react";
import { categoryLabel, type Template } from "../types";

interface Props {
  templates: Template[];
  onSelect: (template: Template) => void;
  compact?: boolean;
}

export function TemplatePicker({ templates, onSelect, compact = false }: Props) {
  const [active, setActive] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(templates.map((t) => t.category))).sort(),
    [templates],
  );

  const visible = active === "all" ? templates : templates.filter((t) => t.category === active);

  return (
    <section aria-label="Prompt templates">

      <div
        role="group"
        aria-label="Filter templates by category"
        className="category-filter"
      >
        {["all", ...categories].map((category) => {
          const selected = active === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                selected
                  ? "filter-chip is-active"
                  : "filter-chip"
              }`}
            >
              {category === "all" ? "All" : categoryLabel(category)}
            </button>
          );
        })}
      </div>

      <ul className={"template-grid" + (compact ? " template-grid--compact" : "")}>
        {visible.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onSelect(template)}
              className="template-card"
            >
              <span className="template-card__title">{template.title}</span>
              <span className="template-card__description">
                {template.description}
              </span>
              <span className="template-card__category">
                {categoryLabel(template.category)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="loading-copy">No templates in this category yet.</p>
      )}
    </section>
  );
}
