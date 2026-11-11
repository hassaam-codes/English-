// English A and English B: a list of chapters, and a page for each chapter.
// Links:  /#/a  (list)   /#/a/unit-1  (chapter)   /#/a/unit-1/2  (chapter, third section)
import { ENGLISH_A, ENGLISH_B } from "./book.js";

const BOOKS = { a: ENGLISH_A, b: ENGLISH_B };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LONG = 6; // chapters with more sections than this get a contents list instead of a row of tabs
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// "Summary · 12 questions" for the chapter row
function overview(ch) {
  const secs = ch.sections || [];
  if (ch.flow) {
    const n = secs.reduce((t, s) => t + (s.items ? s.items.length : 0), 0);
    return n ? `${n} sentences` : "";
  }
  if (secs.length > LONG) {
    const n = secs.reduce((t, s) => t + (s.items ? s.items.length : 0), 0);
    return `${secs.length} sections${n ? ` · ${n} sentences` : ""}`;
  }
  return secs.map((s) => (s.kind === "qa" ? `${s.items.length} question${s.items.length === 1 ? "" : "s"}` : s.title)).join(" · ");
}

function listHTML(book) {
  const rows = book.chapters.map((ch, i) => (ch.fileOnly && ch.pdf
    // A file, not a page: the row opens the PDF itself
    ? `<a class="chapter" style="--i:${Math.min(i, 10)}" href="${esc(ch.pdf)}" target="_blank" rel="noopener">
      <span class="chapter-no chapter-file"><i class="ph ph-file-pdf" aria-hidden="true"></i></span>
      <span><span class="chapter-title">${esc(ch.title)}</span><span class="chapter-meta">PDF</span></span>
      <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>`
    : `<a class="chapter" style="--i:${Math.min(i, 10)}" href="#/${book.key}/${encodeURIComponent(ch.id)}">
      <span class="chapter-no">${esc(ch.no || i + 1)}</span>
      <span><span class="chapter-title">${esc(ch.title)}</span><span class="chapter-meta">${esc(overview(ch))}</span></span>
      <i class="ph ph-caret-right" aria-hidden="true"></i></a>`)).join("");
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
  if (s.kind === "pairs") return `<ol class="pairs">${s.items.map((it, i) => {
      // Number exactly as the source prints it; if the source has none, none is shown.
      const n = it.n !== undefined ? it.n : `${i + 1}.`;
      const ur = it.ur ? `<span class="pair-ur" lang="ur" dir="rtl">${esc(it.ur)}</span>` : "";
      const en = it.en ? `<span class="pair-en">${n ? `<span class="pair-n">${esc(n)}</span> ` : ""}${esc(it.en)}</span>` : "";
      return `<li class="pair">${it.enFirst ? en + ur : ur + en}</li>`;
    }).join("")}</ol>`;
  if (s.kind === "list") return `<ul class="prose-list"${s.urdu ? ' lang="ur" dir="rtl"' : ""}>${s.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (s.kind === "table") return `<div class="table-wrap"><table class="notes-table">
      ${s.head ? `<thead><tr>${s.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""}
      <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return `<div class="prose"${s.urdu ? ' lang="ur" dir="rtl"' : ""}>${(s.paras || []).map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
}

function chapterHTML(book, ch, at) {
  const secs = ch.sections || [];
  const long = secs.length > LONG && !ch.flow;
  const idx = book.chapters.indexOf(ch), prev = book.chapters[idx - 1], next = book.chapters[idx + 1];
  const link = (c) => `#/${book.key}/${encodeURIComponent(c.id)}`;
  const head = (backHref, backText, kicker, title) => `<div class="view-head">
      <a class="back" href="${backHref}"><i class="ph ph-arrow-left" aria-hidden="true"></i>${esc(backText)}</a>
      ${kicker ? `<p class="chapter-kicker">${esc(kicker)}</p>` : ""}
      <h2 class="view-title">${esc(title)}</h2>
    </div>`;
  const pager = (p, n, count) => `<div class="pager">
      ${p ? `<a class="btn btn-ghost btn-sm" href="${p}"><i class="ph ph-arrow-left" aria-hidden="true"></i><span>Previous</span></a>` : "<span></span>"}
      <span class="pager-count">${count}</span>
      ${n ? `<a class="btn btn-ghost btn-sm" href="${n}"><span>Next</span><i class="ph ph-arrow-right" aria-hidden="true"></i></a>` : "<span></span>"}
    </div>`;
  const pdf = ch.pdf ? `<a class="btn btn-ghost btn-sm pdf-link" href="${esc(ch.pdf)}" download><i class="ph ph-download-simple" aria-hidden="true"></i><span>Download PDF</span></a>` : "";

  // Flow chapter: the whole thing on one page, in the order of the source, headings in place
  if (ch.flow) {
    return `${head(`#/${book.key}`, book.name, ch.no, ch.title)}${pdf}
      ${secs.map((s) => `<h3 class="flow-title">${esc(s.title)}</h3>${s.sub ? `<h4 class="flow-sub">${esc(s.sub)}</h4>` : ""}${sectionHTML(s)}`).join("")}
      ${pager(prev && link(prev), next && link(next), `${idx + 1} / ${book.chapters.length}`)}`;
  }
  // Long chapter, no section chosen: show its contents
  if (long && at === null) {
    return `${head(`#/${book.key}`, book.name, ch.no, ch.title)}${pdf}
      <div class="chapter-list">${secs.map((s, n) => `<a class="chapter" style="--i:${Math.min(n, 10)}" href="${link(ch)}/${n}">
        <span class="chapter-no">${n + 1}</span>
        <span><span class="chapter-title">${esc(s.title)}</span>${s.items ? `<span class="chapter-meta">${s.items.length} sentence${s.items.length === 1 ? "" : "s"}</span>` : ""}</span>
        <i class="ph ph-caret-right" aria-hidden="true"></i></a>`).join("")}</div>
      ${pager(prev && link(prev), next && link(next), `${idx + 1} / ${book.chapters.length}`)}`;
  }
  const i = Math.min(Math.max(at || 0, 0), Math.max(secs.length - 1, 0));
  // Long chapter, one section: its own page with previous / next section
  if (long) {
    return `${head(link(ch), ch.title, `${i + 1} of ${secs.length}`, secs[i].title)}
      ${sectionHTML(secs[i])}
      ${pager(i > 0 && `${link(ch)}/${i - 1}`, i < secs.length - 1 && `${link(ch)}/${i + 1}`, `${i + 1} / ${secs.length}`)}`;
  }
  return `${head(`#/${book.key}`, book.name, ch.no, ch.title)}${pdf}
    ${secs.length > 1 ? `<div class="chip-rail" role="tablist" aria-label="Sections">${secs.map((s, n) =>
      `<a class="chip" role="tab" aria-current="${n === i}" href="${link(ch)}/${n}">${esc(s.title)}</a>`).join("")}</div>` : ""}
    ${secs.length ? `<h3 class="list-title">${esc(secs[i].title)}</h3>${sectionHTML(secs[i])}`
      : '<div class="empty"><i class="ph ph-hourglass" aria-hidden="true"></i><p>This chapter is being added</p></div>'}
    ${pager(prev && link(prev), next && link(next), `${idx + 1} / ${book.chapters.length}`)}`;
}

let last = "";
function render() {
  const [, key, id, sec] = (location.hash || "").split("/");
  const book = BOOKS[key];
  if (!book) { last = ""; return; }
  const box = document.getElementById(`view-${key}`);
  const ch = id && book.chapters.find((c) => c.id === decodeURIComponent(id) && !c.fileOnly); // file-only entries have no page
  if (id && !ch) { history.replaceState(null, "", `#/${key}`); }
  const at = sec === undefined || sec === "" || isNaN(+sec) ? null : +sec;
  box.innerHTML = ch ? chapterHTML(book, ch, at) : listHTML(book);
  // New chapter or back to the list: start at the top. Switching section keeps your place.
  const where = `${key}/${ch ? ch.id : ""}/${ch && !ch.flow && (ch.sections || []).length > LONG ? at : ""}`;
  if (where !== last) window.scrollTo(0, 0);
  else box.querySelector('.chip[aria-current="true"]')?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" });
  last = where;
}
window.addEventListener("hashchange", render);
document.addEventListener("view-change", render);

// Counts for the Home page rows
export const counts = () => ({ a: ENGLISH_A.chapters.length, b: ENGLISH_B.chapters.length });
