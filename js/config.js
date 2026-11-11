// Supabase connection for the site's content.
// Both values are safe to be public: the key is the "publishable" (anon) key, and the database
// only allows reading through it. NEVER put the database password or a service_role key here.
export const SUPABASE_URL = "https://eesjmuluinoetqyshnyo.supabase.co";
export const SUPABASE_KEY = "sb_publishable_s3WKE62OZrWdev3oSFPOXw_dDABUKPC"; // publishable key (public by design)

// Papers, questions and answers come from the copy built into the site (js/data.js, js/answers.js).
// Set this to true only after running supabase/setup.sql, to load them from the database instead.
export const PAPERS_FROM_DATABASE = false;

// Admin sign-in for the upload page (/#/admin). This is a simple lock, checked in the browser:
// anyone who reads this file can see it. Change both values here whenever you like.
export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin1221";
export const NOTES_BUCKET = "notes"; // Supabase Storage bucket that holds the uploaded files

// The textbook PDF opened by the round button in the bottom bar.
// Normally it is uploaded from the admin page (stored in the "book" bucket, see supabase/book.sql).
// This is a fallback used only when nothing has been uploaded: a file path or a link.
export const BOOK_PDF = "";
export const BOOK_BUCKET = "book";
