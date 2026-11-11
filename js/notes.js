// Public Notes page and the admin panel (sign in, upload, delete).
import { ADMIN_EMAIL_DOMAIN } from "./config.js";
import { configured, signIn, signOut, currentUser, listNotes, uploadNote, deleteNote, publicUrl } from "./supabase.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MAX_BYTES = 25 * 1024 * 1024;
const TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const size = (n) => (!n ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const day = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
const kind = (t) => (t === "application/pdf" ? "PDF" : (t || "").startsWith("image/") ? "Image" : "File");
const icon = (t) => (t === "application/pdf" ? "ph-file-pdf" : (t || "").startsWith("image/") ? "ph-image" : "ph-file");
const meta = (n) => [kind(n.file_type), size(n.file_size), day(n.created_at)].filter(Boolean).join(" · ");
const toast = (msg) => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); };

const empty = (ic, text, extra = "") => `<div class="empty"><i class="ph ${ic}" aria-hidden="true"></i><p>${text}</p>${extra}</div>`;
const skeleton = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

let notes = null; // last loaded list

/* ---------- Public page ---------- */
async function showNotes() {
  const box = $("#notes-list");
  if (!configured()) { box.innerHTML = empty("ph-notebook", "No notes yet"); return; }
  if (!notes) box.innerHTML = skeleton;
  try {
    notes = await listNotes();
    box.innerHTML = notes.length
      ? `<div class="note-list">${notes.map((n, i) => `<a class="note" style="--i:${Math.min(i, 8)}" href="${esc(publicUrl(n.file_path))}" target="_blank" rel="noopener">
          <span class="note-icon"><i class="ph ${icon(n.file_type)}" aria-hidden="true"></i></span>
          <span><span class="note-title">${esc(n.title)}</span>${n.description ? `<span class="note-desc">${esc(n.description)}</span>` : ""}<span class="note-meta">${esc(meta(n))}</span></span>
          <i class="ph ph-arrow-up-right" aria-hidden="true"></i></a>`).join("")}</div>`
      : empty("ph-notebook", "No notes yet");
  } catch (e) {
    box.innerHTML = empty("ph-wifi-slash", "Could not load the notes", '<button class="btn btn-ghost btn-sm" type="button" id="notes-retry">Try again</button>');
  }
}
$("#notes-list").addEventListener("click", (e) => { if (e.target.closest("#notes-retry")) showNotes(); });

/* ---------- Admin ---------- */
const say = (el, msg) => { el.textContent = msg || ""; el.hidden = !msg; };
const busy = (btn, on) => { btn.setAttribute("aria-busy", String(on)); btn.disabled = on; };

function showAdmin() {
  const ready = configured(), user = ready && currentUser();
  $("#admin-setup").hidden = ready;
  $("#admin-login").hidden = !ready || !!user;
  $("#admin-panel").hidden = !user;
  $("#admin-signout").hidden = !user;
  if (user) loadAdminNotes();
}

async function loadAdminNotes() {
  const box = $("#admin-notes");
  if (!notes) box.innerHTML = skeleton;
  try {
    notes = await listNotes();
    box.innerHTML = notes.length
      ? `<div class="note-list">${notes.map((n) => `<div class="note" data-id="${esc(n.id)}">
          <span class="note-icon"><i class="ph ${icon(n.file_type)}" aria-hidden="true"></i></span>
          <span><a class="note-title" href="${esc(publicUrl(n.file_path))}" target="_blank" rel="noopener">${esc(n.title)}</a>${n.description ? `<span class="note-desc">${esc(n.description)}</span>` : ""}<span class="note-meta">${esc(meta(n))}</span></span>
          <button class="del" type="button" aria-label="Delete ${esc(n.title)}"><i class="ph ph-trash" aria-hidden="true"></i></button></div>`).join("")}</div>`
      : empty("ph-upload-simple", "Nothing uploaded yet");
  } catch (e) {
    box.innerHTML = empty("ph-wifi-slash", esc(e.message || "Could not load the notes"));
    if (e.status === 401) showAdmin();
  }
}

$("#admin-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#admin-user").value.trim(), pass = $("#admin-pass").value, err = $("#login-error"), btn = $("#login-btn");
  say(err, "");
  if (!name || !pass) return say(err, "Enter your username and password");
  const email = name.includes("@") ? name : `${name.toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`;
  busy(btn, true);
  try {
    await signIn(email, pass);
    $("#admin-pass").value = "";
    showAdmin();
  } catch (ex) {
    say(err, ex.status === 400 || ex.status === 401 ? "Wrong username or password" : ex.message || "Could not sign in. Check your connection and try again");
  } finally { busy(btn, false); }
});

$("#admin-signout").addEventListener("click", () => { signOut(); notes = null; showAdmin(); toast("Signed out"); });

$("#upload-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("#note-title").value.trim(), description = $("#note-desc").value.trim(), file = $("#note-file").files[0];
  const err = $("#upload-error"), btn = $("#upload-btn");
  say(err, "");
  if (!title) return say(err, "Add a title");
  if (!file) return say(err, "Choose a file to upload");
  if (!TYPES.includes(file.type)) return say(err, "That file type is not supported. Upload a PDF, PNG, JPG or WebP");
  if (file.size > MAX_BYTES) return say(err, `That file is ${size(file.size)}. The limit is 25 MB`);
  busy(btn, true);
  btn.querySelector("span").textContent = "Uploading";
  try {
    await uploadNote({ title, description, file });
    e.target.reset();
    toast("Uploaded");
    await loadAdminNotes();
  } catch (ex) {
    if (ex.status === 401) { showAdmin(); say($("#login-error"), "Your session ended. Sign in again"); }
    else say(err, ex.status === 403 ? "This account is not allowed to upload" : ex.message || "Upload failed. Try again");
  } finally { busy(btn, false); btn.querySelector("span").textContent = "Upload"; }
});

$("#admin-notes").addEventListener("click", async (e) => {
  const b = e.target.closest(".del");
  if (!b) return;
  const row = b.closest(".note"), note = (notes || []).find((n) => String(n.id) === row.dataset.id);
  if (!note || !confirm(`Delete “${note.title}”? Students will no longer see it.`)) return;
  b.disabled = true;
  try { await deleteNote(note); toast("Deleted"); await loadAdminNotes(); }
  catch (ex) { b.disabled = false; toast(ex.message || "Could not delete"); if (ex.status === 401) showAdmin(); }
});

document.addEventListener("view-change", (e) => {
  if (e.detail === "notes") showNotes();
  if (e.detail === "admin") showAdmin();
});
