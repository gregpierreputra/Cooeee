import * as copy from '../core/copy';
import Glyph from './components/Glyph';

/** What Cooeee is, on one card, in the same led lines as the BlackSky panel on
 *  the home screen. Reached from the bottom bar on every screen. Nothing here
 *  is fetched or asked for. */
export default function About() {
  return (
    <main className="page about">
      <section className="card">
        <span className="kicker">{copy.ABOUT_COOEEE}</span>
        <ul className="info-lines">
          {copy.COOEEE_INFO_LINES.map((line) => (
            <li key={line.glyph}>
              <Glyph kind={line.glyph} />
              <div>
                <h2 className="about-line-title">{line.title}</h2>
                <p>{line.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {/* BS_Enhancement-AC5: the road layer is published under CC BY 4.0, which
          asks for this attribution wherever the roads are shown. BlackSky
          itself has no room for it, so it stands here, a tap away. */}
      <p className="muted about-attribution">{copy.ROADS_ATTRIBUTION}</p>
      <p className="muted about-attribution">{copy.LOCALITIES_ATTRIBUTION}</p>
    </main>
  );
}
