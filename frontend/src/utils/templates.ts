// Per-template page layout. Geometry is at 96 DPI. The defining feature of each
// LaTeX document class is reproduced: article/report/book keep the narrow ~345pt
// text column on US-Letter; letter uses wide 1-inch margins; beamer is a small
// 4:3 landscape slide with larger type.
import type { DocumentNode } from "../types/document";

export type TemplateLayout = {
  cls: string;         // the LaTeX class this mirrors
  pageWidth: number;
  pageHeight: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  textWidth: number;   // body text column width
  columns: number;
  fontSize: number;    // px (≈ 10pt = 13px)
  lineHeight: number;
  title: string;
};

// US-Letter at 96 DPI.
const LW = 816;
const LH = 1056;

export const TEMPLATES: Record<string, TemplateLayout> = {
  // \documentclass{article} — letter, 10pt, ~345pt (≈66 char) text column.
  article: {
    cls: "article",
    pageWidth: LW, pageHeight: LH,
    padTop: 135, padBottom: 145, padLeft: 179, padRight: 179,
    textWidth: 458, columns: 1, fontSize: 13, lineHeight: 1.2,
    title: "Article Title"
  },
  // \documentclass{report} — same geometry as article (chapters differ).
  report: {
    cls: "report",
    pageWidth: LW, pageHeight: LH,
    padTop: 135, padBottom: 145, padLeft: 179, padRight: 179,
    textWidth: 458, columns: 1, fontSize: 13, lineHeight: 1.2,
    title: "Report Title"
  },
  // \documentclass{letter} — wide 1-inch (96px) margins, no title.
  letter: {
    cls: "letter",
    pageWidth: LW, pageHeight: LH,
    padTop: 120, padBottom: 120, padLeft: 96, padRight: 96,
    textWidth: 624, columns: 1, fontSize: 13, lineHeight: 1.2,
    title: ""
  },
  // \documentclass{beamer} — a 4:3 landscape slide. Sized to fill the document
  // area like the other classes (same width as US-Letter), with slide-sized type.
  beamer: {
    cls: "beamer",
    pageWidth: 816, pageHeight: 612,
    padTop: 54, padBottom: 48, padLeft: 54, padRight: 54,
    textWidth: 708, columns: 1, fontSize: 21, lineHeight: 1.3,
    title: "Presentation Title"
  },
  // \documentclass{book} — letter, two-sided; a little extra bottom margin.
  book: {
    cls: "book",
    pageWidth: LW, pageHeight: LH,
    padTop: 135, padBottom: 160, padLeft: 179, padRight: 179,
    textWidth: 458, columns: 1, fontSize: 13, lineHeight: 1.2,
    title: "Book Title"
  },
  // A development stress-test: a long (~50 page) article-geometry document used
  // to exercise pagination and the document outline. Exports as an article.
  wip: {
    cls: "wip",
    pageWidth: LW, pageHeight: LH,
    padTop: 135, padBottom: 145, padLeft: 179, padRight: 179,
    textWidth: 458, columns: 1, fontSize: 13, lineHeight: 1.2,
    title: "Work In Progress"
  }
};

export const templateFor = (preset?: string): TemplateLayout =>
  TEMPLATES[preset ?? "article"] ?? TEMPLATES.article;

/* -----------------------------------------------------------------
   Per-class starting content. Built from the existing node types.
----------------------------------------------------------------- */
const uid = () => crypto.randomUUID();
const para = (text: string): DocumentNode => ({ id: uid(), type: "paragraph", text });
const sect = (title: string, children: DocumentNode[]): DocumentNode =>
  ({ id: uid(), type: "section", title, children });
const subsect = (title: string, children: DocumentNode[]): DocumentNode =>
  ({ id: uid(), type: "subsection", title, children });
const subsubsect = (title: string, children: DocumentNode[]): DocumentNode =>
  ({ id: uid(), type: "subsubsection", title, children });
const abstract = (text: string): DocumentNode => ({ id: uid(), type: "abstract", text });
const bullets = (style: "dot" | "dash" | "number", items: string[]): DocumentNode =>
  ({ id: uid(), type: "list", listStyle: style, items: items.map((t) => ({ id: uid(), text: t })) });
// A beamer slide. `variant: "title"` is the centered title slide.
const frame = (title: string, children: DocumentNode[], variant?: "title"): DocumentNode =>
  ({ id: uid(), type: "frame", title, ...(variant ? { frameVariant: variant } : {}), children });
const specialPage = (type: any, title: string): DocumentNode => ({ id: uid(), type, title });
const docTree = (children: DocumentNode[]): DocumentNode => ({ id: uid(), type: "document", children });

// A long, deterministic "lorem ipsum" stress-test document: a cover page, table
// of contents, many numbered sections (each with subsections / subsubsections
// interlaced with paragraphs of varying length), and a bibliography — sized to
// run to roughly fifty pages so pagination and the outline can be exercised.
function wipDoc(): DocumentNode {
  const LOREM =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod " +
    "tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, " +
    "quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo " +
    "consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse " +
    "cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat " +
    "non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

  // Deterministic pseudo-random so the document is the same every time.
  let seed = 1337;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const body = (n: number) => para(Array.from({ length: n }, () => LOREM).join(" "));

  const WORDS = [
    "Foundations", "Methods", "Analysis", "Architecture", "Evaluation", "Background",
    "Approach", "Results", "Discussion", "Implementation", "Theory", "Experiments",
    "Design", "Observations", "Framework", "Model", "Systems", "Overview",
    "Principles", "Mechanisms", "Strategy", "Notation", "Limitations", "Outlook"
  ];
  const phrase = () => `${WORDS[between(0, WORDS.length - 1)]} of ${WORDS[between(0, WORDS.length - 1)]}`;

  const children: DocumentNode[] = [
    specialPage("coverpage", "Cover Page"),
    specialPage("toc", "Table of Contents")
  ];

  const SECTIONS = 15;
  for (let s = 0; s < SECTIONS; s++) {
    const secChildren: DocumentNode[] = [body(between(2, 4))];
    const subCount = between(3, 4);
    for (let ss = 0; ss < subCount; ss++) {
      const subChildren: DocumentNode[] = [body(between(2, 4))];
      if (rnd() > 0.4) {
        const sssCount = between(1, 2);
        for (let k = 0; k < sssCount; k++) {
          subChildren.push(subsubsect(phrase(), [body(between(2, 3))]));
        }
        subChildren.push(body(between(1, 2)));
      }
      secChildren.push(subsect(phrase(), subChildren));
    }
    children.push(sect(phrase(), secChildren));
  }

  children.push(specialPage("bibliography", "Bibliography"));
  return docTree(children);
}

export function templateDoc(cls: string): DocumentNode {
  switch (cls) {
    case "wip":
      return wipDoc();

    case "report":
      return docTree([
        specialPage("coverpage", "Cover Page"),
        specialPage("toc", "Table of Contents"),
        sect("Introduction", [para("State the purpose, scope and structure of this report.")]),
        sect("Background", [
          para("Provide the context and background needed to understand the report."),
          subsect("Scope", [para("Define what is and isn't covered here.")])
        ]),
        sect("Findings", [para("Present the main findings of the report.")]),
        sect("Recommendations", [para("Give actionable recommendations based on the findings.")]),
        specialPage("bibliography", "Bibliography")
      ]);

    case "letter":
      return docTree([
        para("Your Name\nStreet Address\nCity, State ZIP\nyour.email@example.com"),
        para("January 1, 2026"),
        para("Recipient Name\nCompany or Organisation\nStreet Address\nCity, State ZIP"),
        para("Dear Recipient,"),
        para("Opening paragraph — state the purpose of your letter clearly and briefly."),
        para("Body paragraph — provide the details, context and any supporting information the reader needs to act."),
        para("Closing paragraph — summarise and state the action you'd like the reader to take."),
        para("Sincerely,\n\n\nYour Name")
      ]);

    case "beamer":
      // Each slide is its own frame node, so it occupies exactly one page and
      // its content never spills onto the next slide.
      return docTree([
        frame("Presentation Title", [para("Your Name\nJune 2026")], "title"),
        frame("Overview", [bullets("dot", ["First main point of your talk", "Second main point", "Third main point"])]),
        frame("Motivation", [
          para("Why does this matter?"),
          bullets("dot", ["The problem to solve", "Why existing approaches fall short"])
        ]),
        frame("Approach", [bullets("number", ["Step one of your method", "Step two", "Step three"])]),
        frame("Results", [bullets("dot", ["Key result one", "Key result two"])]),
        frame("Summary", [bullets("dot", ["What we showed", "Where it goes next"])])
      ]);

    case "book":
      return docTree([
        specialPage("coverpage", "Cover Page"),
        specialPage("toc", "Table of Contents"),
        sect("Introduction", [
          para("Begin your book here. Set the scene and introduce the central themes."),
          subsect("Background", [para("Provide the background the reader needs.")])
        ]),
        sect("Development", [para("Develop the main ideas of your book across the middle chapters.")]),
        sect("Conclusion", [para("Bring the threads together and conclude.")]),
        specialPage("bibliography", "Bibliography")
      ]);

    case "article":
    default:
      return docTree([
        abstract("A short summary of the work: its motivation, the approach taken, and the key findings."),
        sect("Introduction", [para("Introduce the topic, the problem you address, and the structure of the paper.")]),
        sect("Related Work", [para("Summarise prior work and how your contribution differs from it.")]),
        sect("Method", [
          para("Describe your approach in detail."),
          subsect("Setup", [para("Explain the experimental or analytical setup.")])
        ]),
        sect("Results", [para("Present and discuss your results.")]),
        sect("Conclusion", [para("Summarise the contribution and outline directions for future work.")])
      ]);
  }
}
