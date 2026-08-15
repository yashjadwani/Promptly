interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Consent starts off and, once ticked, stays on for the rest of the session. It is
 * never written to storage, so closing the tab always revokes it.
 */
export function ConsentCheckbox({ checked, onChange }: Props) {
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        Save my prompts to help improve Promptly
        <span className="consent__detail">
          Keeps what you typed and the prompt we wrote, for 90 days, to test changes against.
          Off by default. Stays on for this session until you untick it.
        </span>
      </span>
    </label>
  );
}
