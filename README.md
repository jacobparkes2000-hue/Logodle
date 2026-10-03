# Logodle — static Cloudflare Pages project

This is a dependency-free website ready for a GitHub repository and Cloudflare Pages. Set the build command to **none** and the output directory to the repository root.

## Add a day

1. Copy `days/2026-10-04` to a new `days/YYYY-MM-DD` folder.
2. Add that day's ten logo files to its `assets/` folder.
3. Edit the copied `day.json`: set the date and title, then add ten rounds with exactly eight options each.
4. Register the new day in `days/index.json`.

Each day is self-contained: its quiz data and logo assets travel together. The root app loads the selected day via `?day=YYYY-MM-DD`; it opens the newest available day on or before the visitor's local date by default.
