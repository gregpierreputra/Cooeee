/** The Cooeee mark: a call going out — a dot with the sound travelling away
 *  from it in arcs. Drawn once here so the landing screen and anywhere else
 *  that shows the mark show the same glyph, at whatever size is asked for, in
 *  whatever colour the surrounding text is in.
 *
 *  Inline, so it needs no request and is part of the shell that works with no
 *  network at all. Decorative in every position it is used: the name is always
 *  beside it in text, so it is hidden from assistive technology. */
export default function Mark({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6.5" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M12.25 8.4a5.5 5.5 0 0 1 0 7.2" />
      <path d="M16.25 5.1a10.5 10.5 0 0 1 0 13.8" />
    </svg>
  );
}
