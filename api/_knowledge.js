// Turns the site's own content (js/data.js, js/answers.js, js/book.js) into plain text for the AI tutor.
// Nothing is copied by hand: add a paper or a chapter to the site and the tutor knows it after the next deploy.
import { PAPERS, REPEATED } from "../js/data.js";
import { ANSWERS } from "../js/answers.js";
import { ENGLISH_A, ENGLISH_B } from "../js/book.js";

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
const answer = (q) => (ANSWERS[q] ? `\n   Suggested answer: ${ANSWERS[q]}` : "");

// The notes are kept as separate sections so only the ones a question needs are sent to the model.
const SECTIONS = []; // { title, text }
const add = (title, lines) => SECTIONS.push({ title, text: `## ${title}\n${lines.filter(Boolean).join("\n")}` });

function section(s) {
  const out = [];
  if (s.sub) out.push([].concat(s.sub).map(strip).join("\n"));
  if (s.kind === "pairs") for (const it of s.items) out.push(`${it.n ? `${it.n} ` : ""}${it.ur || ""}  =  ${it.en || ""}`);
  else if (s.kind === "blocks") for (const p of s.paras) out.push(p.runs.map((r) => r.t).join(""));
  else if (s.kind === "qa") for (const it of s.items) out.push(`Q: ${strip(it.q)}\nA: ${strip(it.a)}`);
  else if (s.kind === "list") for (const it of s.items) out.push(`- ${strip(it)}`);
  else if (s.kind === "table") { if (s.head) out.push(s.head.map(strip).join(" | ")); for (const r of s.rows) out.push(r.map(strip).join(" | ")); }
  else for (const p of s.paras || []) out.push(strip(p));
  return out;
}

for (const [b, what] of [[ENGLISH_A, "textbook question answers"], [ENGLISH_B, "grammar notes, Urdu sentence = English translation"]]) {
  for (const c of b.chapters) {
    const name = `${b.name}, ${[c.no, c.title].filter(Boolean).join(" ").trim()}${c.heading ? ` (${c.heading})` : ""}`;
    const titled = (c.sections || []).filter((s) => s.title);
    if (titled.length > 1) for (const s of c.sections) add(`${name}: ${strip(s.title) || "more"} [${what}]`, section(s));
    else add(`${name} [${what}]`, (c.sections || []).flatMap(section));
  }
}
for (const p of PAPERS) {
  add(`Past paper: ${strip(p.title)} (${p.year} group ${p.group === "II" ? 2 : 1}) [Q.8 translation and Q.9 change the voice, with suggested answers written for this website]`, [
    "Q.8 Translate into English:", ...p.q8.map((q, i) => `${i + 1}. ${q}${answer(q)}`),
    p.alt ? `Alternative: ${strip(p.alt)}` : "",
    "Q.9 Change the voice:", ...p.q9.map((q, i) => `${i + 1}. ${q}${answer(q)}`),
  ]);
}
{
  const line = (r) => `- ${(r.items || []).map(strip).join("  ⇄  ")}${r.in ? `  (asked in: ${strip(r.in)})` : ""}`;
  add("Repeated questions: asked in two or more of the ten past papers (important, guess paper)", [
    strip(REPEATED.q8Title), ...(REPEATED.q8 || []).map(line),
    strip(REPEATED.q9Title), ...(REPEATED.q9 || []).map(line),
    strip(REPEATED.topicTitle), ...(REPEATED.topics || []).map(line),
  ]);
}

export const INDEX = SECTIONS.map((s) => `- ${s.title}`).join("\n");

/* ---------- Picking the sections a question needs ---------- */
const STOP = new Set("a an the of in on at to for from by with and or is are was were be been do does did what which who how why when where me my i you your it this that these those please can could will would give tell explain write make about into as not no yes all any some question questions answer answers english class".split(" "));
const words = (s) => (String(s).toLowerCase().match(/[a-z]+|\d+|[؀-ۿ]+/g) || []).filter((w) => w.length > 1 || /\d/.test(w)).filter((w) => !STOP.has(w));
const BAG = SECTIONS.map((s) => ({ title: new Set(words(s.title)), body: new Set(words(s.text)) }));

// Returns the best-matching sections as one text, at most `budget` characters.
export function pick(query, budget = 36000) {
  const q = [...new Set(words(query))];
  const scored = SECTIONS.map((s, i) => {
    let score = 0;
    for (const w of q) { if (BAG[i].title.has(w)) score += /\d/.test(w) ? 6 : 4; else if (BAG[i].body.has(w)) score += 1; }
    return { s, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  const out = [];
  let used = 0;
  const floor = scored.length ? scored[0].score * 0.4 : 0; // drop weak matches so the model reads less
  for (const { s, score } of scored) {
    if (score < floor) break;
    if (used + s.text.length > budget) { if (!out.length) out.push(s.text.slice(0, budget)); continue; }
    out.push(s.text); used += s.text.length;
    if (out.length >= 8) break;
  }
  return out.join("\n\n");
}
