import { HistoryList } from "./HistoryList";
import { OutputPanel } from "./OutputPanel";
import { TemplatePicker } from "./TemplatePicker";
import type { HistoryEntry } from "../lib/history";
import type { Shown, Template } from "../types";

export type WorkspaceTab = "prompt" | "template" | "recent";

interface Props {
  templates: Template[];
  catalogError: string | null;
  recent: HistoryEntry[];
  shown: Shown | null;
  busy: boolean;
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onSelect: (template: Template) => void;
  onOpenEntry: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

/**
 * Before a generation there is no Prompt tab to offer, so the rail opens on Templates
 * with Recent alongside it. Generating adds Prompt in front and takes focus.
 */
function tabsFor(hasWorkspace: boolean): Array<{ id: WorkspaceTab; label: string }> {
  const rest: Array<{ id: WorkspaceTab; label: string }> = [
    { id: "template", label: hasWorkspace ? "Template" : "Templates" },
    { id: "recent", label: "Recent" },
  ];
  return hasWorkspace ? [{ id: "prompt", label: "Prompt" }, ...rest] : rest;
}

function Skeleton() {
  return (
    <div className="brewing">
      <p className="brewing__message" aria-live="polite">
        Brewing your prompt…
      </p>
      <div className="brewing__lines" aria-hidden="true">
        <span className="skeleton__line animate-pulse-soft" />
        <span className="skeleton__line animate-pulse-soft" />
        <span className="skeleton__line animate-pulse-soft" />
      </div>
      <p className="brewing__note">Turning your idea into something reusable.</p>
    </div>
  );
}

function TemplateBrowser({
  templates,
  catalogError,
  onSelect,
}: Pick<Props, "templates" | "catalogError" | "onSelect">) {
  if (catalogError) {
    return (
      <p role="alert" className="inline-error">
        {catalogError}
      </p>
    );
  }
  return <TemplatePicker templates={templates} onSelect={onSelect} compact />;
}

/**
 * The right pane opens on Templates with Recent beside it. Generating adds a Prompt tab
 * in front and moves focus there, so the workspace grows out of the browser rather than
 * replacing it.
 */
export function SidePanel({
  templates,
  catalogError,
  recent,
  shown,
  busy,
  tab,
  onTabChange,
  onSelect,
  onOpenEntry,
  onRemove,
  onClear,
}: Props) {
  const hasWorkspace = busy || shown !== null;
  const tabs = tabsFor(hasWorkspace);
  // Without a workspace there is no Prompt tab, so fall back rather than showing nothing.
  const active = hasWorkspace ? tab : tab === "prompt" ? "template" : tab;

  return (
    <div className={"rail " + (hasWorkspace ? "rail--workspace" : "")}>
      <div className="rail__tabs" role="tablist" aria-label="Templates and prompts">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`tab-${entry.id}`}
            aria-selected={active === entry.id}
            aria-controls={`panel-${entry.id}`}
            onClick={() => onTabChange(entry.id)}
            className={"rail__tab " + (active === entry.id ? "is-active" : "")}
          >
            {entry.label}
            {entry.id === "recent" && recent.length > 0 && (
              <span className="rail__count">{recent.length}</span>
            )}
            {entry.id === "template" && !hasWorkspace && (
              <span className="rail__count">{templates.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rail__body">
        {active === "prompt" && (
          <div role="tabpanel" id="panel-prompt" aria-labelledby="tab-prompt">
            {busy ? (
              <Skeleton />
            ) : shown ? (
              <>
                {/* Question first, prompt second — the same order the user thought in. */}
                <section className="recall" aria-labelledby="recall-heading">
                  <h3 id="recall-heading" className="recall__heading">
                    Based on your original request
                  </h3>
                  <p className="recall__request">{shown.request}</p>
                </section>

                <OutputPanel
                  result={{
                    prompt: shown.prompt,
                    targetProvider: shown.targetProvider,
                    sources: shown.sources,
                    toolsUsed: [],
                  }}
                />
              </>
            ) : null}
          </div>
        )}

        {active === "template" && (
          <div role="tabpanel" id="panel-template" aria-labelledby="tab-template">
            {shown?.origin && (
              <section className="origin">
                <h3 className="origin__title">{shown.origin.title}</h3>
                <p className="origin__description">{shown.origin.description}</p>
                <p className="origin__note">This prompt was built from that template.</p>
              </section>
            )}
            <TemplateBrowser
              templates={templates}
              catalogError={catalogError}
              onSelect={onSelect}
            />
          </div>
        )}

        {active === "recent" && (
          <div role="tabpanel" id="panel-recent" aria-labelledby="tab-recent">
            {recent.length === 0 ? (
              <p className="rail__empty">
                Prompts you generate are kept here, in this browser only — unless you tick the save
                box when generating.
              </p>
            ) : (
              <HistoryList
                entries={recent}
                onRestore={onOpenEntry}
                onRemove={onRemove}
                onClear={onClear}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
