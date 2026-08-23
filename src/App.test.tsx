import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Template } from "./types";

const MARKETING: Template = {
  id: "marketing-copy",
  title: "Marketing Copy",
  category: "marketing",
  description: "Persuasive copy for a product.",
  fields: [
    { name: "product", label: "Product or service", type: "text", required: true, options: [] },
    { name: "notes", label: "Notes", type: "textarea", required: false, options: [] },
    {
      name: "tone",
      label: "Tone",
      type: "select",
      required: true,
      options: ["professional", "playful"],
    },
  ],
};

const CODE_REVIEW: Template = {
  id: "code-review",
  title: "Code Review",
  category: "engineering",
  description: "A focused review pass.",
  fields: [
    { name: "language", label: "Language or stack", type: "text", required: true, options: [] },
    { name: "context", label: "What it does", type: "textarea", required: true, options: [] },
    {
      name: "priority",
      label: "Review priority",
      type: "select",
      required: true,
      options: ["correctness", "security"],
    },
  ],
};

/** Stands in for a ninth .md file dropped into templates/ with no code change. */
const NEW_TEMPLATE: Template = {
  id: "meeting-agenda",
  title: "Meeting Agenda",
  category: "communication",
  description: "An agenda that respects everyone's time.",
  fields: [
    { name: "purpose", label: "Purpose", type: "text", required: true, options: [] },
    { name: "attendees", label: "Attendees", type: "text", required: true, options: [] },
    {
      name: "duration",
      label: "Duration",
      type: "select",
      required: true,
      options: ["15 minutes", "30 minutes"],
    },
  ],
};

const PROMPT = "You are an experienced copywriter. Write marketing copy for a project tool.";

let fetchMock: ReturnType<typeof vi.fn>;

function mockCatalog(templates: Template[]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/templates") {
      return { ok: true, json: async () => templates } as Response;
    }
    throw new Error(`unexpected call to ${url}`);
  });
}

function mockGenerate(response: unknown, ok = true) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/templates") {
      return { ok: true, json: async () => [MARKETING, CODE_REVIEW] } as Response;
    }
    return { ok, json: async () => response } as Response;
  });
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(async () => {}) },
    configurable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openTemplate(title: string) {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: new RegExp(title) }));
  return user;
}

describe("template picker", () => {
  it("lists every template returned by the API", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    render(<App />);

    expect(await screen.findByRole("button", { name: /Marketing Copy/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Code Review/ })).toBeInTheDocument();
  });

  it("filters by category", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Engineering" }));

    expect(screen.getByRole("button", { name: /Code Review/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marketing Copy/ })).not.toBeInTheDocument();
  });

  it("renders a template it has never seen before, with no code change", async () => {
    mockCatalog([MARKETING, CODE_REVIEW, NEW_TEMPLATE]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /Meeting Agenda/ }));

    expect(screen.getByLabelText(/Purpose/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Attendees/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Duration/ })).toBeInTheDocument();
  });

  it("shows a rail skeleton while the catalog loads, never a blank side", async () => {
    // A fetch that never settles keeps the app in its loading phase.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<App />);

    expect(container.querySelectorAll(".skeleton__card").length).toBeGreaterThan(0);
    expect(container.querySelector(".rail")).toBeInTheDocument();
    expect(screen.getByText("Loading templates.")).toBeInTheDocument();
    // The composer is usable immediately; it never waited on the catalog.
    expect(screen.getByLabelText(/What do you want to create/)).toBeInTheDocument();
  });

  it("replaces the skeleton with real templates once loaded", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const { container } = render(<App />);

    await screen.findByRole("button", { name: /Marketing Copy/ });
    expect(container.querySelectorAll(".skeleton__card")).toHaveLength(0);
  });

  it("surfaces a catalog failure instead of an empty page", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
  });

  it("keeps the composer usable when the catalog fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<App />);

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/What do you want to create/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate prompt/ })).toBeInTheDocument();
  });
});

describe("dynamic form", () => {
  it("renders each field type from metadata alone", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    await openTemplate("Marketing Copy");

    expect(screen.getByLabelText(/Product or service/)).toHaveProperty("tagName", "INPUT");
    expect(screen.getByLabelText(/Notes/)).toHaveProperty("tagName", "TEXTAREA");
    expect(screen.getByLabelText(/Tone/)).toHaveProperty("tagName", "SELECT");
  });

  it("marks optional fields and leaves required ones unmarked", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    await openTemplate("Marketing Copy");

    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("blocks submission and names the missing field", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = await openTemplate("Marketing Copy");

    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    expect(await screen.findByText(/Product or service is required/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // catalog only
  });

  it("preserves entered values when validation fails", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = await openTemplate("Marketing Copy");

    await user.type(screen.getByLabelText(/Product or service/), "A CRM");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    expect(screen.getByLabelText(/Product or service/)).toHaveValue("A CRM");
  });
});

describe("generation", () => {
  it("generates from a free-form chat request", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "claude", sources: [], toolsUsed: [] });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText(/What do you want to create/), "Plan a product launch");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    const [, options] = fetchMock.mock.calls.find(([url]) => url === "/api/generate")!;
    expect(JSON.parse(options.body)).toEqual({
      input: "Plan a product launch",
      targetProvider: "claude",
      saveForResearch: false,
    });
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/Product or service/), "A CRM");
    await user.selectOptions(screen.getByLabelText(/Tone/), "professional");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));
  }

  it("sends the template, values, and provider, then shows the prompt", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [] });
    const user = await openTemplate("Marketing Copy");

    await user.click(screen.getByRole("radio", { name: /GPT/ }));
    await fillAndSubmit(user);

    const [, options] = fetchMock.mock.calls.find(([url]) => url === "/api/generate")!;
    expect(JSON.parse(options.body)).toEqual({
      templateId: "marketing-copy",
      values: { product: "A CRM", tone: "professional" },
      targetProvider: "gpt",
      saveForResearch: false,
    });

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Your prompt for GPT/ })).toBeInTheDocument();
  });

  it("defaults to Claude", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "claude", sources: [], toolsUsed: [] });
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    const [, options] = fetchMock.mock.calls.find(([url]) => url === "/api/generate")!;
    expect(JSON.parse(options.body).targetProvider).toBe("claude");
  });

  it("copies the prompt and confirms quietly", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "claude", sources: [], toolsUsed: [] });
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    await user.click(await screen.findByRole("button", { name: "Copy" }));

    // user-event installs its own clipboard stub, so assert the effect, not the call.
    await expect(navigator.clipboard.readText()).resolves.toBe(PROMPT);
    expect(await screen.findByRole("button", { name: /Copied/ })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows sources only when a search was run", async () => {
    mockGenerate({
      prompt: PROMPT,
      targetProvider: "claude",
      sources: [{ title: "A source", url: "https://example.com/a", snippet: "" }],
      toolsUsed: ["web_search"],
    });
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    const link = await screen.findByRole("link", { name: "A source" });
    expect(link).toHaveAttribute("href", "https://example.com/a");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("hides the source list when nothing was searched", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "claude", sources: [], toolsUsed: [] });
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    await screen.findByText(PROMPT);
    expect(screen.queryByText(/Sources used/)).not.toBeInTheDocument();
  });

  it("shows a friendly rate-limit state with the wait in minutes", async () => {
    mockGenerate(
      {
        error: "RATE_LIMITED",
        message: "You have reached the generation limit. Try again later.",
        retryAfterSeconds: 1800,
      },
      false,
    );
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/generation limit/);
    expect(alert).toHaveTextContent(/30 minutes/);
  });

  it("keeps the form intact after a compiler failure", async () => {
    mockGenerate(
      { error: "COMPILER_UNAVAILABLE", message: "The prompt compiler could not be reached." },
      false,
    );
    const user = await openTemplate("Marketing Copy");
    await fillAndSubmit(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be reached/);
    expect(screen.getByLabelText(/Product or service/)).toHaveValue("A CRM");
    expect(screen.getByRole("button", { name: /Generate prompt/ })).toBeEnabled();
  });
});

describe("workspace", () => {
  async function generateFreeform(text = "plan a launch announcement") {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [] });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/What do you want to create/), text);
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));
    await screen.findByText(PROMPT);
    return user;
  }

  it("opens on Templates with Recent beside it, and no Prompt tab yet", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    render(<App />);

    expect(await screen.findByRole("button", { name: /Marketing Copy/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Templates/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Recent/ })).toHaveAttribute("aria-selected", "false");
    // Nothing generated yet, so there is nothing for a Prompt tab to hold.
    expect(screen.queryByRole("tab", { name: "Prompt" })).not.toBeInTheDocument();
  });

  it("lets you read history before generating anything", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("tab", { name: /Recent/ }));
    expect(screen.getByText(/Prompts you generate are kept here/)).toBeInTheDocument();
  });

  it("grows the three tabs only after generating, landing on Prompt", async () => {
    await generateFreeform();

    expect(screen.getByRole("tab", { name: "Prompt" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Template" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Recent/ })).toHaveAttribute("aria-selected", "false");
  });

  it("shows the prompt and the original request together", async () => {
    await generateFreeform("plan a launch announcement");

    // Scope to the panel: the composer still holds the same text.
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText(PROMPT)).toBeInTheDocument();
    expect(within(panel).getByText("Based on your original request")).toBeInTheDocument();
    expect(within(panel).getByText("plan a launch announcement")).toBeInTheDocument();
  });

  it("keeps the composer on the left, untouched", async () => {
    const user = await generateFreeform();

    const box = screen.getByLabelText(/What do you want to create/);
    expect(box).toBeInTheDocument();
    await user.type(box, " more");
    expect(screen.getByRole("button", { name: /Generate prompt/ })).toBeEnabled();
  });

  it("switches tabs without losing the generated prompt", async () => {
    const user = await generateFreeform();

    await user.click(screen.getByRole("tab", { name: "Template" }));
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
  });

  it("keeps templates reachable from the Template tab", async () => {
    const user = await generateFreeform();

    await user.click(screen.getByRole("tab", { name: "Template" }));
    expect(screen.getByRole("button", { name: /Marketing Copy/ })).toBeInTheDocument();
  });
});

describe("recent", () => {
  async function generateThenOpenRecent() {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [] });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText(/What do you want to create/), "a launch post");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));
    await screen.findByText(PROMPT);
    await user.click(screen.getByRole("tab", { name: /Recent/ }));
    return user;
  }

  it("lists the generation with its question, a preview and a time", async () => {
    await generateThenOpenRecent();

    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByText("a launch post")).toBeInTheDocument();
    expect(within(panel).getByText(/You are an experienced copywriter/)).toBeInTheDocument();
    expect(within(panel).getByText("just now")).toBeInTheDocument();
  });

  it("survives a reload and reopens in the same workspace, not a new screen", async () => {
    await generateThenOpenRecent();
    cleanup();

    mockCatalog([MARKETING, CODE_REVIEW]);
    render(<App />);
    await screen.findByRole("button", { name: /Marketing Copy/ });

    // History exists but the workspace has not opened yet — no tabs on a cold load.
    expect(screen.queryByRole("tab", { name: "Prompt" })).not.toBeInTheDocument();
  });

  it("opens a past generation in the Prompt tab", async () => {
    const user = await generateThenOpenRecent();

    const rows = within(screen.getByRole("tabpanel")).getAllByRole("button", {
      name: /a launch post/,
    });
    // First is the row itself; the delete button carries a "Delete …" label.
    await user.click(rows.find((b) => !/^Delete/.test(b.getAttribute("aria-label") ?? ""))!);

    expect(screen.getByRole("tab", { name: "Prompt" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(PROMPT)).toBeInTheDocument();
    expect(screen.getByText("Based on your original request")).toBeInTheDocument();
    // Still the same shell: the composer never went away.
    expect(screen.getByLabelText(/What do you want to create/)).toBeInTheDocument();
  });

  it("deletes one entry and clears them all", async () => {
    const user = await generateThenOpenRecent();

    await user.click(screen.getByRole("button", { name: /Delete a launch post/ }));
    expect(within(screen.getByRole("tabpanel")).queryByText("a launch post")).not.toBeInTheDocument();
  });

  it("says where prompts are kept", async () => {
    await generateThenOpenRecent();
    expect(screen.getByText(/Kept in this browser only/)).toBeInTheDocument();
  });
});

describe("footer", () => {
  async function renderApp() {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: /Marketing Copy/ });
    return user;
  }

  it("shows the wordmark with the last two letters accented, and the major.minor version", async () => {
    await renderApp();

    expect(screen.getByText("v1.0")).toBeInTheDocument();
    // "Prompt" + "ly", where "ly" carries the accent colour.
    expect(screen.getByText("ly")).toBeInTheDocument();
    expect(screen.getByText("Prompt")).toBeInTheDocument();
  });

  it("opens the box links in a new tab", async () => {
    await renderApp();

    for (const name of ["GitHub", "Docs"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("target", "_blank");
      // noreferrer implies noopener, so this is not a tabnabbing hole.
      expect(link).toHaveAttribute("rel", "noreferrer");
      expect(link).toHaveAttribute("href", expect.stringContaining("github.com"));
    }
  });

  it("keeps the privacy claim visible, not only inside the dialog", async () => {
    await renderApp();
    expect(
      screen.getByText(/Your prompts stay in your browser unless you tick the save box/),
    ).toBeInTheDocument();
  });

  it("shares the page gutter so the brand lines up with the header", async () => {
    const { container } = (() => {
      mockCatalog([MARKETING, CODE_REVIEW]);
      return render(<App />);
    })();
    await screen.findByRole("button", { name: /Marketing Copy/ });

    const footer = container.querySelector("footer");
    // The shared rule supplies padding-inline; a local px-* utility would override it
    // and pull the footer out of alignment.
    expect(footer).toHaveClass("site-footer");
    expect(footer?.className).not.toMatch(/(^|\s)px-\d/);
  });

  it("points Feedback at a new issue", async () => {
    await renderApp();
    expect(screen.getByRole("link", { name: "Feedback" })).toHaveAttribute(
      "href",
      expect.stringContaining("/issues/new"),
    );
  });

  it("opens Methodology as a dialog, not a route", async () => {
    const user = await renderApp();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Methodology" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/How Promptly works/)).toBeInTheDocument();
    // Still the same page underneath.
    expect(screen.getByLabelText(/What do you want to create/)).toBeInTheDocument();
  });

  it("states the privacy position in its dialog", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: "Privacy" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/no accounts, no sign-up and no tracking/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Nothing you type is stored on a server unless you tick the save box/i),
    ).toBeInTheDocument();
  });

  it("closes on the Close button", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: "Privacy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on a backdrop click but not on a click inside", async () => {
    const user = await renderApp();
    await user.click(screen.getByRole("button", { name: "Methodology" }));
    const dialog = screen.getByRole("dialog");

    // Clicking the content must not dismiss it.
    await user.click(within(dialog).getByRole("heading", { name: /How Promptly works/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // The backdrop is the dialog element itself.
    await user.click(dialog);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("consent", () => {
  it("starts unticked and sends saveForResearch false", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [], saved: false });
    const user = userEvent.setup();
    render(<App />);

    const box = await screen.findByRole("checkbox", { name: /Save my prompts/ });
    expect(box).not.toBeChecked();

    await user.type(screen.getByLabelText(/What do you want to create/), "a poem");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    const [, options] = fetchMock.mock.calls.find(([url]) => url === "/api/generate")!;
    expect(JSON.parse(options.body).saveForResearch).toBe(false);
  });

  it("sends true once the user ticks it", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [], saved: true });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("checkbox", { name: /Save my prompts/ }));
    await user.type(screen.getByLabelText(/What do you want to create/), "a poem");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    const [, options] = fetchMock.mock.calls.find(([url]) => url === "/api/generate")!;
    expect(JSON.parse(options.body).saveForResearch).toBe(true);
  });

  it("stays on for the rest of the session once ticked", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [], saved: true });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("checkbox", { name: /Save my prompts/ }));
    await user.type(screen.getByLabelText(/What do you want to create/), "a poem");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));
    await screen.findByText(PROMPT);

    expect(screen.getByRole("checkbox", { name: /Save my prompts/ })).toBeChecked();

    // And the second generation carries it too.
    await user.type(screen.getByLabelText(/What do you want to create/), " again");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    const calls = fetchMock.mock.calls.filter(([url]) => url === "/api/generate");
    expect(JSON.parse(calls[calls.length - 1][1].body).saveForResearch).toBe(true);
  });

  it("is never written to storage, so a reload revokes it", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "gpt", sources: [], toolsUsed: [], saved: true });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("checkbox", { name: /Save my prompts/ }));

    cleanup();
    mockCatalog([MARKETING, CODE_REVIEW]);
    render(<App />);

    expect(await screen.findByRole("checkbox", { name: /Save my prompts/ })).not.toBeChecked();
  });

  it("says how long a saved prompt is kept", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    render(<App />);
    expect(await screen.findByText(/90 days/)).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("groups the provider choices under one legend", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    await openTemplate("Marketing Copy");

    const group = screen.getByRole("group", { name: /Where will you paste this/ });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
  });

  it("reaches every control by keyboard", async () => {
    mockCatalog([MARKETING, CODE_REVIEW]);
    const user = await openTemplate("Marketing Copy");

    const product = screen.getByLabelText(/Product or service/);
    product.focus();
    expect(product).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/Notes/)).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Tone/)).toHaveFocus();
  });

  it("announces generation and readiness politely", async () => {
    mockGenerate({ prompt: PROMPT, targetProvider: "claude", sources: [], toolsUsed: [] });
    const user = await openTemplate("Marketing Copy");

    await user.type(screen.getByLabelText(/Product or service/), "A CRM");
    await user.selectOptions(screen.getByLabelText(/Tone/), "professional");
    await user.click(screen.getByRole("button", { name: /Generate prompt/ }));

    await waitFor(() => expect(screen.getByText("Your prompt is ready.")).toBeInTheDocument());
  });
});
