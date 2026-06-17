import { useEffect, useRef, useState } from "react";
import { Logo, ThemeToggle } from "../chrome";
import { DesignElementView } from "./DesignElementView";
import { useDesign } from "../../hooks/useDesign";
import { blankDesign, LETTER, A4, type DesignPage } from "../../types/design";
import { buildDesignProject, downloadProject, saveAutosave, type BloxProject } from "../../utils/persistence";
import { exportCover } from "../../utils/exportCover";
import { confirmDialog } from "../ConfirmDialog";

// Read a chosen image file → data URL + its natural pixel size.
function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onload = () => resolve({ src, w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ src, w: 0, h: 0 });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

const BG_PRESETS = ["#ffffff", "#0e0a1a", "#111111", "#f4f1ea", "#7c3aed", "#0071e3"];

export function CoverDesigner({
  sidebarsIn = true, project, onBack, dark, onToggleTheme
}: {
  sidebarsIn?: boolean;
  project?: BloxProject | null;
  onBack?: () => void;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const initial: DesignPage = project?.design ?? blankDesign("cover");
  const {
    design, undo, redo, canUndo, canRedo,
    selectedId, setSelectedId, addElement, addImage, updateElement, deleteElement, setBg, setPageSize
  } = useDesign(initial);
  const [title, setTitle] = useState(project?.title ?? "Cover Page");
  const fileRef = useRef<HTMLInputElement>(null);

  // Debounced autosave into the single session slot (same slot the document
  // editor uses — most-recent session wins).
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveAutosave(buildDesignProject(title, design)), 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [design, title]);

  function saveProject() {
    downloadProject(buildDesignProject(title, design));
  }
  function doExport() {
    exportCover(design, title).catch(() =>
      confirmDialog({
        title: "Export failed",
        message: "Couldn't reach the export service — make sure the backend is running on localhost:8000.",
        confirmLabel: "OK", noCancel: true
      })
    );
  }
  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { src, w, h } = await readImage(file);
    addImage(src, w, h);
  }

  const pageIsA4 = Math.abs(design.pageWidth - A4.pageWidth) < 2;

  return (
    <div className="editor-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* ── Top bar ── */}
      <div
        className="ui-panel"
        style={{
          flex: "0 0 auto", height: 64, display: "flex", alignItems: "center",
          gap: 12, padding: "0 18px", borderBottom: "1px solid var(--ui-hairline)",
          opacity: sidebarsIn ? 1 : 0, transition: "opacity 0.4s ease", zIndex: 5
        }}
      >
        <Logo onClick={onBack} />
        <span style={{ width: 1, height: 26, background: "var(--divider)", margin: "0 4px" }} />
        <button className="ui-btn icon-btn" onClick={undo} disabled={!canUndo} title="Undo" aria-label="Undo">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4" /><path d="M4 9h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" /></svg>
        </button>
        <button className="ui-btn icon-btn" onClick={redo} disabled={!canRedo} title="Redo" aria-label="Redo">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4" /><path d="M20 9H9a5 5 0 0 0-5 5v0a5 5 0 0 0 5 5h6" /></svg>
        </button>

        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <input
            className="design-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            spellCheck={false}
            aria-label="Page title"
          />
        </div>

        <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        <button className="ui-btn" onClick={saveProject} title="Download this page as a .blox file">Save</button>
        <button className="ui-btn primary" onClick={doExport}>Export LaTeX</button>
      </div>

      {/* ── Canvas + palette ── */}
      <div className="editor-canvas" style={{ position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* LEFT PALETTE */}
        <div style={{ flex: "0 0 auto", width: sidebarsIn ? 280 : 0, height: "100%", overflow: "hidden", transition: "width 0.45s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div className="ui-panel sidebar-panel" style={{ width: 280, height: "100%", overflowY: "auto", padding: 20, boxSizing: "border-box" }}>
            <h3 className="design-h3">Add to page</h3>
            <div className="design-add-grid">
              <button className="design-add" onClick={() => addElement("text")}><AddGlyph kind="text" /><span>Text</span></button>
              <button className="design-add" onClick={() => fileRef.current?.click()}><AddGlyph kind="image" /><span>Image</span></button>
              <button className="design-add" onClick={() => addElement("rect")}><AddGlyph kind="rect" /><span>Box</span></button>
              <button className="design-add" onClick={() => addElement("line")}><AddGlyph kind="line" /><span>Line</span></button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={pickImage} />

            <h3 className="design-h3" style={{ marginTop: 26 }}>Page</h3>
            <label className="design-field-lbl">Background</label>
            <div className="design-bg-row">
              {BG_PRESETS.map((c) => (
                <button key={c} title={c} onClick={() => setBg(c)}
                  style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: "pointer", padding: 0,
                           border: design.bg.toLowerCase() === c ? "2px solid var(--ui-blue)" : "1px solid var(--ctrl-border)" }} />
              ))}
              <label title="Custom background" style={{ display: "inline-flex", cursor: "pointer" }}>
                <input type="color" value={design.bg} onChange={(e) => setBg(e.target.value)}
                       style={{ width: 26, height: 26, padding: 0, border: "none", background: "none", cursor: "pointer" }} />
              </label>
            </div>

            <label className="design-field-lbl" style={{ marginTop: 16 }}>Page size</label>
            <div className="design-seg">
              <button className={`design-seg-btn${!pageIsA4 ? " on" : ""}`} onClick={() => setPageSize(LETTER.pageWidth, LETTER.pageHeight)}>US&nbsp;Letter</button>
              <button className={`design-seg-btn${pageIsA4 ? " on" : ""}`} onClick={() => setPageSize(A4.pageWidth, A4.pageHeight)}>A4</button>
            </div>

            <p className="design-tip">Tip: double-click a text box to edit it. Drag the corners to resize. Press Delete to remove the selected element.</p>
          </div>
        </div>

        {/* CANVAS */}
        <div className="doc-area" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: 40, overflowY: "auto", overscrollBehavior: "contain", opacity: sidebarsIn ? 1 : 0, transition: "opacity 0.3s ease" }}>
          <div
            className="blox-page"
            style={{
              position: "relative", width: design.pageWidth, height: design.pageHeight,
              flex: "none", background: design.bg, borderRadius: 6, overflow: "hidden",
              boxShadow: "0 12px 40px rgba(55, 45, 25, 0.10), 0 2px 6px rgba(55, 45, 25, 0.06)",
              marginBottom: 44
            }}
          >
            {design.elements.map((el) => (
              <DesignElementView
                key={el.id}
                el={el}
                selected={selectedId === el.id}
                pageWidth={design.pageWidth}
                pageHeight={design.pageHeight}
                onSelect={() => setSelectedId(el.id)}
                onCommitGeom={(g) => updateElement(el.id, g)}
                onPatch={(patch) => updateElement(el.id, patch)}
                onDelete={() => deleteElement(el.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddGlyph({ kind }: { kind: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      {kind === "text" && <><path d="M6 7h12" {...s} /><path d="M12 7v10" {...s} /></>}
      {kind === "image" && <><rect x="4" y="5" width="16" height="14" rx="2" {...s} /><circle cx="9" cy="10" r="1.6" {...s} /><path d="M5 17l4-4 3 3 3-3 4 4" {...s} /></>}
      {kind === "rect" && <rect x="5" y="6" width="14" height="12" rx="1.5" {...s} />}
      {kind === "line" && <path d="M5 12h14" {...s} />}
    </svg>
  );
}
