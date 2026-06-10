"""Convert the Blox document tree (JSON) into a complete, compilable LaTeX
document.

Everything that can live in the editor is serialised here: sections /
subsections / subsubsections, paragraphs (with bold / italic / underline runs,
centering, footnotes and inline Greek letters), abstracts, lists, tables,
figures, display equations and inline math, beamer frames, and the cover /
contents / bibliography pages. The preamble pulls in the packages those features
need — notably ``amsmath`` for math and ``graphicx`` for images.
"""

import re

# --- Greek letters -------------------------------------------------------
# Unicode Greek (typed in the editor) → LaTeX. Letters that coincide with a
# Latin glyph (omicron, capital Alpha, …) map to that glyph; the rest use the
# math-mode command wrapped in ``$ … $`` so they render under pdflatex.
_GREEK_LOWER_NAMES = [
    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho",
    "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
]
_GREEK_LOWER_CHARS = "αβγδεζηθικλμνξοπρστυφχψω"
_GREEK_UPPER_CHARS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ"
# Capitals that have no dedicated LaTeX command (they look like Latin letters).
_UPPER_AS_LATIN = {
    "Alpha": "A", "Beta": "B", "Epsilon": "E", "Zeta": "Z", "Eta": "H",
    "Iota": "I", "Kappa": "K", "Mu": "M", "Nu": "N", "Omicron": "O",
    "Rho": "P", "Tau": "T", "Chi": "X",
}

GREEK = {}
for _name, _lc, _uc in zip(_GREEK_LOWER_NAMES, _GREEK_LOWER_CHARS, _GREEK_UPPER_CHARS):
    GREEK[_lc] = "o" if _name == "omicron" else f"$\\{_name}$"
    cap = _name.capitalize()
    GREEK[_uc] = _UPPER_AS_LATIN[cap] if cap in _UPPER_AS_LATIN else f"$\\{cap}$"

# Arrow / harpoon glyphs (typed via autocorrect or the Math-symbols palette) →
# their math-mode LaTeX command.
_ARROW_NAMES = {
    "→": "rightarrow", "←": "leftarrow", "⇒": "Rightarrow", "⇐": "Leftarrow",
    "↔": "leftrightarrow", "⇔": "Leftrightarrow", "↦": "mapsto", "⟼": "longmapsto",
    "⇌": "rightleftharpoons", "↑": "uparrow", "↓": "downarrow", "⇑": "Uparrow",
    "⇓": "Downarrow", "⇕": "Updownarrow", "↕": "updownarrow", "↗": "nearrow",
    "↘": "searrow", "↙": "swarrow", "↖": "nwarrow", "↼": "leftharpoonup",
    "⇀": "rightharpoonup", "↽": "leftharpoondown", "⇁": "rightharpoondown",
}
ARROWS = {ch: f"$\\{name}$" for ch, name in _ARROW_NAMES.items()}

# Math symbol glyphs (typed in text via the symbol menu) → math-mode command.
# Kept in sync with the editor's MATH_SYMBOLS map (frontend/src/utils/greek.ts).
_MATH_SYM_NAMES = {
    "∞": "infty", "∀": "forall", "ℜ": "Re", "ℑ": "Im", "∇": "nabla",
    "∃": "exists", "∂": "partial", "∄": "nexists", "∅": "emptyset",
    "⌀": "varnothing", "℘": "wp", "∁": "complement", "¬": "neg", "⋯": "cdots",
    "□": "square", "■": "blacksquare", "△": "triangle",
    "×": "times", "⋅": "cdot", "÷": "div", "∩": "cap", "∪": "cup", "≠": "neq",
    "≤": "leq", "≥": "geq", "∈": "in", "⊥": "perp", "∉": "notin", "⊂": "subset",
    "≃": "simeq", "≈": "approx", "∧": "wedge", "∨": "vee", "⊕": "oplus",
    "⊗": "otimes", "⊠": "boxtimes", "≡": "equiv", "≅": "cong",
}
MATH_SYMS = {ch: f"$\\{name}$" for ch, name in _MATH_SYM_NAMES.items()}

# LaTeX special characters that must be escaped in ordinary text.
_SPECIAL = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

_TRAILING_PUNCT = re.compile(r"[.,;:!?)\]}'\"»]+$")


def strip_prefix(title: str) -> str:
    """Drop any leading auto-number ("1.2 ") the editor may have baked in."""
    return re.sub(r"^\d+(\.\d+)*\s*", "", title or "")


def _esc_char(ch: str) -> str:
    if ch in GREEK:
        return GREEK[ch]
    if ch in ARROWS:
        return ARROWS[ch]
    if ch in MATH_SYMS:
        return MATH_SYMS[ch]
    return _SPECIAL.get(ch, ch)


def _fmt_at(marks, i: int):
    for m in marks:
        if m.get("start", 0) <= i < m.get("end", 0):
            return (bool(m.get("b")), bool(m.get("i")), bool(m.get("u")))
    return (False, False, False)


def _wrap(text: str, fmt) -> str:
    if not text:
        return ""
    b, i, u = fmt
    if u:
        text = r"\underline{" + text + "}"
    if i:
        text = r"\textit{" + text + "}"
    if b:
        text = r"\textbf{" + text + "}"
    return text


def text_to_latex(text: str, marks=None, footnotes=None) -> str:
    """Escape paragraph text and wrap bold/italic/underline runs, inserting
    ``\\footnote{…}`` after the words footnotes are attached to, converting
    newlines to line breaks, and Greek glyphs to LaTeX."""
    text = text or ""
    marks = marks or []
    footnotes = footnotes or []

    # Footnotes keyed by the character offset they sit at (end of the word core).
    fn_at = {}
    if footnotes:
        pos, word_idx = 0, -1
        for tok in re.split(r"(\s+)", text):
            if tok == "":
                continue
            if tok.strip() == "":
                pos += len(tok)
                continue
            word_idx += 1
            fns = [f for f in footnotes if f.get("word") == word_idx]
            if fns:
                core = _TRAILING_PUNCT.sub("", tok)
                fn_at.setdefault(pos + len(core), []).extend(fns)
            pos += len(tok)

    out = []
    buf = []
    cur = None

    def flush():
        nonlocal buf, cur
        if buf:
            out.append(_wrap("".join(buf), cur if cur else (False, False, False)))
        buf = []

    n = len(text)
    p = 0
    while p <= n:
        if p in fn_at:
            flush()
            for f in fn_at[p]:
                out.append(r"\footnote{" + text_to_latex(f.get("text", "")) + "}")
            cur = None
        if p == n:
            break
        ch = text[p]
        if ch == "\n":
            flush()
            q = p
            while q < n and text[q] == "\n":
                q += 1
            out.append("\\\\\n" if q - p == 1 else "\n\n")
            cur = None
            p = q
            continue
        fmt = _fmt_at(marks, p)
        if fmt != cur:
            flush()
            cur = fmt
        buf.append(_esc_char(ch))
        p += 1
    flush()
    return "".join(out)


def _math_body(node) -> str:
    items = node.get("items")
    if items:
        return " ".join((it.get("latex") or "") for it in items if (it.get("latex") or "").strip())
    return node.get("latex", "") or ""


def _list_to_latex(node, depth: int) -> str:
    style = node.get("listStyle", "dot")
    env = "enumerate" if style == "number" else "itemize"
    lines = [f"\\begin{{{env}}}"]
    for it in node.get("items", []):
        marker = "[--] " if (style == "dash" and env == "itemize") else ""
        lines.append("  \\item " + marker + text_to_latex(it.get("text", "")))
    lines.append(f"\\end{{{env}}}")
    return "\n".join(lines)


def _table_to_latex(node) -> str:
    rows = node.get("rows", [])
    if not rows:
        return ""
    cols = len(rows[0])
    borders = node.get("borders", {}) or {}
    v = borders.get("v", True) is not False
    h = borders.get("h", True) is not False
    colspec = ("|" + "|".join(["c"] * cols) + "|") if v else ("c" * cols)

    lines = ["\\begin{table}[h]", "\\centering", f"\\begin{{tabular}}{{{colspec}}}"]
    if h:
        lines.append("\\hline")
    for row in rows:
        cells = " & ".join(text_to_latex(c) for c in row)
        lines.append(cells + " \\\\")
        if h:
            lines.append("\\hline")
    lines.append("\\end{tabular}")
    caption = node.get("caption", "")
    if caption:
        lines.append("\\caption{" + text_to_latex(caption) + "}")
    lines.append("\\end{table}")
    return "\n".join(lines)


def _figure_to_latex(node, index: int) -> str:
    images = node.get("images", []) or []
    n = len(images) or 1
    width = node.get("width", 1) or 1
    per = min(width, 1.0 / n)
    lines = ["\\begin{figure}[h]", "\\centering"]
    # Images are stored as data URLs in the editor; reference them by filename.
    lines.append("% replace the filenames below with your exported image files")
    incs = [f"\\includegraphics[width={round(per, 3)}\\linewidth]{{figure-{index}-{i + 1}}}"
            for i in range(n)]
    lines.append("\\hfill".join(incs))
    caption = node.get("caption", "")
    if caption:
        lines.append("\\caption{" + text_to_latex(caption) + "}")
    lines.append("\\end{figure}")
    return "\n".join(lines)


# Section depth → command.
_SECTION_CMD = {0: "section", 1: "subsection", 2: "subsubsection"}


def node_to_latex(node, depth: int = 0, fig_counter=None) -> str:
    if fig_counter is None:
        fig_counter = [0]
    t = node.get("type")

    if t == "paragraph":
        body = text_to_latex(node.get("text", ""), node.get("marks"), node.get("footnotes"))
        if node.get("align") == "center":
            return "\\begin{center}\n" + body + "\n\\end{center}"
        return body

    if t == "abstract":
        return "\\begin{abstract}\n" + text_to_latex(node.get("text", "")) + "\n\\end{abstract}"

    if t == "list":
        return _list_to_latex(node, depth)

    if t == "table":
        return _table_to_latex(node)

    if t == "figure":
        fig_counter[0] += 1
        return _figure_to_latex(node, fig_counter[0])

    if t == "math":
        body = _math_body(node)
        if node.get("display"):
            return "\\begin{equation}\n" + body + "\n\\end{equation}"
        return "\\[\n" + body + "\n\\]"

    if t == "coverpage":
        return "\\begin{titlepage}\n\\centering\n\\vspace*{\\fill}\n{\\Huge " \
               + text_to_latex(node.get("title", "")) + "}\n\\vspace*{\\fill}\n\\end{titlepage}"

    if t == "toc":
        return "\\tableofcontents\n\\newpage"

    if t == "bibliography":
        return ("\\begin{thebibliography}{9}\n"
                "  \\bibitem{ref1} Author, \\emph{Title}, Year.\n"
                "\\end{thebibliography}")

    if t == "frame":  # beamer slide
        title = text_to_latex(strip_prefix(node.get("title", "")))
        inner = "\n".join(node_to_latex(c, 0, fig_counter) for c in node.get("children", []))
        return "\\begin{frame}{" + title + "}\n" + inner + "\n\\end{frame}"

    if t in ("section", "subsection", "subsubsection"):
        cmd = {"section": "section", "subsection": "subsection",
               "subsubsection": "subsubsection"}[t]
        title = text_to_latex(strip_prefix(node.get("title", cmd.capitalize())))
        lines = [f"\\{cmd}{{{title}}}"]
        for child in node.get("children", []):
            lines.append(node_to_latex(child, depth + 1, fig_counter))
        return "\n\n".join(lines)

    # Unknown / structural-only node: serialise its children if any.
    children = node.get("children", [])
    if children:
        return "\n\n".join(node_to_latex(c, depth, fig_counter) for c in children)
    return ""


def document_to_latex(doc) -> str:
    children = doc.get("children", []) if doc else []
    is_beamer = any(c.get("type") == "frame" for c in children)

    preamble = [
        "\\documentclass{beamer}" if is_beamer else "\\documentclass{article}",
        "\\usepackage[utf8]{inputenc}",
        "\\usepackage{amsmath}",
        "\\usepackage{amssymb}",
        "\\usepackage{graphicx}",
    ]

    fig_counter = [0]
    body = ["\\begin{document}"]
    for child in children:
        chunk = node_to_latex(child, 0, fig_counter)
        if chunk.strip():
            body.append(chunk)
    body.append("\\end{document}")

    return "\n".join(preamble) + "\n\n" + "\n\n".join(body) + "\n"
