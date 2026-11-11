import { COVER, PAPERS, REPEATED, Q8_HEADING, Q9_HEADING, ALT_HEADING, ROMAN } from "./data.js";

const $ = (s, el = document) => el.querySelector(s);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(pointer: fine)").matches;

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const groupLabel = (g) => `Group ${g}`;
const idFromLabel = (label) => {
  const m = label.trim().match(/(\d{4}) Group (I{1,2})/);
  return m ? `${m[1]}-${m[2].length}` : null;
};

/* ---------- Repeated lookup ---------- */
const repMap = new Map();
for (const row of [...REPEATED.q8, ...REPEATED.q9]) {
  for (const s of row.items) repMap.set(s, row);
}
const topicMap = new Map();
for (const row of REPEATED.topics) topicMap.set(row.items[0], row);
const topicOf = (alt) => (alt.match(/“(.+)”/) || [])[1];

/* ---------- Cover / hero text ---------- */
$("#hero-title").textContent = COVER.title;
$("#hero-sub").textContent = COVER.subtitle;
$("#hero-qs").innerHTML = `<strong>Q.8</strong> ${esc(COVER.q8)} &nbsp;•&nbsp; <strong>Q.9</strong> ${esc(COVER.q9)}`;
$("#cover-head").textContent = COVER.boxHeading;
$("#cover-note").innerHTML = COVER.boxNote;
$("#footer-text").textContent = COVER.footer;

$("#paper-grid").innerHTML = PAPERS.map(
  (p) => `<a class="tile reveal" href="#paper-${p.id}" data-open="${p.id}" aria-label="${p.year} ${groupLabel(p.group)}">
      ${p.alp ? '<span class="alp">NEW COURSE (ALP)</span>' : ""}
      <span class="tile-year">${p.year}</span>
      <span class="tile-group">${groupLabel(p.group)}</span>
    </a>`
).join("");

/* ---------- Sheets ---------- */
const highlight = (text, q) => {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + "<mark>" + esc(text.slice(i, i + q.length)) + "</mark>" + esc(text.slice(i + q.length));
};
const repTag = (s) => {
  const r = repMap.get(s);
  return r ? `<span class="rep-tag" title="Repeated: ${esc(r.in)}">Repeated ${r.times}×</span>` : "";
};

function sheetHTML(p, q, repOnly) {
  const match = (s) => (!q || s.toLowerCase().includes(q.toLowerCase())) && (!repOnly || repMap.has(s));
  const li = (s, i, cls) => {
    const on = match(s);
    return `<li class="${repMap.has(s) ? "is-rep" : ""} ${on ? "" : "dim"}" data-hit="${on ? 1 : 0}">
      <span class="num">${ROMAN[i]}</span>
      <span class="${cls}" ${cls === "ur" ? 'lang="ur" dir="rtl"' : ""}>${highlight(s, q)}</span>
      ${repTag(s)}
    </li>`;
  };
  const topic = topicOf(p.alt);
  const topicRep = topicMap.get(topic);
  const altHit = (!q || p.alt.toLowerCase().includes(q.toLowerCase())) && (!repOnly || !!topicRep);
  return `
    <article class="sheet" data-tilt>
      <h3>${esc(p.title)}</h3>
      ${p.alp ? '<span class="alp">NEW COURSE (ALP)</span>' : ""}
      <p class="meta">${esc(p.code)}<br />${esc(p.source)}</p>

      <div class="q-head"><span class="q-badge">Q.8</span><span>${esc(Q8_HEADING)}</span><span class="q-marks">5</span></div>
      <ol class="items">${p.q8.map((s, i) => li(s, i, "ur")).join("")}</ol>

      <div class="alt-box ${altHit ? "" : "dim"}" style="${altHit ? "" : "opacity:.22"}" data-hit="${altHit ? 1 : 0}">
        <b>${esc(ALT_HEADING)}</b>
        <div><span>${highlight(p.alt, q)} ${topicRep ? `<span class="rep-tag" title="Repeated: ${esc(topicRep.in)}">Repeated ${topicRep.times}×</span>` : ""}</span><span>5</span></div>
      </div>

      <div class="q-head"><span class="q-badge">Q.9</span><span>${esc(Q9_HEADING)}</span><span class="q-marks">5</span></div>
      <ol class="items">${p.q9.map((s, i) => li(s, i, "en")).join("")}</ol>

      <p class="sheet-foot">${esc(COVER.footer)} &nbsp;|&nbsp; Page ${p.page} of 13</p>
    </article>`;
}

const state = { year: "All", group: "All", q: "", repOnly: false };
const sheetsEl = $("#sheets");
let revealObserver;

function render() {
  const { year, group, q, repOnly } = state;
  const filtering = q || repOnly;
  let shown = 0;
  let hits = 0;
  const html = PAPERS.filter((p) => (year === "All" || String(p.year) === year) && (group === "All" || p.group === group))
    .map((p) => {
      const s = sheetHTML(p, q.trim(), repOnly);
      const n = (s.match(/data-hit="1"/g) || []).length;
      if (filtering && n === 0) return "";
      shown++;
      hits += n;
      return `<div class="sheet-shell reveal" id="paper-${p.id}">${s}</div>`;
    })
    .join("");
  sheetsEl.innerHTML = html;
  $("#empty").hidden = shown > 0;
  $("#result-count").textContent = filtering
    ? `${hits} matching item${hits === 1 ? "" : "s"} in ${shown} paper${shown === 1 ? "" : "s"}`
    : `Showing ${shown} of ${PAPERS.length} papers`;
  sheetsEl.querySelectorAll(".reveal").forEach((el) => observeReveal(el));
  sheetsEl.querySelectorAll("[data-tilt]").forEach((el) => bindTilt(el, 2.2));
}

/* ---------- Filters ---------- */
function chips(el, values, key, label = (v) => v) {
  el.innerHTML = values
    .map((v) => `<button class="chip" type="button" data-v="${v}" aria-pressed="${state[key] === v}">${label(v)}</button>`)
    .join("");
  el.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    state[key] = b.dataset.v;
    el.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    render();
  });
}
const years = ["All", ...new Set(PAPERS.map((p) => String(p.year)))];
chips($("#year-chips"), years, "year", (v) => (v === "All" ? "All years" : v));
chips($("#group-chips"), ["All", "I", "II"], "group", (v) => (v === "All" ? "Both groups" : groupLabel(v)));

let t;
$("#search").addEventListener("input", (e) => {
  clearTimeout(t);
  t = setTimeout(() => { state.q = e.target.value; render(); }, 120);
});
$("#rep-toggle").addEventListener("click", (e) => {
  state.repOnly = !state.repOnly;
  e.currentTarget.setAttribute("aria-pressed", String(state.repOnly));
  render();
});

function resetFilters() {
  Object.assign(state, { year: "All", group: "All", q: "", repOnly: false });
  $("#search").value = "";
  $("#rep-toggle").setAttribute("aria-pressed", "false");
  document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === "All")));
  render();
}
$("#clear").addEventListener("click", resetFilters);

/* ---------- Open a paper (from tiles, 3D scene, repeated table) ---------- */
function openPaper(id) {
  if (!document.getElementById(`paper-${id}`)) resetFilters();
  const el = document.getElementById(`paper-${id}`);
  if (!el) return;
  el.classList.add("in");
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  const sheet = el.querySelector(".sheet");
  if (!reduceMotion && sheet.animate) {
    sheet.animate(
      [{ outline: "2px solid transparent" }, { outline: "2px solid var(--accent)" }, { outline: "2px solid transparent" }],
      { duration: 1400, delay: 500, easing: "cubic-bezier(0.22,1,0.36,1)" }
    );
  }
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-open]");
  if (!a) return;
  e.preventDefault();
  openPaper(a.dataset.open);
});
window.addEventListener("open-paper", (e) => openPaper(e.detail));

/* ---------- Repeated tables ---------- */
const swap = ' <span class="swap" aria-label="or">⇄</span> ';
function table(rows, urdu) {
  return `<table class="rep-table">
    <thead><tr><th>Question item</th><th>Times</th><th>Appeared in</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr>
          <td class="${urdu ? "ur" : ""}" ${urdu ? 'lang="ur" dir="rtl"' : ""}>${r.items.map(esc).join(swap)}</td>
          <td class="times"><span>${r.times}×</span></td>
          <td class="in">${r.in
            .split(", ")
            .map((l) => `<button class="rep-jump" type="button" data-open="${idFromLabel(l)}">${esc(l)}</button>`)
            .join(", ")}</td>
        </tr>`
      )
      .join("")}</tbody></table>`;
}
$("#rep-title").textContent = REPEATED.title;
$("#rep-intro").innerHTML = REPEATED.intro;
$("#rep-q8").innerHTML = `<h3>${esc(REPEATED.q8Title)}</h3>${table(REPEATED.q8, true)}`;
$("#rep-q9").innerHTML = `<h3>${esc(REPEATED.q9Title)}</h3>${table(REPEATED.q9)}<p class="rep-note">${esc(REPEATED.note)}</p>`;
$("#rep-topics").innerHTML = `<h3>${esc(REPEATED.topicTitle)}</h3>${table(REPEATED.topics)}`;

/* ---------- Reveal on scroll ---------- */
function observeReveal(el) {
  if (reduceMotion || !("IntersectionObserver" in window)) return el.classList.add("in");
  revealObserver ||= new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); revealObserver.unobserve(en.target); }
    }),
    { threshold: 0, rootMargin: "0px 0px -40px 0px" }
  );
  revealObserver.observe(el);
}

/* ---------- 3D tilt ---------- */
function bindTilt(el, max) {
  if (reduceMotion || !finePointer) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(x - 0.5) * max * 2}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * max * 2}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  });
  el.addEventListener("pointerleave", () => {
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  });
}

/* ---------- Theme ---------- */
const themeBtn = $(".theme-toggle");
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
const syncThemeIcon = () => {
  themeBtn.querySelector("i").className = `ph-light ${isDark() ? "ph-sun" : "ph-moon-stars"}`;
};
themeBtn.addEventListener("click", () => {
  const next = isDark() ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("lb9-theme", next); } catch (e) {}
  syncThemeIcon();
  window.dispatchEvent(new CustomEvent("theme-change"));
});
syncThemeIcon();

/* ---------- Mobile menu ---------- */
const burger = $(".burger");
const menu = $("#menu");
function setMenu(open) {
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add("open"));
  } else {
    menu.classList.remove("open");
    setTimeout(() => (menu.hidden = true), 350);
  }
}
burger.addEventListener("click", () => setMenu(burger.getAttribute("aria-expanded") !== "true"));
menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

/* ---------- Scroll spy ---------- */
const links = document.querySelectorAll("[data-spy]");
const spy = new IntersectionObserver(
  (entries) => entries.forEach((en) => {
    if (en.isIntersecting) links.forEach((l) => l.classList.toggle("active", l.dataset.spy === en.target.id));
  }),
  { rootMargin: "-45% 0px -50% 0px" }
);
["index", "papers", "repeated"].forEach((id) => spy.observe(document.getElementById(id)));

/* ---------- Init ---------- */
document.querySelectorAll(".reveal").forEach(observeReveal);
document.querySelectorAll(".tile").forEach((el) => bindTilt(el, 5));
render();
