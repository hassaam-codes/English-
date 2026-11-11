// Turns the site's own content (js/data.js, js/answers.js, js/book.js) into plain text for the AI tutor.
// Nothing is copied by hand: add a paper or a chapter to the site and the tutor knows it after the next deploy.
import { PAPERS, REPEATED } from "../js/data.js";
import { ANSWERS } from "../js/answers.js";
import { ENGLISH_A, ENGLISH_B } from "../js/book.js";

const strip = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();
const answer = (q) => (ANSWERS[q] ? `\n   Suggested answer: ${ANSWERS[q]}` : "");

function papers() {
  const out = ["# PAST PAPERS (Lahore Board, 9th Class English, 2022 to 2026)",
    "Q.8 is Urdu to English translation (or, for English medium, ten sentences on a topic). Q.9 is change the voice.",
    "The suggested answers were written for this website. They are not the board's official answers."];
  for (const p of PAPERS) {
    out.push(`\n## ${strip(p.title)}`);
    out.push("Q.8 Translate into English:");
    p.q8.forEach((q, i) => out.push(`${i + 1}. ${q}${answer(q)}`));
    if (p.alt) out.push(`Alternative: ${strip(p.alt)}`);
    out.push("Q.9 Change the voice:");
    p.q9.forEach((q, i) => out.push(`${i + 1}. ${q}${answer(q)}`));
  }
  return out.join("\n");
}

function repeated() {
  const line = (r) => {
    const items = (r.items || [r.text]).filter(Boolean).map(strip).join("  ⇄  ");
    const where = Array.isArray(r.papers) ? r.papers.join(", ") : strip(r.where || r.in || "");
    return `- ${items}${where ? `  (asked in: ${where})` : ""}`;
  };
  const block = (title, rows) => (rows && rows.length ? [`\n## ${strip(title)}`, ...rows.map(line)] : []);
  return ["# REPEATED QUESTIONS (asked in two or more of the ten papers)",
    ...block(REPEATED.q8Title, REPEATED.q8), ...block(REPEATED.q9Title, REPEATED.q9), ...block(REPEATED.topicTitle, REPEATED.topics),
  ].join("\n");
}

function section(s) {
  const out = [];
  if (s.title) out.push(`\n### ${strip(s.title)}`);
  if (s.sub) out.push([].concat(s.sub).map(strip).join("\n"));
  if (s.kind === "pairs") for (const it of s.items) out.push(`${it.n ? `${it.n} ` : ""}${it.ur || ""}  =  ${it.en || ""}`);
  else if (s.kind === "blocks") for (const p of s.paras) out.push(p.runs.map((r) => r.t).join(""));
  else if (s.kind === "qa") for (const it of s.items) out.push(`Q: ${strip(it.q)}\nA: ${strip(it.a)}`);
  else if (s.kind === "list") for (const it of s.items) out.push(`- ${strip(it)}`);
  else if (s.kind === "table") { if (s.head) out.push(s.head.map(strip).join(" | ")); for (const r of s.rows) out.push(r.map(strip).join(" | ")); }
  else for (const p of s.paras || []) out.push(strip(p));
  return out.join("\n");
}

function book(b, intro) {
  const out = [`# ${b.name.toUpperCase()} (${b.label})`, intro];
  for (const c of b.chapters) {
    out.push(`\n## ${[c.no, c.title].filter(Boolean).join(" ").trim()}${c.heading ? `: ${c.heading}` : ""}`);
    for (const s of c.sections || []) out.push(section(s));
  }
  return out.join("\n");
}

export const KNOWLEDGE = [
  book(ENGLISH_A, "Textbook question answers, chapter by chapter, exactly as in the class notes."),
  book(ENGLISH_B, "Grammar notes: tenses, each Urdu sentence with its English translation."),
  papers(),
  repeated(),
].join("\n\n\n");
