import { useState } from "react";
import type { BloxProject } from "../../utils/persistence";
import { timeAgo } from "../../utils/persistence";
import { docFontCss } from "../../utils/fonts";
import type { DesignElement, DesignPage } from "../../types/design";

const CLASS_LABEL: Record<string, string> = {
  beamer: "Beamer", article: "Article", report: "Report",
  book: "Book", letter: "Letter", wip: "Sandbox"
};
const byRecent = (a: BloxProject, b: BloxProject) => Date.parse(b.savedAt) - Date.parse(a.savedAt);

// A4 / US-Letter document types offered by "Start from empty". (Beamer and Page
// skip this step.)
const DOC_TYPES = [
  { cls: "report", label: "Report", desc: "Title page, chapters & sections." },
  { cls: "article", label: "Article", desc: "A single-column paper." },
  { cls: "book", label: "Book", desc: "Multi-chapter, front & back matter." }
];

type FlowKind = "doc" | "beamer" | "page";

// The signed-in workspace: a centered page of the user's projects — A4/US
// documents and Beamer presentations, then design Pages. Each section's title
// row carries the New project / Import buttons; "New project" slides the listing
// aside for the create flow.
export function LibraryPanel({
  projects, pages, onOpen, onStart, onDesign
}: {
  projects: BloxProject[];
  pages: BloxProject[];
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
  onStart: (cls: string, rect?: DOMRect) => void;
  onDesign: (kind: string, rect?: DOMRect) => void;
}) {
  const a4 = projects.filter((p) => p.cls !== "beamer").slice().sort(byRecent);
  const beamer = projects.filter((p) => p.cls === "beamer").slice().sort(byRecent);

  // Create flow: browse → new (Start from empty / Browse templates) → templates
  // (A4/US type choice). Beamer & Page jump straight to their editor.
  const [flow, setFlow] = useState<"browse" | "new" | "templates">("browse");
  const [flowKind, setFlowKind] = useState<FlowKind>("doc");
  const flowIndex = flow === "browse" ? 0 : flow === "new" ? 1 : 2;

  const rectOf = (e: React.MouseEvent) => e.currentTarget.getBoundingClientRect();
  function openNew(kind: FlowKind) { setFlowKind(kind); setFlow("new"); }
  function startEmpty(e: React.MouseEvent) {
    if (flowKind === "beamer") onStart("beamer", rectOf(e));
    else if (flowKind === "page") onDesign("cover", rectOf(e));
    else setFlow("templates");
  }
  const flowNoun = flowKind === "beamer" ? "presentation" : flowKind === "page" ? "page" : "project";
  const emptyDesc = flowKind === "beamer" ? "A blank slide deck."
    : flowKind === "page" ? "A blank page to design freely."
    : "A blank document — you pick the type.";

  return (
    <div className="workspace">
      <div className="ws-flow">
        <div className="ws-track" style={{ transform: `translateX(-${flowIndex * 100}%)` }}>
          {/* 0 — the project listing */}
          <div className="ws-browse lib-scroll ws-panel" aria-hidden={flow !== "browse"}>
            <Section title="Documents" onNew={() => openNew("doc")}>
              <div className="ws-grid">
                {a4.map((p) => <ItemCard key={p.savedAt + p.title} item={p} onOpen={onOpen} />)}
              </div>
            </Section>
            <Section title="Presentations" onNew={() => openNew("beamer")}>
              <div className="ws-grid slide">
                {beamer.map((p) => <ItemCard key={p.savedAt + p.title} item={p} slide onOpen={onOpen} />)}
              </div>
            </Section>
            {pages.length > 0 && (
              <Section title="Pages" onNew={() => openNew("page")}>
                <div className="ws-grid">
                  {pages.map((p) => <ItemCard key={p.savedAt + p.title} item={p} onOpen={onOpen} />)}
                </div>
              </Section>
            )}
          </div>

          {/* 1 — start options */}
          <div className="ws-panel ws-center" aria-hidden={flow !== "new"}>
            <div className="ws-flowcard">
              <button className="ws-back" onClick={() => setFlow("browse")} aria-label="Back">
                <Chevron /> Back
              </button>
              <h2 className="ws-flow-title">New {flowNoun}</h2>
              <p className="ws-flow-sub">How would you like to start?</p>
              <div className="ws-options">
                <button className="ws-option" onClick={startEmpty}>
                  <span className="ws-option-h">Start from empty</span>
                  <span className="ws-option-d">{emptyDesc}</span>
                </button>
                <button className="ws-option" disabled>
                  <span className="ws-option-h">Browse templates</span>
                  <span className="ws-option-d">Coming soon.</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2 — A4/US document type */}
          <div className="ws-panel ws-center" aria-hidden={flow !== "templates"}>
            <div className="ws-flowcard">
              <button className="ws-back" onClick={() => setFlow("new")} aria-label="Back">
                <Chevron /> Back
              </button>
              <h2 className="ws-flow-title">Choose a document type</h2>
              <p className="ws-flow-sub">All are A4 / US-Letter sized.</p>
              <div className="ws-typerow">
                {DOC_TYPES.map((t) => (
                  <button key={t.cls} className="ws-type" onClick={(e) => onStart(t.cls, rectOf(e))}>
                    <span className="ws-type-thumb"><TypeGlyph cls={t.cls} /></span>
                    <span className="ws-type-label">{t.label}</span>
                    <span className="ws-type-desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// A section: title row (with New project / Import) + a grid of cards.
function Section({ title, onNew, children }: { title: string; onNew: () => void; children: React.ReactNode }) {
  return (
    <section className="ws-section">
      <div className="ws-section-head">
        <h2 className="ws-h">{title}</h2>
        <div className="ws-section-actions">
          <button className="ws-headbtn primary" onClick={onNew}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New project
          </button>
          <button className="ws-headbtn ghost" disabled title="Coming soon">Import</button>
        </div>
      </div>
      {children}
    </section>
  );
}

function ItemCard({ item, slide, onOpen }: { item: BloxProject; slide?: boolean; onOpen: (p: BloxProject, rect?: DOMRect) => void }) {
  const design = item.kind === "design" ? item.design : undefined;
  return (
    <button
      className="lib-card"
      title={`Open “${item.title || "Untitled"}”`}
      onClick={(e) => { const t = e.currentTarget.querySelector(".lib-thumb"); onOpen(item, (t ?? e.currentTarget).getBoundingClientRect()); }}
    >
      <span className={`lib-thumb${slide ? " slide" : ""}`} style={design ? { background: design.bg } : undefined}>
        {design ? <PageThumb design={design} /> : <ProjectThumb project={item} />}
      </span>
      <span className="lib-cap">
        <span className="lib-cap-title">{item.title || "Untitled"}</span>
        <span className="lib-cap-meta">{design ? "Cover page" : (CLASS_LABEL[item.cls] ?? "Document")} · {timeAgo(item.savedAt)}</span>
      </span>
    </button>
  );
}

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 6 9 12 15 18" /></svg>;
}

function TypeGlyph({ cls }: { cls: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (cls === "book") {
    return (
      <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden>
        <path d="M20 8c-3.5-2.2-7.5-2.2-12-1.1v24c4.5-1.1 8.5-1.1 12 1.1 3.5-2.2 7.5-2.2 12-1.1v-24c-4.5-1.1-8.5-1.1-12 1.1Z" {...s} />
        <line x1="20" y1="8" x2="20" y2="32" {...s} />
      </svg>
    );
  }
  const rows: Record<string, [number, number][]> = {
    article: [[10, 17], [10, 21], [10, 25], [10, 29], [10, 33]],
    report: [[10, 19], [10, 24], [10, 28], [10, 32], [10, 36]]
  };
  const r = rows[cls] ?? rows.article;
  return (
    <svg viewBox="0 0 36 48" width="28" height="36" aria-hidden>
      <rect x="3" y="3" width="30" height="42" rx="2.5" {...s} />
      {cls === "report" && <rect x="10" y="9" width="14" height="5" rx="1" {...s} />}
      {r.map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x + 16} y2={y} {...s} opacity={0.7} />)}
    </svg>
  );
}

// A simplified typeset-paper preview, echoing the welcome hero paper. Beamer
// projects render as a 4:3 title slide.
function ProjectThumb({ project }: { project: BloxProject }) {
  if (project.cls === "beamer") {
    return (
      <span className="mini-paper mini-slide">
        <span className="ms-title">{project.title || "Untitled"}</span>
        <span className="ms-rule" />
        <span className="ms-sub" />
      </span>
    );
  }
  return (
    <span className="mini-paper">
      <span className="mp-title">{project.title || "Untitled"}</span>
      <span className="mp-byline" />
      <span className="mp-para">{[88, 96, 92, 70].map((w, i) => <span key={i} className="mp-line" style={{ width: `${w}%` }} />)}</span>
      <span className="mp-head" />
      <span className="mp-para">{[94, 90, 60].map((w, i) => <span key={i} className="mp-line" style={{ width: `${w}%` }} />)}</span>
      <span className="mp-fig"><i /><i /><i /></span>
    </span>
  );
}

// A faithful, scaled-down render of a design page.
function PageThumb({ design }: { design: DesignPage }) {
  const { pageWidth: W, pageHeight: H, elements } = design;
  const pc = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <span className="mini-design">
      {elements.map((el) => <Element key={el.id} el={el} W={W} H={H} pc={pc} />)}
    </span>
  );
}

function Element({ el, W, H, pc }: { el: DesignElement; W: number; H: number; pc: (v: number, t: number) => string }) {
  const box = { position: "absolute" as const, left: pc(el.x, W), top: pc(el.y, H), width: pc(el.w, W) };
  if (el.kind === "text") {
    return (
      <span style={{
        ...box, height: pc(el.h, H),
        fontFamily: docFontCss(el.fontFamily ?? "cm"),
        fontSize: `${(el.fontSize ?? 24) / W * 100}cqw`,
        fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? "italic" : "normal",
        textDecoration: el.underline ? "underline" : "none",
        color: el.color ?? "#111111",
        textAlign: (el.align ?? "left"),
        lineHeight: 1.18, whiteSpace: "pre-wrap", overflow: "hidden", display: "block"
      }}>{el.text}</span>
    );
  }
  if (el.kind === "image" && el.src) {
    return <img src={el.src} alt="" style={{ ...box, height: pc(el.h, H), objectFit: "contain" }} />;
  }
  if (el.kind === "rect") {
    return <span style={{
      ...box, height: pc(el.h, H), display: "block",
      background: el.fill ?? "transparent",
      border: (el.strokeWidth ?? 0) > 0 ? `${(el.strokeWidth ?? 0) / W * 100}cqw solid ${el.stroke ?? "#111"}` : "none",
      boxSizing: "border-box"
    }} />;
  }
  return <span style={{
    ...box, height: `${Math.max((el.strokeWidth ?? 2) / H * 100, 0.4)}%`,
    background: el.stroke ?? "#111", display: "block", minHeight: "1px"
  }} />;
}
