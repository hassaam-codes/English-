# 9th Class English: Lahore Board Past Papers (2022 to 2026)

A static website for the Q.8 (Urdu to English translation) and Q.9 (change the voice) questions from the ten Lahore Board 9th class English papers, 2022 to 2026, Group I and Group II.

All question text is copied exactly from `assets/Past_papers.pdf` and lives in `js/data.js`.

## Features
A 9th class English site, built mobile first like an app.

- **Home:** the list of sections.
- **English A (textbook):** chapters, each with its summary, question answers and other sections. Content lives in `js/book.js` and is copied word for word from the notes PDFs.
- **English B (grammar):** grammar topics, in the same format.
- **Past papers:** the ten Lahore Board papers 2022 to 2026 (Q.8 and Q.9) with suggested answers; swipe between papers, search in English or Urdu, tick what you have practised.
- **Quiz (inside Past papers):** flashcards for Q.8, Q.9 or only repeated questions. Tap to flip for the answer, swipe right if you know it.
- **Books (round button):** Book A and Book B as PDFs, each uploaded from the admin page (see `supabase/README.md`). A book that has not been uploaded shows as 'being added'.
- **Repeated questions:** every question asked in more than one paper.
- **Notes:** files uploaded from the admin page (`/#/admin`).
- Light and dark themes, reduced-motion support, a designed PDF of the papers.

### Adding a chapter
Open `js/book.js`. The comment at the top shows the shape of a chapter. Sections can be text (`paras`), question answers (`qa`), Urdu with English (`pairs`), a list or a table. A long chapter can live in its own file under `js/book/` (see `js/book/tenses.js`). Chapters with more than six sections get a contents page. An entry marked `fileOnly` with a `pdf` path has no page: its row just opens the PDF (this is how PRESENT TENSES is shown).

To build the designed PDF for a chapter: `node tools/make-notes-pdf.js b tenses assets/notes/Present_Tenses.pdf`, then set the chapter's `pdf` field to that path.

## Run locally
No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy
Upload the folder as-is to GitHub Pages, Netlify or Vercel (static site, no framework).

## Database
Content can be served from Supabase (read-only for the public). See [`supabase/README.md`](supabase/README.md) for the one-time setup. Without it the site uses the built-in copy in `js/data.js` and `js/answers.js`.

## PDF
- `assets/English_Papers_2022-2026.pdf`: the designed PDF (what the Download button gives)
- `assets/Past_papers.pdf`: the original source PDF
- Rebuild after editing `js/data.js`: `npm i playwright && node tools/make-pdf.js` (template: `tools/pdf.html`)

## Logo
- `assets/logo.svg`: the mark (a sheet of paper with a folded corner and a 9)
- `assets/icons/`: browser tab icon and phone home-screen icons
- `manifest.webmanifest`: lets people add the site to their phone's home screen

## Files
- `index.html`: page structure
- `css/styles.css`: design tokens, layout, motion
- `js/data.js`: all paper text (edit here to add a new year)
- `js/app.js`: the app (tabs, papers, practice deck, search, theme)
- `js/book.js`: English A and English B content
- `js/library.js`: chapter lists and chapter pages
- `js/content.js`: loads content from Supabase, with a saved copy and the built-in copy as fallbacks
- `js/config.js`: Supabase URL and publishable key, admin username and password
- `js/supabase.js`: list, upload and delete files in the notes storage bucket
- `js/notes.js`: the Notes page and the admin panel
