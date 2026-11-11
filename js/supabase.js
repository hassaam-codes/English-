// Notes storage: files live in one public Supabase Storage bucket. No tables, no accounts.
// The note's title is kept inside the file's name, so nothing else needs to be stored.
import { SUPABASE_URL, SUPABASE_KEY, NOTES_BUCKET } from "./config.js";

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
