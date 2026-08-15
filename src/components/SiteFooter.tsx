/** Set this to the real repository before shipping. */
const GITHUB_URL = "https://github.com/your-username/promptly";

export const APP_VERSION = "v1.0";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__brand">
        <img src="/logo.svg" alt="" width="18" height="18" />
        <span>Promptly</span>
        <span className="site-footer__version">{APP_VERSION}</span>
      </div>

      <nav className="site-footer__links" aria-label="Footer">
        <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
          GitHub
        </a>
        <a href={`${GITHUB_URL}/issues/new`} target="_blank" rel="noreferrer noopener">
          Report an issue
        </a>
        <a
          href={`${GITHUB_URL}/issues/new?labels=template&title=Template%20request`}
          target="_blank"
          rel="noreferrer noopener"
        >
          Request a template
        </a>
      </nav>

      <p className="site-footer__note">
        Your prompts stay in your browser unless you tick the save box.
      </p>
    </footer>
  );
}
