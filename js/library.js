// English A and English B: a list of chapters, and a page for each chapter.
// Links:  /#/a  (list)   /#/a/unit-1  (chapter)   /#/a/unit-1/2  (chapter, third section)
import { ENGLISH_A, ENGLISH_B } from "./book.js";

const BOOKS = { a: ENGLISH_A, b: ENGLISH_B };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// "Summary · 12 questions" for the chapter row
function overview(ch) {
  return (ch.sections || []).map((s) => (s.kind === "qa" ? `${s.items.length} question${s.items.length === 1 ? "" : "s"}` : s.title)).join(" · ");
}

function listHTML(book) {
  const rows = book.chapters.map((ch, i) => `<a class="chapter" style="--i:${Math.min(i, 10)}" href="#/${book.key}/${encodeURIComponent(ch.id)}">
      <span class="chapter-no">${esc(ch.no || i + 1)}</span>
      <span><span class="chapter-title">${esc(ch.title)}</span><span class="chapter-meta">${esc(overview(ch))}</span></span>
      <i class="ph ph-caret-right" aria-hidden="true"></i></a>`).join("");
  return `<div class="view-head">
      <h2 class="view-title">${esc(book.name)}</h2>
      <p class="view-lead">${esc(book.label)}</p>
    </div>
    ${book.chapters.length ? `<div class="chapter-list">${rows}</div>`
      : `<div class="empty"><i class="ph ${book.key === "a" ? "ph-book-open" : "ph-text-aa"}" aria-hidden="true"></i><p>${book.key === "a" ? "Chapters" : "Topics"} are being added</p></div>`}`;
}

function sectionHTML(s) {
  const dir = s.urdu ? ' class="ur" lang="ur" dir="rtl"' : "";
  if (s.kind === "qa") return `<ol class="qa">${s.items.map((it, i) => `<li class="qa-item" style="--i:${Math.min(i, 10)}">
      <p class="qa-q"><span class="qa-n">Q.${i + 1}</span><span${dir}>${esc(it.q)}</span></p>
      <p class="qa-a"${s.urdu ? ' lang="ur" dir="rtl"' : ""}>${esc(it.a)}</p></li>`).join("")}</ol>`;
  if (s.kind === "list") return `<ul class="prose-list"${s.urdu ? ' lang="ur" dir="rtl"' : ""}>${s.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (s.kind === "table") return `<div class="table-wrap"><table class="notes-table">
      ${s.head ? `<thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""}
      <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return `<div class="prose"${s.urdu ? ' lang="ur" dir="rtl"' : ""}>${(s.paras || []).map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
}

function chapterHTML(book, ch, at) {
  const secs = ch.sections || [];
  const i = Math.min(Math.max(at, 0), Math.max(secs.length - 1, 0));
  const idx = book.chapters.indexOf(ch), prev = book.chapters[idx - 1], next = book.chapters[idx + 1];
  const link = (c) => `#/${book.key}/${encodeURIComponent(c.id)}`;
  return `<div class="view-head">
      <a class="back" href="#/${book.key}"><i class="ph ph-arrow-left" aria-hidden="true"></i>${esc(book.name)}</a>
      ${ch.no ? `<p class="chapter-kicker">${esc(ch.no)}</p>` : ""}
      <h2 class="view-title">${esc(ch.title)}</h2>
    </div>
    ${secs.length > 1 ? `<div class="chip-rail" role="tablist" aria-label="Sections">${secs.map((s, n) =>
      `<a class="chip" role="tab" aria-current="${n === i}" href="${link(ch)}/${n}">${esc(s.title)}</a>`).join("")}</div>` : ""}
    ${secs.length ? `<h3 class="list-title">${esc(secs[i].title)}</h3>${sectionHTML(secs[i])}`
      : '<div class="empty"><i class="ph ph-hourglass" aria-hidden="true"></i><p>This chapter is being added</p></div>'}
    <div class="pager">
      ${prev ? `<a class="btn btn-ghost btn-sm" href="${link(prev)}"><i class="ph ph-arrow-left" aria-hidden="true"></i><span>Previous</span></a>` : "<span></span>"}
      <span class="pager-count">${idx + 1} / ${book.chapters.length}</span>
      ${next ? `<a class="btn btn-ghost btn-sm" href="${link(next)}"><span>Next</span><i class="ph ph-arrow-right" aria-hidden="true"></i></a>` : "<span></span>"}
    </div>`;
}

let last = "";
function render() {
  const [, key, id, sec] = (location.hash || "").split("/");
  const book = BOOKS[key];
  if (!book) { last = ""; return; }
  const box = document.getElementById(`view-${key}`);
  const ch = id && book.chapters.find((c) => c.id === decodeURIComponent(id));
  if (id && !ch) { history.replaceState(null, "", `#/${key}`); }
  box.innerHTML = ch ? chapterHTML(book, ch, +sec || 0) : listHTML(book);
  // New chapter or back to the list: start at the top. Switching section keeps your place.
  const where = `${key}/${ch ? ch.id : ""}`;
  if (where !== last) window.scrollTo(0, 0);
  else box.querySelector('.chip[aria-current="true"]')?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  last = where;
}
window.addEventListener("hashchange", render);
document.addEventListener("view-change", render);

// Counts for the Home page rows
export const counts = () => ({ a: ENGLISH_A.chapters.length, b: ENGLISH_B.chapters.length });
