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
    </main>
  );
}
