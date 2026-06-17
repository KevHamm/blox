// Body fonts offered across the editor. `css` is a font-family value applied to
// document/page text; "cm" is the LaTeX default (Computer Modern via KaTeX).
// Shared by the document editor's Typography panel and the page designer's text
// elements. `latex` names the package/family the exporter should select.
export const DOC_FONTS = [
  { id: "cm",        label: "Computer Modern", css: '"KaTeX_Main", Georgia, serif',                              latex: "cm" },
  { id: "times",     label: "Times",           css: '"Times New Roman", Times, serif',                           latex: "times" },
  { id: "palatino",  label: "Palatino",        css: '"Palatino Linotype", "Book Antiqua", Palatino, serif',      latex: "palatino" },
  { id: "georgia",   label: "Georgia",         css: 'Georgia, "Times New Roman", serif',                         latex: "georgia" },
  { id: "helvetica", label: "Helvetica",       css: 'Helvetica, Arial, sans-serif',                              latex: "helvetica" }
];

export const docFontCss = (id: string) => DOC_FONTS.find((f) => f.id === id)?.css ?? DOC_FONTS[0].css;
