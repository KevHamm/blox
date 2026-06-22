// A pragmatic, best-effort LaTeX → DocumentNode importer (the inverse of the
// backend exporter in backend/exporter.py). It targets the common subset — the
// constructs BLoX itself emits, plus ordinary hand-written articles/beamers —
// and *downgrades* anything it doesn't model to plain text rather than failing.
// Import is intentionally lossy: figures arrive as caption-only placeholders,
// inline $math$ is kept as text (BLoX's Greek/symbol glyphs reversed to unicode
// where cheap), unknown macros are stripped but their visible text is kept.
import type { DocumentNode } from "../types/document";
import type { Mark } from "./marks";
import { symbolFor } from "./greek";

const uid = () => crypto.randomUUID();

export type ParseResult = { cls: string; title: string; doc: DocumentNode; notes: string[] };

// ── Inline text ───────────────────────────────────────────────────────────
type Fmt = { b?: boolean; i?: boolean; u?: boolean };
type Footnote = { id: string; offset: number; text: string };
type Runs = { text: string; fmts: Fmt[]; footnotes: Footnote[] };

const ESCAPES: Record<string, string> = { "&": "&", "%": "%", "$": "$", "#": "#", "_": "_", "{": "{", "}": "}", " ": " " };
const ITALIC_CMDS = new Set(["textit", "emph", "textsl"]);
const PLAIN_WRAP = new Set(["textrm", "texttt", "textsf", "textsc", "textnormal", "mbox", "text", "mathrm"]);

// Read a balanced { … } group starting at/after `i` (leading spaces skipped).
// Returns the inner content and the index just past the closing brace.
function readGroup(src: string, i: number): { content: string; next: number; had: boolean } {
  let k = i;
  while (k < src.length && (src[k] === " " || src[k] === "\n" || src[k] === "\t")) k++;
  if (src[k] !== "{") return { content: "", next: i, had: false };
  let depth = 0;
  const start = k + 1;
  for (let j = k; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") { j++; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { content: src.slice(start, j), next: j + 1, had: true }; }
  }
  return { content: src.slice(start), next: src.length, had: true };
}

// Convert the body of an inline $ … $ to display text: a lone \cmd that names a
// known Greek letter / math symbol becomes its glyph; otherwise the inner LaTeX
// is kept literally (the braces are dropped).
function inlineMathToText(inner: string, notes: Set<string>): string {
  const m = inner.trim().match(/^\\([A-Za-z]+)$/);
  if (m) { const g = symbolFor(m[1]); if (g) return g; }
  notes.add("Inline math was kept as plain text.");
  return inner.trim();
}

// Parse a run of inline LaTeX into characters + per-character formatting +
// footnotes. Formatting nests (\textbf{a\textit{b}}) by OR-ing flags per char.
function parseRuns(src: string, notes: Set<string>): Runs {
  const chars: string[] = [];
  const fmts: Fmt[] = [];
  const footnotes: Footnote[] = [];
  const n = src.length;
  let i = 0;

  const appendInner = (inner: Runs, add?: keyof Fmt) => {
    const base = chars.length;
    for (let k = 0; k < inner.text.length; k++) {
      const f: Fmt = { ...inner.fmts[k] };
      if (add) f[add] = true;
      chars.push(inner.text[k]); fmts.push(f);
    }
    for (const fn of inner.footnotes) footnotes.push({ ...fn, offset: fn.offset + base });
  };

  while (i < n) {
    const c = src[i];
    if (c === "\\") {
      const nx = src[i + 1];
      if (nx === "\\") { chars.push("\n"); fmts.push({}); i += 2; continue; } // line break
      if (nx !== undefined && ESCAPES[nx] !== undefined && !/[A-Za-z]/.test(nx)) { chars.push(ESCAPES[nx]); fmts.push({}); i += 2; continue; }
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(src[j])) j++;
      const cmd = src.slice(i + 1, j);
      if (!cmd) { if (nx === " ") { chars.push(" "); fmts.push({}); } i += 2; continue; } // \, \; \! …
      if (cmd === "textbackslash") { chars.push("\\"); fmts.push({}); i = readGroup(src, j).had ? readGroup(src, j).next : j; continue; }
      if (cmd === "textasciitilde") { chars.push("~"); fmts.push({}); const g = readGroup(src, j); i = g.had ? g.next : j; continue; }
      if (cmd === "textasciicircum") { chars.push("^"); fmts.push({}); const g = readGroup(src, j); i = g.had ? g.next : j; continue; }
      if (cmd === "footnote") { const g = readGroup(src, j); footnotes.push({ id: uid(), offset: chars.length, text: parseInline(g.content, notes).text }); i = g.next; continue; }
      if (cmd === "cite" || cmd === "citep" || cmd === "citet" || cmd === "ref" || cmd === "label" || cmd === "eqref") {
        const g = readGroup(src, j); if (cmd.startsWith("cite")) notes.add("Citations (\\cite) were removed."); i = g.next; continue;
      }
      if (cmd === "textbf") { const g = readGroup(src, j); appendInner(parseRuns(g.content, notes), "b"); i = g.next; continue; }
      if (ITALIC_CMDS.has(cmd)) { const g = readGroup(src, j); appendInner(parseRuns(g.content, notes), "i"); i = g.next; continue; }
      if (cmd === "underline") { const g = readGroup(src, j); appendInner(parseRuns(g.content, notes), "u"); i = g.next; continue; }
      if (PLAIN_WRAP.has(cmd)) { const g = readGroup(src, j); appendInner(parseRuns(g.content, notes)); i = g.next; continue; }
      // Unknown command: keep a braced argument's text, drop a bare command.
      const g = readGroup(src, j);
      if (g.had) { appendInner(parseRuns(g.content, notes)); i = g.next; continue; }
      i = j; if (src[i] === " ") i++; // a control word swallows one trailing space
      continue;
    }
    if (c === "$") {
      let j = i + 1;
      while (j < n && src[j] !== "$") { if (src[j] === "\\") j++; j++; }
      for (const ch of inlineMathToText(src.slice(i + 1, j), notes)) { chars.push(ch); fmts.push({}); }
      i = j < n ? j + 1 : j;
      continue;
    }
    if (c === "~") { chars.push(" "); fmts.push({}); i++; continue; }
    if (c === "\n" || c === "\t") {
      chars.push(" "); fmts.push({}); i++;
      while (i < n && (src[i] === " " || src[i] === "\t" || src[i] === "\n")) i++;
      continue;
    }
    chars.push(c); fmts.push({}); i++;
  }
  return { text: chars.join(""), fmts, footnotes };
}

function fmtsToMarks(fmts: Fmt[]): Mark[] {
  const marks: Mark[] = [];
  let i = 0;
  while (i < fmts.length) {
    const f = fmts[i];
    if (!f.b && !f.i && !f.u) { i++; continue; }
    let j = i + 1;
    while (j < fmts.length && !!fmts[j].b === !!f.b && !!fmts[j].i === !!f.i && !!fmts[j].u === !!f.u) j++;
    marks.push({ start: i, end: j, ...(f.b ? { b: true } : {}), ...(f.i ? { i: true } : {}), ...(f.u ? { u: true } : {}) });
    i = j;
  }
  return marks;
}

function parseInline(src: string, notes: Set<string>): { text: string; marks: Mark[]; footnotes: Footnote[] } {
  const r = parseRuns(src, notes);
  return { text: r.text.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim(), marks: fmtsToMarks(r.fmts), footnotes: r.footnotes };
}

const inlineText = (src: string, notes: Set<string>) => parseInline(src, notes).text;

function paragraphNode(src: string, notes: Set<string>): DocumentNode | null {
  const { text, marks, footnotes } = parseInline(src, notes);
  if (!text.trim()) return null;
  const node: DocumentNode = { id: uid(), type: "paragraph", text };
  if (marks.length) node.marks = marks;
  if (footnotes.length) node.footnotes = footnotes;
  return node;
}

// ── Block scanning ─────────────────────────────────────────────────────────
const BLOCK_CMDS = new Set(["section", "subsection", "subsubsection", "chapter", "part",
  "maketitle", "tableofcontents", "bibliography", "bibliographystyle", "newpage", "clearpage", "item"]);

function stripComments(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\\") {
      // Verbatim-like environments are copied through untouched — `%` is literal
      // there, not a comment.
      const m = s.startsWith("\\begin{", i) ? /^\\begin\{(verbatim|lstlisting|minted|Verbatim)\}/.exec(s.slice(i)) : null;
      if (m) {
        const endTok = `\\end{${m[1]}}`;
        const end = s.indexOf(endTok, i + m[0].length);
        const stop = end < 0 ? s.length : end + endTok.length;
        out += s.slice(i, stop);
        i = stop - 1;
        continue;
      }
      out += c + (s[i + 1] ?? ""); i++; continue;
    }
    if (c === "%") { while (i < s.length && s[i] !== "\n") i++; out += "\n"; continue; }
    out += c;
  }
  return out;
}

// Strip exactly one leading + one trailing newline (how verbatim/code content is
// wrapped on export), keeping all interior whitespace.
const trimVerbatim = (s: string) => s.replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");

function envBody(src: string, env: string, from: number): { body: string; next: number } {
  const open = `\\begin{${env}}`, close = `\\end{${env}}`;
  let depth = 1, i = from;
  while (i < src.length) {
    const b = src.indexOf(open, i), e = src.indexOf(close, i);
    if (e < 0) return { body: src.slice(from), next: src.length };
    if (b >= 0 && b < e) { depth++; i = b + open.length; }
    else { depth--; if (depth === 0) return { body: src.slice(from, e), next: e + close.length }; i = e + close.length; }
  }
  return { body: src.slice(from), next: src.length };
}

// Split a string on a top-level (brace-depth-0) separator — a plain char like
// "&" or a command like "\\item" / a row break "\\\\". A letter-ending token
// (\item) must be followed by a non-letter so it doesn't catch \itemize.
function splitTop(src: string, token: string): string[] {
  const parts: string[] = [];
  const tokAlpha = /[A-Za-z]/.test(token[token.length - 1]);
  let depth = 0, last = 0;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (depth === 0 && src.startsWith(token, i)) {
      const after = src[i + token.length];
      if (!(tokAlpha && after !== undefined && /[A-Za-z]/.test(after))) {
        parts.push(src.slice(last, i)); i += token.length - 1; last = i + 1; continue;
      }
    }
    if (c === "\\") { i++; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
  }
  parts.push(src.slice(last));
  return parts;
}

function parseList(env: string, content: string, notes: Set<string>): DocumentNode {
  let style: "dash" | "dot" | "number" = env === "enumerate" ? "number" : "dot";
  const items: { id: string; text: string }[] = [];
  const parts = splitTop(content, "\\item");
  for (let k = 1; k < parts.length; k++) {
    let p = parts[k];
    const lbl = p.match(/^\s*\[([^\]]*)\]/);
    if (lbl) { if (env !== "enumerate" && lbl[1].includes("-")) style = "dash"; p = p.slice(lbl[0].length); }
    const t = inlineText(p, notes).trim();
    if (t) items.push({ id: uid(), text: t });
  }
  return { id: uid(), type: "list", listStyle: style, items };
}

function parseTable(content: string, notes: Set<string>): DocumentNode | null {
  const tb = content.match(/\\begin\{tabular\}/);
  if (!tb || tb.index === undefined) return paragraphNode(content, notes);
  const after = tb.index + tb[0].length;
  // Drop a leading [pos] and the {colspec} argument.
  let i = after;
  while (i < content.length && content[i] === " ") i++;
  if (content[i] === "[") { const e = content.indexOf("]", i); if (e >= 0) i = e + 1; }
  const spec = readGroup(content, i); i = spec.next;
  const body = envBody(content, "tabular", i).body;
  const rows: string[][] = [];
  for (const rawRow of splitTop(body, "\\\\")) {
    const cleaned = rawRow.replace(/\\hline/g, "").trim();
    if (!cleaned) continue;
    const cells = splitTop(cleaned, "&").map((cell) => inlineText(cell.replace(/\\cellcolor\{[^}]*\}/g, ""), notes).trim());
    if (cells.some((c) => c.length) || rows.length) rows.push(cells);
  }
  if (!rows.length) return null;
  const cols = Math.max(...rows.map((r) => r.length));
  const norm = rows.map((r) => { const c = r.slice(); while (c.length < cols) c.push(""); return c; });
  if (/\\cellcolor/.test(body)) notes.add("Table cell colours were dropped.");
  const node: DocumentNode = { id: uid(), type: "table", rows: norm };
  const cap = content.match(/\\caption\{/);
  if (cap && cap.index !== undefined) node.caption = inlineText(readGroup(content, cap.index + cap[0].length - 1).content, notes);
  return node;
}

function parseFigure(content: string, notes: Set<string>): DocumentNode {
  notes.add("Figures were imported as captions only (images aren't carried over).");
  const node: DocumentNode = { id: uid(), type: "figure", width: 1, images: [] };
  const cap = content.match(/\\caption\{/);
  node.caption = cap && cap.index !== undefined ? inlineText(readGroup(content, cap.index + cap[0].length - 1).content, notes) : "";
  return node;
}

function mathNode(latex: string): DocumentNode {
  return { id: uid(), type: "math", display: true, items: [{ id: uid(), latex: latex.trim() }] };
}

export function parseLatex(tex: string): ParseResult {
  const notes = new Set<string>();
  const src0 = stripComments(tex || "");

  // Preamble (before \begin{document}) → class + title.
  const docStart = src0.indexOf("\\begin{document}");
  const preamble = docStart >= 0 ? src0.slice(0, docStart) : src0;
  const clsMatch = preamble.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
  let cls = ({ article: "article", report: "report", book: "book", letter: "letter", beamer: "beamer" } as Record<string, string>)[(clsMatch?.[1] || "").trim()] || "article";

  const docEnd = src0.indexOf("\\end{document}");
  let body = docStart >= 0 ? src0.slice(docStart + "\\begin{document}".length, docEnd >= 0 ? docEnd : undefined) : src0;
  if (/\\begin\{frame\}/.test(body)) cls = "beamer";

  let title = "";
  const titleM = preamble.match(/\\title\{/) || body.match(/\\title\{/);
  const titleSrc = preamble.match(/\\title\{/) ? preamble : body;
  if (titleM && titleM.index !== undefined) title = inlineText(readGroup(titleSrc, titleM.index + titleM[0].length - 1).content, notes);

  // Build the tree with a nesting cursor.
  const root: DocumentNode = { id: uid(), type: "document", children: [] };
  let curSection: DocumentNode | null = null, curSub: DocumentNode | null = null, curSubsub: DocumentNode | null = null;
  const push = (n: DocumentNode) => { (curSubsub ?? curSub ?? curSection ?? root).children!.push(n); };
  const pushRoot = (n: DocumentNode) => { root.children!.push(n); };

  function heading(level: number, titleText: string) {
    if (level === 0) { const n: DocumentNode = { id: uid(), type: "section", title: titleText, children: [] }; root.children!.push(n); curSection = n; curSub = null; curSubsub = null; }
    else if (level === 1) { const n: DocumentNode = { id: uid(), type: "subsection", title: titleText, children: [] }; (curSection ?? root).children!.push(n); curSub = n; curSubsub = null; }
    else { const n: DocumentNode = { id: uid(), type: "subsubsection", title: titleText, children: [] }; (curSub ?? curSection ?? root).children!.push(n); curSubsub = n; }
  }

  // Parse a contained run of blocks (frame bodies, unknown envs) into a flat list
  // — these never carry sectioning.
  function parseInner(inner: string): DocumentNode[] {
    const out: DocumentNode[] = [];
    walk(inner, (n) => out.push(n), () => {});
    return out;
  }

  // Core scanner. `emit` receives leaf/structural nodes; `onHeading` handles
  // sectioning (no-op for contained scans).
  function walk(s: string, emit: (n: DocumentNode) => void, onHeading: (level: number, t: string) => void) {
    let i = 0;
    const n = s.length;
    const skipWs = (k: number) => { while (k < n && (s[k] === " " || s[k] === "\n" || s[k] === "\t")) k++; return k; };
    while (i < n) {
      i = skipWs(i);
      if (i >= n) break;

      if (s.startsWith("\\begin{", i)) {
        const g = readGroup(s, i + "\\begin".length);
        const env = g.content.trim();
        const eb = envBody(s, env, g.next);
        const inner = eb.body;
        i = eb.next;
        if (env === "abstract") { const node: DocumentNode = { id: uid(), type: "abstract", text: inlineText(inner, notes) }; emit(node); }
        else if (env === "itemize" || env === "enumerate") emit(parseList(env, inner, notes));
        else if (env === "table" || env === "tabular") { const t = parseTable(env === "tabular" ? `\\begin{tabular}${inner}\\end{tabular}` : inner, notes); if (t) emit(t); }
        else if (env === "figure") emit(parseFigure(inner, notes));
        else if (["equation", "equation*", "align", "align*", "displaymath", "eqnarray", "gather", "multline"].includes(env)) emit(mathNode(inner));
        else if (env === "verbatim" || env === "Verbatim") emit({ id: uid(), type: "verbatim", text: trimVerbatim(inner) });
        else if (env === "lstlisting" || env === "minted") {
          let rest = inner, lang = "text";
          const optM = /^\s*\[([^\]]*)\]/.exec(rest);          // lstlisting [language=…]
          const braceM = /^\s*\{([^}]*)\}/.exec(rest);          // minted {lang}
          if (optM) { const lm = /language\s*=\s*\{?([A-Za-z0-9+#.]+)\}?/i.exec(optM[1]); if (lm) lang = lm[1]; rest = rest.slice(optM[0].length); }
          else if (env === "minted" && braceM) { lang = braceM[1].trim() || "text"; rest = rest.slice(braceM[0].length); }
          emit({ id: uid(), type: "code", language: lang, text: trimVerbatim(rest) });
        }
        else if (env === "center") { const p = paragraphNode(inner, notes); if (p) { p.align = "center"; emit(p); } }
        else if (env === "titlepage") { const t = inlineText(inner, notes).split("\n").map((l) => l.trim()).find((l) => l.length) || "Cover Page"; if (!title) title = t; emit({ id: uid(), type: "coverpage", title: t }); }
        else if (env === "thebibliography") emit({ id: uid(), type: "bibliography", title: "Bibliography" });
        else if (env === "frame") emit(parseFrame(inner));
        else for (const node of parseInner(inner)) emit(node);
        continue;
      }
      if (s.startsWith("\\[", i)) { const e = s.indexOf("\\]", i + 2); emit(mathNode(s.slice(i + 2, e < 0 ? n : e))); i = e < 0 ? n : e + 2; continue; }
      if (s.startsWith("$$", i)) { const e = s.indexOf("$$", i + 2); emit(mathNode(s.slice(i + 2, e < 0 ? n : e))); i = e < 0 ? n : e + 2; continue; }

      if (s[i] === "\\" && /[A-Za-z]/.test(s[i + 1] ?? "")) {
        let j = i + 1; while (j < n && /[A-Za-z]/.test(s[j])) j++;
        const cmd = s.slice(i + 1, j);
        let k = j; if (s[k] === "*") k++; // starred forms
        if (cmd === "section" || cmd === "chapter" || cmd === "part") { const g = readGroup(s, k); onHeading(0, inlineText(g.content, notes)); i = g.next; continue; }
        if (cmd === "subsection") { const g = readGroup(s, k); onHeading(1, inlineText(g.content, notes)); i = g.next; continue; }
        if (cmd === "subsubsection") { const g = readGroup(s, k); onHeading(2, inlineText(g.content, notes)); i = g.next; continue; }
        if (cmd === "tableofcontents") { emit({ id: uid(), type: "toc", title: "Table of Contents" }); i = k; continue; }
        if (cmd === "bibliography" || cmd === "bibliographystyle") { const g = readGroup(s, k); if (cmd === "bibliography") emit({ id: uid(), type: "bibliography", title: "Bibliography" }); i = g.next; continue; }
        if (cmd === "title") { const g = readGroup(s, k); if (!title) title = inlineText(g.content, notes); i = g.next; continue; }
        if (BLOCK_CMDS.has(cmd) || cmd === "frametitle" || cmd === "titlepage" || cmd === "author" || cmd === "date" || cmd === "centering" || cmd === "noindent" || cmd === "par" || cmd === "vfill" || cmd === "vspace" || cmd === "bigskip" || cmd === "medskip" || cmd === "smallskip") {
          // Structural/ignored commands consume an optional argument and move on.
          const g = readGroup(s, k); i = g.had ? g.next : k; continue;
        }
        // else: an inline command begins a paragraph — fall through.
      }

      // Paragraph: accumulate to the next blank line or block-level construct.
      let j = i;
      while (j < n) {
        if (s[j] === "\n") { let p = j + 1; while (p < n && (s[p] === " " || s[p] === "\t")) p++; if (p >= n || s[p] === "\n") break; }
        if (s.startsWith("\\begin{", j) || s.startsWith("\\[", j) || s.startsWith("$$", j) || s.startsWith("\\end{", j)) break;
        if (s[j] === "\\" && /[A-Za-z]/.test(s[j + 1] ?? "")) { let q = j + 1; while (q < n && /[A-Za-z]/.test(s[q])) q++; if (BLOCK_CMDS.has(s.slice(j + 1, q))) break; }
        j++;
      }
      const raw = s.slice(i, j);
      if (j <= i) { i++; continue; }
      const node = paragraphNode(raw, notes);
      if (node) emit(node);
      i = j;
    }
  }

  function parseFrame(inner: string): DocumentNode {
    let rest = inner; let plain = false;
    const opt = rest.match(/^\s*\[([^\]]*)\]/); if (opt) { plain = /plain/.test(opt[1]); rest = rest.slice(opt[0].length); }
    let frameTitle = "";
    const argT = readGroup(rest, 0); if (argT.had) { frameTitle = inlineText(argT.content, notes); rest = rest.slice(argT.next); }
    const ftM = rest.match(/\\frametitle\{/); if (!frameTitle && ftM && ftM.index !== undefined) frameTitle = inlineText(readGroup(rest, ftM.index + ftM[0].length - 1).content, notes);
    const isTitle = plain || /\\titlepage/.test(rest);
    const children = parseInner(rest.replace(/\\frametitle\{[^}]*\}/, "").replace(/\\titlepage/g, ""));
    const node: DocumentNode = { id: uid(), type: "frame", title: frameTitle || (isTitle ? title : "Slide"), children };
    if (isTitle) node.frameVariant = "title";
    return node;
  }

  // Special pages / frames / bibliography / abstract live at the document root;
  // everything else nests under the current heading.
  walk(body, (node) => {
    if (node.type === "coverpage" || node.type === "toc" || node.type === "bibliography" || node.type === "frame") pushRoot(node);
    else push(node);
  }, heading);

  return { cls, title, doc: root, notes: [...notes] };
}
