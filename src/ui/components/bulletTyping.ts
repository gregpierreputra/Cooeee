import type { ChangeEvent, KeyboardEvent } from 'react';

const BULLET = '• ';
/** A dash or a star and a space at the start of a line, as typed, even
 *  straight after a bullet the box already started. */
const TYPED_BULLET = /^([ \t]*)(?:• )?[-*] /gm;

/** Scroll the box just far enough that the line holding the caret is in view.
 *  The caret's height is read from an unseen copy of the box holding the text
 *  up to the caret, so the box itself, and its Undo, are never touched. */
function showCaret(box: HTMLTextAreaElement) {
  const style = getComputedStyle(box);
  const copy = document.createElement('div');
  copy.textContent = `${box.value.slice(0, box.selectionEnd)}\u200b`;
  Object.assign(copy.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: `${box.clientWidth}px`,
    padding: style.padding,
    font: style.font,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  document.body.append(copy);
  const caretBottom = copy.scrollHeight - parseFloat(style.paddingBottom);
  copy.remove();
  if (caretBottom > box.scrollTop + box.clientHeight) box.scrollTop = caretBottom - box.clientHeight;
}

/** Put new text into the box and keep the caret where it was meant to be.
 *  Written to the box directly, so React finds nothing to change and leaves
 *  the caret alone. */
function place(box: HTMLTextAreaElement, text: string, caret: number) {
  box.value = text;
  box.setSelectionRange(caret, caret);
}

/** The box's text after a change, with a dash or a star typed at the start of
 *  a line shown at once as a bullet. The change is just behind the caret, so
 *  the caret moves back by however many characters went. */
export function typeBullets(event: ChangeEvent<HTMLTextAreaElement>): string {
  const box = event.currentTarget;
  const text = box.value.replace(TYPED_BULLET, `$1${BULLET}`);
  if (text !== box.value) place(box, text, Math.max(0, box.selectionStart - (box.value.length - text.length)));
  return text;
}

/** Enter on a bullet line starts the next line with a bullet, and Enter on an
 *  empty bullet ends the list. Any other key, or Enter anywhere else, types
 *  as usual. */
export function continueBullets(event: KeyboardEvent<HTMLTextAreaElement>, onText: (text: string) => void) {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  const box = event.currentTarget;
  const { value, selectionStart: at, selectionEnd } = box;
  const lineStart = value.lastIndexOf('\n', at - 1) + 1;
  const lineEnd = value.indexOf('\n', at) === -1 ? value.length : value.indexOf('\n', at);
  if (at !== selectionEnd || !value.slice(lineStart).startsWith(BULLET)) return;

  const empty = value.slice(lineStart, lineEnd) === BULLET;
  const text = empty ? value.slice(0, lineStart) + value.slice(lineEnd) : `${value.slice(0, at)}\n${BULLET}${value.slice(at)}`;
  if (text.length > box.maxLength && box.maxLength > 0) return;
  event.preventDefault();
  // A new bullet is typed through the browser, as a key would type it, so Undo
  // takes it back; its input event reports the text. A browser without the
  // command has the text placed directly. Either way the box then follows the
  // caret down, as it would for a typed line.
  if (empty || !document.execCommand('insertText', false, `\n${BULLET}`)) {
    place(box, text, empty ? lineStart : at + 1 + BULLET.length);
    onText(text);
  }
  showCaret(box);
}
