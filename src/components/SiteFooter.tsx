import { useRef } from "react";
import { BookOpen, GitBranch, Triangle } from "lucide-react";
import { version } from "../../package.json";

/** Set this to the real repository before shipping. */
const GITHUB_URL = "https://github.com/yashjadwani/Promptly";

/** Marketing shows major.minor only — the patch number is noise to a reader. */
export const APP_VERSION = `v${version.split(".").slice(0, 2).join(".")}`;

const boxLink =
  "inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 " +
  "text-ink-muted transition hover:border-ink hover:text-ink";

const textLink = "text-ink-muted transition hover:text-ink hover:underline underline-offset-4";

interface DialogProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}

/**
 * Native <dialog> rather than a routed page: Escape, focus trapping and inertness of
 * the page behind come free, and the footer stays a footer instead of becoming
 * navigation.
 */
function Popup({ id, title, children, onClose, dialogRef }: DialogProps) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      // Clicking the backdrop hits the dialog element itself, never its children.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      onClose={onClose}
      className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-hairline
                 bg-surface p-6 text-ink shadow-[0_24px_70px_rgba(36,63,45,0.18)]
                 [&::backdrop]:bg-black/70"
    >
      <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-muted">{children}</div>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white
                   transition hover:bg-accent"
      >
        Close
      </button>
    </dialog>
  );
}

export function SiteFooter() {
  const methodology = useRef<HTMLDialogElement>(null);
  const privacy = useRef<HTMLDialogElement>(null);

  return (
    // site-footer supplies padding-inline from the shared --gutter, so the horizontal
    // padding is deliberately not a Tailwind utility here.
    <footer className="site-footer flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hairline bg-canvas py-3 text-[13px] sm:py-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-md bg-ink text-[#e9f4e9]"
        >
          <Triangle size={14} strokeWidth={2.2} />
        </span>
        <span className="font-bold tracking-tight text-ink">
          Prompt<span className="text-accent">ly</span>
        </span>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-muted">
          {APP_VERSION}
        </span>
      </div>

      {/* The strongest claim the product makes, so it stays visible rather than living
          only behind the Privacy dialog. */}
      <p className="order-last w-full text-ink-muted sm:order-none sm:w-auto">
        Your prompts stay in your browser unless you tick the save box.
      </p>

      <nav
        aria-label="Footer"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end"
      >
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={boxLink}>
          <GitBranch size={14} aria-hidden="true" />
          GitHub
        </a>
        <a
          href={`${GITHUB_URL}/blob/main/EXPLANATION.md`}
          target="_blank"
          rel="noreferrer"
          className={boxLink}
        >
          <BookOpen size={14} aria-hidden="true" />
          Docs
        </a>

        <button type="button" onClick={() => methodology.current?.showModal()} className={textLink}>
          Methodology
        </button>
        <button type="button" onClick={() => privacy.current?.showModal()} className={textLink}>
          Privacy
        </button>
        <a
          href={`${GITHUB_URL}/issues/new`}
          target="_blank"
          rel="noreferrer"
          className={textLink}
        >
          Feedback
        </a>
      </nav>

      <Popup
        id="methodology"
        title="How Promptly works"
        dialogRef={methodology}
        onClose={() => methodology.current?.close()}
      >
        <p>
          You describe a task in plain language. Promptly rewrites it into a prompt using the
          conventions of the assistant you choose — XML sections for Claude, direct Markdown
          instructions for GPT, front-loaded context for Gemini.
        </p>
        <p>
          Promptly never calls Claude, GPT or Gemini. Picking a provider changes how the prompt is
          written, nothing else. You copy the result and paste it wherever you were going anyway.
        </p>
      </Popup>

      <Popup
        id="privacy"
        title="Privacy"
        dialogRef={privacy}
        onClose={() => privacy.current?.close()}
      >
        <p>
          There are no accounts, no sign-up and no tracking. Your prompt history is kept in this
          browser only, and clearing it removes it for good.
        </p>
        <p>
          Nothing you type is stored on a server unless you tick the save box when generating. That
          box is off by default, and what it keeps is used only to test changes to the product.
        </p>
      </Popup>
    </footer>
  );
}
