import { useState } from "react";
import type { DocumentNode } from "../types/document";
import { sampleDocument } from "../data/sampleDocument";
import {
  tableColors,
  uniformColor,
  removeFigureImage,
  setFigureWidthTree,
  updateMathItemTree,
  deleteMathItemTree,
  updateFootnoteText,
  deleteFootnote,
  updateListItemTree,
  addListItemTree,
  deleteListItemTree,
  setListStyleTree,
  patchNodeTree,
  toggleTableCellBorderTree
} from "../utils/docTree";

const lorem =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const lorem_full = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed eiusmod tempor" +
                   "incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation" +
                   "ullamco laboris nisi ut aliquid ex ea commodi consequat. Quisaute iure reprehenderit in" +
                   "voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat" +
                   "non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

/**
 * Owns the document tree and every immutable mutation on it. Components get a
 * `doc` to render plus a stable set of editing handlers; drag-and-drop logic
 * that needs raw `setDoc` access still gets it back too.
 */
export function useDocument(initial?: DocumentNode) {
  // Undo/redo history. Every committed change pushes the previous document onto
  // `past`; undo/redo move the present between the two stacks. Unbounded for now.
  const [hist, setHist] = useState<{
    past: DocumentNode[];
    present: DocumentNode;
    future: DocumentNode[];
  }>(() => ({ past: [], present: initial ?? sampleDocument, future: [] }));

  const doc = hist.present;

  // Drop-in replacement for a useState setter: supports a value or an updater,
  // records history, and clears the redo stack on a real change.
  function setDoc(updater: DocumentNode | ((prev: DocumentNode) => DocumentNode)) {
    setHist((h) => {
      const next = typeof updater === "function"
        ? (updater as (p: DocumentNode) => DocumentNode)(h.present)
        : updater;
      if (next === h.present) return h;
      return { past: [...h.past, h.present], present: next, future: [] };
    });
  }

  function undo() {
    setHist((h) =>
      h.past.length
        ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] }
        : h
    );
  }
  function redo() {
    setHist((h) =>
      h.future.length
        ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
        : h
    );
  }
  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  // -----------------------------
  // UPDATE TEXT
  // -----------------------------
  function updateTextById(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && (node.type === "paragraph" || node.type === "abstract")) {
        return { ...node, text: value };
      }

      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // Toggle a paragraph between centered and the default (justified) alignment.
  function toggleParagraphAlign(id: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "paragraph") {
        const next = { ...node };
        if (next.align === "center") delete next.align;
        else next.align = "center";
        return next;
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Update a paragraph's text, inline formatting marks, and (when provided) its
  // reconciled footnotes. The footnote reconciliation — which marker survived
  // the edit, which became unconnected — is computed in the editor from the DOM.
  function updateRichText(id: string, value: string, marks: any[], footnotes?: any[], citations?: any[]) {
    function update(node: any): any {
      if (node.id === id && node.type === "paragraph") {
        const next: any = { ...node, text: value };
        if (marks && marks.length) next.marks = marks;
        else delete next.marks;
        if (footnotes !== undefined) {
          if (footnotes.length) next.footnotes = footnotes;
          else delete next.footnotes;
        }
        if (citations !== undefined) {
          if (citations.length) next.citations = citations;
          else delete next.citations;
        }
        return next;
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // UPDATE TITLES
  // -----------------------------
  function updateSectionTitle(id: string, value: string) {
    function update(node: any): any {
      if (
        node.id === id &&
        (node.type === "section" || node.type === "subsection" || node.type === "frame")
      ) {
        return { ...node, title: value };
      }

      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  function updateFigureCaption(id: string, value: string) {
    function update(node: any): any {
      if (node.id === id && node.type === "figure") {
        return {
          ...node,
          caption: value
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // Edit / delete an individual equation part within a math block.
  function updateMathItem(mathId: string, itemId: string, latex: string) {
    setDoc((prev) => updateMathItemTree(prev, mathId, itemId, latex));
  }
  function deleteMathItem(mathId: string, itemId: string) {
    setDoc((prev) => deleteMathItemTree(prev, mathId, itemId));
  }

  // Edit / remove a footnote attached to a paragraph word.
  function setFootnoteText(paragraphId: string, footnoteId: string, text: string) {
    setDoc((prev) => updateFootnoteText(prev, paragraphId, footnoteId, text));
  }
  function removeFootnote(paragraphId: string, footnoteId: string) {
    setDoc((prev) => deleteFootnote(prev, paragraphId, footnoteId));
  }

  // List item edits.
  function updateListItem(listId: string, itemId: string, text: string) {
    setDoc((prev) => updateListItemTree(prev, listId, itemId, text));
  }
  function addListItem(listId: string, afterId: string | null, newId: string) {
    setDoc((prev) => addListItemTree(prev, listId, afterId, newId));
  }
  function deleteListItem(listId: string, itemId: string) {
    setDoc((prev) => deleteListItemTree(prev, listId, itemId));
  }
  function setListStyle(listId: string, style: "dash" | "dot" | "number") {
    setDoc((prev) => setListStyleTree(prev, listId, style));
  }
  // Discrete field edits on any node (e.g. a code block's language).
  function updateNodeFields(id: string, patch: Record<string, any>) {
    setDoc((prev) => patchNodeTree(prev, id, patch));
  }

  // -----------------------------
  // INSERT SECTION
  // -----------------------------

  // Insert a fresh section immediately after the given one.
  function addSectionAfter(sectionId: string) {
    setDoc((prev) => {
      const siblings = prev.children ?? [];
      const index = siblings.findIndex((c: any) => c.id === sectionId);
      if (index === -1) return prev;

      const newSection: DocumentNode = {
        id: crypto.randomUUID(),
        type: "section",
        title: "Section",
        children: [
          { id: crypto.randomUUID(), type: "paragraph", text: lorem }
        ]
      };

      const children = [...siblings];
      children.splice(index + 1, 0, newSection);
      return { ...prev, children };
    });
  }

  // Resize every image in a figure container (per-image fraction of column).
  function updateFigureWidth(figureId: string, width: number) {
    setDoc((prev) => setFigureWidthTree(prev, figureId, width));
  }

  // Delete a single image from a figure (drops the figure if it was the last).
  function deleteFigureImage(figureId: string, imageId: string) {
    setDoc((prev) => removeFigureImage(prev, figureId, imageId));
  }

  // -----------------------------
  // SUBSECTION
  // -----------------------------
  function addSubsection(sectionId: string) {
    const newNode = {
      id: crypto.randomUUID(),
      type: "subsection",
      title: "New Subsection",
      children: [
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          text: lorem_full
        }
      ]
    };

    function update(node: any): any {
      if (node.id === sectionId && node.type === "section") {
        return {
          ...node,
          children: [...node.children, newNode]
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // Append a subsubsection to the given subsection.
  function addSubsubsection(subsectionId: string) {
    const newNode = {
      id: crypto.randomUUID(),
      type: "subsubsection",
      title: "New Subsubsection",
      children: [
        { id: crypto.randomUUID(), type: "paragraph", text: lorem_full }
      ]
    };

    function update(node: any): any {
      if (node.id === subsectionId && node.type === "subsection") {
        return { ...node, children: [...(node.children ?? []), newNode] };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // TABLE CELL UPDATE
  // -----------------------------
  function updateTableCell(
    id: string,
    row: number,
    col: number,
    value: string
  ) {
    function update(node: any): any {
      if (node.id === id && node.type === "table") {
        const newRows = node.rows.map((r: any[], ri: number) =>
          ri === row
            ? r.map((c, ci) => (ci === col ? value : c))
            : r
        );

        return {
          ...node,
          rows: newRows
        };
      }

      if (node.children) {
        return {
          ...node,
          children: node.children.map(update)
        };
      }

      return node;
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE NODE
  // -----------------------------
  function deleteNodeById(id: string) {
    function update(node: any): any {
      if (!node.children) return node;

      return {
        ...node,
        children: node.children
          .filter((c: any) => c.id !== id)
          .map(update)
      };
    }

    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // ADD ROW
  // -----------------------------
  function addTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colors = tableColors(node);

        // Restore a previously removed row, if one is remembered.
        const stack = node.removedRows ?? [];
        if (stack.length) {
          const restored = stack[stack.length - 1];
          return {
            ...node,
            rows: [...node.rows, restored.cells],
            colors: [...colors, restored.colors],
            removedRows: stack.slice(0, -1)
          };
        }

        // Otherwise a fresh empty row that inherits any fully-coloured column.
        const colCount = node.rows[0]?.length || 1;
        const newRow = Array(colCount).fill("");
        const newColorRow = Array.from({ length: colCount }, (_, c) =>
          uniformColor(colors.map((row) => row[c]))
        );
        return { ...node, rows: [...node.rows, newRow], colors: [...colors, newColorRow] };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE ROW (last; remembered for re-add)
  // -----------------------------
  function deleteTableRow(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        if (node.rows.length <= 1) return node;
        const colors = tableColors(node);
        const removed = {
          cells: node.rows[node.rows.length - 1],
          colors: colors[colors.length - 1]
        };
        return {
          ...node,
          rows: node.rows.slice(0, -1),
          colors: colors.slice(0, -1),
          removedRows: [...(node.removedRows ?? []), removed]
        };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Delete a row by index (paint-tool style; not remembered).
  function deleteTableRowAt(tableId: string, r: number) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        // The header row is permanent, and a table always keeps at least one
        // content row (so never fewer than two rows total).
        if (r === 0 || node.rows.length <= 2) return node;
        const colors = tableColors(node);
        return {
          ...node,
          rows: node.rows.filter((_: any, i: number) => i !== r),
          colors: colors.filter((_, i) => i !== r)
        };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // ADD COLUMN
  // -----------------------------
  function addTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colors = tableColors(node);

        // Restore a previously removed column, if one is remembered.
        const stack = node.removedColumns ?? [];
        if (stack.length) {
          const restored = stack[stack.length - 1];
          return {
            ...node,
            rows: node.rows.map((row: string[], r: number) => [...row, restored.cells[r] ?? ""]),
            colors: colors.map((row, r) => [...row, restored.colors[r] ?? null]),
            removedColumns: stack.slice(0, -1)
          };
        }

        // Otherwise a fresh column that inherits any fully-coloured row.
        const colCount = node.rows[0]?.length || 0;
        return {
          ...node,
          rows: node.rows.map((row: string[], r: number) => [
            ...row,
            r === 0 ? `Column ${colCount + 1}` : ""
          ]),
          colors: colors.map((row) => [...row, uniformColor(row)])
        };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Delete a column by index (paint-tool style; not remembered).
  function deleteTableColumnAt(tableId: string, c: number) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        if ((node.rows[0]?.length || 0) <= 1) return node;
        const colors = tableColors(node);
        return {
          ...node,
          rows: node.rows.map((row: string[]) => row.filter((_, i) => i !== c)),
          colors: colors.map((row) => row.filter((_, i) => i !== c))
        };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // RESIZE COLUMNS (drag)
  // -----------------------------
  // Widths are stored as fractions that always sum to 1, so the table keeps
  // filling exactly the text-column width no matter how the user drags.
  function updateTableColWidths(tableId: string, widths: number[]) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        return { ...node, colWidths: widths };
      }
      if (node.children) {
        return { ...node, children: node.children.map(update) };
      }
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Edit a table's caption.
  function updateTableCaption(tableId: string, caption: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") return { ...node, caption };
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Replace a table's per-cell colour grid.
  function updateTableColors(tableId: string, colors: (string | null)[][]) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") return { ...node, colors };
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // DELETE COLUMN
  // -----------------------------
  function deleteTableColumn(tableId: string) {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colCount = node.rows[0]?.length || 0;
        if (colCount <= 1) return node;
        const colors = tableColors(node);
        const removed = {
          cells: node.rows.map((row: string[]) => row[row.length - 1]),
          colors: colors.map((row) => row[row.length - 1])
        };
        return {
          ...node,
          rows: node.rows.map((row: string[]) => row.slice(0, -1)),
          colors: colors.map((row) => row.slice(0, -1)),
          removedColumns: [...(node.removedColumns ?? []), removed]
        };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Toggle a table's vertical (between-column) or horizontal (between-row) grid
  // lines. Defaults to visible; stored as { v, h } on the node.
  // Toggle a single internal grid separator (custom tables).
  function toggleCellBorder(tableId: string, axis: "v" | "h", r: number, c: number) {
    setDoc((prev) => toggleTableCellBorderTree(prev, tableId, axis, r, c));
  }

  function toggleTableBorder(tableId: string, axis: "v" | "h") {
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const borders = { v: node.borders?.v !== false, h: node.borders?.h !== false };
        borders[axis] = !borders[axis];
        return { ...node, borders };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Move a column from one position to another (cells, widths and colours all
  // travel together).
  function reorderTableColumn(tableId: string, from: number, to: number) {
    if (from === to) return;
    const move = <T,>(arr: T[]): T[] => {
      const a = arr.slice();
      a.splice(to, 0, a.splice(from, 1)[0]);
      return a;
    };
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colors = tableColors(node);
        const next: any = {
          ...node,
          rows: node.rows.map((row: string[]) => move(row)),
          colors: colors.map((row) => move(row))
        };
        if (Array.isArray(node.colWidths) && node.colWidths.length === (node.rows[0]?.length || 0))
          next.colWidths = move(node.colWidths);
        return next;
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // Move a row from one position to another (cells + colours).
  function reorderTableRow(tableId: string, from: number, to: number) {
    if (from === to) return;
    function update(node: any): any {
      if (node.id === tableId && node.type === "table") {
        const colors = tableColors(node);
        const rows = node.rows.slice();
        rows.splice(to, 0, rows.splice(from, 1)[0]);
        const cl = colors.slice();
        cl.splice(to, 0, cl.splice(from, 1)[0]);
        return { ...node, rows, colors: cl };
      }
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    }
    setDoc((prev) => update(prev));
  }

  // -----------------------------
  // MOVE SECTION UP / DOWN
  // -----------------------------
  function moveSection(sectionId: string, direction: -1 | 1) {
    setDoc((prev) => {
      const siblings = prev.children ?? [];
      const index = siblings.findIndex((c: any) => c.id === sectionId);
      if (index === -1) return prev;

      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= siblings.length) return prev;

      const updated = [...siblings];
      const [moved] = updated.splice(index, 1);
      updated.splice(newIndex, 0, moved);

      return {
        ...prev,
        children: updated
      };
    });
  }

  // -----------------------------
  // MOVE SUBSECTION UP / DOWN
  // -----------------------------
  function moveSubsection(id: string, dir: -1 | 1) {
    setDoc((prev) => {
      const copy = structuredClone(prev);

      function findSection(node: any) {
        if (!node.children) return;

        // find subsection indexes INSIDE ORIGINAL CHILD ARRAY
        const subsectionIndexes = node.children
          .map((child: any, index: number) => ({
            child,
            index
          }))
          .filter((x: any) => x.child.type === "subsection");

        const currentSubIndex = subsectionIndexes.findIndex(
          (x: any) => x.child.id === id
        );

        // subsection not found here
        if (currentSubIndex === -1) {
          node.children.forEach(findSection);
          return;
        }

        const targetSubIndex = currentSubIndex + dir;

        // prevent moving outside subsection bounds
        if (
          targetSubIndex < 0 ||
          targetSubIndex >= subsectionIndexes.length
        ) {
          return;
        }

        // actual indexes in children[]
        const fromIndex = subsectionIndexes[currentSubIndex].index;
        const toIndex = subsectionIndexes[targetSubIndex].index;

        // swap ONLY subsection positions
        const updatedChildren = [...node.children];

        const temp = updatedChildren[fromIndex];
        updatedChildren[fromIndex] = updatedChildren[toIndex];
        updatedChildren[toIndex] = temp;

        node.children = updatedChildren;
      }

      findSection(copy);

      return copy;
    });
  }

  return {
    doc,
    setDoc,
    undo,
    redo,
    canUndo,
    canRedo,
    updateTextById,
    updateRichText,
    toggleParagraphAlign,
    updateSectionTitle,
    updateFigureCaption,
    updateMathItem,
    deleteMathItem,
    setFootnoteText,
    removeFootnote,
    updateListItem,
    addListItem,
    deleteListItem,
    setListStyle,
    updateNodeFields,
    addSectionAfter,
    updateFigureWidth,
    deleteFigureImage,
    addSubsection,
    addSubsubsection,
    updateTableCell,
    deleteNodeById,
    addTableRow,
    deleteTableRow,
    deleteTableRowAt,
    addTableColumn,
    deleteTableColumnAt,
    updateTableColWidths,
    updateTableCaption,
    updateTableColors,
    deleteTableColumn,
    toggleTableBorder,
    toggleCellBorder,
    reorderTableColumn,
    reorderTableRow,
    moveSection,
    moveSubsection
  };
}
