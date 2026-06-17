import { useState } from "react";
import type { BloxProject } from "../../utils/persistence";
import { timeAgo } from "../../utils/persistence";
import { docFontCss } from "../../utils/fonts";
import type { DesignElement, DesignPage } from "../../types/design";

const CLS_LABEL: Record<string, string> = {
  article: "Article", report: "Report", letter: "Letter",
  beamer: "Beamer", book: "Book", wip: "Sandbox"
};

// The signed-in welcome panel: tabs to switch between previews of saved Projects
// (flowing documents) and Pages (free-form design pages). Clicking a preview
// reopens it through the normal morph (onOpen).
export function LibraryPanel({
  projects, pages, onOpen
}: {
  projects: BloxProject[];
  pages: BloxProject[];
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
}) {
  const [tab, setTab] = useState<"projects" | "pages">("projects");
  const items = tab === "projects" ? projects : pages;

  return (
    <div className="library-panel">
      <div className="lib-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "projects"} className={`lib-tab${tab === "projects" ? " on" : ""}`} onClick={() => setTab("projects")}>
          Projects<span className="lib-count">{projects.length}</span>
        </button>
        <button role="tab" aria-selected={tab === "pages"} className={`lib-tab${tab === "pages" ? " on" : ""}`} onClick={() => setTab("pages")}>
          Pages<span className="lib-count">{pages.length}</span>
        </button>
      </div>

      <div className="lib-grid" key={tab}>
        {items.length === 0 && <div className="lib-empty">Nothing here yet.</div>}
        {items.map((item) => (
          <button
            key={item.savedAt + (item.title || "")}
            className="lib-card"
            title={`Open “${item.title || "Untitled"}”`}
            onClick={(e) => onOpen(item, e.currentTarget.getBoundingClientRect())}
          >
            <span className="lib-thumb" style={tab === "pages" && item.design ? { background: item.design.bg } : undefined}>
              {tab === "projects"
                ? <ProjectThumb project={item} />
                : item.design && <PageThumb design={item.design} />}
            </span>
            <span className="lib-cap">
              <span className="lib-cap-title">{item.title || "Untitled"}</span>
              <span className="lib-cap-meta">
                {tab === "projects" ? (CLS_LABEL[item.cls] ?? "Document") : "Cover page"} · {timeAgo(item.savedAt)}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// A simplified typeset-paper preview, echoing the welcome hero paper: the real
// title in the document serif, with faux body bars (illegible at thumb scale,
// so bars read cleaner than tiny text) and the brand block-figure motif.
function ProjectThumb({ project }: { project: BloxProject }) {
  const slide = project.cls === "beamer";
  if (slide) {
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

// A faithful, scaled-down render of a design page: each absolutely-positioned
// element placed by percentage of the page, with text sized in cqw so it scales
// with the thumbnail. The sheet is a container (container-type: inline-size).
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
  // line — drawn as a thin bar (seed lines are horizontal rules).
  return <span style={{
    ...box, height: `${Math.max((el.strokeWidth ?? 2) / H * 100, 0.4)}%`,
    background: el.stroke ?? "#111", display: "block", minHeight: "1px"
  }} />;
}
