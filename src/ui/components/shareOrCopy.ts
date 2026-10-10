/** The phone's own share sheet where there is one (a text message needs no
 *  data), otherwise the clipboard. Says what happened, or null when the person
 *  cancelled the sheet or tapped again while it was open: neither is a share
 *  that failed, so neither earns a note while the real sheet is on screen. */
export async function shareOrCopy(text: string): Promise<'shared' | 'copied' | 'unavailable' | null> {
  try {
    await navigator.share({ text });
    return 'shared';
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'AbortError' || name === 'InvalidStateError') return null;
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'unavailable';
  }
}
