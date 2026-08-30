import * as copy from '../../core/copy';
import { provenanceView } from '../../core/provenance';
import type { Source } from '../../core/types';

export default function ProvenanceLine({ source, now }: { source: Source; now: number }) {
  const view = provenanceView(now, source);
  return (
    <div className="provenance">
      <p>{view.publisherLine}</p>
      <p className="figure">{view.ageLine}</p>
      {view.stale ? (
        <div className="stale-note">
          <p>{copy.NOT_RECENTLY_VERIFIED_LABEL}</p>
          <p>{copy.STALE_PACK_STILL_WORKS}</p>
        </div>
      ) : null}
    </div>
  );
}
