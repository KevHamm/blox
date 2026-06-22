import { useEffect, useMemo, useState } from "react";
import { DesignPreview } from "./welcome/DesignPreview";
import { getMyProjects } from "../utils/myProjects";
import { getTemplates } from "../utils/library";
import { pageSizeDiffers, pageSizeLabel } from "../types/design";
import type { BloxProject } from "../utils/persistence";

// Where an imported page should land. Resolved against the document's children
// at import time (a node id to insert before, or null for the very end).
export type InsertPos = { kind: "start" } | { kind: "before"; id: string } | { kind: "end" };

type OutlineGroup = { key: string; type: string; label: string };

// Outline group types that count as body content (valid "before" anchors and
// the target of "At the start"). Cover / TOC / bibliography are pinned by
// pagination, so they're never reorder/insert anchors.
const CONTENT_TYPES = new Set(["section", "frame", "designpage"]);

function firstContentId(outline: OutlineGroup[]): string | null {
  const g = outline.find((o) => CONTENT_TYPES.has(o.type));
  return g ? g.key : null;
}

function resolveBeforeId(pos: InsertPos, outline: OutlineGroup[]): string | null {
  if (pos.kind === "before") return pos.id;
  if (pos.kind === "start") return firstContentId(outline);
  return null; // "end"
}

export function PageImportModal({
  outline, docPageWidth, docPageHeight, defaultPos, onImport, onClose
}: {
  outline: OutlineGroup[];
  docPageWidth: number;
  docPageHeight: number;
  defaultPos: InsertPos;
  onImport: (design: any, title: string, beforeId: string | null) => void;
  onClose: () => void;
}) {
  const [source, setSource] = useState<"mine" | "templates">("mine");
  const [selected, setSelected] = useState<BloxProject | null>(null);

  // The position chooser options, derived from the document outline.
  const positions = useMemo(() => {
    const opts: { label: string; pos: InsertPos }[] = [{ label: "At the start", pos: { kind: "start" } }];
    for (const g of outline) {
      if (CONTENT_TYPES.has(g.type)) opts.push({ label: `Before ${g.label}`, pos: { kind: "before", id: g.key } });
    }
    opts.push({ label: "At the end", pos: { kind: "end" } });
    return opts;
  }, [outline]);

  // Match the opening context to one of the options (falls back to the first).
  const defaultPosIndex = useMemo(() => {
    const i = positions.findIndex((o) =>
      o.pos.kind === defaultPos.kind &&
      (o.pos.kind !== "before" || (defaultPos.kind === "before" && o.pos.id === defaultPos.id))
    );
    return i >= 0 ? i : 0;
  }, [positions, defaultPos]);

  const [posIndex, setPosIndex] = useState(defaultPosIndex);
  useEffect(() => setPosIndex(defaultPosIndex), [defaultPosIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); if (selected) setSelected(null); else onClose(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, selected]);

  const pages = source === "mine" ? getMyProjects().pages : getTemplates().pages;

  function confirmImport() {
    if (!selected?.design) return;
    onImport(selected.design, selected.title, resolveBeforeId(positions[posIndex].pos, outline));
    onClose();
  }

  const selMismatch = selected?.design
    ? pageSizeDiffers(selected.design.pageWidth, selected.design.pageHeight, docPageWidth, docPageHeight)
    : false;

  return (
    <div className="confirm-backdrop" onPointerDown={onClose}>
      <div className="ui-panel imp-card" role="dialog" aria-modal="true" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="imp-x" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {!selected ? (
          <>
            <div className="imp-head">
              <div className="imp-title">Import a page</div>
              <div className="imp-sub">Bring a design page into this document. Pick one of your pages or a template.</div>
            </div>

            <div className="imp-tabs" role="tablist" aria-label="Page source">
              <button role="tab" aria-selected={source === "mine"} className={`imp-tab${source === "mine" ? " on" : ""}`} onClick={() => setSource("mine")}>My Pages</button>
              <button role="tab" aria-selected={source === "templates"} className={`imp-tab${source === "templates" ? " on" : ""}`} onClick={() => setSource("templates")}>Templates</button>
            </div>

            <div className="imp-grid">
              {pages.length === 0 ? (
                <div className="imp-empty">No pages here yet.</div>
              ) : (
                pages.map((p) => {
                  const d = p.design!;
                  const mism = pageSizeDiffers(d.pageWidth, d.pageHeight, docPageWidth, docPageHeight);
                  return (
                    <button key={p.savedAt + p.title} className="imp-item" onClick={() => setSelected(p)} title={p.title}>
                      <span className="imp-thumb" style={{ background: d.bg }}>
                        <DesignPreview design={d} />
                      </span>
                      <span className="imp-cap">
                        <span className="imp-cap-title">{p.title}</span>
                        {mism && <span className="imp-cap-size">{pageSizeLabel(d.pageWidth, d.pageHeight)}</span>}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            <div className="imp-head">
              <button className="imp-back" onClick={() => setSelected(null)} aria-label="Back to pages">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                Back
              </button>
              <div className="imp-title">Place “{selected.title}”</div>
            </div>

            <div className="imp-place">
              <span className="imp-thumb imp-thumb-lg" style={{ background: selected.design!.bg }}>
                <DesignPreview design={selected.design!} />
              </span>

              <div className="imp-place-side">
                <label className="imp-field">
                  <span className="imp-field-lbl">Position</span>
                  <select className="ui-select" value={posIndex} onChange={(e) => setPosIndex(Number(e.target.value))}>
                    {positions.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
                  </select>
                </label>

                {selMismatch && (
                  <div className="imp-warn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>
                      This page is <b>{pageSizeLabel(selected.design!.pageWidth, selected.design!.pageHeight)}</b> but the document is <b>{pageSizeLabel(docPageWidth, docPageHeight)}</b>. Importing may distort the design.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="imp-actions">
              <button className="ui-btn" onClick={() => setSelected(null)}>Back</button>
              <button className="ui-btn primary" onClick={confirmImport}>Insert page</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
