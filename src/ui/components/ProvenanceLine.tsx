import type { ReactNode } from 'react';
import * as copy from '../../core/copy';
import { provenanceView } from '../../core/provenance';
import type { Source } from '../../core/types';
import Hint from './Hint';

/** One labelled fact. `detail` is a quieter second part, such as a date. */
export type SourceRow = { label: string; value: string; detail?: string };

/** The facts as a list of label and value pairs: the label small and quiet,
 *  the value at full strength, so each fact is found at a glance. */
function SourceRows({ rows }: { rows: SourceRow[] }) {
  return (
    <dl className="source-rows">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>
            {row.value}
            {row.detail ? <span className="source-detail"> · {row.detail}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Source as words that open the facts, as Not for you? does on Home, with
 *  any links beside it on one row. */
export function SourceText({ rows, links = null }: { rows: SourceRow[]; links?: ReactNode }) {
  return (
    <Hint className="hint source-row" label={copy.SOURCE_LABEL} asText titled={false} panelClass="source-panel" head={links}>
      <SourceRows rows={rows} />
    </Hint>
  );
}

type ProvenanceLineProps = {
  source: Source;
  now: number;
  /** More facts for the same panel, such as the licence or list date. */
  extra?: SourceRow[];
  /** Shows the facts open, for a screen whose whole job is the source. */
  open?: boolean;
  /** Links beside Source on its row, as on the pack page; none by default. */
  links?: ReactNode;
};

/** Who published an item and when it was saved. UAT: these lines crowded every
 *  card, so they sit behind Source, in words as Not for you? is on Home. */
export default function ProvenanceLine({ source, now, extra = [], open = false, links = null }: ProvenanceLineProps) {
  const view = provenanceView(now, source);
  const rows: SourceRow[] = [
    { label: copy.SOURCE_PUBLISHED_BY, value: view.publisher },
    { label: copy.SOURCE_SAVED, value: view.age, detail: view.savedOn },
    ...extra,
  ];
  return (
    <div className="provenance">
      {open ? <SourceRows rows={rows} /> : <SourceText rows={rows} links={links} />}
    </div>
  );
}
