import { useState } from "react";
import { ConsentCheckbox } from "./ConsentCheckbox";
import { PROVIDERS, type TargetProvider } from "../types";

interface Props {
  provider: TargetProvider;
  busy: boolean;
  consent: boolean;
  onProviderChange: (provider: TargetProvider) => void;
  onConsentChange: (consent: boolean) => void;
  onSubmit: (input: string) => void;
}

export function ChatComposer({
  provider,
  busy,
  consent,
  onProviderChange,
  onConsentChange,
  onSubmit,
}: Props) {
  const [input, setInput] = useState("");

  function send() {
    if (input.trim() && !busy) onSubmit(input.trim());
  }

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor="chat-input" className="sr-only">
        What do you want to create?
      </label>
      <textarea
        id="chat-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter is a newline. isComposing guards IME candidate
          // selection, where Enter means "accept this character", not "submit".
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
        placeholder="Tell me what you want to create…"
        rows={5}
        maxLength={2000}
        autoFocus
        className="chat-composer__input"
      />

      <div className="chat-composer__footer">
        <div className="provider-switcher" aria-label="Where will you paste this?">
          {PROVIDERS.map((option) => {
            const selected = provider === option.id;
            return (
              <label
                key={option.id}
                className={"provider-chip " + (selected ? "is-selected" : "")}
                title={option.hint}
              >
                <input
                  type="radio"
                  name="chat-target-provider"
                  value={option.id}
                  checked={selected}
                  onChange={() => onProviderChange(option.id)}
                />
                {option.label}
              </label>
            );
          })}
        </div>

        <button
          type="submit"
          disabled={!input.trim() || busy}
          title="Enter to send, Shift+Enter for a new line"
          className="generate-button"
        >
          {busy ? "Writing…" : "Generate prompt"}
          {!busy && <span aria-hidden="true">↗</span>}
        </button>
      </div>

      <div className="chat-composer__consent">
        <ConsentCheckbox checked={consent} onChange={onConsentChange} />
      </div>
    </form>
  );
}
