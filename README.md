# 9th Class English: Lahore Board Past Papers (2022 to 2026)

A static website for the Q.8 (Urdu to English translation) and Q.9 (change the voice) questions from the ten Lahore Board 9th class English papers, 2022 to 2026, Group I and Group II.

All question text is copied exactly from `assets/Past_papers.pdf` and lives in `js/data.js`.

## Features
Built mobile first, like an app, with a bottom tab bar:
- **Home:** kept deliberately bare: the title, one line, and a Start practice button.
- **Papers:** pick a paper from the chip row or swipe left and right between papers. Switch between Q.8, Q.9 and the English medium question. Tick sentences you have practised. Search every paper in English or Urdu.
- **Practice:** a flashcard deck for Q.8, Q.9 or only repeated questions. Tap a card to flip it and see the answer. Swipe right if you can do it, left to see it again later.
- **Answers:** suggested answers live in `js/answers.js` (they are not from the board or the source PDF). In Papers, tap a sentence to show its answer.
- **Repeated:** every repeated question with how many times it came, each paper tappable.
- Progress is saved on the device. Light and dark themes, reduced-motion support, PDF download.

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
- `js/content.js`: loads content from Supabase, with a saved copy and the built-in copy as fallbacks
- `js/config.js`: Supabase URL and publishable key
