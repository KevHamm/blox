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
  mathNode,
  MATH_TEMPLATES
} from "../utils/docTree";

/* A KaTeX-rendered glyph for the Blox palette icons. */
export function KatexIcon({ tex, size = 22 }: { tex: string; size?: number }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false }),
    [tex]
  );
  return (
    <span
      style={{ fontSize: size, lineHeight: 1, color: "#333" }}
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
  "block::math::integral": mathBlock("block::math::integral", "Integral", "\\int"),
  "block::math::sum":      mathBlock("block::math::sum", "Sum", "\\sum"),
  "block::math::product":  mathBlock("block::math::product", "Product", "\\prod"),
  "block::math::fraction": mathBlock("block::math::fraction", "Fraction", "\\frac{a}{b}"),
  "block::math::matrix":   mathBlock("block::math::matrix", "Matrix", "\\left[\\begin{smallmatrix}a&b\\\\c&d\\end{smallmatrix}\\right]", 15),

  "block::page::cover":        { label: "Cover Page",        icon: () => <PageGlyph kind="coverpage" />,    make: () => newPage("coverpage") },
  "block::page::toc":          { label: "Contents",          icon: () => <PageGlyph kind="toc" />,          make: () => newPage("toc") },
  "block::page::bibliography": { label: "Bibliography",       icon: () => <PageGlyph kind="bibliography" />, make: () => newPage("bibliography") }
};

// Structural blocks land at the correct hierarchy level, not literally at the
// drop index.
export const STRUCTURAL: Record<string, "section" | "subsection" | "subsubsection"> = {
  "block::section": "section",
  "block::subsection": "subsection",
  "block::subsubsection": "subsubsection"
};

export const BLOX_ORDER = [
  "block::section",
  "block::subsection",
  "block::subsubsection",
  "block::abstract",
  "block::footnote",
  "block::list",
  "block::table",
  "block::math::integral",
  "block::math::sum",
  "block::math::product",
  "block::math::fraction",
  "block::math::matrix"
];

export const PAGE_ORDER = [
  "block::page::cover",
  "block::page::toc",
  "block::page::bibliography"
];

/* The visual box for a Blox item: an icon with a label below it. */
export function BlockBox({ id, shadow }: { id: string; shadow?: boolean }) {
  const def = BLOCK_DEFS[id];
  if (!def) return null;
  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 6,
        padding: "10px 6px",
        background: "#fafafa",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        color: "#333",
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
