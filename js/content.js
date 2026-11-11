// Loads the site's content.
//   1. A copy saved from the last visit is used straight away (fast, works offline) and refreshed in the background.
//   2. Otherwise the content is fetched from Supabase.
//   3. If Supabase is not set up, slow or unreachable, the copy built into the site (data.js) is used.
// So the site always has content to show.
import * as bundled from "./data.js";
import { ANSWERS as bundledAnswers } from "./answers.js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const CACHE_KEY = "lb9-content-v1";
const TIMEOUT_MS = 4000;

const fallback = () => ({
  source: "built-in",
  COVER: bundled.COVER, PAPERS: bundled.PAPERS, REPEATED: bundled.REPEATED,
  Q8_HEADING: bundled.Q8_HEADING, Q9_HEADING: bundled.Q9_HEADING, ALT_HEADING: bundled.ALT_HEADING,
  ANSWERS: bundledAnswers,
});

// Database text is shown as text. Only <strong> is allowed through, for the two notes that use it.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const safeHtml = (s) => esc(s).replace(/&lt;(\/?)strong&gt;/g, "<$1strong>");

async function get(pathAndQuery, signal) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, signal,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

async function fetchFromSupabase() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const [papers, repeated, texts] = await Promise.all([
      get("papers?select=*,questions(kind,position,question,answer)&order=sort", ctl.signal),
      get("repeated?select=kind,position,items,times,appeared_in&order=position", ctl.signal),
      get("site_text?select=key,value", ctl.signal),
    ]);
    return shape(papers, repeated, texts);
  } finally { clearTimeout(timer); }
}

// Turn database rows into the shapes the app uses. Throws if anything essential is missing.
function shape(papers, repeated, texts) {
  const base = fallback();
  const t = Object.fromEntries(texts.map((r) => [r.key, r.value]));
  const txt = (key, def) => (typeof t[key] === "string" && t[key].trim() ? t[key] : def);
  const ANSWERS = {};
  const PAPERS = papers.map((p) => {
    const of = (kind) => p.questions.filter((x) => x.kind === kind).sort((a, b) => a.position - b.position);
    for (const x of p.questions) if (x.answer) ANSWERS[x.question] = x.answer;
    return {
      id: p.id, year: p.year, group: p.grp, page: p.page, alp: !!p.alp,
      title: p.title, code: p.code, source: p.source, alt: p.alt_question,
      q8: of("q8").map((x) => x.question), q9: of("q9").map((x) => x.question),
    };
  });
  if (!PAPERS.length || PAPERS.some((p) => !p.id || !p.q8.length || !p.q9.length)) throw new Error("Incomplete content");
  const rep = (kind) => repeated.filter((r) => r.kind === kind).sort((a, b) => a.position - b.position)
    .map((r) => ({ items: r.items, times: r.times, in: r.appeared_in }));
  return {
    source: "supabase",
    PAPERS, ANSWERS,
    COVER: {
      title: txt("cover_title", base.COVER.title), subtitle: txt("cover_subtitle", base.COVER.subtitle),
      q8: txt("cover_q8", base.COVER.q8), q9: txt("cover_q9", base.COVER.q9),
      boxHeading: txt("cover_box_heading", base.COVER.boxHeading),
      boxNote: safeHtml(txt("cover_box_note", base.COVER.boxNote)), footer: txt("cover_footer", base.COVER.footer),
    },
    Q8_HEADING: txt("q8_heading", base.Q8_HEADING), Q9_HEADING: txt("q9_heading", base.Q9_HEADING),
    ALT_HEADING: txt("alt_heading", base.ALT_HEADING),
    REPEATED: {
      title: txt("rep_title", base.REPEATED.title), intro: safeHtml(txt("rep_intro", base.REPEATED.intro)),
      q8Title: txt("rep_q8_title", base.REPEATED.q8Title), q9Title: txt("rep_q9_title", base.REPEATED.q9Title),
      topicTitle: txt("rep_topic_title", base.REPEATED.topicTitle), note: txt("rep_note", base.REPEATED.note),
      q8: rep("q8"), q9: rep("q9"), topics: rep("topics"),
    },
  };
}

const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "null"); } catch (e) { return null; } };
const writeCache = (c) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (e) {} };

export async function loadContent() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback();
  const cached = readCache();
  if (cached && cached.PAPERS && cached.PAPERS.length) {
    // Show the saved copy now; fetch the latest for the next visit.
    fetchFromSupabase().then(writeCache).catch(() => {});
    return { ...cached, source: "saved copy" };
  }
  try {
    const fresh = await fetchFromSupabase();
    writeCache(fresh);
    return fresh;
  } catch (e) {
    console.warn("Content: using the built-in copy.", e.message);
    return fallback();
  }
}
