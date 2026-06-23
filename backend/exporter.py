"""Convert the Blox document tree (JSON) into a complete, compilable LaTeX
document.

Everything that can live in the editor is serialised here: sections /
subsections / subsubsections, paragraphs (with bold / italic / underline runs,
centering, footnotes and inline Greek letters), abstracts, lists, tables
(including per-cell background colours), figures, display equations and inline
math, beamer frames, and the cover / contents / bibliography pages. The
preamble pulls in the packages those features need — notably ``amsmath`` for
math and ``graphicx`` for images.

Two entry points:

``document_to_latex(doc, meta)``
    The ``.tex`` source alone. Figure images stay as placeholder filenames the
    user must supply next to the file.

``export_bundle(doc, meta)``
    ``(tex, assets)`` where ``assets`` is a list of ``(filename, bytes)`` —
    every figure image decoded from its editor data-URL, named exactly as the
    ``\\includegraphics`` calls reference it, so zipping the lot up compiles
    as-is.

``meta`` carries editor state that lives outside the doc tree: the template
class (``cls``), the document title, the column count and the body font size.
"""

import base64
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


def text_to_latex(text: str, marks=None, footnotes=None, citations=None, cite_keys=None) -> str:
    """Escape paragraph text and wrap bold/italic/underline runs, inserting
    ``\\footnote{…}`` and ``\\cite{key}`` at the character offsets they anchor to,
    converting newlines to line breaks, and Greek glyphs to LaTeX."""
    text = text or ""
    marks = marks or []
    footnotes = footnotes or []
    citations = citations or []
    cite_keys = cite_keys or {}

    # Inline inserts keyed by the character offset they sit at: footnotes first,
    # then citations (both are anchored by offset in the editor model).
    inserts = {}

    def _clamp(off):
        return max(0, min(int(off), len(text)))

    for f in footnotes:
        if f.get("unconnected") or f.get("offset") is None:
            continue
        inserts.setdefault(_clamp(f["offset"]), []).append(
            r"\footnote{" + text_to_latex(f.get("text", "")) + "}")
    for c in citations:
        if c.get("offset") is None:
            continue
        key = cite_keys.get(c.get("entryId"))
        if key:
            inserts.setdefault(_clamp(c["offset"]), []).append(r"\cite{" + key + "}")

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
        if p in inserts:
            flush()
            out.extend(inserts[p])
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
    colors = node.get("colors") or []

    lines = ["\\begin{table}[h]", "\\centering", f"\\begin{{tabular}}{{{colspec}}}"]
    if h:
        lines.append("\\hline")
    for r, row in enumerate(rows):
        cells = []
        for c, cell in enumerate(row):
            tex = text_to_latex(cell)
            fill = colors[r][c] if r < len(colors) and c < len(colors[r]) else None
            if fill:
                tex = f"\\cellcolor{{{_color_name(fill)}}} " + tex
            cells.append(tex)
        lines.append(" & ".join(cells) + " \\\\")
        if h:
            lines.append("\\hline")
    lines.append("\\end{tabular}")
    caption = node.get("caption", "")
    if caption:
        lines.append("\\caption{" + text_to_latex(caption) + "}")
    lines.append("\\end{table}")
    return "\n".join(lines)


# --- Figures --------------------------------------------------------------
# The editor stores images as data URLs. For a bundle export each one is
# decoded to real bytes and written next to the .tex with a deterministic
# name; pdflatex understands png / jpg / pdf, so anything else keeps its own
# extension and is flagged with a comment.
_DATA_URL = re.compile(r"^data:([^;,]+);base64,(.*)$", re.S)
_MIME_EXT = {
    "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
    "application/pdf": "pdf", "image/pdf": "pdf",
}
_PDFLATEX_OK = {"png", "jpg", "pdf"}


def _decode_image(src):
    """Decode an editor data-URL → ``(bytes, extension)``, or ``(None, None)``."""
    m = _DATA_URL.match(src or "")
    if not m:
        return None, None
    mime, payload = m.group(1).lower(), m.group(2)
    try:
        data = base64.b64decode(payload)
    except Exception:
        return None, None
    ext = _MIME_EXT.get(mime)
    if ext is None:
        ext = re.sub(r"[^a-z0-9]", "", mime.split("/")[-1]) or "bin"
    return data, ext


def _figure_to_latex(node, index: int, assets=None) -> str:
    images = node.get("images", []) or []
    n = len(images) or 1
    width = node.get("width", 1) or 1
    per = min(width, 1.0 / n)
    lines = ["\\begin{figure}[h]", "\\centering"]
    incs, notes = [], []
    for i in range(n):
        src = images[i].get("src") if i < len(images) else None
        name = f"figure-{index}-{i + 1}"
        data, ext = (None, None) if assets is None else _decode_image(src)
        if data is not None:
            fname = f"{name}.{ext}"
            assets.append((fname, data))
            if ext not in _PDFLATEX_OK:
                notes.append(f"% {fname}: pdflatex only reads png/jpg/pdf — convert this file")
            incs.append(f"\\includegraphics[width={round(per, 3)}\\linewidth]{{{fname}}}")
        else:
            notes.append(f"% supply an image file named {name} (png/jpg/pdf) next to this .tex")
            incs.append(f"\\includegraphics[width={round(per, 3)}\\linewidth]{{{name}}}")
    lines += notes
    lines.append("\\hfill".join(incs))
    caption = node.get("caption", "")
    if caption:
        lines.append("\\caption{" + text_to_latex(caption) + "}")
    lines.append("\\end{figure}")
    return "\n".join(lines)


# --- Free-form overlay shapes -------------------------------------------
# Shapes are stored in editor pixels (96 dpi) measured from each page's top-left
# corner. LaTeX's default article paper is US-Letter (612 × 792 bp), so 1 px =
# 72/96 = 0.75 bp and the page is 792 bp tall. We place each page's shapes with
# eso-pic's per-page shipout hook + a TikZ overlay anchored at the page's lower-
# left corner, so they land exactly where they were drawn.
_BP = 0.75          # px → bp
_PAGE_H_BP = 792.0  # US-Letter height in bp


def _color_name(hex_str: str) -> str:
    return "bloxc" + (hex_str or "").lstrip("#").upper()


def _num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _shape_draw(s) -> str:
    x, y = _num(s.get("x")), _num(s.get("y"))
    w, h = _num(s.get("w")), _num(s.get("h"))
    sw = max(_num(s.get("strokeWidth")) or 1.0, 0.1)
    kind = s.get("kind")
    opts = [f"draw={_color_name(s.get('color', '#000000'))}", f"line width={round(sw * _BP, 2)}bp"]

    x1, x2 = round(x * _BP, 2), round((x + w) * _BP, 2)
    y_top, y_bot = round(_PAGE_H_BP - y * _BP, 2), round(_PAGE_H_BP - (y + h) * _BP, 2)

    if kind in ("rect", "circle") and s.get("fill"):
        opts.append(f"fill={_color_name(s.get('fill'))}")

    if kind == "rect":
        return f"\\draw[{', '.join(opts)}] ({x1},{y_bot}) rectangle ({x2},{y_top});"
    if kind == "circle":
        cx, cy = round((x + w / 2) * _BP, 2), round(_PAGE_H_BP - (y + h / 2) * _BP, 2)
        rx, ry = round((w / 2) * _BP, 2), round((h / 2) * _BP, 2)
        return f"\\draw[{', '.join(opts)}] ({cx},{cy}) ellipse [x radius={rx}, y radius={ry}];"

    # line / arrow — across the chosen diagonal of the box.
    (px1, py1), (px2, py2) = ((x1, y_bot), (x2, y_top)) if s.get("flip") else ((x1, y_top), (x2, y_bot))
    if kind == "arrow":
        opts.append(f"-{{Latex[length={round(max(6.0, sw * 2.2), 2)}bp]}}")
    return f"\\draw[{', '.join(opts)}] ({px1},{py1}) -- ({px2},{py2});"


def _shapes_to_latex(shapes):
    """Return (colour name → hex dict, shipout-hook lines) for the shapes, or
    ({}, []) when there are none."""
    shapes = [s for s in (shapes or []) if s.get("kind")]
    if not shapes:
        return {}, []

    # One \definecolor per distinct stroke / fill colour.
    colors = {}
    for s in shapes:
        for key in ("color", "fill"):
            c = s.get(key)
            if c:
                colors[_color_name(c)] = c.lstrip("#").upper()

    by_page = {}
    for s in shapes:
        by_page.setdefault(int(_num(s.get("page"))), []).append(s)

    hook = ["\\AddToShipoutPictureFG{%"]
    for p in sorted(by_page):
        hook.append(f"  \\ifnum\\value{{page}}={p + 1}\\relax")
        hook.append("    \\AtPageLowerLeft{%")
        hook.append("      \\begin{tikzpicture}[overlay,x=1bp,y=1bp]")
        for s in by_page[p]:
            hook.append("        " + _shape_draw(s))
        hook.append("      \\end{tikzpicture}}%")
        hook.append("  \\fi")
    hook.append("}")
    return colors, hook


def _collect_table_colors(node, out):
    """Walk the tree gathering every table cell colour (name → hex)."""
    if node.get("type") == "table":
        for row in (node.get("colors") or []):
            for c in row:
                if c:
                    out[_color_name(c)] = c.lstrip("#").upper()
    for ch in node.get("children", []) or []:
        _collect_table_colors(ch, out)


def _collect_design_colors(node, out):
    """Walk the tree gathering every imported design-page colour (background and
    element colours), keyed name → hex."""
    if node.get("type") == "designpage":
        design = node.get("design") or {}
        bg = design.get("bg")
        if bg:
            out[_color_name(bg)] = bg.lstrip("#").upper()
        for el in design.get("elements", []) or []:
            for key in ("color", "fill", "stroke"):
                c = el.get(key)
                if c:
                    out[_color_name(c)] = c.lstrip("#").upper()
    for ch in node.get("children", []) or []:
        _collect_design_colors(ch, out)


# Section depth → command.
_SECTION_CMD = {0: "section", 1: "subsection", 2: "subsubsection"}

# Code-block language (editor picker / imported value, lowercased) → the name the
# LaTeX ``listings`` package knows. Languages listings doesn't ship (JS, Go, Rust,
# …) are absent → the listing is emitted with no ``language=`` option.
_LST_LANGS = {
    "python": "Python", "java": "Java", "c": "C", "c++": "C++", "ruby": "Ruby",
    "php": "PHP", "sql": "SQL", "html": "HTML", "xml": "XML", "r": "R",
    "matlab": "Matlab", "haskell": "Haskell", "bash": "bash", "perl": "Perl",
    "pascal": "Pascal", "fortran": "Fortran",
}


def _has_node_type(node, type_name: str) -> bool:
    """True when any node in the tree has ``type == type_name``."""
    if not node:
        return False
    if node.get("type") == type_name:
        return True
    return any(_has_node_type(c, type_name) for c in node.get("children", []) or [])


def _design_page_to_latex(node, ctx=None) -> str:
    """An imported design page → its own full page: a TikZ picture (background +
    every element) scaled to the text width. Reuses the design-element drawing
    used by the standalone cover export. Image elements are decoded into the
    bundle assets (a running per-document counter keeps their filenames unique)."""
    design = node.get("design") or {}
    elements = design.get("elements", []) or []
    pw = _num(design.get("pageWidth")) or 816.0
    ph = _num(design.get("pageHeight")) or 1056.0
    pw_bp, ph_bp = round(pw * _BP, 2), round(ph * _BP, 2)
    bg = design.get("bg") or "#ffffff"
    assets = ctx.get("assets") if ctx else None

    gidx = ctx.get("design_eli", 0) if ctx is not None else 0
    draws = [f"\\fill[{_color_name(bg)}] (0,0) rectangle ({pw_bp},{ph_bp});"]
    for el in elements:
        if not el.get("kind"):
            gidx += 1
            continue
        draws.append(_design_el_tikz(el, ph_bp, gidx, assets))
        gidx += 1
    if ctx is not None:
        ctx["design_eli"] = gidx

    pic = ["\\begin{tikzpicture}[x=1bp,y=1bp]"] + ["  " + d for d in draws] + ["\\end{tikzpicture}"]
    return (
        "\\clearpage\n{\\thispagestyle{empty}%\n\\begin{center}%\n"
        "\\resizebox{\\textwidth}{!}{%\n" + "\n".join(pic) + "}%\n"
        "\\end{center}}\n\\clearpage"
    )


def node_to_latex(node, depth: int = 0, ctx=None) -> str:
    # `ctx` threads the figure counter and (for bundle exports) the list that
    # decoded image files are appended to; `assets` of None means "tex only".
    if ctx is None:
        ctx = {"fig": 0, "assets": None}
    t = node.get("type")

    if t == "designpage":
        return _design_page_to_latex(node, ctx)

    if t == "paragraph":
        body = text_to_latex(node.get("text", ""), node.get("marks"), node.get("footnotes"),
                             node.get("citations"), ctx.get("cite_keys"))
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
        ctx["fig"] += 1
        return _figure_to_latex(node, ctx["fig"], ctx.get("assets"))

    if t == "math":
        body = _math_body(node)
        if node.get("display"):
            return "\\begin{equation}\n" + body + "\n\\end{equation}"
        return "\\[\n" + body + "\n\\]"

    # Preformatted blocks — content is emitted RAW (never escaped).
    if t == "verbatim":
        return "\\begin{verbatim}\n" + (node.get("text") or "") + "\n\\end{verbatim}"

    if t == "code":
        lang = (node.get("language") or "").strip().lower()
        mapped = _LST_LANGS.get(lang)
        opt = f"[language={mapped}]" if mapped else ""
        return "\\begin{lstlisting}" + opt + "\n" + (node.get("text") or "") + "\n\\end{lstlisting}"

    if t == "coverpage":
        return "\\begin{titlepage}\n\\centering\n\\vspace*{\\fill}\n{\\Huge " \
               + text_to_latex(node.get("title", "")) + "}\n\\vspace*{\\fill}\n\\end{titlepage}"

    if t == "toc":
        return "\\tableofcontents\n\\newpage"

    if t == "bibliography":
        # With real entries, defer to BibTeX (the .bib is emitted via filecontents
        # and the chosen \bibliographystyle); otherwise keep a placeholder.
        if ctx.get("bib_entries"):
            ctx["bib_emitted"] = True
            return ("\\bibliographystyle{" + ctx.get("bib_style", "IEEEtran") + "}\n"
                    "\\bibliography{refs}")
        return ("\\begin{thebibliography}{9}\n"
                "  \\bibitem{ref1} Author, \\emph{Title}, Year.\n"
                "\\end{thebibliography}")

    if t == "frame":  # beamer slide
        title = text_to_latex(strip_prefix(node.get("title", "")))
        inner = "\n".join(node_to_latex(c, 0, ctx) for c in node.get("children", []))
        # A frame holding verbatim / lstlisting must be \begin{frame}[fragile].
        fragile = _has_node_type(node, "verbatim") or _has_node_type(node, "code")
        if node.get("frameVariant") == "title":
            # The centered title slide: big title, content (author / date) below.
            opt = "[plain,fragile]" if fragile else "[plain]"
            return ("\\begin{frame}" + opt + "\n\\centering\n\\vfill\n{\\LARGE "
                    + title + "\\par}\n\\bigskip\n" + inner + "\n\\vfill\n\\end{frame}")
        opt = "[fragile]" if fragile else ""
        return "\\begin{frame}" + opt + "{" + title + "}\n" + inner + "\n\\end{frame}"

    if t in ("section", "subsection", "subsubsection"):
        cmd = {"section": "section", "subsection": "subsection",
               "subsubsection": "subsubsection"}[t]
        title = text_to_latex(strip_prefix(node.get("title", cmd.capitalize())))
        lines = [f"\\{cmd}{{{title}}}"]
        for child in node.get("children", []):
            lines.append(node_to_latex(child, depth + 1, ctx))
        return "\n\n".join(lines)

    # Unknown / structural-only node: serialise its children if any.
    children = node.get("children", [])
    if children:
        return "\n\n".join(node_to_latex(c, depth, ctx) for c in children)
    return ""


def export_bundle(doc, meta=None, bundle_assets=True):
    """Serialise the document → ``(tex, assets)``.

    ``assets`` is a list of ``(filename, bytes)`` for every figure image that
    could be decoded from its data-URL (empty when ``bundle_assets`` is False —
    figures then keep placeholder names the user must supply).
    """
    meta = meta or {}
    children = doc.get("children", []) if doc else []
    cls = (meta.get("cls") or "").lower()
    is_beamer = cls == "beamer" or any(c.get("type") == "frame" for c in children)

    has_designpage = bool(doc) and _has_node_type(doc, "designpage")

    shape_colors, hook_lines = _shapes_to_latex(doc.get("shapes") if doc else None)
    table_colors = {}
    design_colors = {}
    if doc:
        _collect_table_colors(doc, table_colors)
        _collect_design_colors(doc, design_colors)
    all_colors = {**shape_colors, **table_colors, **design_colors}
    color_lines = [f"\\definecolor{{{name}}}{{HTML}}{{{hexv}}}"
                   for name, hexv in sorted(all_colors.items())]

    # Class options: body size (10pt is the default; the editor's 13px ≈ 10pt)
    # and two-column flow. Beamer loads xcolor itself, so its table-colour
    # support has to come in as a class option rather than a \usepackage.
    opts = []
    pt = _num(meta.get("fontSizePx")) * 72.0 / 96.0
    if not is_beamer:
        if pt >= 11.5:
            opts.append("12pt")
        elif pt >= 10.5:
            opts.append("11pt")
        if int(_num(meta.get("columns")) or 1) >= 2:
            opts.append("twocolumn")
    elif table_colors:
        opts.append("xcolor={table}")

    base = "beamer" if is_beamer else {"report": "report", "book": "book"}.get(cls, "article")
    opt_s = "[" + ",".join(opts) + "]" if opts else ""

    preamble = [
        f"\\documentclass{opt_s}{{{base}}}",
        "\\usepackage[utf8]{inputenc}",
        "\\usepackage{amsmath}",
        "\\usepackage{amssymb}",
        "\\usepackage{graphicx}",
    ]
    if cls == "letter":
        # The editor's letter template is article geometry with 1-inch margins
        # (the letter class has no \section, so article + geometry mirrors it).
        preamble.append("\\usepackage[margin=1in]{geometry}")
    if doc and _has_node_type(doc, "code"):
        # `listings` powers the code blocks; verbatim needs no package.
        preamble.append("\\usepackage{listings}")
        preamble.append("\\lstset{basicstyle=\\ttfamily\\small, breaklines=true, columns=fullflexible, frame=single, framesep=4pt, xleftmargin=4pt}")
    if not is_beamer:
        if table_colors:
            preamble.append("\\usepackage[table]{xcolor}")  # also loads colortbl
        elif all_colors:
            preamble.append("\\usepackage{xcolor}")
    if hook_lines or has_designpage:
        # Overlay shapes and imported design pages are drawn with TikZ (the Latex
        # arrow tip is used by overlay arrows); only the per-page overlay shapes
        # also need eso-pic's foreground shipout hook.
        preamble += ["\\usepackage{tikz}", "\\usetikzlibrary{arrows.meta}"]
        if hook_lines:
            preamble.append("\\usepackage{eso-pic}")
    preamble += color_lines
    preamble += hook_lines

    # \maketitle for classes that support it, unless the document already has
    # its own cover page (which would duplicate the title).
    title = (meta.get("title") or "").strip()
    has_cover = any(c.get("type") == "coverpage" for c in children)
    use_maketitle = bool(title) and not is_beamer and cls != "letter" and not has_cover
    if use_maketitle:
        preamble += [f"\\title{{{text_to_latex(title)}}}", "\\author{}", "\\date{}"]

    # Bibliography: entryId → cite key, the chosen style, and the raw .bib body.
    bib = (doc.get("bib") if doc else None) or {}
    bib_entries = bib.get("entries") or []
    bib_style = bib.get("style") or "IEEEtran"
    cite_keys = {e.get("id"): e.get("key") for e in bib_entries if e.get("key")}

    assets = []
    ctx = {
        "fig": 0,
        "assets": assets if bundle_assets else None,
        "cite_keys": cite_keys,
        "bib_entries": bool(bib_entries),
        "bib_style": bib_style,
        "bib_emitted": False,
    }
    body = ["\\begin{document}"]
    if use_maketitle:
        body.append("\\maketitle")
    for child in children:
        chunk = node_to_latex(child, 0, ctx)
        if chunk.strip():
            body.append(chunk)
    # Entries exist but no bibliography page was placed → append one at the end.
    if bib_entries and not ctx["bib_emitted"]:
        body.append("\\bibliographystyle{" + bib_style + "}\n\\bibliography{refs}")
    body.append("\\end{document}")

    # The .bib ships inline via filecontents so the archive compiles with the
    # standard latex → bibtex → latex × 2 run (no separate file to manage).
    head = ""
    if bib_entries:
        refs = "\n\n".join((e.get("raw") or "").strip() for e in bib_entries)
        head = (
            "% Run: pdflatex -> bibtex -> pdflatex (x2) to resolve citations.\n"
            "\\begin{filecontents*}[overwrite]{refs.bib}\n" + refs + "\n\\end{filecontents*}\n\n"
        )

    tex = head + "\n".join(preamble) + "\n\n" + "\n\n".join(body) + "\n"
    return tex, assets


def document_to_latex(doc, meta=None) -> str:
    tex, _ = export_bundle(doc, meta, bundle_assets=False)
    return tex


# --- Free-form design pages (the "Design a page" cover editor) -----------
# A design page places elements (text / image / rect / line) at absolute pixel
# coordinates from the page's top-left corner. We mirror the overlay-shape
# machinery: geometry sizes the paper to the page, eso-pic's per-page foreground
# hook drops a TikZ overlay anchored at the page's lower-left corner, and every
# element is converted to bp coordinates (1 px = 0.75 bp, page chosen at 96 dpi).

# DOC_FONTS id → a PSNFSS family code that ships with base LaTeX (no extra
# package). Georgia has no LaTeX equivalent, so it falls back to Times; Computer
# Modern is the default family (None ⇒ leave the family alone).
_DESIGN_FONT = {"times": "ptm", "palatino": "ppl", "helvetica": "phv", "georgia": "ptm", "cm": None}


def _esc_plain(text: str) -> str:
    """Escape text for a TikZ node body, turning newlines into forced breaks."""
    out = []
    for ch in (text or ""):
        out.append("\\\\ " if ch == "\n" else _esc_char(ch))
    return "".join(out)


def _design_el_tikz(el, page_h_bp: float, index: int, assets) -> str:
    x, y = _num(el.get("x")), _num(el.get("y"))
    w, h = _num(el.get("w")), _num(el.get("h"))
    X = round(x * _BP, 2)
    Y_top = round(page_h_bp - y * _BP, 2)
    Wbp, Hbp = round(w * _BP, 2), round(h * _BP, 2)
    kind = el.get("kind")

    if kind == "rect":
        opts = []
        if el.get("fill"):
            opts.append(f"fill={_color_name(el['fill'])}")
        sw = _num(el.get("strokeWidth"))
        if sw > 0:
            opts += [f"draw={_color_name(el.get('stroke', '#111111'))}", f"line width={round(sw * _BP, 2)}bp"]
        if not opts:
            opts.append("draw=none")
        return f"\\draw[{', '.join(opts)}] ({X},{round(Y_top - Hbp, 2)}) rectangle ({round(X + Wbp, 2)},{Y_top});"

    if kind == "line":
        sw = max(_num(el.get("strokeWidth")) or 1.0, 0.1)
        return (f"\\draw[draw={_color_name(el.get('stroke', '#111111'))}, line width={round(sw * _BP, 2)}bp] "
                f"({X},{Y_top}) -- ({round(X + Wbp, 2)},{round(Y_top - Hbp, 2)});")

    if kind == "image":
        name = f"image-{index + 1}"
        data, ext = (None, None) if assets is None else _decode_image(el.get("src"))
        if data is not None:
            fname = f"{name}.{ext}"
            assets.append((fname, data))
        else:
            fname = name  # placeholder the user supplies next to the .tex
        inc = f"\\includegraphics[width={Wbp}bp,height={Hbp}bp]{{{fname}}}"
        rot = _num(el.get("rotation"))
        if rot:
            # Rotate about the element centre (screen CW → TikZ CCW, so negate).
            cx, cy = round(X + Wbp / 2, 2), round(Y_top - Hbp / 2, 2)
            return f"\\node[anchor=center, rotate={round(-rot, 2)}, inner sep=0pt] at ({cx},{cy}) {{{inc}}};"
        return f"\\node[anchor=north west, inner sep=0pt] at ({X},{Y_top}) {{{inc}}};"

    # text
    align = {"left": "left", "center": "center", "right": "right"}.get(el.get("align", "left"), "left")
    fs = round(max(_num(el.get("fontSize")) or 24.0, 1.0) * _BP, 2)
    bl = round(fs * 1.2, 2)
    fam = _DESIGN_FONT.get(el.get("fontFamily", "cm"))
    font_cmd = (f"\\fontfamily{{{fam}}}" if fam else "") + f"\\fontsize{{{fs}}}{{{bl}}}\\selectfont"
    body = _esc_plain(el.get("text", ""))
    if el.get("underline"):
        body = r"\underline{" + body + "}"
    if el.get("italic"):
        body = r"\textit{" + body + "}"
    if el.get("bold"):
        body = r"\textbf{" + body + "}"
    return (f"\\node[anchor=north west, text width={Wbp}bp, align={align}, inner sep=0pt, "
            f"text={_color_name(el.get('color', '#111111'))}, font={{{font_cmd}}}] "
            f"at ({X},{Y_top}) {{{body}}};")


def export_design_bundle(design, title=None, bundle_assets=True):
    """Serialise a design page → ``(tex, assets)`` — a one-page, compilable
    titlepage whose elements are positioned by a single TikZ overlay."""
    design = design or {}
    elements = design.get("elements", []) or []
    pw = _num(design.get("pageWidth")) or 816.0
    ph = _num(design.get("pageHeight")) or 1056.0
    pw_bp, ph_bp = round(pw * _BP, 2), round(ph * _BP, 2)
    bg = design.get("bg") or "#ffffff"

    colors = {_color_name(bg): bg.lstrip("#").upper()}
    for el in elements:
        for key in ("color", "fill", "stroke"):
            c = el.get(key)
            if c:
                colors[_color_name(c)] = c.lstrip("#").upper()
    color_lines = [f"\\definecolor{{{name}}}{{HTML}}{{{hexv}}}" for name, hexv in sorted(colors.items())]

    assets = []
    draws = [f"\\fill[{_color_name(bg)}] (0,0) rectangle ({pw_bp},{ph_bp});"]
    for i, el in enumerate(elements):
        if not el.get("kind"):
            continue
        draws.append(_design_el_tikz(el, ph_bp, i, assets if bundle_assets else None))

    hook = ["\\AddToShipoutPictureFG{%", "  \\AtPageLowerLeft{%", "    \\begin{tikzpicture}[overlay,x=1bp,y=1bp]"]
    hook += ["      " + d for d in draws]
    hook += ["    \\end{tikzpicture}}%", "}"]

    preamble = [
        "\\documentclass{article}",
        "\\usepackage[utf8]{inputenc}",
        f"\\usepackage[paperwidth={pw_bp}bp,paperheight={ph_bp}bp,margin=0pt]{{geometry}}",
        "\\usepackage{graphicx}",
        "\\usepackage{xcolor}",
        "\\usepackage{tikz}",
        "\\usetikzlibrary{arrows.meta}",
        "\\usepackage{eso-pic}",
        "\\pagestyle{empty}",
    ]
    preamble += color_lines
    preamble += hook

    body = ["\\begin{document}", "\\null", "\\end{document}"]
    tex = "\n".join(preamble) + "\n\n" + "\n".join(body) + "\n"
    return tex, assets


def design_to_latex(design, title=None) -> str:
    tex, _ = export_design_bundle(design, title, bundle_assets=False)
    return tex
