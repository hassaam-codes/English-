# 9th Class English: Lahore Board Past Papers (2022 to 2026)

A static website for the Q.8 (Urdu to English translation) and Q.9 (change the voice) questions from the ten Lahore Board 9th class English papers, 2022 to 2026, Group I and Group II.

All question text is copied exactly from `assets/Past_papers.pdf` and lives in `js/data.js`.

## Features
Built mobile first, like an app, with a bottom tab bar:
- **Home:** a moving stack of the most repeated questions (tap to practise), your progress, and a swipeable row of papers.
- **Papers:** pick a paper from the chip row or swipe left and right between papers. Switch between Q.8, Q.9 and the English medium question. Tick sentences you have practised. Search every paper in English or Urdu.
- **Practice:** a flashcard deck for Q.8, Q.9 or only repeated questions. Swipe right if you can do it, left to see it again later.
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

## Files
- `index.html`: page structure
- `css/styles.css`: design tokens, layout, motion
- `js/data.js`: all paper text (edit here to add a new year)
- `js/app.js`: rendering, filters, search, theme, menu
