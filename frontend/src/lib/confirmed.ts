/**
 * Proof that the user said yes to a delete (argus-studio#262).
 *
 * Every destructive fetcher in `lib/*Api.ts` takes a {@link Confirmed} and
 * spends it before its request, so a delete that skipped the question does not
 * compile, and one that faked the value throws before anything is sent. There
 * are two ways to get one: {@link askConfirm} asks with the browser's own
 * dialog, and {@link confirmedBy} takes the click on a page's own confirm
 * button. Dev mode has no third.
 */

declare const brand: unique symbol;

/** One yes from the user, good for one destructive call. */
export interface Confirmed {
  readonly [brand]: true;
}

/** A delete reached its client without the user's yes. A bug, never a state to show. */
export class Unconfirmed extends Error {
  constructor(message = "This delete needs the user's confirmation, and has none.") {
    super(message);
    this.name = "Unconfirmed";
  }
}

const live = new WeakSet<Confirmed>();

function mint(): Confirmed {
  const token = Object.freeze({}) as Confirmed;
  live.add(token);
  return token;
}

/** Ask with the browser's confirm dialog. Null when the user says no. */
export function askConfirm(message: string): Confirmed | null {
  return window.confirm(message) ? mint() : null;
}

/**
 * The user's click on a confirm button the page drew itself. The event must be
 * the browser's own (`isTrusted`), so a scripted `click()` cannot stand in.
 */
export function confirmedBy(event: { readonly isTrusted: boolean }): Confirmed {
  if (event?.isTrusted !== true) throw new Unconfirmed("A delete can only be confirmed by the user's own click.");
  return mint();
}

/** Use up a confirmation. Throws {@link Unconfirmed} for a forged or already spent one. */
export function spendConfirmation(confirmed: Confirmed): void {
  if (!live.delete(confirmed)) throw new Unconfirmed();
}
