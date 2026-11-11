// Ask AI: the small server piece behind the chat page. It runs on Vercel, never in the browser.
//
// The API key is NOT in this file and must never be put in the repo. Add it in Vercel:
//   Project → Settings → Environment Variables → Name: ANTHROPIC_API_KEY, Value: your key → Save → Redeploy.
// Optional: AI_MODEL to use a different Claude model (for example claude-haiku-5-5, which costs much less).
//
// The browser sends the conversation; this file adds the site's notes and streams the answer back
// as one JSON object per line: {"t":"text"}, {"reset":true}, {"error":"..."} and finally {"done":true}.
import Anthropic from "@anthropic-ai/sdk";
import { KNOWLEDGE } from "./_knowledge.js";
import { SUPABASE_URL, NOTES_BUCKET } from "../js/config.js";

const MODEL = process.env.AI_MODEL || "claude-opus-5-5";

const MAX_TURNS = 16;            // messages kept from the conversation
const MAX_CHARS = 2000;          // per message
const MAX_NOTE_BYTES = 15 * 1024 * 1024;
const LIMIT = { count: 20, windowMs: 10 * 60 * 1000 }; // per visitor, per server instance (a speed bump, not a wall)

const INSTRUCTIONS = `You are the study helper on a website for 9th class English students of the Lahore Board (Punjab, Pakistan). The students are about 14 to 16 years old, English is their second language, and most of them think in Urdu. They come here to prepare for the board exam.

Below, inside <notes>, is everything the website teaches: the English A textbook question answers, the English B grammar notes (tenses, each Urdu sentence with its English), the past papers of 2022 to 2026 with suggested answers, and the questions that were repeated across papers.

How to help:
- When a question is covered by the notes, answer from the notes and keep their wording for the part the student would write in the exam, because that is what their teacher expects. Then explain it in your own simple words so the student understands it instead of only memorising it.
- When the notes do not cover something (another grammar topic, a word meaning, an essay, a letter, a summary), help from your own knowledge at 9th class level, and say in a few words that this part is not from the website's notes.
- Explain like a patient teacher: the rule in one or two plain sentences, then the steps, then two or three short examples. For translation and change of voice, show how the answer is built (tense, helping verb, form of the verb, word order), not only the final sentence.
- Write in simple English with short sentences. If the student writes in Urdu or Roman Urdu, explain in that same language and keep the exam answer itself in English.
- If the student asks you to test them, ask one question at a time from the notes, wait for their answer, then correct it kindly.
- The notes are scans typed up as they were, so they contain a few typing mistakes. If the student asks about a line that is clearly wrong, give the correct form and mention that the notes have a slip there.
- Keep answers short enough to read on a phone: usually a few short paragraphs or a short list. Use **bold** for the exam answer or the key term, and simple lists. No tables and no headings.
- This helper is for English study. If asked about something unrelated, say so in one line and offer help with English instead.
- If a file is attached to the conversation, it is a note the teacher uploaded to the website. Read it and answer from it the same way.`;

const SYSTEM = [{ type: "text", text: `${INSTRUCTIONS}\n\n<notes>\n${KNOWLEDGE}\n</notes>`, cache_control: { type: "ephemeral" } }];

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
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, m.role === "user" ? MAX_CHARS : MAX_CHARS * 4) }))
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

// A note uploaded in the admin page (public Supabase file), turned into something the model can read.
async function noteBlock(name) {
  if (typeof name !== "string" || !/^[A-Za-z0-9_.-]{1,200}$/.test(name) || !SUPABASE_URL) return null;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${NOTES_BUCKET}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error("note-missing");
  const type = (res.headers.get("content-type") || "").split(";")[0];
  if (Number(res.headers.get("content-length") || 0) > MAX_NOTE_BYTES) throw new Error("note-big");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_NOTE_BYTES) throw new Error("note-big");
  const data = buf.toString("base64");
  if (type === "application/pdf") return { type: "document", source: { type: "base64", media_type: type, data }, cache_control: { type: "ephemeral" } };
  if (["image/png", "image/jpeg", "image/webp"].includes(type)) return { type: "image", source: { type: "base64", media_type: type, data }, cache_control: { type: "ephemeral" } };
  throw new Error("note-type");
}

const NOTE_ERRORS = {
  "note-missing": "That note could not be opened. It may have been removed.",
  "note-big": "That note is too big for the AI to read (15 MB is the limit). Ask without it, or pick a smaller note.",
  "note-type": "The AI can read PDF and image notes only.",
};

export default async function handler(req, res) {
  const fail = (status, error, code) => res.status(status).json({ error, code });
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return fail(405, "Use POST."); }
  if (!sameSite(req)) return fail(403, "This chat only works from the website.");
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "The AI helper is not switched on yet.", "no_key");

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return fail(429, "You are asking very fast. Wait a few minutes and try again.");

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body;
  const messages = clean(body);
  if (!messages) return fail(400, "Type a question first.");

  if (body.note) {
    try {
      const block = await noteBlock(body.note);
      if (block) messages[0] = { role: "user", content: [block, { type: "text", text: messages[0].content }] };
    } catch (e) {
      return fail(400, NOTE_ERRORS[e.message] || NOTE_ERRORS["note-missing"]);
    }
  }

  const client = new Anthropic();
  const send = (obj) => res.write(`${JSON.stringify(obj)}\n`);
  let started = false;
  try {
    // "fallbacks": if the model's safety filter wrongly declines a question, the API retries it on another model by itself.
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM,
      messages,
      output_config: { effort: "low" }, // quick, chat-sized answers
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    res.on("close", () => { if (!res.writableEnded) stream.abort(); }); // the student closed the page or pressed Stop

    res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    started = true;
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "fallback") send({ reset: true }); // another model took over: drop the half answer
      else if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: event.delta.text });
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") { send({ reset: true }); send({ t: "I can't help with that one. Ask me anything about your English course instead." }); }
    else if (final.stop_reason === "max_tokens") send({ t: "\n\n(The answer was cut short. Ask me to continue.)" });
    send({ done: true });
    res.end();
  } catch (err) {
    const message =
      err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError ? "The AI key is not working. The site owner needs to check it in Vercel."
      : err instanceof Anthropic.RateLimitError ? "The AI helper is busy right now. Try again in a minute."
      : err instanceof Anthropic.BadRequestError ? "The AI could not read that. Try a shorter question, or ask without the attached note."
      : err instanceof Anthropic.APIError ? "The AI helper had a problem. Try again."
      : "The AI helper could not be reached. Try again.";
    if (!(err instanceof Anthropic.APIUserAbortError)) console.error("chat error:", err && err.status, err && err.message);
    if (started) { send({ error: message }); res.end(); } else fail(502, message);
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
