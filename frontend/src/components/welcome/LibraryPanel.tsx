import { useState } from "react";
import type { BloxProject } from "../../utils/persistence";
import { timeAgo } from "../../utils/persistence";
import { docFontCss } from "../../utils/fonts";
import type { DesignElement, DesignPage } from "../../types/design";

const CLASS_LABEL: Record<string, string> = {
  beamer: "Beamer", article: "Article", report: "Report",
  book: "Book", letter: "Letter", wip: "Sandbox"
};
const CLASS_ORDER = ["beamer", "article", "report", "book", "letter", "wip"];
const classOrder = (cls: string) => { const i = CLASS_ORDER.indexOf(cls); return i < 0 ? 99 : i; };
const byRecent = (a: BloxProject, b: BloxProject) => Date.parse(b.savedAt) - Date.parse(a.savedAt);

// A collapsible class section. Beamer slides are 4:3 landscape, so that group
// renders fewer, wider cards; everything else is portrait, three across.
type Group = { key: string; label: string; items: BloxProject[]; slide: boolean; cols: number };

function projectGroups(projects: BloxProject[]): Group[] {
  const by = new Map<string, BloxProject[]>();
  for (const p of projects) {
    const k = p.cls || "article";
    if (!by.has(k)) by.set(k, []);
    by.get(k)!.push(p);
  }
  return [...by.entries()]
    .sort((a, b) => classOrder(a[0]) - classOrder(b[0]))
    .map(([cls, items]) => ({
      key: cls, label: CLASS_LABEL[cls] ?? cls,
      items: items.slice().sort(byRecent),
      slide: cls === "beamer", cols: cls === "beamer" ? 2 : 3
    }));
}

function pageGroups(pages: BloxProject[]): Group[] {
  if (!pages.length) return [];
  return [{ key: "cover", label: "Cover pages", items: pages.slice().sort(byRecent), slide: false, cols: 3 }];
}

// The signed-in welcome panel: tabs to switch between previews of saved Projects
// (flowing documents, grouped by class) and Pages (free-form design pages). Each
// class section is collapsible; clicking a preview reopens it via onOpen.
export function LibraryPanel({
  projects, pages, onOpen
}: {
  projects: BloxProject[];
  pages: BloxProject[];
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
}) {
  const [tab, setTab] = useState<"projects" | "pages">("projects");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const groups = tab === "projects" ? projectGroups(projects) : pageGroups(pages);

  const toggle = (key: string) => setCollapsed((prev) => {
    const id = `${tab}:${key}`;
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

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

      <div className="lib-body lib-scroll" key={tab}>
        {groups.length === 0 && <div className="lib-empty">Nothing here yet.</div>}
        {groups.map((g) => {
          const isCol = collapsed.has(`${tab}:${g.key}`);
          return (
            <section className="lib-group" key={g.key}>
              <button className="lib-group-head" onClick={() => toggle(g.key)} aria-expanded={!isCol}>
                <svg className={`lib-chevron${isCol ? " col" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="lib-group-title">{g.label}</span>
                <span className="lib-group-count">{g.items.length}</span>
              </button>
              {!isCol && (
                <div className={`lib-grid${g.slide ? " slide" : ""}`} style={{ gridTemplateColumns: `repeat(${g.cols}, minmax(0, 1fr))` }}>
                  {g.items.map((item) => (
                    <LibCard key={item.savedAt + (item.title || "")} item={item} tab={tab} slide={g.slide} onOpen={onOpen} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LibCard({
  item, tab, slide, onOpen
}: {
  item: BloxProject; tab: "projects" | "pages"; slide: boolean;
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
}) {
  return (
    <button
      className="lib-card"
      title={`Open “${item.title || "Untitled"}”`}
      onClick={(e) => onOpen(item, e.currentTarget.getBoundingClientRect())}
    >
      <span className={`lib-thumb${slide ? " slide" : ""}`} style={tab === "pages" && item.design ? { background: item.design.bg } : undefined}>
        {tab === "projects" ? <ProjectThumb project={item} /> : item.design && <PageThumb design={item.design} />}
      </span>
      <span className="lib-cap">
        <span className="lib-cap-title">{item.title || "Untitled"}</span>
        <span className="lib-cap-meta">
          {tab === "projects" ? (CLASS_LABEL[item.cls] ?? "Document") : "Cover page"} · {timeAgo(item.savedAt)}
        </span>
      </span>
    </button>
  );
}

// A simplified typeset-paper preview, echoing the welcome hero paper. Beamer
// projects render as a 4:3 title slide instead of a portrait page.
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

// A faithful, scaled-down render of a design page: each absolutely-positioned
// element placed by percentage of the page, text sized in cqw so it scales with
// the thumbnail. The sheet is a container (container-type: inline-size).
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
