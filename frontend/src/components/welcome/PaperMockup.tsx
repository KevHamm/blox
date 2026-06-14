// A miniature, realistically typeset article — the hero centrepiece. It is the
// product's own output (a clean LaTeX-style page), rendered in the document
// serif at small scale so it reads as a genuine paper rather than a toy.
// Decorative only (aria-hidden); a faint second sheet sits behind for depth.

export function PaperMockup() {
  return (
    <div className="paper-stack" aria-hidden="true">
      <div className="paper paper-behind" />
      <div className="paper paper-front">
        <div className="paper-doc">
          <div className="pd-title">On the Visual Composition of Typeset Documents</div>
          <div className="pd-authors">Ada Lovelace&nbsp;&nbsp;·&nbsp;&nbsp;Donald E. Knuth</div>
          <div className="pd-affil">BLoX Press · Cambridge</div>

          <div className="pd-abstract">
            <span className="pd-abstract-h">Abstract.</span> We describe a system
            for composing publication-quality documents directly on the page,
            without writing markup. Content is arranged as blocks and flows into a
            true-to-size layout that mirrors the final typeset result.
          </div>

          <div className="pd-h">1&nbsp;&nbsp;Introduction</div>
          <p className="pd-p pd-first">
            Typesetting has historically separated the act of writing from the act
            of design. The author specifies structure in a markup language and a
            compiler produces the page. While precise, this indirection obscures
            the relationship between intent and result.
          </p>
          <p className="pd-p">
            We instead treat the page as the primary surface. Each element is a
            block placed in situ, measured against real geometry, so that what the
            author sees is what the reader receives.
          </p>

          <div className="pd-eq">
            <span className="pd-eq-body">
              <span className="pd-it">F</span>(<span className="pd-it">ξ</span>) =
              <span className="pd-int">∫</span>
              <span className="pd-it">f</span>(<span className="pd-it">x</span>)&#8201;
              <span className="pd-it">e</span><sup>−2π<span className="pd-it">i</span><span className="pd-it">x</span><span className="pd-it">ξ</span></sup>&#8201;
              <span className="pd-it">dx</span>
            </span>
            <span className="pd-eq-no">(1)</span>
          </div>

          <div className="pd-h">2&nbsp;&nbsp;Method</div>
          <p className="pd-p pd-first">
            The editor renders pages at their physical dimensions and reflows
            content as it is edited, so pagination, figures and footnotes settle
            exactly where they will appear in the exported file.
          </p>

          <div className="pd-fig">
            <div className="pd-fig-box">
              <span className="pd-fig-blocks">
                <i /><i /><i />
              </span>
            </div>
            <div className="pd-fig-cap">Figure&nbsp;1:&nbsp;A document composed from blocks.</div>
          </div>
        </div>
        <div className="pd-pageno">1</div>
      </div>
    </div>
  );
}
