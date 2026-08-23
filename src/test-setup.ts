import "@testing-library/jest-dom/vitest";

/**
 * jsdom 26 still ships no <dialog> methods — `showModal` is literally undefined — so
 * without this the footer's popups can never open under test. Toggling the `open`
 * attribute is what the real methods do observably, which is enough for assertions
 * about visibility, the dialog role, and close behaviour.
 *
 * Real modality (focus trapping, inert background, Escape, ::backdrop) is browser
 * behaviour and has to be checked in a browser, not here.
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(returnValue?: string) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}
