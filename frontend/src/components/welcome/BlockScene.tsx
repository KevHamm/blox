import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// The hero centrepiece: a luminous "document" page slab encircled by a cloud of
// glowing, brand-tinted blocks that slowly orbit and bob — the BLoX product
// metaphor (a document built from blocks). The whole tableau parallaxes toward
// the cursor. Everything is set up imperatively so it can be disposed cleanly on
// unmount; honours prefers-reduced-motion (renders a single static frame) and
// degrades to nothing (the CSS aurora shows through) if WebGL is unavailable.
//
// The heavy scene is built once; `dark` only nudges exposure / light intensity
// so the scene reads well over either backdrop (no costly re-init on toggle).

const BRAND = [
  0x7c3aed, // violet
  0x8b5cf6, // light violet
  0xa855f7, // purple
  0xec4899, // fuchsia
  0xf472b6, // pink
  0x6366f1, // indigo
  0x22d3ee, // cyan
  0x818cf8  // periwinkle
];

type ThemeApply = (dark: boolean) => void;

export function BlockScene({ dark }: { dark: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const applyRef = useRef<ThemeApply | null>(null);
  const darkRef = useRef(dark);
  darkRef.current = dark;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL → the CSS aurora carries the backdrop
    }

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, 9.2);

    // ── Lighting: a soft key plus coloured violet / fuchsia / cyan rims that give
    //    the matte blocks their iridescent brand sheen. ──
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(4, 6, 8);
    scene.add(key);
    const violet = new THREE.PointLight(0x7c3aed, 55, 60);
    violet.position.set(-7, 3, 4);
    scene.add(violet);
    const fuchsia = new THREE.PointLight(0xec4899, 45, 60);
    fuchsia.position.set(6, -4, 5);
    scene.add(fuchsia);
    const cyan = new THREE.PointLight(0x22d3ee, 32, 60);
    cyan.position.set(0, 6, -6);
    scene.add(cyan);

    const world = new THREE.Group();
    // Weight the composition to the right on wide screens, leaving the left
    // clear for the hero copy (resize() retunes this for narrow viewports).
    world.position.x = 2.6;
    scene.add(world);

    // ── The central document page: a thin, near-white rounded slab with a few
    //    faint "text line" bars on its face, gently glowing. ──
    const page = new THREE.Group();
    const pageGeo = new RoundedBoxGeometry(2.7, 3.5, 0.14, 4, 0.09);
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.45, metalness: 0.0,
      emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.06
    });
    page.add(new THREE.Mesh(pageGeo, pageMat));
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x6b6280, roughness: 0.6 });
    const titleMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed, roughness: 0.4, emissive: new THREE.Color(0x7c3aed), emissiveIntensity: 0.4
    });
    const lineGeos: THREE.BufferGeometry[] = [];
    const mkLine = (w: number, y: number, mat: THREE.Material) => {
      const g = new THREE.BoxGeometry(w, 0.085, 0.02);
      const m = new THREE.Mesh(g, mat);
      m.position.set(-1.0 + w / 2, y, 0.08);
      page.add(m);
      lineGeos.push(g);
    };
    mkLine(1.35, 1.25, titleMat);
    [[2.0, 0.85], [1.85, 0.6], [2.05, 0.35], [1.5, 0.1], [1.95, -0.4], [1.7, -0.65], [1.2, -0.9]]
      .forEach(([w, y]) => mkLine(w, y, lineMat));
    page.rotation.set(-0.12, -0.35, 0.04);
    world.add(page);

    // ── The orbiting blocks: fewer, larger and mostly glassy, set on a calm
    //    elliptical ring with little depth jitter — restrained, not busy. ──
    const blockGeo = new RoundedBoxGeometry(1, 1, 1, 5, 0.16);
    const materials: THREE.MeshStandardMaterial[] = [];
    const blocks: { mesh: THREE.Mesh; phase: number; speed: number; amp: number; spin: THREE.Vector3; baseY: number }[] = [];
    const COUNT = 14;
    for (let i = 0; i < COUNT; i++) {
      const color = BRAND[i % BRAND.length];
      const glass = i % 2 === 0;
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: glass ? 0.1 : 0.42, metalness: glass ? 0.42 : 0.08,
        // Low emissive: the blocks are *lit* by the coloured rims rather than
        // self-glowing, which reads more premium than candy-bright.
        emissive: new THREE.Color(color), emissiveIntensity: glass ? 0.14 : 0.06,
        transparent: glass, opacity: glass ? 0.82 : 1
      });
      materials.push(mat);
      const mesh = new THREE.Mesh(blockGeo, mat);
      const ang = (i / COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const radius = 3.5 + Math.random() * 1.7;
      const x = Math.cos(ang) * radius;
      const y = Math.sin(ang) * radius * 0.68 + (Math.random() - 0.5) * 0.7;
      const z = (Math.random() - 0.5) * 3.0 - 0.4;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(0.46 + Math.random() * 0.34);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      world.add(mesh);
      blocks.push({
        mesh, phase: Math.random() * Math.PI * 2, speed: 0.26 + Math.random() * 0.3,
        amp: 0.05 + Math.random() * 0.09,
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16),
        baseY: y
      });
    }

    // ── Theme adjustment (no re-init on toggle). ──
    const apply: ThemeApply = (d) => {
      renderer.toneMappingExposure = d ? 1.22 : 1.12;
      ambient.intensity = d ? 0.5 : 0.85;
      violet.intensity = d ? 72 : 52;
      fuchsia.intensity = d ? 60 : 42;
      cyan.intensity = d ? 46 : 30;
      pageMat.emissiveIntensity = d ? 0.2 : 0.05;
    };
    apply(darkRef.current);
    applyRef.current = apply;

    // ── Pointer parallax (off the window so the UI stays interactive). ──
    const target = { x: 0, y: 0 };
    const curp = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    if (!reduce) window.addEventListener("pointermove", onPointer);

    const t0 = performance.now();
    let raf = 0;
    let running = true;

    const render = () => {
      const t = (performance.now() - t0) / 1000;
      curp.x += (target.x - curp.x) * 0.032;
      curp.y += (target.y - curp.y) * 0.032;
      world.rotation.y = Math.sin(t * 0.05) * 0.07 + curp.x * 0.2;
      world.rotation.x = curp.y * 0.13 - 0.03;
      camera.position.x = curp.x * 0.34;
      camera.position.y = -curp.y * 0.24;
      camera.lookAt(0, 0, 0);
      page.rotation.y = -0.35 + Math.sin(t * 0.16) * 0.05;
      page.position.y = Math.sin(t * 0.28) * 0.04;
      for (const b of blocks) {
        b.mesh.position.y = b.baseY + Math.sin(t * b.speed + b.phase) * b.amp;
        b.mesh.rotation.x += b.spin.x * 0.006;
        b.mesh.rotation.y += b.spin.y * 0.006;
        b.mesh.rotation.z += b.spin.z * 0.006;
      }
      renderer.render(scene, camera);
    };
    const loop = () => { if (!running) return; render(); raf = requestAnimationFrame(loop); };
    if (reduce) render(); else loop();

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth || 1;
      const h = mount.clientHeight || window.innerHeight || 1;
      if (w === width && h === height) return;
      width = w; height = h;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      // Centre the tableau on narrow screens (hero stacks on top of it there);
      // weight it right on wide screens (hero sits to the left).
      world.position.x = width > 820 ? 2.6 : 0;
      render(); // draw a fresh frame immediately so a resize never shows stale pixels
    };
    // Window resize always; ResizeObserver additionally catches layout-only
    // changes. A deferred call corrects the initial size once layout settles.
    window.addEventListener("resize", resize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(resize); ro.observe(mount); }
    requestAnimationFrame(resize);
    setTimeout(resize, 60);

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; loop(); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      applyRef.current = null;
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      renderer.dispose();
      pageGeo.dispose();
      blockGeo.dispose();
      lineGeos.forEach((g) => g.dispose());
      pageMat.dispose();
      lineMat.dispose();
      titleMat.dispose();
      materials.forEach((m) => m.dispose());
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  // Re-skin lighting when the theme flips (cheap; no scene rebuild).
  useEffect(() => { applyRef.current?.(dark); }, [dark]);

  return <div ref={mountRef} className="welcome-scene" aria-hidden="true" />;
}
