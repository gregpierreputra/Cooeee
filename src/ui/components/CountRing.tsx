/** A ring that fills as items are done or chosen, with the count inside it. */
export default function CountRing({ count, total, label }: { count: number; total: number; label: string }) {
  const r = 20;
  const length = 2 * Math.PI * r;
  return (
    <svg className="chosen-ring" viewBox="0 0 48 48" role="img" aria-label={label}>
      <circle className="chosen-ring-track" cx="24" cy="24" r={r} />
      <circle
        className="chosen-ring-fill"
        cx="24"
        cy="24"
        r={r}
        strokeDasharray={length}
        strokeDashoffset={length * (1 - count / total)}
      />
      <text x="24" y="24" dominantBaseline="central" textAnchor="middle" aria-hidden="true">
        {count}/{total}
      </text>
    </svg>
  );
}
