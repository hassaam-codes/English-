// Supabase connection for the site's content.
// Both values are safe to be public: the key is the "publishable" (anon) key, and the database
// only allows reading through it. NEVER put the database password or a service_role key here.
export const SUPABASE_URL = "https://eesjmuluinoetqyshnyo.supabase.co";
export const SUPABASE_KEY = ""; // paste the publishable / anon key here (Supabase > Project Settings > API Keys)

// Admin sign-in for the upload page (/#/admin). This is a simple lock, checked in the browser:
// anyone who reads this file can see it. Change both values here whenever you like.
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin1221";
export const NOTES_BUCKET = "notes"; // Supabase Storage bucket that holds the uploaded files
