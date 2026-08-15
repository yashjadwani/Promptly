import { useEffect, useState } from "react";
import { ChatComposer } from "./components/ChatComposer";
import { OutputPanel } from "./components/OutputPanel";
import { PromptForm } from "./components/PromptForm";
import { SidePanel, type WorkspaceTab } from "./components/SidePanel";
import { SiteFooter } from "./components/SiteFooter";
import * as history from "./lib/history";
import type { HistoryEntry } from "./lib/history";
import type { ApiError, GenerateResponse, Shown, TargetProvider, Template } from "./types";

type Phase = "loading" | "picking" | "filling";

/** Mirrors the rail's real shape — tabs, filter chips, card grid — so nothing jumps
 *  when the catalog lands. */
function RailSkeleton() {
  return (
    <div className="rail" aria-hidden="true">
      <div className="rail__tabs">
        <span className="skeleton__chip animate-pulse-soft" style={{ width: 96 }} />
        <span className="skeleton__chip animate-pulse-soft" style={{ width: 78 }} />
      </div>
      <div className="rail__body">
        <div className="category-filter">
          {[46, 92, 78, 64].map((width) => (
            <span key={width} className="skeleton__chip animate-pulse-soft" style={{ width }} />
          ))}
        </div>
        <div className="template-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="skeleton__card animate-pulse-soft" />
          ))}
        </div>
      </div>
    </div>
  );
}

function GeneratingSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <span className="skeleton__line animate-pulse-soft" />
      <span className="skeleton__line animate-pulse-soft" />
      <span className="skeleton__line animate-pulse-soft" />
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [provider, setProvider] = useState<TargetProvider>("claude");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<HistoryEntry[]>(() => history.list());
  // Ticked once, it stays on for the session. Never written to storage, so closing the
  // tab always revokes it.
  const [consent, setConsent] = useState(false);

  // The generation the workspace is showing: the newest one, or a past one reopened
  // from Recent. One value, so both routes render identically.
  const [shown, setShown] = useState<Shown | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("prompt");

  useEffect(() => {
    fetch("/api/templates")
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<Template[]>;
      })
      .then((data) => {
        setTemplates(data);
        setPhase("picking");
      })
      .catch(() => {
        setCatalogError("Templates could not be loaded. Refresh to try again.");
        setPhase("picking");
      });
  }, []);

  function choose(template: Template) {
    setSelected(template);
    setValues({});
    setShown(null);
    setError(null);
    setPhase("filling");
  }

  function back() {
    setSelected(null);
    setShown(null);
    setError(null);
    setPhase("picking");
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setShown(null);
    setTab("prompt");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          values,
          targetProvider: provider,
          saveForResearch: consent,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const apiError = payload as ApiError;
        setError(
          apiError.retryAfterSeconds
            ? `${apiError.message} About ${Math.ceil(apiError.retryAfterSeconds / 60)} minutes.`
            : apiError.message,
        );
        return;
      }

      const generated = payload as GenerateResponse;
      const request = selected.fields
        .map((f) => `${f.label}: ${values[f.name] || "—"}`)
        .join("\n");

      setShown({
        prompt: generated.prompt,
        targetProvider: generated.targetProvider,
        sources: generated.sources,
        request,
        origin: { title: selected.title, description: selected.description },
      });
      setRecent(
        history.save({
          prompt: generated.prompt,
          targetProvider: generated.targetProvider,
          label: selected.title,
          sources: generated.sources,
          request,
        }),
      );
    } catch {
      setError("The request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function generateFreeform(input: string) {
    setBusy(true);
    setError(null);
    setShown(null);
    setTab("prompt");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, targetProvider: provider, saveForResearch: consent }),
      });
      const payload = await response.json();

      if (!response.ok) {
        const apiError = payload as ApiError;
        const wait = apiError.retryAfterSeconds
          ? " About " + Math.ceil(apiError.retryAfterSeconds / 60) + " minutes."
          : "";
        setError(apiError.message + wait);
        return;
      }

      const generated = payload as GenerateResponse;
      setShown({
        prompt: generated.prompt,
        targetProvider: generated.targetProvider,
        sources: generated.sources,
        request: input,
      });
      setRecent(
        history.save({
          prompt: generated.prompt,
          targetProvider: generated.targetProvider,
          label: history.labelFor(input),
          sources: generated.sources,
          request: input,
        }),
      );
    } catch {
      setError("The request could not be sent. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Reopens a past generation in the same workspace — no navigation, no new screen. */
  function openEntry(entry: HistoryEntry) {
    setError(null);
    setShown({
      prompt: entry.prompt,
      targetProvider: entry.targetProvider,
      sources: entry.sources,
      request: entry.request ?? entry.label,
    });
    setTab("prompt");
  }

  const chrome = (
    <>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Promptly home">
          <img className="brand__mark" src="/logo.svg" alt="" width="30" height="30" />
          <span>Promptly</span>
        </a>
      </header>
    </>
  );

  // A chosen template owns the whole workspace. Same header and footer, nothing else competing.
  if (phase === "filling" && selected) {
    return (
      <div className="app-shell">
        {chrome}

        <main className="main-content main-content--full">
          <div className="workspace">
            <button type="button" onClick={back} className="back-button">
              ← All templates
            </button>

            <h1 className="form-heading">{selected.title}</h1>
            <p className="form-description">{selected.description}</p>

            <div className="form-card">
              <PromptForm
                template={selected}
                values={values}
                provider={provider}
                busy={busy}
                consent={consent}
                onChange={setValues}
                onProviderChange={setProvider}
                onConsentChange={setConsent}
                onSubmit={generate}
              />
            </div>

            <p aria-live="polite" className="sr-only">
              {busy ? "Brewing your prompt." : shown ? "Your prompt is ready." : ""}
            </p>

            {busy && <GeneratingSkeleton />}

            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}

            {shown && (
              <OutputPanel
                result={{
                  prompt: shown.prompt,
                  targetProvider: shown.targetProvider,
                  sources: shown.sources,
                  toolsUsed: [],
                }}
              />
            )}
          </div>
        </main>

        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {chrome}

      <main className="main-content main-content--split">
        <section className="pane pane--compose" aria-label="Write your request">
          <div className="pane__inner">
            <div className="hero">
              <h1>What do you want to make?</h1>
              <p>
                Describe it plainly. You get back a prompt built for the assistant you name - yours to paste, keep, and reuse.
              </p>
            </div>

            <ChatComposer
              provider={provider}
              busy={busy}
              consent={consent}
              onProviderChange={setProvider}
              onConsentChange={setConsent}
              onSubmit={generateFreeform}
            />

            <p aria-live="polite" className="sr-only">
              {busy ? "Brewing your prompt." : shown ? "Your prompt is ready." : ""}
            </p>

            {error && (
              <p role="alert" className="inline-error">
                {error}
              </p>
            )}
          </div>
        </section>

        <aside className="pane pane--rail" aria-label="Templates and generated prompts">
          {phase === "loading" ? (
            <>
              <RailSkeleton />
              <p className="sr-only" aria-live="polite">
                Loading templates.
              </p>
            </>
          ) : (
            <SidePanel
              templates={templates}
              catalogError={catalogError}
              recent={recent}
              shown={shown}
              busy={busy}
              tab={tab}
              onTabChange={setTab}
              onSelect={choose}
              onOpenEntry={openEntry}
              onRemove={(id) => setRecent(history.remove(id))}
              onClear={() => setRecent(history.clear())}
            />
          )}
        </aside>
      </main>

      <SiteFooter />
    </div>
  );
}
