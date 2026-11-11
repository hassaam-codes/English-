// Small Supabase client: sign-in, table rows and file storage over plain fetch (no library needed).
import { SUPABASE_URL, SUPABASE_KEY, NOTES_BUCKET } from "./config.js";

export const configured = () => !!(SUPABASE_URL && SUPABASE_KEY);
const SESSION_KEY = "lb9-admin-session";

/* ---------- Session ---------- */
let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) {}
const save = (s) => {
  session = s;
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (e) {}
};
const keep = (d) => save({
  access_token: d.access_token, refresh_token: d.refresh_token,
  expires_at: Date.now() + (d.expires_in || 3600) * 1000, email: d.user && d.user.email,
});

async function authCall(grant, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error_description || data.msg || data.message || `Sign-in failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function signIn(email, password) { keep(await authCall("password", { email, password })); return session; }
export function signOut() {
  const token = session && session.access_token;
  save(null);
  if (token) fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
}
export const currentUser = () => (session ? session.email || "admin" : null);

// A valid access token, refreshed when it is about to run out. Null when signed out.
async function token() {
  if (!session) return null;
  if (session.expires_at - Date.now() > 60000) return session.access_token;
  try { keep(await authCall("refresh_token", { refresh_token: session.refresh_token })); return session.access_token; }
  catch (e) { save(null); return null; }
}

/* ---------- Requests ---------- */
async function call(path, { method = "GET", body, headers = {}, auth = false } = {}) {
  const h = { apikey: SUPABASE_KEY, ...headers };
  if (auth) {
    const t = await token();
    if (!t) { const e = new Error("Please sign in again"); e.status = 401; throw e; }
    h.Authorization = `Bearer ${t}`;
  } else h.Authorization = `Bearer ${SUPABASE_KEY}`;
  const res = await fetch(`${SUPABASE_URL}${path}`, { method, headers: h, body });
  if (res.status === 401 && auth) save(null);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

/* ---------- Notes ---------- */
export const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${NOTES_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`;

export const listNotes = () =>
  call("/rest/v1/notes?select=id,title,description,file_path,file_name,file_type,file_size,created_at&order=created_at.desc");

export async function uploadNote({ title, description, file }) {
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";
  const path = `${Date.now()}-${safe}`;
  await call(`/storage/v1/object/${NOTES_BUCKET}/${path}`, {
    method: "POST", auth: true, body: file,
    headers: { "Content-Type": file.type || "application/octet-stream", "cache-control": "max-age=3600", "x-upsert": "false" },
  });
  try {
    const rows = await call("/rest/v1/notes", {
      method: "POST", auth: true,
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ title, description, file_path: path, file_name: file.name, file_type: file.type, file_size: file.size }),
    });
    return rows && rows[0];
  } catch (e) {
    // Don't leave a file behind that no note points to.
    call(`/storage/v1/object/${NOTES_BUCKET}/${path}`, { method: "DELETE", auth: true }).catch(() => {});
    throw e;
  }
}

export async function deleteNote(note) {
  await call(`/rest/v1/notes?id=eq.${encodeURIComponent(note.id)}`, { method: "DELETE", auth: true });
  await call(`/storage/v1/object/${NOTES_BUCKET}/${note.file_path}`, { method: "DELETE", auth: true }).catch(() => {});
}
