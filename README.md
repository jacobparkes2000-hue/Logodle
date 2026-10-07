# Logodle

Logodle is a React single-page app built with Vite. Shared logo assets and crawler files are served from `public/`. Per-day quiz data and logos remain in `days/` and are copied into the production build.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.

Run `npm run build` to create the production site in `dist/`.

## Deploy

For Vercel, use the Vite framework preset, `npm run build` as the build command, and `dist` as the output directory.

For Cloudflare, run `npm run build` before deploying the `dist/` directory with Wrangler.

## Add a day

1. Copy `days/2026-10-04` to a new `days/YYYY-MM-DD` folder.
2. Add that day's ten logo files to its `assets/` folder.
3. Edit the copied `day.json`: set the date and title, then add ten rounds with exactly eight options each.
4. Register the new day in `public/days/index.json`.

Each day is self-contained: its quiz data and logo assets travel together. The app loads the selected day via `?day=YYYY-MM-DD`; it opens the newest available day on or before the visitor's local date by default.
