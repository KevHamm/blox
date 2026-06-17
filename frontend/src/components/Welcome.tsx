import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import gsap from "gsap";
import { Logo, ThemeToggle } from "./chrome";
import { PaperMockup } from "./welcome/PaperMockup";
import { LoginModal } from "./welcome/LoginModal";
import { LibraryPanel } from "./welcome/LibraryPanel";
import { getLibrary } from "../utils/library";
import { parseProject, timeAgo, type BloxProject } from "../utils/persistence";

interface WelcomeProps {
  onStart: (preset?: string, rect?: DOMRect) => void;
  onOpen: (project: BloxProject, rect?: DOMRect) => void;
  onDesign: (kind: string, rect?: DOMRect) => void;
  autosave: BloxProject | null;
  dark: boolean;
  onToggleTheme: () => void;
  user: string | null;
  onLogin: (user: string, pass: string) => boolean;
  onLogout: () => void;
}

const PRESETS = [
  { id: "article", label: "Article", desc: "Single-column paper — the article class." },
  { id: "report",  label: "Report",  desc: "Title page, chapters and sections." },
  { id: "letter",  label: "Letter",  desc: "Formal correspondence with a signature." },
  { id: "beamer",  label: "Beamer",  desc: "A slide deck built from frames." },
  { id: "book",    label: "Book",    desc: "Multi-chapter with front and back matter." },
  { id: "wip",     label: "Sandbox", desc: "A long document to exercise pagination." }
];

// Free-form "design a page" types. Only the cover page is live today.
const PAGE_TYPES = [
  { id: "cover",        label: "Cover page",      desc: "A title / cover page — place text, logos and shapes anywhere.", enabled: true },
  { id: "bibliography", label: "Bibliography",    desc: "A custom references page.",      enabled: false },
  { id: "section",      label: "Section divider", desc: "A divider between sections.",    enabled: false }
];

const META = ["No syntax", "True-to-size pages", "Compilable LaTeX export"];

// Minimal monochrome line-art per template type.
function TemplateGlyph({ id }: { id: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "beamer") {
    return (
      <svg viewBox="0 0 40 34" width="34" height="29" aria-hidden>
        <rect x="3" y="3" width="34" height="25" rx="2.5" {...s} />
        <line x1="8" y1="11" x2="24" y2="11" {...s} />
        <line x1="8" y1="16" x2="20" y2="16" {...s} />
        <line x1="8" y1="21" x2="16" y2="21" {...s} />
      </svg>
    );
  }
  if (id === "book") {
    return (
      <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden>
        <path d="M20 8c-3.5-2.2-7.5-2.2-12-1.1v24c4.5-1.1 8.5-1.1 12 1.1 3.5-2.2 7.5-2.2 12-1.1v-24c-4.5-1.1-8.5-1.1-12 1.1Z" {...s} />
        <line x1="20" y1="8" x2="20" y2="32" {...s} />
      </svg>
    );
  }
  const rows: Record<string, [number, number][]> = {
    article: [[10, 17], [10, 21], [10, 25], [10, 29], [10, 33]],
    report:  [[10, 19], [10, 24], [10, 28], [10, 32], [10, 36]],
    letter:  [[22, 12], [10, 20], [10, 24], [10, 28], [20, 36]],
    wip:     [[10, 14], [10, 18], [10, 22], [10, 26], [10, 30], [10, 34], [10, 38]]
  };
  const r = rows[id] ?? rows.article;
  return (
    <svg viewBox="0 0 36 48" width="30" height="40" aria-hidden>
      <rect x="3" y="3" width="30" height="42" rx="2.5" {...s} />
      {id === "report" && <rect x="10" y="9" width="14" height="5" rx="1" {...s} />}
      {r.map(([x, y], i) => <line key={i} x1={x} y1={y} x2={x + (id === "letter" && i === 0 ? 4 : 16)} y2={y} {...s} opacity={0.7} />)}
    </svg>
  );
}

export function Welcome({ onStart, onOpen, onDesign, autosave, dark, onToggleTheme, user, onLogin, onLogout }: WelcomeProps) {
  const [picking, setPicking] = useState(false);
  const [designing, setDesigning] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const library = getLibrary();

  // Close the sign-in modal once a login succeeds.
  function tryLogin(u: string, p: string) {
    const ok = onLogin(u, p);
    if (ok) setLoginOpen(false);
    return ok;
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const openRectRef = useRef<DOMRect | undefined>(undefined);
  const errTimer = useRef<number | undefined>(undefined);
  const [openError, setOpenError] = useState<string | null>(null);

  const reduce = useRef(
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;

  // ── Entrance: a restrained, slow reveal. ───────────────────────────────
  useLayoutEffect(() => {
    if (reduce) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-topbar", { y: -14, opacity: 0, duration: 0.8 })
        .from(".hero-eyebrow", { y: 12, opacity: 0, duration: 0.7 }, "-=0.35")
        .from(".hero-h1 .line-inner", { yPercent: 105, duration: 1.1, stagger: 0.09, ease: "power4.out" }, "-=0.4")
        .from(".hero-lede", { y: 14, opacity: 0, duration: 0.8 }, "-=0.7")
        .from(".hero-actions > *", { y: 14, opacity: 0, duration: 0.7, stagger: 0.08 }, "-=0.55")
        .from(".hero-meta", { y: 12, opacity: 0, duration: 0.7 }, "-=0.5")
        .from(".paper-stage", { opacity: 0, y: 28, duration: 1.3, ease: "power2.out" }, 0.15);
    }, rootRef);
    return () => ctx.revert();
  }, [reduce]);

  // ── Subtle, eased pointer tilt on the paper (premium depth, not bounce). ─
  useEffect(() => {
    if (reduce) return;
    const root = rootRef.current;
    const paper = paperRef.current;
    if (!root || !paper) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const px = e.clientX / window.innerWidth - 0.5;
        const py = e.clientY / window.innerHeight - 0.5;
        paper.style.setProperty("--ry", `${(-px * 7).toFixed(2)}deg`);
        paper.style.setProperty("--rx", `${(py * 5).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => { window.removeEventListener("pointermove", onMove); if (raf) cancelAnimationFrame(raf); };
  }, [reduce]);

  // ── Template grid reveal — fades in as one unit (cards stay aligned). ───
  useEffect(() => {
    if (!picking || reduce || !gridRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".picker-head", { y: 10, opacity: 0, duration: 0.55, ease: "power3.out" });
      gsap.from(".tpl-grid", { y: 16, opacity: 0, duration: 0.65, ease: "power3.out", delay: 0.05 });
    }, gridRef);
    return () => ctx.revert();
  }, [picking, reduce]);

  // ── Design-type picker reveal — same one-unit fade as the template grid. ─
  useEffect(() => {
    if (!designing || reduce || !designRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".picker-head", { y: 10, opacity: 0, duration: 0.55, ease: "power3.out" });
      gsap.from(".tpl-grid", { y: 16, opacity: 0, duration: 0.65, ease: "power3.out", delay: 0.05 });
    }, designRef);
    return () => ctx.revert();
  }, [designing, reduce]);

  function showOpenError(msg: string) {
    setOpenError(msg);
    window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setOpenError(null), 5000);
  }
  async function handleFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      onOpen(parseProject(await file.text()), openRectRef.current);
    } catch {
      showOpenError("That file doesn’t look like a Blox project (.blox).");
    }
  }
  function openPicker(e: MouseEvent<HTMLButtonElement>) {
    openRectRef.current = e.currentTarget.getBoundingClientRect();
    fileRef.current?.click();
  }

  return (
    <div ref={rootRef} className="welcome3">
      <input ref={fileRef} type="file" accept=".blox,application/json" style={{ display: "none" }} onChange={handleFileChosen} />

      <header className="hero-topbar">
        <button className="hero-brand" onClick={() => { setPicking(false); setDesigning(false); }} aria-label="BLoX home">
          <Logo flip={false} />
        </button>
        <div className="hero-topbar-right">
          {user ? (
            <div className="user-chip">
              <span className="user-avatar" aria-hidden>{user.charAt(0).toUpperCase()}</span>
              <span className="user-name">{user}</span>
              <button className="user-logout" onClick={onLogout} title="Sign out">Sign out</button>
            </div>
          ) : (
            <button className="login-btn" onClick={() => setLoginOpen(true)}>
              L<span className="login-o">o</span>GIN
            </button>
          )}
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </header>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onLogin={tryLogin} />}

      <main className="welcome3-stage">
        {/* ── HERO ── */}
        <section className="hero" data-hidden={picking || designing} aria-hidden={picking || designing}>
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-mark" />Visual&nbsp;LaTeX&nbsp;editor
            </div>

            <h1 className="hero-h1">
              <span className="line"><span className="line-inner">Beautiful documents,</span></span>
              <span className="line"><span className="line-inner"><em>without</em> the syntax.</span></span>
            </h1>

            <p className="hero-lede">
              BLoX is a visual editor for LaTeX. Compose on a true-to-size page with
              drag-and-drop blocks — then export clean, compilable&nbsp;<code>.tex</code>.
            </p>

            <div className="hero-actions">
              <button className="w3-btn w3-primary" onClick={() => setPicking(true)}>
                New document
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
              <button className="w3-btn w3-ghost" onClick={() => setDesigning(true)}>Design a page</button>
              <button className="w3-btn w3-ghost" onClick={openPicker}>Open project</button>
            </div>

            <div className="hero-foot">
              {openError ? (
                <span className="hero-error">{openError}</span>
              ) : autosave ? (
                <button
                  className="hero-resume"
                  onClick={(e) => onOpen(autosave, e.currentTarget.getBoundingClientRect())}
                  title="Restore the autosaved session"
                >
                  <span className="hero-resume-dot" />
                  Resume “{autosave.title || "Untitled"}”
                  <span className="hero-resume-when">· {timeAgo(autosave.savedAt)}</span>
                </button>
              ) : (
                <ul className="hero-meta">
                  {META.map((m, i) => <li key={m}>{i > 0 && <span className="hero-meta-sep" />}{m}</li>)}
                </ul>
              )}
            </div>
          </div>

          {user ? (
            <LibraryPanel projects={library.projects} pages={library.pages} onOpen={onOpen} />
          ) : (
            <div className="paper-stage">
              <div ref={paperRef} className="paper-tilt">
                <PaperMockup />
              </div>
            </div>
          )}
        </section>

        {/* ── TEMPLATE PICKER ── */}
        <section ref={gridRef} className="picker" data-hidden={!picking} aria-hidden={!picking}>
          <div className="picker-head">
            <button className="picker-back" onClick={() => setPicking(false)} aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div>
              <h2 className="picker-title">Choose a starting point</h2>
              <p className="picker-sub">Every template exports to clean, compilable LaTeX.</p>
            </div>
          </div>

          <div className="tpl-grid">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                className="tpl-card"
                tabIndex={picking ? 0 : -1}
                onClick={(e) => onStart(p.id, e.currentTarget.getBoundingClientRect())}
              >
                <span className="tpl-glyph"><TemplateGlyph id={p.id} /></span>
                <span className="tpl-text">
                  <span className="tpl-label">{p.label}</span>
                  <span className="tpl-desc">{p.desc}</span>
                </span>
                <span className="tpl-go" aria-hidden>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── DESIGN-A-PAGE PICKER ── */}
        <section ref={designRef} className="picker" data-hidden={!designing} aria-hidden={!designing}>
          <div className="picker-head">
            <button className="picker-back" onClick={() => setDesigning(false)} aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <div>
              <h2 className="picker-title">Design a page</h2>
              <p className="picker-sub">Place anything anywhere — text, images and shapes — on a single page.</p>
            </div>
          </div>

          <div className="tpl-grid">
            {PAGE_TYPES.map((p) => (
              <button
                key={p.id}
                className="tpl-card"
                disabled={!p.enabled}
                tabIndex={designing && p.enabled ? 0 : -1}
                onClick={(e) => { if (p.enabled) onDesign(p.id, e.currentTarget.getBoundingClientRect()); }}
              >
                <span className="tpl-glyph"><PageTypeGlyph id={p.id} /></span>
                <span className="tpl-text">
                  <span className="tpl-label">{p.label}{!p.enabled && <span className="tpl-soon">Soon</span>}</span>
                  <span className="tpl-desc">{p.desc}</span>
                </span>
                {p.enabled && (
                  <span className="tpl-go" aria-hidden>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// Minimal line-art per design-page type.
function PageTypeGlyph({ id }: { id: string }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 36 48" width="30" height="40" aria-hidden>
      <rect x="3" y="3" width="30" height="42" rx="2.5" {...s} />
      {id === "cover" && <><rect x="9" y="14" width="18" height="9" rx="1" {...s} /><line x1="11" y1="30" x2="25" y2="30" {...s} /><line x1="13" y1="35" x2="23" y2="35" {...s} /></>}
      {id === "bibliography" && <>{[16, 21, 26, 31, 36].map((y, i) => <line key={i} x1="9" y1={y} x2={i % 2 ? 22 : 27} y2={y} {...s} />)}</>}
      {id === "section" && <><line x1="9" y1="24" x2="27" y2="24" {...s} /><rect x="13" y="20" width="10" height="8" rx="1" {...s} /></>}
    </svg>
  );
}
