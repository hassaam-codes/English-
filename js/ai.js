// Ask AI: the chat page. The browser only talks to /api/chat on this site; the API key lives on the server (see api/chat.js).

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const log = $("#ai-log"), form = $("#ai-form"), input = $("#ai-input"), sendBtn = $("#ai-send"), newBtn = $("#ai-new");
const KEY = "lb9-ai-chat";

const STARTERS = [
  "Explain the present perfect tense with examples",
  "How do I change active voice into passive voice?",
  "Give me the important questions of Chapter 1",
  "Test me on Urdu to English translation",
];

let chat = [];        // [{ role: "user" | "assistant", content, error? }]
let fresh = 0;       // how many bubbles have already been shown (these do not animate again)
let busy = null;      // AbortController while an answer is arriving
try { const saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (saved && Array.isArray(saved.chat)) { chat = saved.chat; } } catch (e) {}
const remember = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ chat: chat.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) })); } catch (e) {} };

/* ---------- Small, safe formatter: paragraphs, lists, **bold**, `code`. Everything is escaped first. ---------- */
const URDU = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
function inline(text) {
  return esc(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, "$1<em>$2</em>");
}
function format(text) {
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(text).split("\n")) {
    const line = raw.replace(/^#{1,6}\s+/, "").trimEnd();
    const cls = URDU.test(line) ? ' class="has-ur"' : "";
    const li = line.match(/^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/);
    if (li) {
      const want = li[1] ? "ul" : "ol";
      if (list !== want) { close(); out.push(want === "ol" ? `<ol start="${li[2]}">` : "<ul>"); list = want; }
      out.push(`<li dir="auto"${cls}>${inline(li[3])}</li>`);
    } else if (!line.trim()) { close(); }
    else { close(); out.push(`<p dir="auto"${cls}>${inline(line)}</p>`); }
  }
  close();
  return out.join("");
}

/* ---------- Drawing ---------- */
function bubble(m, i) {
  if (m.role === "user") return `<div class="ai-msg ai-user"><p dir="auto"${URDU.test(m.content) ? ' class="has-ur"' : ""}>${esc(m.content).replace(/\n/g, "<br>")}</p></div>`;
  if (m.error) return `<div class="ai-msg ai-bot ai-error" data-i="${i}"><p>${esc(m.content)}</p><button class="btn btn-ghost btn-sm" type="button" data-retry><i class="ph ph-arrow-clockwise" aria-hidden="true"></i>Try again</button></div>`;
  let text = m.content;
  if (m.typing) { // while typing, only the letters revealed so far (and close a half-typed **bold** so no stars show)
    text = [...m.content].slice(0, m.shown).join("").replace(/\*+$/, "");
    const lastLine = text.slice(text.lastIndexOf("\n") + 1);
    if ((lastLine.match(/\*\*/g) || []).length % 2) text += "**";
  }
  return `<div class="ai-msg ai-bot" data-i="${i}">${text ? format(text) : '<p class="ai-wait"><span></span><span></span><span></span><span class="sr-only">Thinking</span></p>'}</div>`;
}
function draw() {
  newBtn.hidden = !chat.length;
  if (!chat.length) {
    log.innerHTML = `<div class="ai-empty">
      <p class="ai-hello">Ask anything from your English course. I answer from this site's notes and explain it step by step.</p>
      <div class="ai-starters">${STARTERS.map((s) => `<button type="button" class="ai-starter" data-ask="${esc(s)}">${esc(s)}<i class="ph ph-arrow-up-right" aria-hidden="true"></i></button>`).join("")}</div>
    </div>`;
    return;
  }
  log.innerHTML = chat.map(bubble).join("");
  [...log.children].forEach((el, i) => { if (i < fresh) el.classList.add("is-old"); }); // only new bubbles slide in
  fresh = chat.length;
  log.scrollTop = log.scrollHeight;
}
// Updates the newest bubble in place. The element is kept (only its contents change), so nothing flashes while text streams in.
function redrawLast() {
  const last = log.lastElementChild, m = chat[chat.length - 1];
  if (!last || !m || !last.classList.contains("ai-msg")) return draw();
  const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 80; // only follow the text if the reader is at the bottom
  const tmp = document.createElement("div");
  tmp.innerHTML = bubble(m, chat.length - 1);
  const next = tmp.firstElementChild;
  last.className = `${next.className} is-old`;
  last.innerHTML = next.innerHTML;
  if (stick) log.scrollTop = log.scrollHeight;
}
function setBusy(ctrl) {
  busy = ctrl;
  sendBtn.setAttribute("aria-label", ctrl ? "Stop" : "Send");
  sendBtn.querySelector("i").className = ctrl ? "ph-fill ph-stop" : "ph-fill ph-paper-plane-right";
  sendBtn.classList.toggle("is-stop", !!ctrl);
}

/* ---------- Talking to the server ---------- */
async function ask(text) {
  if (busy) return;
  if (text) chat.push({ role: "user", content: text });
  chat = chat.filter((m) => !m.error);
  const history = chat.map(({ role, content }) => ({ role, content }));
  const reply = { role: "assistant", content: "" };
  chat.push(reply);
  draw();
  const ctrl = new AbortController();
  setBusy(ctrl);
  // Typewriter: the answer arrives in chunks of words, but is shown a letter at a time. When a lot of text is
  // waiting it types faster, so the screen never falls far behind the answer.
  reply.typing = true; reply.shown = 0;
  let frame = 0, lastTick = 0, carry = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const step = (now) => {
    frame = 0;
    const total = [...reply.content].length, waiting = total - reply.shown;
    if (waiting > 0) {
      const dt = Math.min(now - (lastTick || now), 100); lastTick = now;
      carry += (still ? 1e6 : Math.max(60, waiting * 2.5)) * dt / 1000 || 1; // letters per second: 60, more when behind
      const n = Math.floor(carry); carry -= n;
      if (n > 0) { reply.shown = Math.min(total, reply.shown + n); redrawLast(); }
      frame = requestAnimationFrame(step);
    } else { lastTick = 0; if (typed) typed(); }
  };
  let typed = null;
  const paint = () => { if (!frame) frame = requestAnimationFrame(step); };
  const allTyped = () => new Promise((done) => { if ([...reply.content].length <= reply.shown) return done(); typed = done; ctrl.finish = () => { reply.shown = Infinity; done(); }; paint(); });
  const failWith = (msg) => { reply.content = msg; reply.error = true; };
  try {
    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ messages: history }),
    });
    if (!res.ok || !res.body) {
      let msg = res.status === 404 ? "The AI helper is not set up on this copy of the site yet." : "The AI helper could not be reached. Try again.";
      try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
      failWith(msg);
    } else {
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = "";
      const take = (line) => {
        if (!line.trim()) return;
        let ev; try { ev = JSON.parse(line); } catch (e) { return; }
        if (ev.reset) reply.content = "";
        if (ev.t) reply.content += ev.t;
        if (ev.error) { if (reply.content) reply.content += `\n\n(${ev.error})`; else failWith(ev.error); }
        paint();
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        lines.forEach(take);
      }
      take(buf);
      if (!reply.content) failWith("No answer came back. Try again.");
    }
  } catch (e) {
    if (e.name === "AbortError") { if (!reply.content) chat.pop(); else reply.content += "\n\n(Stopped.)"; }
    else if (reply.content) reply.content += "\n\n(The connection dropped before the answer finished.)";
    else failWith("You seem to be offline. Check your internet and try again.");
  }
  if (reply.error || ctrl.signal.aborted) reply.shown = Infinity; else await allTyped(); // let the last letters finish typing
  if (frame) { cancelAnimationFrame(frame); frame = 0; }
  delete reply.typing; delete reply.shown;
  setBusy(null);
  if (chat[chat.length - 1] === reply) redrawLast(); else { fresh = Math.min(fresh, chat.length); draw(); }
  newBtn.hidden = !chat.length;
  remember();
}

/* ---------- Events ---------- */
const grow = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 132)}px`; };
input.addEventListener("input", grow);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer: fine)").matches) { e.preventDefault(); form.requestSubmit(); }
});
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (busy) { busy.abort(); if (busy.finish) busy.finish(); return; }
  const text = input.value.trim();
  if (!text) { input.focus(); return; }
  input.value = ""; grow();
  ask(text);
});
log.addEventListener("click", (e) => {
  const s = e.target.closest("[data-ask]");
  if (s) return ask(s.dataset.ask);
  if (e.target.closest("[data-retry]")) ask("");
});
newBtn.addEventListener("click", () => { if (busy) busy.abort(); chat = []; fresh = 0; draw(); remember(); input.focus(); });

document.addEventListener("view-change", (e) => {
  if (e.detail !== "ai") return;
  draw();
  if (matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
});
draw();
