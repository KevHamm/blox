import { useEffect, useRef } from "react";
import { TrashButton } from "./shared";

// listings languages offered in the code-block picker ("text" = no language →
// a plain monospace listing). Kept to common ones the LaTeX `listings` package
// knows; unknown values are dropped from the export option.
const CODE_LANGUAGES = [
  "text", "Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "Go",
  "Rust", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "HTML", "XML", "CSS", "Bash", "R", "Matlab", "Haskell"
];

/* -----------------------------
   VERBATIM / CODE — a preformatted, monospace leaf. Content lives in `node.text`
   and is stored + exported raw (no LaTeX escaping). Code blocks add a language
   picker; verbatim blocks don't. The textarea auto-grows so the block measures
   its true height for pagination.
----------------------------- */
export function CodeBlock({ node, updateTextById, updateNodeFields, deleteNodeById, fontSize = 13 }: any) {
  const isCode = node.type === "code";
  const taRef = useRef<HTMLTextAreaElement>(null);

  const autosize = () => {
    const t = taRef.current;
    if (t) { t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }
  };
  useEffect(() => { autosize(); }, [node.text, fontSize]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault(); // keep Tab in the block as two spaces, don't move focus
    const ta = e.currentTarget;
    const s = ta.selectionStart, en = ta.selectionEnd;
    const next = (node.text ?? "").slice(0, s) + "  " + (node.text ?? "").slice(en);
    updateTextById(node.id, next);
    requestAnimationFrame(() => { if (taRef.current) taRef.current.selectionStart = taRef.current.selectionEnd = s + 2; });
  }

  return (
    <div className={`code-blox${isCode ? " is-code" : ""}`}>
      <div className="code-blox-head">
        {isCode ? (
          <select
            className="ui-select code-lang"
            value={node.language ?? "text"}
            onChange={(e) => updateNodeFields(node.id, { language: e.target.value })}
            title="Listing language"
          >
            {CODE_LANGUAGES.map((l) => <option key={l} value={l}>{l === "text" ? "Plain text" : l}</option>)}
          </select>
        ) : (
          <span className="code-blox-tag">Verbatim</span>
        )}
        <TrashButton onClick={() => deleteNodeById(node.id)} label={isCode ? "Delete code block" : "Delete verbatim block"} />
      </div>
      <textarea
        ref={taRef}
        className="code-blox-area"
        rows={1}
        spellCheck={false}
        value={node.text ?? ""}
        placeholder={isCode ? "// your code here…" : "preformatted text…"}
        onChange={(e) => updateTextById(node.id, e.target.value)}
        onInput={autosize}
        onKeyDown={onKeyDown}
        style={{ fontSize: fontSize * 0.92 }}
      />
    </div>
  );
}
