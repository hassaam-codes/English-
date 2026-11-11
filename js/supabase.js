// Notes storage: files live in one public Supabase Storage bucket. No tables, no accounts.
// The note's title is kept inside the file's name, so nothing else needs to be stored.
import { SUPABASE_URL, SUPABASE_KEY, NOTES_BUCKET, BOOK_BUCKET } from "./config.js";

export const configured = () => !!(SUPABASE_URL && SUPABASE_KEY);

async function call(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1${path}`, {
    method, body, headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, ...headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => null);
}

/* File name = <time>_<title, base64url>.<ext>   e.g. 1794421829354_VGVuc2Vz.pdf */
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));
const EXT = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function titleOf(name) {
  const m = name.match(/^\d+_([A-Za-z0-9_-]+)\.[a-z0-9]+$/);
  try { if (m) return unb64(m[1]); } catch (e) {}
  return name.replace(/\.[a-z0-9]+$/i, ""); // a file added by hand in Supabase: show its name
}

export const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${NOTES_BUCKET}/${encodeURIComponent(path)}`;

export async function listNotes() {
  const rows = await call(`/object/list/${NOTES_BUCKET}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "created_at", order: "desc" } }),
  });
  return (rows || []).filter((r) => r.id && r.name && !r.name.startsWith(".")).map((r) => ({
    id: r.name, file_path: r.name, title: titleOf(r.name),
    file_type: (r.metadata && r.metadata.mimetype) || "", file_size: (r.metadata && r.metadata.size) || 0, created_at: r.created_at,
  }));
}

export async function uploadNote({ title, file }) {
  const path = `${Date.now()}_${b64(title)}.${EXT[file.type] || "bin"}`;
  await call(`/object/${NOTES_BUCKET}/${path}`, {
    method: "POST", body: file,
    headers: { "Content-Type": file.type || "application/octet-stream", "cache-control": "max-age=3600", "x-upsert": "false" },
  });
  return path;
}

export const deleteNote = (note) => call(`/object/${NOTES_BUCKET}/${encodeURIComponent(note.file_path)}`, { method: "DELETE" });

/* ---------- Books: Book A and Book B, in the "book" bucket. ----------
   Supabase's free plan refuses any single file over 50 MB, so a bigger book is stored in pieces:
     small book:  a_<time>.pdf
     big book:    a_<time>.p1of3.pdf, a_<time>.p2of3.pdf, a_<time>.p3of3.pdf
   The pieces are joined back together in the browser when the book is opened. */
export const BOOK_PART_BYTES = 40 * 1024 * 1024;
export const bookUrl = (name) => `${SUPABASE_URL}/storage/v1/object/public/${BOOK_BUCKET}/${encodeURIComponent(name)}`;
const NAME = /^([ab])_(\d+)(?:\.p(\d+)of(\d+))?\.pdf$/;

async function listBooks() {
  const rows = await call(`/object/list/${BOOK_BUCKET}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
  return (rows || []).filter((r) => r.id && r.name && NAME.test(r.name));
}
const del = (name) => call(`/object/${BOOK_BUCKET}/${encodeURIComponent(name)}`, { method: "DELETE" });

// The newest complete upload for one letter: { urls: [...], size, created_at, parts } or null
function newest(rows, key) {
  const sets = new Map(); // time -> { total, files: Map(partNo -> row) }
  for (const r of rows) {
    const [, k, time, no, of] = r.name.match(NAME);
    if (k !== key) continue;
    if (!sets.has(time)) sets.set(time, { total: +(of || 1), files: new Map() });
    sets.get(time).files.set(+(no || 1), r);
  }
  const done = [...sets].filter(([, s]) => s.files.size === s.total).sort((x, y) => +y[0] - +x[0])[0];
  if (!done) return null;
  const files = [...done[1].files].sort((x, y) => x[0] - y[0]).map(([, r]) => r);
  return {
    urls: files.map((r) => bookUrl(r.name)), parts: files.length, time: done[0],
    size: files.reduce((t, r) => t + ((r.metadata && r.metadata.size) || 0), 0), created_at: files[0].created_at,
  };
}

// { a: {...} | null, b: {...} | null }
export async function getBooks() {
  const rows = await listBooks();
  return { a: newest(rows, "a"), b: newest(rows, "b") };
}

// onProgress(fractionDone) is called after each piece
export async function uploadBook(key, file, onProgress = () => {}) {
  const time = Date.now(), total = Math.max(1, Math.ceil(file.size / BOOK_PART_BYTES));
  const headers = { "Content-Type": "application/pdf", "cache-control": "max-age=86400", "x-upsert": "false" };
  const made = [];
  try {
    for (let i = 0; i < total; i++) {
      const name = total === 1 ? `${key}_${time}.pdf` : `${key}_${time}.p${i + 1}of${total}.pdf`;
      const piece = total === 1 ? file : file.slice(i * BOOK_PART_BYTES, (i + 1) * BOOK_PART_BYTES, "application/pdf");
      await call(`/object/${BOOK_BUCKET}/${name}`, { method: "POST", body: piece, headers });
      made.push(name);
      onProgress((i + 1) / total);
    }
  } catch (e) {
    await Promise.all(made.map((n) => del(n).catch(() => {}))); // don't leave half a book behind
    throw e;
  }
  // Remove older uploads of this book
  const old = (await listBooks().catch(() => [])).filter((r) => r.name.startsWith(`${key}_`) && !made.includes(r.name));
  await Promise.all(old.map((r) => del(r.name).catch(() => {})));
}

export async function removeBook(key) {
  const mine = (await listBooks()).filter((r) => r.name.startsWith(`${key}_`));
  await Promise.all(mine.map((r) => del(r.name)));
}
