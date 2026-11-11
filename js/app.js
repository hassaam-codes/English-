import { ROMAN } from "./data.js";
import { loadContent } from "./content.js";
import "./notes.js"; // Notes page and admin panel (listen for the view-change event)

// Content comes from Supabase when it is set up, otherwise from the copy built into the site.
const { COVER, PAPERS, REPEATED, Q8_HEADING, Q9_HEADING, ALT_HEADING, ANSWERS, source: CONTENT_SOURCE } = await loadContent();
document.documentElement.dataset.content = CONTENT_SOURCE;
const roman = (i) => ROMAN[i] || `(${i + 1})`; // a paper added in the database may have more than eight items

const $ = (s, el = document) => el.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const paperLabel = (p) => `${p.year} Group ${p.group}`;
const idFromLabel = (label) => {
  const m = label.trim().match(/(\d{4}) Group (I{1,2})/);
  return m ? `${m[1]}-${m[2].length}` : null;
};

/* ---------- Data model ---------- */
const ITEMS = [];
for (const p of PAPERS) {
  p.q8.forEach((text, i) => ITEMS.push({ id: `${p.id}-q8-${i}`, paper: p, kind: "q8", i, text, ur: true }));
  p.q9.forEach((text, i) => ITEMS.push({ id: `${p.id}-q9-${i}`, paper: p, kind: "q9", i, text, ur: false }));
}
const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));
const repMap = new Map();
for (const row of [...REPEATED.q8, ...REPEATED.q9]) for (const s of row.items) repMap.set(s, row);
const topicMap = new Map(REPEATED.topics.map((r) => [r.items[0], r]));
const topicOf = (alt) => (alt.match(/“(.+)”/) || [])[1];

/* ---------- Progress (saved on this device) ---------- */
let done = new Set();
try { done = new Set(JSON.parse(localStorage.getItem("lb9-done") || "[]")); } catch (e) {}
const saveDone = () => { try { localStorage.setItem("lb9-done", JSON.stringify([...done])); } catch (e) {} };
function setDone(id, on) {
  on ? done.add(id) : done.delete(id);
  saveDone();
}

/* ---------- Toast ---------- */
let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("show"), 1600);
}

/* ---------- Segmented control with sliding pill ---------- */
function segmented(el, attr, onPick) {
  const btns = [...el.querySelectorAll("button")];
  const pill = document.createElement("span");
  pill.className = "seg-pill";
  pill.style.width = `calc((100% - 8px) / ${btns.length})`;
  el.prepend(pill);
  el.setAttribute("role", "tablist");
  btns.forEach((b) => b.setAttribute("role", "tab"));
  const set = (val) => {
    btns.forEach((b, i) => {
      const on = b.dataset[attr] === val;
      b.setAttribute("aria-selected", String(on));
      if (on) pill.style.transform = `translateX(${i * 100}%)`;
    });
  };
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    buzz();
    set(b.dataset[attr]);
    onPick(b.dataset[attr]);
  });
  return set;
}

/* ---------- Item row (used in papers and search) ---------- */
function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
}
function itemHTML(it, idx, { q = "", showSrc = false } = {}) {
  const r = repMap.get(it.text);
  const isDone = done.has(it.id);
  return `<li class="item ${isDone ? "is-done" : ""}" style="--i:${idx}" data-id="${it.id}">
    <span class="num">${roman(it.i)}</span>
    <span class="text">
      <span class="${it.ur ? "ur" : "en"}" ${it.ur ? 'lang="ur" dir="rtl"' : ""}>${highlight(it.text, q)}</span>
      ${showSrc ? `<span class="src">${esc(paperLabel(it.paper))} · ${it.kind === "q8" ? "Q.8" : "Q.9"}</span>` : ""}
      ${r ? `<span class="rep-tag">Repeated ${r.times}×</span>` : ""}
      <span class="ans" hidden><span class="ans-label">Answer</span>${esc(ANSWERS[it.text] || "")}</span>
    </span>
    <button class="check" type="button" aria-pressed="${isDone}" aria-label="Mark as practised">
      <i class="ph${isDone ? "-fill" : ""} ph-check-circle" aria-hidden="true"></i>
    </button>
  </li>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest(".check");
  if (!b) {
    // Tap a sentence to show or hide its answer
    const t = e.target.closest(".item .text");
    if (t) { const a = t.querySelector(".ans"); a.hidden = !a.hidden; t.closest(".item").classList.toggle("is-open", !a.hidden); buzz(6); }
    return;
  }
  const li = b.closest(".item");
  const on = b.getAttribute("aria-pressed") !== "true";
  setDone(li.dataset.id, on);
  b.setAttribute("aria-pressed", String(on));
  b.querySelector("i").className = `ph${on ? "-fill" : ""} ph-check-circle`;
  li.classList.toggle("is-done", on);
  buzz(on ? 12 : 6);
});

/* ---------- Home ---------- */
$("#hero-title").textContent = COVER.title;
$("#hero-sub").textContent = COVER.subtitle;

/* ---------- Papers ---------- */
const paperState = { idx: 0, section: "q8", q: "" };
$("#paper-chips").innerHTML = PAPERS.map((p, i) => `<button class="chip" type="button" data-i="${i}">${p.year} Group ${p.group}</button>`).join("");
$("#paper-chips").addEventListener("click", (e) => {
  const c = e.target.closest(".chip");
  if (c) { buzz(); goPaper(+c.dataset.i); }
});

function renderPaper(dir = 0) {
  const p = PAPERS[paperState.idx];
  const el = $("#paper");
  const topic = topicOf(p.alt);
  const topicRep = topicMap.get(topic);
  const items = ITEMS.filter((it) => it.paper === p && it.kind === paperState.section);
  let body;
  if (paperState.section === "alt") {
    body = `<div class="alt-card">
      <p class="alt-h">${esc(ALT_HEADING)}</p>
      <p class="alt-t">${esc(p.alt)}</p>
      ${topicRep ? `<span class="rep-tag">Repeated ${topicRep.times}×</span>` : ""}
    </div>`;
  } else {
    body = `<div class="q-intro"><p>${esc(paperState.section === "q8" ? Q8_HEADING : Q9_HEADING)}</p><span class="marks">5 marks</span></div>
      <p class="tap-hint"><i class="ph ph-hand-tap" aria-hidden="true"></i> Tap a sentence to see its answer</p>
      <ol class="items">${items.map((it, i) => itemHTML(it, i)).join("")}</ol>`;
  }
  el.innerHTML = `
    <div class="paper-head">
      ${p.alp ? '<div class="paper-kicker"><span class="alp">NEW COURSE (ALP)</span></div>' : ""}
      <div class="paper-year">${p.year} <span style="font-size:20px;color:var(--text-2)">Group ${p.group}</span></div>
      <p class="paper-title">${esc(p.title)}</p>
      <details><summary>Paper details <i class="ph ph-caret-down" aria-hidden="true"></i></summary>
        <p>${esc(p.code)}</p><p>${esc(p.source)}</p></details>
    </div>
    <div class="segmented" id="section-seg">
      <button type="button" data-sec="q8">Q.8 Translate</button>
      <button type="button" data-sec="q9">Q.9 Voice</button>
      <button type="button" data-sec="alt">English medium</button>
    </div>
    <div id="section-body">${body}</div>`;
  const setSeg = segmented($("#section-seg"), "sec", (v) => { paperState.section = v; writeHash(); renderPaper(); });
  setSeg(paperState.section);

  el.classList.remove("slide-left", "slide-right");
  el.style.transform = "";
  if (dir) { void el.offsetWidth; el.classList.add(dir > 0 ? "slide-left" : "slide-right"); }

  document.querySelectorAll("#paper-chips .chip").forEach((c, i) => c.setAttribute("aria-current", String(i === paperState.idx)));
  const chip = document.querySelector(`#paper-chips .chip[data-i="${paperState.idx}"]`);
  chip && chip.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  $("#pager-count").textContent = `${paperState.idx + 1} / ${PAPERS.length}`;
  $("#prev").disabled = paperState.idx === 0;
  $("#next").disabled = paperState.idx === PAPERS.length - 1;
}
function goPaper(i, dir) {
  if (i < 0 || i >= PAPERS.length) return;
  const d = dir ?? Math.sign(i - paperState.idx);
  paperState.idx = i;
  writeHash();
  renderPaper(d);
}
$("#prev").addEventListener("click", () => goPaper(paperState.idx - 1, -1));
$("#next").addEventListener("click", () => goPaper(paperState.idx + 1, 1));

// Swipe left / right between papers
(() => {
  const zone = $("#swipe-zone");
  let x0 = 0, y0 = 0, dx = 0, axis = null, id = null;
  zone.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" || e.target.closest("button, summary, a")) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; axis = null;
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!axis && Math.hypot(mx, my) > 10) axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (axis !== "x") return;
    dx = mx;
    const edge = (dx > 0 && paperState.idx === 0) || (dx < 0 && paperState.idx === PAPERS.length - 1);
    $("#paper").style.transform = `translateX(${edge ? dx * 0.2 : dx * 0.6}px)`;
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    const paper = $("#paper");
    if (axis === "x" && Math.abs(dx) > 70) {
      const next = paperState.idx + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < PAPERS.length) { buzz(10); goPaper(next, dx < 0 ? 1 : -1); return; }
    }
    paper.style.transition = "transform 240ms cubic-bezier(0.22,1,0.36,1)";
    paper.style.transform = "";
    setTimeout(() => (paper.style.transition = ""), 260);
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
})();

// Search across all papers
let searchT;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchT);
  searchT = setTimeout(() => { paperState.q = e.target.value.trim(); renderSearch(); }, 120);
});
function renderSearch() {
  const q = paperState.q;
  $("#paper-mode").hidden = !!q;
  $("#search-mode").hidden = !q;
  if (!q) return;
  const lq = q.toLowerCase();
  const hits = ITEMS.filter((it) => it.text.toLowerCase().includes(lq));
  const alts = PAPERS.filter((p) => p.alt.toLowerCase().includes(lq));
  $("#search-count").textContent = `${hits.length + alts.length} result${hits.length + alts.length === 1 ? "" : "s"}`;
  if (!hits.length && !alts.length) {
    $("#search-results").innerHTML = `<div class="empty"><i class="ph ph-magnifying-glass" aria-hidden="true"></i><p>Nothing matches “${esc(q)}”</p>
      <button class="btn btn-ghost btn-sm" type="button" id="clear-search">Clear search</button></div>`;
    return;
  }
  const groups = new Map();
  hits.forEach((it) => { if (!groups.has(it.paper)) groups.set(it.paper, []); groups.get(it.paper).push(it); });
  let html = [...groups].map(([p, list]) => `<div class="result-group">
      <h3>${esc(paperLabel(p))}</h3>
      <ol class="items">${list.map((it, i) => itemHTML(it, i, { q, showSrc: true })).join("")}</ol>
    </div>`).join("");
  if (alts.length) {
    html += `<div class="result-group"><h3>English medium topics</h3>${alts.map((p) =>
      `<a class="alt-card" style="display:block;margin-bottom:8px" href="#/papers/${p.id}/alt"><p class="alt-h">${esc(paperLabel(p))}</p><p class="alt-t">${highlight(p.alt, q)}</p></a>`).join("")}</div>`;
  }
  $("#search-results").innerHTML = html;
}
$("#search-results").addEventListener("click", (e) => {
  if (e.target.closest("#clear-search")) { $("#search").value = ""; paperState.q = ""; renderSearch(); $("#search").focus(); }
});

/* ---------- Practice deck ---------- */
const deck = { kind: "q8", queue: [], known: 0, again: 0 };
function buildDeck(kind) {
  deck.kind = kind;
  const pool = ITEMS.filter((it) => (kind === "rep" ? repMap.has(it.text) : it.kind === kind));
  const fresh = pool.filter((it) => !done.has(it.id));
  deck.queue = (fresh.length ? fresh : pool).map((it) => it.id);
  deck.total = deck.queue.length;
  deck.known = 0; deck.again = 0;
  $("#deck").innerHTML = "";
  renderDeck();
}
function cardHTML(it) {
  const r = repMap.get(it.text);
  const top = `<div class="f-top"><span class="f-q">${it.kind === "q8" ? "Q.8" : "Q.9"}</span>${r ? `<span class="rep-tag">Repeated ${r.times}×</span>` : ""}</div>`;
  const q = `<span class="${it.ur ? "ur" : "en"}" ${it.ur ? 'lang="ur" dir="rtl"' : ""}>${esc(it.text)}</span>`;
  return `<div class="f-inner">
      <div class="f-face f-front">
        ${top}
        <p class="f-ask">${esc(it.kind === "q8" ? Q8_HEADING : Q9_HEADING)}</p>
        <div class="f-body">${q}</div>
        <div class="f-foot"><span class="f-src">${esc(paperLabel(it.paper))} · ${roman(it.i)}</span><span class="f-hint"><i class="ph ph-hand-tap" aria-hidden="true"></i> Tap for answer</span></div>
      </div>
      <div class="f-face f-back" aria-hidden="true">
        <div class="f-top"><span class="f-q">Answer</span><span class="f-hint"><i class="ph ph-arrow-u-up-left" aria-hidden="true"></i> Tap for question</span></div>
        <div class="f-body"><span class="f-answer">${esc(ANSWERS[it.text] || "")}</span></div>
        <div class="f-quest">${q}</div>
      </div>
    </div>
    <span class="stamp yes">Got it</span><span class="stamp no">Again</span>`;
}
function flipTop() {
  const top = $('#deck .fcard[data-depth="0"]:not(.flying)');
  if (!top) return;
  const inner = top.querySelector(".f-inner");
  if (inner.dataset.busy) return;
  const swap = () => {
    const on = top.classList.toggle("flipped");
    top.querySelector(".f-front").setAttribute("aria-hidden", String(on));
    top.querySelector(".f-back").setAttribute("aria-hidden", String(!on));
  };
  buzz(6);
  inner.dataset.busy = "1";
  // Timers (not animation events) so a flip can never get stuck half way.
  const [out, back, tOut, tIn] = reduceMotion ? ["fade-out", "fade-in", 120, 170] : ["flip-out", "flip-in", 200, 330];
  inner.classList.add(out);
  setTimeout(() => {
    swap();
    inner.classList.remove(out);
    inner.classList.add(back);
    setTimeout(() => { inner.classList.remove(back); delete inner.dataset.busy; }, tIn);
  }, tOut);
}
function renderDeck() {
  const box = $("#deck");
  const ids = deck.queue.slice(0, 4);
  box.querySelectorAll(".fcard").forEach((n) => { if (!ids.includes(n.dataset.id) && !n.classList.contains("flying")) n.remove(); });
  box.querySelector(".deck-done")?.remove();
  ids.forEach((id, depth) => {
    let n = box.querySelector(`.fcard[data-id="${id}"]:not(.flying)`);
    if (!n) {
      n = document.createElement("article");
      n.className = "fcard";
      n.dataset.id = id;
      n.dataset.depth = "3";
      n.innerHTML = cardHTML(BY_ID.get(id));
      box.prepend(n);
      void n.offsetWidth;
    }
    n.dataset.depth = String(depth);
    n.style.zIndex = String(10 - depth);
    n.setAttribute("aria-hidden", String(depth !== 0));
  });
  const left = deck.queue.length;
  $("#deck-count").textContent = left ? `${left} left · ${deck.known} known · ${deck.again} to repeat` : "";
  if (!left) {
    box.insertAdjacentHTML("beforeend", `<div class="deck-done"><span class="big">${deck.known} / ${deck.total}</span>
      <p>Deck finished. Every card you knew is marked as practised.</p>
      <button class="btn btn-primary" type="button" id="restart"><i class="ph ph-arrow-clockwise" aria-hidden="true"></i><span>Practise again</span></button></div>`);
  }
  $("#gotit").disabled = $("#again").disabled = !left;
  const top = box.querySelector('.fcard[data-depth="0"]');
  if (top) bindDrag(top);
}
function fling(dir) {
  const box = $("#deck");
  const top = box.querySelector('.fcard[data-depth="0"]:not(.flying)');
  if (!top) return;
  const id = top.dataset.id;
  top.classList.add("flying");
  top.classList.remove("dragging");
  top.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 320ms cubic-bezier(0.22,1,0.36,1)";
  top.style.transform = `translateX(${dir * 140}%) rotate(${dir * 18}deg)`;
  top.style.opacity = "0";
  setTimeout(() => top.remove(), 340);
  deck.queue.shift();
  if (dir > 0) { deck.known++; setDone(id, true); buzz(14); }
  else { deck.again++; deck.queue.push(id); buzz(6); }
  renderDeck();
}
function bindDrag(card) {
  if (card.dataset.bound) return;
  card.dataset.bound = "1";
  let x0 = 0, y0 = 0, dx = 0, moved = 0, pid = null;
  const yes = card.querySelector(".stamp.yes"), no = card.querySelector(".stamp.no");
  card.addEventListener("pointerdown", (e) => {
    if (card.dataset.depth !== "0") return;
    pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; moved = 0;
    card.setPointerCapture(pid);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - x0;
    moved = Math.max(moved, Math.hypot(dx, e.clientY - y0));
    const dy = (e.clientY - y0) * 0.25;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    yes.style.opacity = Math.max(0, Math.min(1, dx / 90));
    no.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (Math.abs(dx) > 90) return fling(dx > 0 ? 1 : -1);
    if (e.type === "pointerup" && moved < 8) flipTop();
    card.classList.remove("dragging");
    card.style.transform = "";
    yes.style.opacity = no.style.opacity = 0;
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
}
$("#gotit").addEventListener("click", () => fling(1));
$("#again").addEventListener("click", () => fling(-1));
$("#shuffle").addEventListener("click", () => {
  for (let i = deck.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck.queue[i], deck.queue[j]] = [deck.queue[j], deck.queue[i]]; }
  $("#deck").innerHTML = ""; renderDeck(); buzz(); toast("Shuffled");
});
$("#deck").addEventListener("click", (e) => {
  if (e.target.closest("#restart")) {
    const pool = ITEMS.filter((it) => (deck.kind === "rep" ? repMap.has(it.text) : it.kind === deck.kind));
    deck.queue = pool.map((it) => it.id); deck.total = deck.queue.length; deck.known = deck.again = 0;
    $("#deck").innerHTML = ""; renderDeck();
  }
});
document.addEventListener("keydown", (e) => {
  if (current !== "practice" || e.target.closest("input")) return;
  if (e.key === " " || e.key === "Enter") { if (!e.target.closest("button, a")) { e.preventDefault(); flipTop(); } }
  if (e.key === "ArrowRight") fling(1);
  if (e.key === "ArrowLeft") fling(-1);
});
const setDeckSeg = segmented($("#deck-filter"), "deck", (v) => buildDeck(v));

/* ---------- Repeated ---------- */
$("#rep-title").textContent = REPEATED.title;
$("#rep-intro").innerHTML = REPEATED.intro;
let repKind = "q8";
function renderRepeated() {
  const rows = REPEATED[repKind];
  $("#rep-list-title").textContent = { q8: REPEATED.q8Title, q9: REPEATED.q9Title, topics: REPEATED.topicTitle }[repKind];
  $("#rep-list").innerHTML = rows.map((r, i) => `<div class="rep-card" style="--i:${i}">
      <div class="t">${r.items.map((s) => `<span class="${repKind === "q8" ? "ur" : "en"}" ${repKind === "q8" ? 'lang="ur" dir="rtl"' : ""}>${esc(s)}</span>`).join('<span class="swap">⇄</span>')}</div>
      <div class="times">${r.times}×<small>times</small></div>
      <div class="where">${r.in.split(", ").map((l) => `<button type="button" data-go="${idFromLabel(l)}">${esc(l)}</button>`).join("")}</div>
    </div>`).join("");
  $("#rep-note").textContent = repKind === "q9" ? REPEATED.note : "";
}
const setRepSeg = segmented($("#rep-filter"), "rep", (v) => { repKind = v; renderRepeated(); });
$("#rep-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  const sec = repKind === "q9" ? "q9" : repKind === "topics" ? "alt" : "q8";
  location.hash = `#/papers/${b.dataset.go}/${sec}`;
});

/* ---------- Router + tab bar ---------- */
const ORDER = ["home", "papers", "practice", "repeated", "notes", "admin"];
let current = null;
function writeHash() {
  const h = `#/papers/${PAPERS[paperState.idx].id}/${paperState.section}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}
function route() {
  const [, name = "home", pid, sec] = (location.hash || "#/home").split("/");
  const view = ORDER.includes(name) ? name : "home";
  if (view === "papers") {
    const i = PAPERS.findIndex((p) => p.id === pid);
    const changed = (i >= 0 && i !== paperState.idx) || (sec && sec !== paperState.section);
    const dir = i >= 0 ? Math.sign(i - paperState.idx) : 0;
    if (i >= 0) paperState.idx = i;
    if (["q8", "q9", "alt"].includes(sec)) paperState.section = sec;
    if (pid && pid !== "search" && paperState.q) { paperState.q = ""; $("#search").value = ""; renderSearch(); }
    if (changed || current !== "papers") renderPaper(current === "papers" ? dir : 0);
  }
  syncTabs(view === "papers" && pid === "search" ? "search" : view);
  if (view === "papers" && pid === "search") {
    if (paperState.q) { renderSearch(); }
    requestAnimationFrame(() => { $("#search").focus({ preventScroll: true }); });
  }
  if (view === current) return;
  const from = ORDER.indexOf(current), to = ORDER.indexOf(view);
  document.querySelectorAll(".view").forEach((v) => {
    const on = v.dataset.view === view;
    v.hidden = !on;
    if (on) {
      v.classList.remove("from-left", "from-right");
      void v.offsetWidth;
      if (from >= 0) v.classList.add(to > from ? "from-right" : "from-left");
    }
  });
  window.scrollTo(0, 0);
  document.documentElement.classList.toggle("is-practice", view === "practice");
  document.documentElement.classList.toggle("is-home", view === "home");
  current = view;
  document.dispatchEvent(new CustomEvent("view-change", { detail: view }));
}
window.addEventListener("hashchange", route);
document.querySelectorAll(".tab, .fab").forEach((t) => t.addEventListener("click", () => buzz()));
function syncTabs(active) {
  document.querySelectorAll(".tab, .fab").forEach((t) => {
    const on = t.dataset.tab === active;
    if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    const i = t.querySelector("i[data-icon]");
    if (i) i.className = `${on ? "ph-fill" : "ph"} ph-${i.dataset.icon}`;
  });
}

/* Notched background: redrawn to the bar's real size, so the curve never stretches. */
(() => {
  const nav = $(".tabbar");
  const path = nav.querySelector(".tabbar-bg path");
  const wide = matchMedia("(min-width: 960px)");
  const draw = () => {
    const W = nav.clientWidth, H = nav.clientHeight;
    if (!W || !H) return;
    const c = W / 2, R = 40, D = 36, S = 22;            // notch half-width, depth, shoulder
    const tr = wide.matches ? 24 : 22;                  // top corner radius
    const br = wide.matches ? 24 : 0;                   // bottom corners only on the floating bar
    nav.querySelector(".tabbar-bg").setAttribute("viewBox", `0 0 ${W} ${H}`);
    path.setAttribute("d", [
      `M0 ${tr}`, `Q0 0 ${tr} 0`,
      `H${c - R - S}`,
      `C${c - R - 4} 0 ${c - R + 2} ${D} ${c} ${D}`,
      `C${c + R - 2} ${D} ${c + R + 4} 0 ${c + R + S} 0`,
      `H${W - tr}`, `Q${W} 0 ${W} ${tr}`,
      `V${H - br}`, br ? `Q${W} ${H} ${W - br} ${H}` : "",
      `H${br}`, br ? `Q0 ${H} 0 ${H - br}` : "", "Z",
    ].join(" "));
  };
  new ResizeObserver(draw).observe(nav);
  wide.addEventListener?.("change", draw);
  draw();
})();

/* ---------- Top bar hairline once content scrolls under it ---------- */
const sentinel = document.createElement("div");
sentinel.style.cssText = "position:absolute;top:0;height:1px;width:1px";
document.body.prepend(sentinel);
new IntersectionObserver(([en]) => $(".topbar").classList.toggle("scrolled", !en.isIntersecting)).observe(sentinel);

/* ---------- Theme ---------- */
const themeBtn = $(".theme-toggle");
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
const syncThemeIcon = () => { themeBtn.querySelector("i").className = `ph ${isDark() ? "ph-sun" : "ph-moon"}`; };
themeBtn.addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("lb9-theme", next); } catch (e) {}
  syncThemeIcon();
  buzz();
});
syncThemeIcon();

/* ---------- Init ---------- */
setDeckSeg("q8");
buildDeck("q8");
setRepSeg("q8");
renderRepeated();
route();
