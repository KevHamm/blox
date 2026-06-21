import { useReducer, useRef, useState } from "react";
import type { BloxProject } from "../../utils/persistence";
import { timeAgo, buildProject } from "../../utils/persistence";
import { getTemplates, layoutFor } from "../../utils/library";
import { getMyProjects, addToMyProjects } from "../../utils/myProjects";
import { getUserTemplates, removeUserTemplate } from "../../utils/userTemplates";
import { useFavorites, favKey } from "../../utils/favorites";
import { parseLatex } from "../../utils/importLatex";
import { confirmDialog } from "../ConfirmDialog";
import { DesignPreview } from "./DesignPreview";
import { HeartIcon } from "./ViewerBar";

const CLASS_LABEL: Record<string, string> = {
  beamer: "Beamer", article: "Article", report: "Report",
  book: "Book", letter: "Letter", wip: "Sandbox"
};
const byRecent = (a: BloxProject, b: BloxProject) => Date.parse(b.savedAt) - Date.parse(a.savedAt);

const DOC_TYPES = [
  { cls: "report", label: "Report", desc: "Title page, chapters & sections." },
  { cls: "article", label: "Article", desc: "A single-column paper." },
  { cls: "book", label: "Book", desc: "Multi-chapter, front & back matter." }
];

type FlowKind = "doc" | "beamer" | "page";
type SectionKey = "documents" | "presentations" | "pages";
const PAGE_SIZE = 9;
const PAGE_STEP = 10;

export function LibraryPanel({
  onOpen, onStart, onDesign, onView
}: {
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
  onStart: (cls: string, rect?: DOMRect) => void;
  onDesign: (kind: string, rect?: DOMRect) => void;
  onView: (list: BloxProject[], index: number) => void;
}) {
  const { isFav, toggle } = useFavorites();
  // Re-read the user's own templates after a remove (a bump forces a re-render).
  const [, bumpTpl] = useReducer((n: number) => n + 1, 0);
  const userTemplates = getUserTemplates();
  const mine = getMyProjects();
  const a4 = mine.projects.filter((p) => p.cls !== "beamer").slice().sort(byRecent);
  const beamer = mine.projects.filter((p) => p.cls === "beamer").slice().sort(byRecent);
  const tpl = getTemplates();
  const fav = {
    documents: tpl.documents.filter((p) => isFav(favKey(p))),
    presentations: tpl.presentations.filter((p) => isFav(favKey(p))),
    pages: tpl.pages.filter((p) => isFav(favKey(p)))
  };
  const favCount = fav.documents.length + fav.presentations.length + fav.pages.length;

  // Title search (right side of the tab row). Filters the visible lists by a
  // case-insensitive substring of the document title.
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matchTitle = (p: BloxProject) => !q || (p.title || "").toLowerCase().includes(q);
  const a4f = a4.filter(matchTitle);
  const beamerf = beamer.filter(matchTitle);
  const minePagesf = mine.pages.filter(matchTitle);

  const [tab, setTab] = useState<"mine" | "favorites" | "templates">("mine");
  // Within the Templates tab: the user's own saved templates vs. the seeded
  // catalogue to browse. Default to "mine" once they've saved any.
  const [tplSource, setTplSource] = useState<"mine" | "browse">(() => getUserTemplates().length ? "mine" : "browse");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState<Record<SectionKey, number>>({ documents: PAGE_SIZE, presentations: PAGE_SIZE, pages: PAGE_SIZE });

  const [flow, setFlow] = useState<"browse" | "new" | "doctype">("browse");
  const [flowKind, setFlowKind] = useState<FlowKind>("doc");
  const flowIndex = flow === "browse" ? 0 : flow === "new" ? 1 : 2;

  const isCol = (key: string) => collapsed.has(`${tab}:${key}`);
  const toggleCol = (key: string) => setCollapsed((prev) => {
    const id = `${tab}:${key}`; const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  function switchTab(t: "mine" | "favorites" | "templates") { setTab(t); setFlow("browse"); }
  function showMore(key: SectionKey) { setShown((s) => ({ ...s, [key]: s[key] + PAGE_STEP })); }

  const rectOf = (e: React.MouseEvent) => e.currentTarget.getBoundingClientRect();
  function openNew(kind: FlowKind) { setFlowKind(kind); setFlow("new"); }
  function startEmpty(e: React.MouseEvent) {
    if (flowKind === "beamer") onStart("beamer", rectOf(e));
    else if (flowKind === "page") onDesign("cover", rectOf(e));
    else setFlow("doctype");
  }
  const flowNoun = flowKind === "beamer" ? "presentation" : flowKind === "page" ? "page" : "project";
  const emptyDesc = flowKind === "beamer" ? "A blank slide deck."
    : flowKind === "page" ? "A blank page to design freely."
    : "A blank document — you pick the type.";

  // Open a template as a fresh personal project (and persist it under My projects).
  function useTemplate(item: BloxProject, rect?: DOMRect) {
    const copy: BloxProject = { ...item, savedAt: new Date().toISOString() };
    addToMyProjects(copy);
    onOpen(copy, rect);
  }

  // Import a .tex file: parse it into a document tree, persist it under My
  // projects, and open it in the editor. Lossy bits are surfaced as a summary.
  const fileRef = useRef<HTMLInputElement>(null);
  const triggerImport = () => fileRef.current?.click();
  async function importTex(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    let parsed: ReturnType<typeof parseLatex> | null = null;
    try { parsed = parseLatex(await file.text()); } catch { parsed = null; }
    if (!parsed || !parsed.doc.children?.length) {
      await confirmDialog({ title: "Couldn’t import that file", message: "We couldn’t find any LaTeX content to read. Make sure it’s a .tex document.", confirmLabel: "OK", noCancel: true });
      return;
    }
    const title = parsed.title || file.name.replace(/\.(tex|latex)$/i, "") || "Imported document";
    const project = buildProject(parsed.cls, title, layoutFor(parsed.cls), parsed.doc, []);
    addToMyProjects(project);
    if (parsed.notes.length) {
      await confirmDialog({ title: "Imported — a few things were simplified", message: parsed.notes.join("  ·  "), confirmLabel: "Open in editor", noCancel: true });
    }
    onOpen(project);
  }

  // Cards for a template/favorites section: the full list drives the viewer's
  // prev/next, while only `visible` are rendered.
  const templateCards = (visible: BloxProject[], full: BloxProject[], slide?: boolean) =>
    visible.map((item, i) => (
      <ItemCard
        key={item.savedAt + item.title} item={item} slide={slide} template
        isFav={isFav(favKey(item))} onToggleFav={() => toggle(favKey(item))}
        onView={() => onView(full, i)}
        onOpenInEditor={(rect) => useTemplate(item, rect)}
      />
    ));

  function templateSection(key: SectionKey, title: string, items: BloxProject[], slide?: boolean) {
    if (!items.length) return null; // hide a section emptied by the title search
    const n = shown[key];
    const visible = items.slice(0, n);
    const hasMore = items.length > n;
    return (
      <Section title={title} collapsed={isCol(key)} onToggle={() => toggleCol(key)}>
        <div className={`ws-grid${slide ? " slide" : ""}`}>
          {templateCards(visible, items, slide)}
          {hasMore && (
            <button className={`ws-showmore${slide ? " slide" : ""}`} onClick={() => showMore(key)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span className="ws-showmore-h">Show more</span>
              <span className="ws-showmore-n">{items.length - n} more</span>
            </button>
          )}
        </div>
      </Section>
    );
  }

  function favSection(key: SectionKey, title: string, items: BloxProject[], slide?: boolean) {
    if (!items.length) return null;
    return (
      <Section title={title} collapsed={isCol(key)} onToggle={() => toggleCol(key)}>
        <div className={`ws-grid${slide ? " slide" : ""}`}>{templateCards(items, items, slide)}</div>
      </Section>
    );
  }

  return (
    <div className="workspace">
      <input ref={fileRef} type="file" accept=".tex,.latex,text/x-tex,text/plain" style={{ display: "none" }} onChange={importTex} />
      <div className="ws-tabsrow">
        <div className="ws-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "mine"} className={`ws-tab${tab === "mine" ? " on" : ""}`} onClick={() => switchTab("mine")}>My projects</button>
          <button role="tab" aria-selected={tab === "favorites"} className={`ws-tab${tab === "favorites" ? " on" : ""}`} onClick={() => switchTab("favorites")}>
            Favorites{favCount > 0 && <span className="ws-tab-n">{favCount}</span>}
          </button>
          <button role="tab" aria-selected={tab === "templates"} className={`ws-tab${tab === "templates" ? " on" : ""}`} onClick={() => switchTab("templates")}>Templates</button>
        </div>
        <div className="ws-search">
          <SearchIcon />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title…" aria-label="Search documents by title" spellCheck={false}
          />
          {query && (
            <button className="ws-search-clear" onClick={() => setQuery("")} aria-label="Clear search"><ClearIcon /></button>
          )}
        </div>
      </div>

      {tab === "mine" ? (
        <div className="ws-flow">
          <div className="ws-track" style={{ transform: `translateX(-${flowIndex * 100}%)` }}>
            <div className="ws-browse lib-scroll ws-panel" aria-hidden={flow !== "browse"}>
              {q && !a4f.length && !beamerf.length && !minePagesf.length ? (
                <div className="ws-empty">
                  <SearchIcon size={26} />
                  <p>No documents match “{query.trim()}”.</p>
                </div>
              ) : (
                <>
                  {(q ? a4f.length > 0 : true) && (
                    <Section title="Documents" collapsed={isCol("documents")} onToggle={() => toggleCol("documents")} actions={<NewImport onNew={() => openNew("doc")} onImport={triggerImport} />}>
                      <div className="ws-grid">{a4f.map((p) => <ItemCard key={p.savedAt + p.title} item={p} onOpen={(rect) => onOpen(p, rect)} />)}</div>
                    </Section>
                  )}
                  {(q ? beamerf.length > 0 : true) && (
                    <Section title="Presentations" collapsed={isCol("presentations")} onToggle={() => toggleCol("presentations")} actions={<NewImport onNew={() => openNew("beamer")} onImport={triggerImport} />}>
                      <div className="ws-grid slide">{beamerf.map((p) => <ItemCard key={p.savedAt + p.title} item={p} slide onOpen={(rect) => onOpen(p, rect)} />)}</div>
                    </Section>
                  )}
                  {(q ? minePagesf.length > 0 : mine.pages.length > 0) && (
                    <Section title="Pages" collapsed={isCol("pages")} onToggle={() => toggleCol("pages")} actions={<NewImport onNew={() => openNew("page")} onImport={triggerImport} />}>
                      <div className="ws-grid">{minePagesf.map((p) => <ItemCard key={p.savedAt + p.title} item={p} onOpen={(rect) => onOpen(p, rect)} />)}</div>
                    </Section>
                  )}
                </>
              )}
            </div>

            <div className="ws-panel ws-center" aria-hidden={flow !== "new"}>
              <div className="ws-flowcard">
                <button className="ws-back" onClick={() => setFlow("browse")} aria-label="Back"><Chevron /> Back</button>
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

            <div className="ws-panel ws-center" aria-hidden={flow !== "doctype"}>
              <div className="ws-flowcard">
                <button className="ws-back" onClick={() => setFlow("new")} aria-label="Back"><Chevron /> Back</button>
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
      ) : tab === "favorites" ? (
        <div className="ws-list lib-scroll">
          {favCount === 0 ? (
            <div className="ws-empty">
              <HeartIcon size={26} />
              <p>No favorites yet — hover a template and tap the heart to save it here.</p>
            </div>
          ) : (() => {
            const fd = fav.documents.filter(matchTitle), fp = fav.presentations.filter(matchTitle), fg = fav.pages.filter(matchTitle);
            if (q && !fd.length && !fp.length && !fg.length) {
              return <div className="ws-empty"><SearchIcon size={26} /><p>No favorites match “{query.trim()}”.</p></div>;
            }
            return (
              <>
                {favSection("documents", "Documents", fd)}
                {favSection("presentations", "Presentations", fp, true)}
                {favSection("pages", "Pages", fg)}
              </>
            );
          })()}
        </div>
      ) : (
        <div className="ws-list lib-scroll">
          <div className="ws-subtabs" role="tablist" aria-label="Template source">
            <button role="tab" aria-selected={tplSource === "mine"} className={`ws-subtab${tplSource === "mine" ? " on" : ""}`} onClick={() => setTplSource("mine")}>
              My templates{userTemplates.length > 0 && <span className="ws-tab-n">{userTemplates.length}</span>}
            </button>
            <button role="tab" aria-selected={tplSource === "browse"} className={`ws-subtab${tplSource === "browse" ? " on" : ""}`} onClick={() => setTplSource("browse")}>Browse templates</button>
          </div>

          {tplSource === "browse" ? (() => {
            const td = tpl.documents.filter(matchTitle), tp = tpl.presentations.filter(matchTitle), tg = tpl.pages.filter(matchTitle);
            if (q && !td.length && !tp.length && !tg.length) {
              return <div className="ws-empty"><SearchIcon size={26} /><p>No templates match “{query.trim()}”.</p></div>;
            }
            return (
              <>
                {templateSection("documents", "Documents", td)}
                {templateSection("presentations", "Presentations", tp, true)}
                {templateSection("pages", "Pages", tg)}
              </>
            );
          })() : userTemplates.length === 0 ? (
            <div className="ws-empty">
              <BookmarkIcon />
              <p>You haven't saved any templates yet. Open the page designer, craft a page, and hit <strong>Save as template</strong> to keep it here.</p>
              <button className="ws-headbtn ghost" onClick={() => setTplSource("browse")}>Browse templates instead</button>
            </div>
          ) : (() => {
            const ut = userTemplates.filter(matchTitle);
            if (q && !ut.length) {
              return <div className="ws-empty"><SearchIcon size={26} /><p>No templates match “{query.trim()}”.</p></div>;
            }
            return (
              <Section title="My page templates" collapsed={isCol("mytemplates")} onToggle={() => toggleCol("mytemplates")}>
                <div className="ws-grid">
                  {ut.map((item, i) => (
                    <ItemCard
                      key={item.savedAt + item.title} item={item} template owned
                      onView={() => onView(ut, i)}
                      onOpenInEditor={(rect) => useTemplate(item, rect)}
                      onRemove={() => { removeUserTemplate(item); bumpTpl(); }}
                    />
                  ))}
                </div>
              </Section>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function Section({ title, collapsed, onToggle, actions, children }: {
  title: string; collapsed: boolean; onToggle: () => void; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="ws-section">
      <div className="ws-section-head">
        <button className="ws-collapse" onClick={onToggle} aria-expanded={!collapsed}>
          <svg className={`ws-caret${collapsed ? " col" : ""}`} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 12 15 18 9" /></svg>
          <span className="ws-h">{title}</span>
        </button>
        {actions}
      </div>
      {!collapsed && children}
    </section>
  );
}

function NewImport({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <div className="ws-section-actions">
      <button className="ws-headbtn primary" onClick={onNew}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        New project
      </button>
      <button className="ws-headbtn ghost" onClick={onImport} title="Import a .tex file">Import</button>
    </div>
  );
}

function ItemCard({
  item, slide, template, owned, isFav, onToggleFav, onView, onOpenInEditor, onOpen, onRemove
}: {
  item: BloxProject; slide?: boolean; template?: boolean; owned?: boolean;
  isFav?: boolean; onToggleFav?: () => void; onView?: () => void;
  onOpenInEditor?: (rect: DOMRect) => void; onOpen?: (rect: DOMRect) => void; onRemove?: () => void;
}) {
  const design = item.kind === "design" ? item.design : undefined;
  const typeLabel = design ? "Cover page" : (CLASS_LABEL[item.cls] ?? "Document");
  function cardClick(e: React.SyntheticEvent) {
    const t = (e.currentTarget as HTMLElement).querySelector(".lib-thumb");
    const rect = (t ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    if (template) onView?.(); else onOpen?.(rect);
  }
  return (
    <div
      className="lib-card" role="button" tabIndex={0}
      title={template ? `Preview “${item.title || "Untitled"}”` : `Open “${item.title || "Untitled"}”`}
      onClick={cardClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cardClick(e); } }}
    >
      <span className={`lib-thumb${slide ? " slide" : ""}`} style={design ? { background: design.bg } : undefined}>
        {design ? <DesignPreview design={design} /> : <ProjectThumb project={item} />}
        {template && (
          <>
            {owned ? (
              <button className="lib-heart lib-del" title="Remove from your templates"
                onClick={(e) => { e.stopPropagation(); onRemove?.(); }}>
                <TrashIcon />
              </button>
            ) : (
              <button className={`lib-heart${isFav ? " on" : ""}`} title={isFav ? "Remove from favorites" : "Save as favorite"}
                onClick={(e) => { e.stopPropagation(); onToggleFav?.(); }}>
                <HeartIcon filled={isFav} size={16} />
              </button>
            )}
            <div className="lib-actions" onClick={(e) => e.stopPropagation()}>
              <button className="lib-act primary" onClick={(e) => onOpenInEditor?.(e.currentTarget.getBoundingClientRect())}>Open in editor</button>
              <button className="lib-act" onClick={() => onView?.()}>View</button>
            </div>
          </>
        )}
      </span>
      <span className="lib-cap">
        <span className="lib-cap-title">{item.title || "Untitled"}</span>
        <span className="lib-cap-meta">{template ? typeLabel : `${typeLabel} · ${timeAgo(item.savedAt)}`}</span>
      </span>
    </div>
  );
}

function Chevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 6 9 12 15 18" /></svg>;
}

function BookmarkIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" /></svg>;
}

function SearchIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
}

function ClearIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

function TrashIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
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

// A simplified typeset-paper preview. Beamer projects render a 4:3 title slide.
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
