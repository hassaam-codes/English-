// Ask AI: the small server piece behind the chat page. It runs on Vercel, never in the browser.
//
// The API key is NOT in this file and must never be put in the repo. Add it in Vercel:
//   Project → Settings → Environment Variables → Name: NVIDIA_API_KEY, Value: your nvapi-... key → Save → Redeploy.
// Optional: AI_MODEL to use a different model from build.nvidia.com (default below).
//
// The browser sends the conversation; this file adds the matching parts of the site's notes and streams the
// answer back as one JSON object per line: {"t":"text"}, {"error":"..."} and finally {"done":true}.
import { INDEX, pick } from "./_knowledge.js";

const API_URL = `${process.env.AI_BASE_URL || "https://integrate.api.nvidia.com/v1"}/chat/completions`;
const MODEL = process.env.AI_MODEL || "meta/llama-3.3-70b-instruct";

const MAX_TURNS = 12;            // messages kept from the conversation
const MAX_CHARS = 2000;          // per message
const LIMIT = { count: 20, windowMs: 10 * 60 * 1000 }; // per visitor, per server instance (a speed bump, not a wall)

const INSTRUCTIONS = `You are the study helper on a website for 9th class English students of the Lahore Board (Punjab, Pakistan). The students are about 14 to 16 years old, English is their second language, and most of them think in Urdu. They come here to prepare for the board exam.

The website teaches: the English A textbook question answers, the English B grammar notes (tenses, each Urdu sentence with its English), the past papers of 2022 to 2026 with suggested answers, and the questions repeated across papers. With each question you are given, inside <notes>, the parts of those notes that match it. Inside <contents> is the list of everything the notes hold.

How to help:
- When the question is covered by the <notes>, answer from them and keep their wording for the part the student would write in the exam, because that is what their teacher expects. Then explain it in your own simple words so the student understands it instead of only memorising it.
- When the <notes> do not cover something (another grammar topic, a word meaning, an essay, a letter, a summary), help from your own knowledge at 9th class level, and say in a few words that this part is not from the website's notes. Never invent what the notes say.
- Explain like a patient teacher: the rule in one or two plain sentences, then the steps, then two or three short examples. For translation and change of voice, show how the answer is built (tense, helping verb, form of the verb, word order), not only the final sentence.
- Write in simple English with short sentences. If the student writes in Urdu or Roman Urdu, explain in that same language and keep the exam answer itself in English.
- If the student asks you to test them, ask one question at a time from the notes, wait for their answer, then correct it kindly.
- The notes were typed up from scans as they were, so they contain a few typing mistakes. If the student asks about a line that is clearly wrong, give the correct form and mention that the notes have a slip there.
- Keep answers short enough to read on a phone: usually a few short paragraphs or a short list. Use **bold** for the exam answer or the key term, and simple lists. No tables and no headings.
- This helper is for English study. If asked about something unrelated, say so in one line and offer help with English instead.`;

const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < LIMIT.windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT.count;
}

function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin requests from some browsers, and server-to-server checks
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

function clean(body) {
  const list = Array.isArray(body && body.messages) ? body.messages : [];
  const msgs = list
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? MAX_CHARS : MAX_CHARS * 3) }))
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };

export default async function handler(req, res) {
  const fail = (status, error, code) => res.status(status).json({ error, code });
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return fail(405, "Use POST."); }
  if (!sameSite(req)) return fail(403, "This chat only works from the website.");
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return fail(503, "The AI helper is not switched on yet.", "no_key");

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return fail(429, "You are asking very fast. Wait a few minutes and try again.");

  const messages = clean(typeof req.body === "string" ? safeParse(req.body) : req.body);
  if (!messages) return fail(400, "Type a question first.");

  // Find the notes for this question. The last two questions are used, so "explain it again" still finds its topic.
  const asked = messages.filter((m) => m.role === "user").slice(-2).map((m) => m.content).join("\n");
  const notes = pick(asked) || "(Nothing in the notes matches this question.)";
  const system = `${INSTRUCTIONS}\n\n<contents>\n${INDEX}\n</contents>\n\n<notes>\n${notes}\n</notes>`;

  const ctrl = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ctrl.abort(); }); // the student closed the page or pressed Stop
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);
  let started = false;
  try {
    const up = await fetch(API_URL, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, ...messages], max_tokens: 1500, temperature: 0.3, stream: true }),
    });
    if (!up.ok || !up.body) {
      const detail = (await up.text().catch(() => "")).slice(0, 300);
      console.error("chat upstream error:", up.status, detail);
      const message =
        up.status === 401 || up.status === 403 ? "The AI key is not working. The site owner needs to check it in Vercel."
        : up.status === 429 ? "The AI helper is busy right now. Try again in a minute."
        : up.status === 404 ? "The AI model was not found. The site owner needs to check AI_MODEL in Vercel."
        : "The AI helper had a problem. Try again.";
      return fail(502, message);
    }

    res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    started = true;
    const dec = new TextDecoder();
    let buf = "", cut = false;
    const take = (line) => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return;
      const ev = safeParse(data);
      const choice = ev && ev.choices && ev.choices[0];
      if (!choice) return;
      if (choice.delta && typeof choice.delta.content === "string" && choice.delta.content) send({ t: choice.delta.content });
      if (choice.finish_reason === "length") cut = true;
    };
    for await (const chunk of up.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      lines.forEach((l) => take(l.trim()));
    }
    take(buf.trim());
    if (cut) send({ t: "\n\n(The answer was cut short. Ask me to continue.)" });
    send({ done: true });
    res.end();
  } catch (err) {
    if (ctrl.signal.aborted) { if (!res.writableEnded) res.end(); return; }
    console.error("chat error:", err && err.message);
    const message = "The AI helper could not be reached. Try again.";
    if (started) { send({ error: message }); res.end(); } else fail(502, message);
  }
}
