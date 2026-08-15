import { useId, useMemo, useState } from "react";
import { ConsentCheckbox } from "./ConsentCheckbox";
import { PROVIDERS, type TargetProvider, type Template, type TemplateField } from "../types";

export const MAX_FIELD_LENGTH = 2000;

interface Props {
  template: Template;
  values: Record<string, string>;
  provider: TargetProvider;
  busy: boolean;
  consent: boolean;
  onChange: (values: Record<string, string>) => void;
  onProviderChange: (provider: TargetProvider) => void;
  onConsentChange: (consent: boolean) => void;
  onSubmit: () => void;
}

function fieldError(field: TemplateField, raw: string): string | null {
  const value = raw.trim();
  if (!value) return field.required ? field.label + " is required." : null;
  if (value.length > MAX_FIELD_LENGTH) {
    return field.label + " must be " + MAX_FIELD_LENGTH + " characters or fewer.";
  }
  return null;
}

const inputClass = "form-input";

export function PromptForm({
  template,
  values,
  provider,
  busy,
  consent,
  onChange,
  onProviderChange,
  onConsentChange,
  onSubmit,
}: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const groupId = useId();

  const errors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const field of template.fields) {
      const error = fieldError(field, values[field.name] ?? "");
      if (error) map[field.name] = error;
    }
    return map;
  }, [template, values]);

  const valid = Object.keys(errors).length === 0;

  function set(name: string, value: string) {
    onChange({ ...values, [name]: value });
  }

  return (
    <form
      className="animate-rise"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(Object.fromEntries(template.fields.map((f) => [f.name, true])));
        if (valid && !busy) onSubmit();
      }}
    >
      <div className="form-fields">
        {template.fields.map((field) => {
          const id = groupId + "-" + field.name;
          const error = touched[field.name] ? errors[field.name] : undefined;
          const describedBy = error ? id + "-error" : undefined;
          const value = values[field.name] ?? "";

          return (
            <div
              key={field.name}
              className={"form-field" + (field.type === "textarea" ? " form-field--wide" : "")}
            >
              <label htmlFor={id} className="form-label">
                {field.label}
                {!field.required && <span className="optional-label">Optional</span>}
              </label>

              <div className="field-control">
                {field.type === "select" ? (
                  <select
                    id={id}
                    value={value}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    onChange={(e) => set(field.name, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                    className={inputClass}
                  >
                    <option value="">Select an option</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    id={id}
                    rows={4}
                    value={value}
                    maxLength={MAX_FIELD_LENGTH}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    onChange={(e) => set(field.name, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                    className={inputClass + " resize-y"}
                  />
                ) : (
                  <input
                    id={id}
                    type="text"
                    value={value}
                    maxLength={MAX_FIELD_LENGTH}
                    aria-invalid={Boolean(error)}
                    aria-describedby={describedBy}
                    onChange={(e) => set(field.name, e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, [field.name]: true }))}
                    className={inputClass}
                  />
                )}
              </div>

              {error && (
                <p id={id + "-error"} role="alert" className="field-error">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <fieldset className="provider-fieldset">
        <legend className="form-label">Where will you paste this?</legend>
        <p className="form-help">
          This changes how the prompt is written. Promptly does not send anything to them — you
          copy it across yourself.
        </p>

        <div className="provider-grid">
          {PROVIDERS.map((option) => {
            const selected = provider === option.id;
            return (
              <label
                key={option.id}
                className={"provider-card " + (selected ? "is-selected" : "")}
              >
                <span className="provider-card__topline">
                  <input
                    type="radio"
                    name="targetProvider"
                    value={option.id}
                    checked={selected}
                    onChange={() => onProviderChange(option.id)}
                    className="accent-accent"
                  />
                  <span className="provider-card__label">{option.label}</span>
                </span>
                <span className="provider-card__hint">
                  {option.hint}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <ConsentCheckbox checked={consent} onChange={onConsentChange} />

      <button type="submit" disabled={busy} aria-disabled={!valid || busy} className="generate-button">
        {busy ? "Writing your prompt…" : "Generate prompt"}
        {!busy && <span aria-hidden="true">↗</span>}
      </button>
    </form>
  );
}
