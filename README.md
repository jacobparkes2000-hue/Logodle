# Logodle

A dependency-free static daily logo guessing game. Open `index.html` through a static server (for example, `python -m http.server 8080`) and visit the supplied local address.

## Content

Daily quizzes live in `data.js`. Add a date, label, and five `rounds`; every round has an `answer`, a `logo` image path, and eight `options`. The app uses `?day=YYYY-MM-DD` for shareable/archive URLs and opens the newest available quiz dated today or earlier by default. It persistently records results in browser `localStorage` under `logodle:result:<date>`.

The five original Day 1 rounds use the supplied PNG/JPG/WebP logo files in `assets/`; the additional archive rounds use image-only SVG marks. When a future image is not yet supplied, the game displays a neutral mark without text, so it never gives away the answer.

## Answer feedback

After an answer, the selected option gives immediate visual feedback: correct choices pulse green, while incorrect choices shake red and reveal the green answer. The game automatically advances after two seconds (or shows results after the final round); the Next button remains available for players who want to continue immediately.
