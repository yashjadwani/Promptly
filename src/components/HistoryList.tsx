import type { HistoryEntry } from "../lib/history";

interface Props {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function whenever(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Today · ${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function preview(prompt: string): string {
  const flat = prompt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return flat.length > 70 ? `${flat.slice(0, 69)}…` : flat;
}

export function HistoryList({ entries, onRestore, onRemove, onClear }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="history" aria-label="Recent prompts">
      <div className="history__heading">
        <p className="history__note">Kept in this browser only.</p>
        <button type="button" onClick={onClear} className="history__clear">
          Clear all
        </button>
      </div>

      <ul className="history__list">
        {entries.map((entry) => (
          <li key={entry.id} className="history__item">
            <button type="button" onClick={() => onRestore(entry)} className="history__restore">
              <span className="history__label">{entry.label}</span>
              <span className="history__preview">{preview(entry.prompt)}</span>
              <span className="history__meta">{whenever(entry.createdAt)}</span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="history__remove"
              aria-label={`Delete ${entry.label}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
