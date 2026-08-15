import { useEffect, useState } from "react";
import { PROVIDERS, type GenerateResponse } from "../types";

export function OutputPanel({ result }: { result: GenerateResponse }) {
  const [copied, setCopied] = useState(false);
  const providerLabel =
    PROVIDERS.find((p) => p.id === result.targetProvider)?.label ?? result.targetProvider;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section aria-labelledby="output-heading" className="output-panel animate-rise">
      <div className="output-panel__heading">
        <h2 id="output-heading" className="output-panel__title">
          Your prompt for {providerLabel}
        </h2>
        <button type="button" onClick={copy} className="copy-button">
          <svg
            className="copy-button__icon"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {copied ? (
              <path d="M4.5 12.5 9.5 17.5 19.5 6.5" strokeLinecap="round" />
            ) : (
              <>
                <rect x="3" y="3" width="13" height="13" rx="2.5" />
                <path d="M8 21h11a2 2 0 0 0 2-2V8" strokeLinecap="round" />
              </>
            )}
          </svg>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? "Prompt copied to clipboard." : ""}
      </p>

      <pre className="output-panel__prompt">
        {result.prompt}
      </pre>

      {result.sources.length > 0 && (
        <div className="sources-list">
          <h3>Sources used for current information</h3>
          <ul>
            {result.sources.map((source) => (
                <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="break-words text-accent underline underline-offset-2"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
