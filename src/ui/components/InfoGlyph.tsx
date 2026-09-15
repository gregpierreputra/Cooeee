/** The "i" inside an information ring, and beside the quieter notes. One
 *  drawing wherever information is offered, so the same mark always means the
 *  same thing. Decorative: the ring or the line beside it carries the name. */
export default function InfoGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
