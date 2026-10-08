/** A line typed as a bullet: "- ", "• " or "* " at its start. */
const BULLET = /^\s*[-•*]\s+/;

type Block = { list: boolean; lines: string[] };

/** A note as the user typed it. Runs of bullet lines show as a list, every
 *  other line as written. Plain text throughout, so nothing in a note is ever
 *  read as markup. */
export default function NoteText({ text }: { text: string }) {
  const blocks: Block[] = [];
  for (const line of text.split('\n')) {
    const list = BULLET.test(line);
    const shown = list ? line.replace(BULLET, '') : line;
    const last = blocks.at(-1);
    if (last && last.list === list) last.lines.push(shown);
    else blocks.push({ list, lines: [shown] });
  }
  return blocks.map((block, index) =>
    block.list ? (
      <ul key={index} className="note-list">
        {block.lines.map((line, row) => (
          <li key={row}>{line}</li>
        ))}
      </ul>
    ) : (
      <span key={index} className="note-lines">
        {block.lines.join('\n')}
      </span>
    ),
  );
}
