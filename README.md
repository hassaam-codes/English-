# 9th Class English: Lahore Board Past Papers (2022 to 2026)

A static website for the Q.8 (Urdu to English translation) and Q.9 (change the voice) questions from the ten Lahore Board 9th class English papers, 2022 to 2026, Group I and Group II.

All question text is copied exactly from `assets/Past_papers.pdf` and lives in `js/data.js`.

## Features
- 3D hero (Three.js): the ten papers float in a helix. Drag to spin, click a sheet to jump to that paper.
- Each paper is shown as a "sheet" laid out like the PDF page (Urdu in Nastaliq).
- Filter by year and group, search any sentence (English or Urdu), or show only repeated questions.
- Repeated items are tagged on every paper; the repeated-questions tables link back to each paper.
- Light and dark themes, mobile layout, reduced-motion support, PDF download.

## Run locally
No build step. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy
Upload the folder as-is to GitHub Pages, Netlify or Vercel (static site, no framework).

## Files
- `index.html`: page structure
- `css/styles.css`: design tokens, layout, motion
- `js/data.js`: all paper text (edit here to add a new year)
- `js/app.js`: rendering, filters, search, theme, menu
- `js/scene.js`: the Three.js 3D scene
