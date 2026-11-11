// Supabase connection for the site's content.
// Both values are safe to be public: the key is the "publishable" (anon) key, and the database
// only allows reading through it. NEVER put the database password or a service_role key here.
export const SUPABASE_URL = "https://eesjmuluinoetqyshnyo.supabase.co";
export const SUPABASE_KEY = ""; // paste the publishable / anon key here (Supabase > Project Settings > API Keys)

// Admin sign-in: the login form takes a username; it is turned into this email address for Supabase.
// Create that user in Supabase > Authentication > Users (see supabase/README.md). The password is
// checked by Supabase and is never stored in this site's code.
export const ADMIN_EMAIL_DOMAIN = "english-papers.app"; // "admin" signs in as admin@english-papers.app
export const NOTES_BUCKET = "notes";
