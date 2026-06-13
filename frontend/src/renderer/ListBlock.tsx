import { useRef, useState, useEffect, useLayoutEffect } from "react";
import { DROP_LINE, TrashButton } from "./shared";

/* -----------------------------
   LIST (itemize / enumerate)
----------------------------- */
// A single auto-growing list-item field. Enter starts a new item; Backspace in
// an empty item removes it (and focuses the previous one). Shift+Enter inserts a
// soft line break within the item.
function ListItemInput({ value, fontSize, lineHeight, autoFocus, onChange, onEnter, onEmptyBackspace }: any) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(grow, [value, fontSize]);

  useEffect(() => {
    if (!autoFocus || !ref.current) return;
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter(); }
        else if (e.key === "Backspace" && value === "") { e.preventDefault(); onEmptyBackspace(); }
      }}
      style={{
        flex: 1,
        minWidth: 0,
        display: "block",
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        background: "transparent",
        color: "var(--text)",
        fontFamily: "var(--sans)",
        fontSize,
        lineHeight,
        padding: 0,
        margin: 0,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word"
      }}
    />
  );
}

export function ListBlock({
  node,
  updateListItem,
  addListItem,
  deleteListItem,
  setListStyle,
  deleteNodeById,
  fontSize = 13,
  lineHeight = 1.2
}: any) {
  const items: any[] = node.items ?? [];
  const style: string = node.listStyle ?? "dot";
  const [focusId, setFocusId] = useState<string | null>(null);

  const marker = (i: number) =>
    style === "number" ? `${i + 1}.` : style === "dash" ? "–" : "•";

  const styleBtn = (s: "dot" | "dash" | "number", label: string, glyph: string) => (
    <button
      className="tbl-btn"
      title={label}
      onClick={() => setListStyle(node.id, s)}
      style={{
        width: 24, height: 24, padding: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: style === s ? "#e8eefc" : "#eee",
        border: style === s ? `1px solid ${DROP_LINE}` : "1px solid #ccc",
        color: style === s ? DROP_LINE : "#555",
        borderRadius: 4, cursor: "pointer", fontSize: 13, lineHeight: 1
      }}
    >
      {glyph}
    </button>
  );

  return (
    <div className="hover-target" data-leaf-id={node.id} style={{ margin: "10px 0" }}>
      <div style={{ paddingLeft: "1.5em" }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", lineHeight, fontSize }}>
            <span
              style={{
                minWidth: "1.5em",
                textAlign: "right",
                fontFamily: "var(--sans)",
                color: "var(--text)",
                userSelect: "none",
                fontSize,
                lineHeight
              }}
            >
              {marker(i)}
            </span>
            <ListItemInput
              value={it.text ?? ""}
              fontSize={fontSize}
              lineHeight={lineHeight}
              autoFocus={focusId === it.id}
              onChange={(v: string) => updateListItem(node.id, it.id, v)}
              onEnter={() => {
                const nid = crypto.randomUUID();
                addListItem(node.id, it.id, nid);
                setFocusId(nid);
              }}
              onEmptyBackspace={() => {
                if (items.length <= 1) return;
                const idx = items.findIndex((x) => x.id === it.id);
                const prev = items[idx - 1];
                deleteListItem(node.id, it.id);
                if (prev) setFocusId(prev.id);
              }}
            />
          </div>
        ))}
      </div>

      {/* style toggles + delete — only while the list is hovered */}
      <div className="hover-tools" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: "1.5em" }}>
        {styleBtn("dot", "Bullets (•)", "•")}
        {styleBtn("dash", "Dashes (–)", "–")}
        {styleBtn("number", "Numbers (1.)", "1.")}
        <TrashButton onClick={() => deleteNodeById(node.id)} label="Delete list" />
      </div>
    </div>
  );
}
