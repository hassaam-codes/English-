// Builds the pages search engines read: one real address per past paper, chapter and tense,
// plus sitemap.xml and robots.txt. The app (index.html) is not touched.
//
//   node tools/build-pages.mjs
//
// Run it again after changing js/data.js, js/answers.js or js/book.js, then commit the result.
// The wording of questions, answers and sentences is taken straight from those files; only page
// titles, descriptions and the short intro line on each page are written here.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PAPERS, REPEATED } from "../js/data.js";
import { ANSWERS } from "../js/answers.js";
import { ENGLISH_A, ENGLISH_B } from "../js/book.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://english-paper.vercel.app"; // change here if the site moves to its own domain
const BRAND = "9th English";
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
const slug = (s) => String(s).toLowerCase().replace(/["'’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clip = (s, n = 155) => { s = String(s).replace(/\s+/g, " ").trim(); return s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`; };
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Is|Am|Are|Was|Were|Of|About|To)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());

const written = [];   // { url, priority } for the sitemap
const made = new Set(); // top-level folders this script owns

function page({ url, title, description, crumbs, h1, kicker, lead, body, app, pdf, prev, next, ld = [] }) {
  const canonical = `${SITE}${url}`;
  const trail = [{ name: "Home", url: "/" }, ...crumbs];
  const breadcrumbLd = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE}${c.url}` })),
  };
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="theme-color" content="#f3f5f9" media="(prefers-color-scheme: light)" />
  <meta name="theme-color" content="#0f1218" media="(prefers-color-scheme: dark)" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="${BRAND}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE}/assets/icons/icon-512.png" />
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml" />
  <link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/css/styles.css" />
  <link rel="stylesheet" href="/css/pages.css" />
  <script>try { const t = localStorage.getItem("lb9-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}</script>
  <script type="application/ld+json">${JSON.stringify([breadcrumbLd, ...ld])}</script>
</head>
<body class="doc">
  <a class="skip" href="#content">Skip to content</a>
  <div class="paper-bg" aria-hidden="true"></div>
  <div class="grain" aria-hidden="true"></div>
  <header class="topbar">
    <a class="brand" href="/" aria-label="${BRAND} home">
      <svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path class="bm-sheet" d="M14 0h30l20 20v30a14 14 0 0 1-14 14H14A14 14 0 0 1 0 50V14A14 14 0 0 1 14 0z"/>
        <path class="bm-fold" d="M44 0v12a8 8 0 0 0 8 8h12z"/>
        <g class="bm-nine" fill="none" stroke-width="7.5" stroke-linecap="round"><circle cx="29" cy="28" r="9.75"/><path d="M38.75 28v8c0 10-6.5 15.75-16.5 15.75"/></g>
      </svg>
      <span class="brand-text">${BRAND}</span>
    </a>
    <nav class="doc-nav" aria-label="Sections">
      <a href="/english-a/">English A</a><a href="/english-b/">English B</a><a href="/past-papers/">Past papers</a>
    </nav>
  </header>
  <main id="content" class="doc-main">
    <nav class="crumbs" aria-label="Breadcrumb">${trail.map((c, i) => (i < trail.length - 1 ? `<a href="${c.url}">${esc(c.name)}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(c.name)}</span>`)).join("")}</nav>
    <article>
      <header class="doc-head">
        ${kicker ? `<p class="chapter-kicker">${esc(kicker)}</p>` : ""}
        <h1 class="view-title">${esc(h1)}</h1>
        ${lead ? `<p class="view-lead">${lead}</p>` : ""}
        ${app || pdf ? `<p class="doc-actions">${app ? `<a class="btn btn-primary btn-sm" href="${app.url}">${esc(app.label)}</a>` : ""}${pdf ? `<a class="btn btn-ghost btn-sm" href="${pdf}">Download PDF</a>` : ""}</p>` : ""}
      </header>
      ${body}
    </article>
    ${prev || next ? `<nav class="doc-pager" aria-label="More pages">${prev ? `<a href="${prev.url}" rel="prev"><small>Previous</small>${esc(prev.name)}</a>` : "<span></span>"}${next ? `<a href="${next.url}" rel="next"><small>Next</small>${esc(next.name)}</a>` : "<span></span>"}</nav>` : ""}
  </main>
  <footer class="doc-foot">
    <p><a href="/">${BRAND}</a> · 9th class English for the Lahore Board: <a href="/english-a/">textbook question answers</a>, <a href="/english-b/">grammar and tenses</a>, <a href="/past-papers/">past papers 2022 to 2026</a>, <a href="/repeated-questions/">repeated questions</a>.</p>
  </footer>
</body>
</html>
`;
  const dir = path.join(ROOT, url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  written.push({ url, priority: url.split("/").filter(Boolean).length > 1 ? "0.8" : "0.9" });
}
function fresh(folder) { fs.rmSync(path.join(ROOT, folder), { recursive: true, force: true }); made.add(folder); }
const cards = (items) => `<div class="chapter-list doc-list">${items.map((it) => `<a class="chapter" href="${it.url}"><span class="chapter-no">${esc(it.no)}</span><span><span class="chapter-title">${esc(it.name)}</span>${it.meta ? `<span class="chapter-meta">${esc(it.meta)}</span>` : ""}</span><span class="doc-arrow" aria-hidden="true">›</span></a>`).join("")}</div>`;

/* ---------- Past papers ---------- */
fresh("past-papers");
const paperUrl = (p) => `/past-papers/${p.year}-group-${p.group === "II" ? 2 : 1}/`;
const paperName = (p) => `${p.year} Group ${p.group}`;
const sentence = (q, urdu) => {
  const a = ANSWERS[q];
  return `<li class="pair">${urdu ? `<p class="pair-ur" lang="ur" dir="rtl">${esc(q)}</p>` : `<p class="pair-en">${esc(q)}</p>`}${a ? `<p class="doc-answer"><span>Answer</span> ${esc(a)}</p>` : ""}</li>`;
};
PAPERS.forEach((p, i) => {
  const g = p.group === "II" ? 2 : 1;
  page({
    url: paperUrl(p),
    title: `9th Class English Past Paper ${p.year} Group ${g} Lahore Board (Solved)`,
    description: `9th class English past paper ${p.year}, Lahore Board Group ${p.group}: Q.8 Urdu to English translation and Q.9 change the voice, each sentence with its answer.`,
    crumbs: [{ name: "Past papers", url: "/past-papers/" }, { name: paperName(p), url: paperUrl(p) }],
    kicker: strip(p.title),
    h1: `Past paper ${p.year}, Group ${p.group}`,
    lead: `Lahore Board, 9th class English. ${esc(strip(p.code))}. The answers are suggested answers written for this website, not the board's official key.`,
    app: { url: `/#/papers/${p.id}/q8`, label: "Practise this paper in the app" },
    pdf: "/assets/English_Papers_2022-2026.pdf",
    body: `<h2 class="flow-title">Q.8 Translate the following sentences into English</h2><ol class="pairs">${p.q8.map((q) => sentence(q, true)).join("")}</ol>
      ${p.alt ? `<h2 class="flow-title">Q.8 for English medium candidates</h2><p class="doc-p">${esc(strip(p.alt))}</p>` : ""}
      <h2 class="flow-title">Q.9 Change the voice</h2><ol class="pairs">${p.q9.map((q) => sentence(q, false)).join("")}</ol>`,
    prev: PAPERS[i - 1] && { url: paperUrl(PAPERS[i - 1]), name: paperName(PAPERS[i - 1]) },
    next: PAPERS[i + 1] && { url: paperUrl(PAPERS[i + 1]), name: paperName(PAPERS[i + 1]) },
  });
});
page({
  url: "/past-papers/",
  title: "9th Class English Past Papers 2022 to 2026, Lahore Board (Solved)",
  description: "All ten 9th class English past papers of the Lahore Board, 2022 to 2026, Group 1 and Group 2. Urdu to English translation and change the voice, with answers.",
  crumbs: [{ name: "Past papers", url: "/past-papers/" }],
  h1: "9th class English past papers",
  lead: "Lahore Board, 2022 to 2026, Group I and Group II. Each paper has Q.8 (Urdu to English translation) and Q.9 (change the voice) with an answer under every sentence.",
  app: { url: "/#/papers", label: "Open the papers in the app" },
  pdf: "/assets/English_Papers_2022-2026.pdf",
  body: `${cards(PAPERS.map((p) => ({ url: paperUrl(p), no: p.year, name: `English past paper ${p.year}, Group ${p.group}`, meta: `${p.q8.length} translation sentences · ${p.q9.length} change the voice` })))}
    <p class="doc-p">Some sentences come back year after year. See the <a href="/repeated-questions/">repeated questions</a>.</p>`,
});

/* ---------- Repeated questions ---------- */
fresh("repeated-questions");
{
  const row = (r, urdu) => `<li class="pair">${(r.items || []).map((t) => (urdu ? `<p class="pair-ur" lang="ur" dir="rtl">${esc(strip(t))}</p>` : `<p class="pair-en">${esc(strip(t))}</p>`)).join('<p class="doc-swap" aria-hidden="true">⇄</p>')}${(r.items || []).map((t) => (ANSWERS[t] ? `<p class="doc-answer"><span>Answer</span> ${esc(ANSWERS[t])}</p>` : "")).join("")}<p class="doc-where">${esc(r.times)} times: ${esc(strip(r.in))}</p></li>`;
  page({
    url: "/repeated-questions/",
    title: "9th Class English Repeated Questions 2022 to 2026, Lahore Board",
    description: "The translation sentences, change the voice sentences and essay topics that appeared in two or more 9th class English papers of the Lahore Board, 2022 to 2026.",
    crumbs: [{ name: "Repeated questions", url: "/repeated-questions/" }],
    kicker: strip(REPEATED.title),
    h1: "Repeated questions",
    lead: REPEATED.intro,
    app: { url: "/#/repeated", label: "Open in the app" },
    body: `<h2 class="flow-title">${esc(strip(REPEATED.q8Title))}</h2><ol class="pairs">${(REPEATED.q8 || []).map((r) => row(r, true)).join("")}</ol>
      <h2 class="flow-title">${esc(strip(REPEATED.q9Title))}</h2><ol class="pairs">${(REPEATED.q9 || []).map((r) => row(r, false)).join("")}</ol>
      <h2 class="flow-title">${esc(strip(REPEATED.topicTitle))}</h2><ol class="pairs">${(REPEATED.topics || []).map((r) => row(r, false)).join("")}</ol>
      ${REPEATED.note ? `<p class="doc-p doc-note">${esc(strip(REPEATED.note))}</p>` : ""}`,
  });
}

/* ---------- English A: one page per chapter ---------- */
fresh("english-a");
const chapters = ENGLISH_A.chapters.map((c) => {
  const n = (c.title.match(/\d+/) || c.id.match(/\d+/) || [""])[0];
  return { c, n, url: `/english-a/chapter-${n}/`, name: `Chapter ${n}${c.heading ? `: ${c.heading.replace(/\s*-\s*Question Answers$/i, "")}` : ""}` };
});
chapters.forEach((ch, i) => {
  const paras = ch.c.sections.flatMap((s) => s.paras || []);
  const text = (p) => p.runs.map((r) => r.t).join("");
  const qs = paras.filter((p) => p.q);
  const body = paras.map((p) => {
    const inner = p.runs.map((r) => (r.b && !p.q ? `<strong>${esc(r.t)}</strong>` : esc(r.t))).join("");
    return p.q ? `<h2 class="doc-q">${inner}</h2>` : `<p class="doc-p${p.indent ? " doc-indent" : ""}">${inner}</p>`;
  }).join("\n");
  // Question/answer pairs for search engines, wording unchanged
  const faq = [];
  paras.forEach((p, k) => { if (p.q && paras[k + 1] && !paras[k + 1].q) faq.push({ "@type": "Question", name: text(p), acceptedAnswer: { "@type": "Answer", text: text(paras[k + 1]) } }); });
  page({
    url: ch.url,
    title: `9th Class English ${ch.name} Question Answers (Lahore Board)`,
    description: clip(`9th class English ${ch.name.toLowerCase()} question answers for the Lahore Board, new book. ${qs.length} questions with answers. ${qs[0] ? text(qs[0]) : ""}`),
    crumbs: [{ name: "English A", url: "/english-a/" }, { name: `Chapter ${ch.n}`, url: ch.url }],
    kicker: "English A · Textbook",
    h1: `${ch.name} question answers`,
    lead: `${qs.length} questions with answers from the 9th class English textbook, typed word for word from the class notes.`,
    app: { url: "/#/a", label: "Open English A in the app" },
    pdf: ch.c.pdf ? `/${ch.c.pdf}` : "",
    body,
    ld: faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq }] : [],
    prev: chapters[i - 1] && { url: chapters[i - 1].url, name: chapters[i - 1].name },
    next: chapters[i + 1] && { url: chapters[i + 1].url, name: chapters[i + 1].name },
  });
});
page({
  url: "/english-a/",
  title: "9th Class English Notes: All Chapters Question Answers (Lahore Board)",
  description: "9th class English textbook question answers, chapter 1 to chapter 11, for the Lahore Board and other Punjab boards. Read online or download each chapter as a PDF.",
  crumbs: [{ name: "English A", url: "/english-a/" }],
  kicker: "English A · Textbook",
  h1: "9th class English: chapter question answers",
  lead: "Every chapter of the textbook with its questions and answers. Open a chapter to read it online, or download its PDF.",
  app: { url: "/#/a", label: "Open English A in the app" },
  body: cards(chapters.map((ch) => ({ url: ch.url, no: ch.n, name: `${ch.name} question answers`, meta: `${ch.c.sections.flatMap((s) => s.paras || []).filter((p) => p.q).length} questions` }))),
});

/* ---------- English B: one page per tense (sections with the same name are kept together, in order) ---------- */
fresh("english-b");
const FIX = (t) => t.replace(/continues/gi, "Continuous"); // the notes spell it "continues"; page titles use the usual spelling
const tensePages = [];
for (const c of ENGLISH_B.chapters) {
  const groupName = titleCase(c.title); // "Present Tenses"
  const byName = new Map();
  for (const s of c.sections) {
    const key = s.title.toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, { title: s.title, sections: [] });
    byName.get(key).sections.push(s);
  }
  for (const g of byName.values()) {
    let name = titleCase(FIX(g.title));
    if (name === "Exercise") name = `${groupName.replace(/s$/, "")} Exercise: is, am, are`;
    tensePages.push({ c, groupName, name, sections: g.sections, url: `/english-b/${slug(FIX(g.title) === "Exercise" ? "is-am-are-exercise" : FIX(g.title))}/` });
  }
}
tensePages.forEach((t, i) => {
  const count = t.sections.reduce((n, s) => n + s.items.length, 0);
  const first = t.sections[0].items[0];
  const isTense = /tense/i.test(t.name);
  page({
    url: t.url,
    title: `${t.name}: Urdu to English Sentences`,
    description: clip(`${t.name} ${isTense ? "exercise" : "sentences"} for 9th class: ${count} Urdu sentences with their English translation, from the Lahore Board grammar notes. Example: ${first.en}`),
    crumbs: [{ name: "English B", url: "/english-b/" }, { name: t.name, url: t.url }],
    kicker: `English B · ${t.groupName}`,
    h1: `${t.name}: Urdu to English sentences`,
    lead: `${count} sentences in Urdu with their English translation, in the order and wording of the class notes.`,
    app: { url: "/#/b", label: "Open English B in the app" },
    pdf: t.c.pdf ? `/${t.c.pdf}` : "",
    body: t.sections.map((s) => `<h2 class="flow-title">${esc(s.title)}</h2>${s.sub ? [].concat(s.sub).map((x) => `<p class="flow-sub">${esc(strip(x))}</p>`).join("") : ""}
      <ol class="pairs">${s.items.map((it) => `<li class="pair">${it.n ? `<span class="pair-n">${esc(it.n)}</span>` : ""}<p class="pair-ur" lang="ur" dir="rtl">${esc(it.ur)}</p><p class="pair-en">${esc(it.en)}</p></li>`).join("")}</ol>`).join("\n"),
    prev: tensePages[i - 1] && { url: tensePages[i - 1].url, name: tensePages[i - 1].name },
    next: tensePages[i + 1] && { url: tensePages[i + 1].url, name: tensePages[i + 1].name },
  });
});
page({
  url: "/english-b/",
  title: "9th Class English Grammar: Tenses in Urdu with Translation Exercises",
  description: "English tenses for 9th class with Urdu to English translation sentences: present, past and future tenses, affirmative, negative and interrogative exercises.",
  crumbs: [{ name: "English B", url: "/english-b/" }],
  kicker: "English B · Grammar",
  h1: "9th class English grammar: tenses",
  lead: "Present, past and future tenses. Each page lists the Urdu sentences from the class notes with their English translation.",
  app: { url: "/#/b", label: "Open English B in the app" },
  body: ENGLISH_B.chapters.map((c) => {
    const mine = tensePages.filter((t) => t.c === c);
    return `<h2 class="flow-title">${esc(titleCase(c.title))}</h2>${cards(mine.map((t, k) => ({ url: t.url, no: k + 1, name: t.name, meta: `${t.sections.reduce((n, s) => n + s.items.length, 0)} sentences` })))}`;
  }).join("\n"),
});

/* ---------- sitemap.xml and robots.txt ---------- */
const urls = [{ url: "/", priority: "1.0" }, ...written.sort((a, b) => a.url.localeCompare(b.url, "en", { numeric: true }))];
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.url}</loc><lastmod>${TODAY}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE}/sitemap.xml
`);
console.log(`${written.length} pages written in: ${[...made].join(", ")}. Plus sitemap.xml (${urls.length} addresses) and robots.txt.`);
