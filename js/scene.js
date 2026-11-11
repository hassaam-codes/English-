// 3D hero: the ten papers float as real sheets in a slow helix.
// Drag to spin, hover to lift a sheet, click to open that paper below.
import * as THREE from "three";
import { PAPERS } from "./data.js";

const canvas = document.getElementById("scene");
const stage = document.getElementById("stage");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (e) { return false; }
}

if (!canvas || !hasWebGL()) {
  document.documentElement.classList.add("no-webgl");
} else {
  start().catch(() => document.documentElement.classList.add("no-webgl"));
}

/* Draw one paper as a study card (not a copy of the PDF page). */
function paperTexture(p, renderer) {
  const W = 600, H = 800;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#1d4ed8"; g.fillRect(0, 0, W, 14);

  g.fillStyle = "#6e6e73";
  g.font = "500 26px Geist, system-ui, sans-serif";
  g.fillText("Lahore Board", 48, 96);

  g.fillStyle = "#171717";
  g.font = "500 168px Geist, system-ui, sans-serif";
  g.fillText(String(p.year), 40, 290);
  g.fillStyle = "#525252";
  g.font = "400 48px Geist, system-ui, sans-serif";
  g.fillText(`Group ${p.group}`, 48, 366);

  if (p.alp) {
    g.fillStyle = "#fdf0c2"; roundRect(g, 48, 400, 250, 44, 8); g.fill();
    g.fillStyle = "#5a4300"; g.font = "600 22px Geist, system-ui, sans-serif";
    g.fillText("NEW COURSE (ALP)", 64, 430);
  }

  // First translation sentence, as a taste of the paper
  g.fillStyle = "#171717";
  g.font = "400 34px 'Noto Nastaliq Urdu', serif";
  g.textAlign = "right"; g.direction = "rtl";
  g.fillText(p.q8[0], W - 48, 540);
  g.textAlign = "left"; g.direction = "ltr";

  const row = (label, text, y) => {
    g.fillStyle = "#1d4ed8"; roundRect(g, 48, y - 34, 76, 46, 10); g.fill();
    g.fillStyle = "#ffffff"; g.font = "500 24px 'Geist Mono', monospace"; g.fillText(label, 60, y - 3);
    g.fillStyle = "#525252"; g.font = "400 26px Geist, system-ui, sans-serif"; g.fillText(text, 144, y - 3);
  };
  row("Q.8", `${p.q8.length} translation sentences`, 660);
  row("Q.9", `${p.q9.length} change the voice`, 728);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

async function start() {
  // Make sure Urdu + serif fonts are ready before painting textures.
  try {
    await Promise.all([
      document.fonts.load("400 25px 'Noto Nastaliq Urdu'", "اردو"),
      document.fonts.load("500 168px Geist"),
      document.fonts.load("500 24px 'Geist Mono'"),
    ]);
  } catch (e) {}

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.2, 9.2);

  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 6);
  scene.add(key);
  // Neutral fill from the lower left, so the sheets read as paper, not tinted.
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(-3, -1, 2);
  scene.add(fill);

  const helix = new THREE.Group();
  scene.add(helix);

  const SW = 1.5, SH = SW * (800 / 600);
  const geo = new THREE.BoxGeometry(SW, SH, 0.012);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xdedcd4, roughness: 0.9 });

  const sheets = PAPERS.map((p, i) => {
    const map = paperTexture(p, renderer);
    const front = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    // Box back faces are already UV-mapped to read correctly from behind.
    const back = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, front, back]);
    const a = i * ((Math.PI * 2) / PAPERS.length);
    const r = 2.25;
    const y = (i - (PAPERS.length - 1) / 2) * 0.34;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    holder.rotation.y = a;
    holder.add(mesh);
    mesh.userData = { id: p.id, lift: 0, phase: i * 0.7, front };
    helix.add(holder);
    return mesh;
  });



  // Size
  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 520 ? 11.5 : 10.6;
    camera.updateProjectionMatrix();
    needsFrame = true;
  };
  new ResizeObserver(resize).observe(stage);

  // Pointer: hover, drag-to-spin, click-to-open
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  const mouse = { x: 0, y: 0 };
  let hovered = null, dragging = false, dragX = 0, moved = 0;
  let spin = 0, spinVel = 0;
  let needsFrame = true;

  const toNdc = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    mouse.x = ndc.x; mouse.y = ndc.y;
  };
  canvas.addEventListener("pointermove", (e) => {
    toNdc(e);
    if (dragging) {
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      moved += Math.abs(dx);
      spinVel = dx * 0.006;
      spin += spinVel;
    }
    needsFrame = true;
  });
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; dragX = e.clientX; moved = 0;
    if (e.pointerType === "mouse") canvas.setPointerCapture(e.pointerId);
  });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", (e) => {
    end();
    if (moved < 6) {
      toNdc(e);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(sheets, false)[0];
      if (hit) window.dispatchEvent(new CustomEvent("open-paper", { detail: hit.object.userData.id }));
    }
  });
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("pointerleave", () => { ndc.set(9, 9); mouse.x = mouse.y = 0; needsFrame = true; });

  // Only animate while the hero is on screen.
  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }).observe(stage);

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    const t = clock.getElapsedTime();
    if (!dragging) { spinVel *= 0.94; spin += spinVel + (reduceMotion ? 0 : 0.0016); }
    // Gentle scroll-linked turn (read in the frame loop, no scroll listener).
    const scrollTurn = Math.min(window.scrollY / innerHeight, 1.2);
    helix.rotation.y = spin + scrollTurn * 1.4;
    helix.rotation.x += ((mouse.y * 0.18 - 0.08) - helix.rotation.x) * 0.06;
    helix.rotation.z += ((-mouse.x * 0.06) - helix.rotation.z) * 0.06;
    helix.position.y = scrollTurn * 0.9;

    ray.setFromCamera(ndc, camera);
    const hit = dragging ? null : ray.intersectObjects(sheets, false)[0];
    const now = hit ? hit.object : null;
    if (now !== hovered) { hovered = now; canvas.classList.toggle("hovering", !!hovered); }

    for (const m of sheets) {
      const target = m === hovered ? 1 : 0;
      m.userData.lift += (target - m.userData.lift) * 0.12;
      const l = m.userData.lift;
      m.position.z = l * 0.55;
      m.scale.setScalar(1 + l * 0.08);
      m.position.y = reduceMotion ? 0 : Math.sin(t * 0.8 + m.userData.phase) * 0.05;
      m.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.5 + m.userData.phase) * 0.02;
    }
    renderer.render(scene, camera);
  }
  function loop() {
    cancelAnimationFrame(raf);
    const tick = () => {
      if (!visible) return;
      if (reduceMotion && !needsFrame && !dragging && Math.abs(spinVel) < 1e-4 && !hovered) {
        raf = requestAnimationFrame(tick);
        return;
      }
      needsFrame = false;
      frame();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  resize();
  frame();
  loop();
}
