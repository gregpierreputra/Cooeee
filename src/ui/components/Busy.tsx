/** A small turning arc, as the app's own mark draws one, that says work is
 *  under way. It is a picture only: the words beside it say what the work is,
 *  and with reduced motion it simply holds still. */
export default function Busy({ size = 18 }: { size?: number }) {
  return (
    <svg className="busy" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
