/**
 * A tiny, dependency-free markdown renderer for the assistant's prose.
 *
 * Deliberately narrow: paragraphs, headings, **bold**, `code`, bullet lists and
 * GitHub tables — which is the whole of what the agent writes. Result grids,
 * charts and cards are rendered as real components elsewhere, so this only ever
 * handles the written reply.
 *
 * `skipTables` drops markdown tables: when the same rows are already on screen
 * as an interactive grid, the model's restated copy is pure duplication.
 *
 * `cites` turns the file-citation markers an answer from documents carries
 * (`[S3]`, `[S1, S4]`, `[S1/S5]`) into small numbers that open the cited file.
 * Without it they stay as written.
 */
import type { ReactNode } from "react";
import { ScrollX } from "../components/ScrollX";

/** A file citation an answer refers to by key (`[S3]`): the number shown, the file and the quoted words. */
export interface Cite {
  n: number;
  title: string;
  quote?: string | null;
  onOpen?: () => void;
}
export type Cites = Record<string, Cite>;

// The separators InventDB's citation check accepts (routes/ai/citations.rs); keep the two in step.
const CITE = String.raw`\[\s*S\d+(?:\s*(?:[,;/&]|and)\s*S\d+)*\s*\]`;
const CITE_RE = new RegExp(`^${CITE}$`);

/** A citation marker as numbers that open the cited file. A key with no source behind it is dropped. */
function CiteMarker({ token, cites }: { token: string; cites: Cites }) {
  const keys = Array.from(new Set(token.match(/S\d+/g) || [])).filter((k) => cites[k]);
  if (!keys.length) return null;
  return (
    <sup className="an-cite-group">
      {keys.map((k) => {
        const c = cites[k];
        const tip = c.quote ? `${c.title}\n“${c.quote}”` : c.title;
        return c.onOpen ? (
          <button key={k} type="button" className="an-cite" title={tip} onClick={c.onOpen}>
            {c.n}
          </button>
        ) : (
          <span key={k} className="an-cite" title={tip}>
            {c.n}
          </span>
        );
      })}
    </sup>
  );
}

/**
 * Markdown backslash escapes (`\"`, `\*`, `\[`) show the character alone. A
 * model quoting a passage that holds quotes writes them escaped, and the
 * backslashes were shown.
 */
const unescapeMd = (s: string) => s.replace(/\\([\\`*_{}[\]()#+\-.!"'|<>~])/g, "$1");

function inline(text: string, cites?: Cites): ReactNode[] {
  const out: ReactNode[] = [];
  // `**bold**` is tried before `*italic*` so a bold run is never read as two
  // italics; the agent sets a quoted citation line in *...*.
  const re = new RegExp(`(${CITE}|\\*\\*[^*]+\\*\\*|\\*[^*\\n]+\\*|\`[^\`]+\`)`, "g");
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(unescapeMd(text.slice(last, m.index)));
    const token = m[0];
    if (CITE_RE.test(token)) {
      out.push(cites ? <CiteMarker key={key++} token={token} cites={cites} /> : token);
    } else if (token.startsWith("**")) {
      out.push(<strong key={key++}>{inline(token.slice(2, -2), cites)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={key++}>{inline(token.slice(1, -1), cites)}</em>);
    } else {
      out.push(
        <code key={key++} className="an-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(unescapeMd(text.slice(last)));
  return out;
}

export function Markdown({
  text,
  skipTables,
  cites,
}: {
  text: string;
  skipTables?: boolean;
  cites?: Cites;
}) {
  const il = (t: string) => inline(t, cites);
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Table: a row containing pipes, followed by a `---` separator row.
    if (
      /\|/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      if (skipTables) {
        i += 2;
        while (i < lines.length && lines[i].includes("|")) i++;
        continue;
      }
      const header = line
        .split("|")
        .map((s) => s.trim())
        .filter(
          (_, idx, arr) =>
            !(idx === 0 && arr[0] === "") &&
            !(idx === arr.length - 1 && arr[arr.length - 1] === "")
        );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i].split("|").map((s) => s.trim());
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        rows.push(cells);
        i++;
      }
      blocks.push(
        <ScrollX className="an-table-wrap" key={key++}>
          <table className="an-table">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi}>{il(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{il(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      );
      continue;
    }

    // Bullet list.
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul className="an-list" key={key++}>
          {items.map((it, ii) => (
            <li key={ii}>{il(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol className="an-list" key={key++}>
          {items.map((it, ii) => (
            <li key={ii}>{il(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Block quote: the agent sets a passage it quotes from a file on "> " lines.
    if (/^\s*>/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote className="an-quote" key={key++}>
          {il(quoted.join(" "))}
        </blockquote>
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) {
      blocks.push(
        <p className="an-heading" key={key++}>
          {il(heading[2])}
        </p>
      );
      i++;
      continue;
    }

    // Paragraph: gather consecutive lines that start nothing else.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !lines[i].includes("|") &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p className="an-para" key={key++}>
        {il(para.join(" "))}
      </p>
    );
  }

  return <div className="an-md">{blocks}</div>;
}
