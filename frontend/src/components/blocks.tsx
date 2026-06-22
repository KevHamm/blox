import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  newSection,
  newSubsection,
  newSubsubsection,
  newPage,
  newAbstract,
  newList,
  newEquation,
  newVerbatim,
  newCode,
  mathNode,
  MATH_TEMPLATES,
  ARROW_COMMANDS,
  SYMBOL_COMMANDS,
  BINOP_COMMANDS,
  DELIMITER_BLOCKS,
  NUMBER_SET_BLOCKS
} from "../utils/docTree";

/* A KaTeX-rendered glyph for the Blox palette icons. */
export function KatexIcon({ tex, size = 22 }: { tex: string; size?: number }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false }),
    [tex]
  );
  return (
    <span
      style={{ fontSize: size, lineHeight: 1, color: "var(--glyph)" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/* Small line-art table icon for the Blox palette. */
export function TableGlyph() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </svg>
  );
}

// A heading glyph for the structural Blox items; the bar shrinks with depth.
export function HeadingGlyph({ level }: { level: number }) {
  const headW = level === 1 ? 26 : level === 2 ? 20 : 15;
  const headH = level === 1 ? 6 : level === 2 ? 5 : 4;
  const y2 = 4 + headH + 5;
  return (
    <svg width="34" height="30" viewBox="0 0 34 30">
      <rect x="4" y="4" width={headW} height={headH} rx="1" fill="currentColor" />
      <rect x="4" y={y2} width="26" height="2.5" rx="1" fill="currentColor" opacity="0.45" />
      <rect x="4" y={y2 + 5} width="26" height="2.5" rx="1" fill="currentColor" opacity="0.45" />
    </svg>
  );
}

// A page glyph (a sheet) with type-specific content lines.
export function PageGlyph({ kind }: { kind: "coverpage" | "toc" | "bibliography" }) {
  return (
    <svg width="30" height="34" viewBox="0 0 30 34">
      <rect x="3" y="2" width="24" height="30" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5" />
      {kind === "coverpage" && (
        <>
          <rect x="8" y="12" width="14" height="3.5" rx="1" fill="currentColor" />
          <rect x="10" y="18" width="10" height="2" rx="1" fill="currentColor" opacity="0.5" />
        </>
      )}
      {kind === "toc" && [8, 13, 18, 23].map((y) => (
        <g key={y}>
          <rect x="7" y={y} width="9" height="2" rx="1" fill="currentColor" opacity="0.7" />
          <rect x="20" y={y} width="3" height="2" rx="1" fill="currentColor" opacity="0.4" />
        </g>
      ))}
      {kind === "bibliography" && [9, 15, 21].map((y) => (
        <g key={y}>
          <rect x="7" y={y} width="16" height="2" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="9" y={y + 3} width="12" height="2" rx="1" fill="currentColor" opacity="0.35" />
        </g>
      ))}
    </svg>
  );
}

/* A page glyph filled with solid text blocks, in one or two columns. */
export function LayoutIcon({ columns }: { columns: number }) {
  const pageW = 40, pageH = 50, pad = 6, top = 7, lineH = 3, gap = 3, rows = 6;
  const bars: any[] = [];
  if (columns === 1) {
    const w = pageW - pad * 2;
    for (let i = 0; i < rows; i++)
      bars.push(<rect key={i} x={pad} y={top + i * (lineH + gap)} width={w} height={lineH} rx={1} fill="currentColor" />);
  } else {
    const colW = (pageW - pad * 3) / 2;
    for (const c of [0, 1]) {
      const x = pad + c * (colW + pad);
      for (let i = 0; i < rows; i++)
        bars.push(<rect key={`${c}-${i}`} x={x} y={top + i * (lineH + gap)} width={colW} height={lineH} rx={1} fill="currentColor" />);
    }
  }
  return (
    <svg width={pageW} height={pageH} viewBox={`0 0 ${pageW} ${pageH}`}>
      <rect x={0.5} y={0.5} width={pageW - 1} height={pageH - 1} rx={3} fill="white" stroke="currentColor" strokeWidth={1} />
      {bars}
    </svg>
  );
}

// An abstract glyph: a centered heading bar over a justified block.
export function AbstractGlyph() {
  return (
    <svg width="32" height="30" viewBox="0 0 32 30">
      <rect x="11" y="3" width="10" height="3" rx="1" fill="currentColor" />
      {[10, 14, 18, 22].map((y) => (
        <rect key={y} x="4" y={y} width="24" height="2" rx="1" fill="currentColor" opacity="0.45" />
      ))}
    </svg>
  );
}

// A bulleted-list glyph.
export function ListGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="5" cy="7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.3" fill="currentColor" stroke="none" />
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
    </svg>
  );
}

// Code glyph: angle brackets around a slash (</>).
export function CodeGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 8 4 12 8 16" />
      <polyline points="16 8 20 12 16 16" />
      <line x1="13.5" y1="6" x2="10.5" y2="18" />
    </svg>
  );
}

// Verbatim glyph: monospace lines of even width inside a faint frame.
export function VerbatimGlyph() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="16" rx="1.5" opacity="0.4" />
      <line x1="6" y1="9" x2="14" y2="9" />
      <line x1="6" y1="12" x2="18" y2="12" />
      <line x1="6" y1="15" x2="11" y2="15" />
    </svg>
  );
}

// A footnote glyph: a text line with a superscript marker and a rule + note.
export function FootnoteGlyph() {
  return (
    <svg width="32" height="30" viewBox="0 0 32 30">
      <rect x="4" y="5" width="16" height="2.5" rx="1" fill="currentColor" opacity="0.7" />
      <text x="21" y="7" fontSize="7" fill="currentColor" fontFamily="serif">1</text>
      <line x1="4" y1="18" x2="14" y2="18" stroke="currentColor" strokeWidth="1" />
      <text x="4" y="27" fontSize="6" fill="currentColor" fontFamily="serif">¹ note</text>
    </svg>
  );
}

// Line-art glyphs for the free-form shape Blox (line / arrow / rectangle / circle).
export function ShapeGlyph({ kind }: { kind: "line" | "arrow" | "rect" | "circle" }) {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {kind === "line" && <line x1="4" y1="20" x2="20" y2="4" />}
      {kind === "arrow" && (
        <>
          <line x1="4" y1="20" x2="19" y2="5" />
          <polyline points="11 5 19 5 19 13" />
        </>
      )}
      {kind === "rect" && <rect x="4" y="6" width="16" height="12" rx="1" />}
      {kind === "circle" && <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

const mathBlock = (id: string, label: string, iconTex: string, iconSize = 22) => ({
  label,
  icon: () => <KatexIcon tex={iconTex} size={iconSize} />,
  make: () => mathNode(MATH_TEMPLATES[id])
});

// Blox palette: block id → label, palette icon and a fresh-node factory.
export const BLOCK_DEFS: Record<string, { label: string; icon: () => any; make: () => any }> = {
  "block::section":       { label: "Section",       icon: () => <HeadingGlyph level={1} />, make: () => newSection() },
  "block::subsection":    { label: "Subsection",    icon: () => <HeadingGlyph level={2} />, make: () => newSubsection() },
  "block::subsubsection": { label: "Subsubsection", icon: () => <HeadingGlyph level={3} />, make: () => newSubsubsection() },
  "block::abstract":      { label: "Abstract",      icon: () => <AbstractGlyph />,          make: () => newAbstract() },
  "block::footnote":      { label: "Footnote",      icon: () => <FootnoteGlyph />,          make: () => null },
  "block::list":          { label: "List",          icon: () => <ListGlyph />,              make: () => newList() },
  "block::table": {
    label: "Table",
    icon: () => <TableGlyph />,
    make: () => ({
      id: crypto.randomUUID(),
      type: "table",
      rows: Array.from({ length: 3 }, (_, r) =>
        Array.from({ length: 3 }, (_, c) => (r === 0 ? `Column ${c + 1}` : ""))
      )
    })
  },
  "block::verbatim": { label: "Verbatim", icon: () => <VerbatimGlyph />, make: () => newVerbatim() },
  "block::code":      { label: "Code",     icon: () => <CodeGlyph />,     make: () => newCode() },
  "block::equation": {
    label: "Equation",
    icon: () => <KatexIcon tex="a=b" size={18} />,
    make: () => newEquation()
  },
  "block::math::integral": mathBlock("block::math::integral", "Integral", "\\int"),
  "block::math::oint":     mathBlock("block::math::oint", "Contour integral", "\\oint"),
  "block::math::lim":      mathBlock("block::math::lim", "Limit", "\\lim"),
  "block::math::sum":      mathBlock("block::math::sum", "Sum", "\\sum"),
  "block::math::product":  mathBlock("block::math::product", "Product", "\\prod"),
  "block::math::fraction": mathBlock("block::math::fraction", "Fraction", "\\frac{a}{b}"),
  "block::math::matrix":   mathBlock("block::math::matrix", "Matrix", "\\left[\\begin{smallmatrix}a&b\\\\c&d\\end{smallmatrix}\\right]", 15),

  "block::page::cover":        { label: "Cover Page",        icon: () => <PageGlyph kind="coverpage" />,    make: () => newPage("coverpage") },
  "block::page::toc":          { label: "Contents",          icon: () => <PageGlyph kind="toc" />,          make: () => newPage("toc") },
  "block::page::bibliography": { label: "Bibliography",       icon: () => <PageGlyph kind="bibliography" />, make: () => newPage("bibliography") },

  // Free-form shapes — dropped anywhere on a page (handled specially in App;
  // `make` returns null because shapes live on doc.shapes, not in the tree).
  "block::shape::line":   { label: "Line",      icon: () => <ShapeGlyph kind="line" />,   make: () => null },
  "block::shape::arrow":  { label: "Arrow",     icon: () => <ShapeGlyph kind="arrow" />,  make: () => null },
  "block::shape::rect":   { label: "Rectangle", icon: () => <ShapeGlyph kind="rect" />,   make: () => null },
  "block::shape::circle": { label: "Circle",    icon: () => <ShapeGlyph kind="circle" />, make: () => null }
};

// The shapes Blox category (free-form overlay graphics).
export const SHAPE_ORDER = [
  "block::shape::line",
  "block::shape::arrow",
  "block::shape::rect",
  "block::shape::circle"
];

// Math-symbol Blox render their glyph as the icon (shown label-less and larger
// in the sidebar). Each inserts a math node containing the command.
const SYMBOL_ICON_SIZE = 24;
for (const c of ARROW_COMMANDS) {
  BLOCK_DEFS[`block::math::${c}`] = mathBlock(`block::math::${c}`, c, `\\${c}`, SYMBOL_ICON_SIZE);
}
for (const c of SYMBOL_COMMANDS) {
  const iconTex = c === "sqrt" ? "\\sqrt{x}" : `\\${c}`;
  BLOCK_DEFS[`block::math::${c}`] = mathBlock(`block::math::${c}`, c, iconTex, SYMBOL_ICON_SIZE);
}
for (const c of BINOP_COMMANDS) {
  BLOCK_DEFS[`block::math::${c}`] = mathBlock(`block::math::${c}`, c, `\\${c}`, SYMBOL_ICON_SIZE);
}
// Paired delimiters and blackboard number sets carry an explicit preview glyph
// (the inserted snippet differs from the rendered icon).
for (const d of DELIMITER_BLOCKS) {
  BLOCK_DEFS[`block::math::${d.id}`] = mathBlock(`block::math::${d.id}`, d.id, d.icon, SYMBOL_ICON_SIZE);
}
for (const s of NUMBER_SET_BLOCKS) {
  BLOCK_DEFS[`block::math::${s.id}`] = mathBlock(`block::math::${s.id}`, s.id, s.icon, SYMBOL_ICON_SIZE);
}

// Structural blocks land at the correct hierarchy level, not literally at the
// drop index.
export const STRUCTURAL: Record<string, "section" | "subsection" | "subsubsection"> = {
  "block::section": "section",
  "block::subsection": "subsection",
  "block::subsubsection": "subsubsection"
};

// The Blox palette, grouped into the three collapsible categories shown in the
// sidebar.
export const DOCUMENT_ORDER = [
  "block::section",
  "block::subsection",
  "block::subsubsection",
  "block::abstract",
  "block::footnote",
  "block::list",
  "block::table",
  "block::verbatim",
  "block::code",
  "block::page::cover",
  "block::page::toc",
  "block::page::bibliography"
];

export const MATH_ORDER = [
  "block::equation",
  "block::math::integral",
  "block::math::oint",
  "block::math::lim",
  "block::math::sum",
  "block::math::product",
  "block::math::fraction",
  "block::math::matrix"
];

// Math symbols, split into collapsible subcategories for the sidebar palette.
export const MATH_SYMBOL_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Arrows",      ids: ARROW_COMMANDS.map((c) => `block::math::${c}`) },
  { title: "Operators",   ids: BINOP_COMMANDS.map((c) => `block::math::${c}`) },
  { title: "Symbols",     ids: SYMBOL_COMMANDS.map((c) => `block::math::${c}`) },
  { title: "Delimiters",  ids: DELIMITER_BLOCKS.map((d) => `block::math::${d.id}`) },
  { title: "Number sets", ids: NUMBER_SET_BLOCKS.map((s) => `block::math::${s.id}`) }
];

/* The visual box for a Blox item: an icon with a label below it. In `compact`
   mode (used for the math-symbol grid) the label is dropped and the box is a
   square showing just the glyph. */
export function BlockBox({ id, shadow, compact }: { id: string; shadow?: boolean; compact?: boolean }) {
  const def = BLOCK_DEFS[id];
  if (!def) return null;
  if (compact) {
    return (
      <div
        title={def.label}
        style={{
          border: "1px solid var(--block-border)",
          borderRadius: 8,
          background: "var(--block-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          aspectRatio: "1 / 1",
          width: "100%",
          boxSizing: "border-box",
          color: "var(--glyph)",
          overflow: "hidden",
          boxShadow: shadow ? "0 4px 12px rgba(0,0,0,0.25)" : undefined
        }}
      >
        {def.icon()}
      </div>
    );
  }
  return (
    <div
      style={{
        border: "1px solid var(--block-border)",
        borderRadius: 6,
        padding: "10px 6px",
        background: "var(--block-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        color: "var(--glyph)",
        width: "100%",
        boxSizing: "border-box",
        boxShadow: shadow ? "0 4px 12px rgba(0,0,0,0.25)" : undefined
      }}
    >
      {/* fixed-height icon area keeps every Blox item the same size */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden"
        }}
      >
        {def.icon()}
      </div>
      <span style={{ fontSize: 12 }}>{def.label}</span>
    </div>
  );
}
