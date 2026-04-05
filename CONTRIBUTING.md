# Contributing to Arrakis Planner

Thank you for your interest in contributing. This guide covers everything you need to get started.

## Prerequisites

- **Node.js 20+** and npm 10+
- **Python 3.11+** for the data scraper
- Git

## Local development setup

```bash
git clone https://github.com/your-org/arrakis-planner
cd arrakis-planner
npm install
npm run dev          # dev server at http://localhost:5173
```

## Before every commit

Run both checks — CI enforces zero warnings on each:

```bash
npm run typecheck && npm run lint
```

## Tests

```bash
npm run test         # all unit tests (single run)
npm run test:watch   # watch mode during development
```

Test files live alongside the code they test (`*.test.ts` / `*.test.tsx`).
Adding a new calculation function? Add tests in `src/lib/calculations.test.ts`.
Adding a new store action or selector? Add tests in `src/store/buildStore.test.ts`.

## Data scraper

Game data is sourced from [awakening.wiki](https://awakening.wiki) via the Python scraper.

```bash
pip install -r scraper/requirements.txt

# Preview output without writing
python scraper/scrape.py --dry-run

# Full scrape + apply manual overrides
python scraper/scrape.py --merge

# Deploy updated data to the app
cp scraper/output/items_data.json public/data/items_data.json
```

Manual corrections (e.g. volume overrides, confirmed water rates) go in
`scraper/manual_overrides.json` and are applied with `--merge`. See the file
for the expected format.

## Project layout

```
src/
  components/     React components (read-only store consumers)
  lib/            Pure calculation functions + data loader
  store/          Zustand store, actions, named selectors
  types/          TypeScript interfaces and constants
scraper/          Python wiki scraper
public/data/      Deployed game data (generated — do not hand-edit)
infra/            AWS deploy script
.github/          CI and deploy workflows
```

## Pull request guidelines

1. Open an issue first for non-trivial changes so the approach can be discussed.
2. Keep PRs focused — one logical change per PR.
3. All CI checks must pass: typecheck, lint, tests.
4. For scraper changes, include `--dry-run` output in the PR description.
5. For data corrections, explain the in-game source (screenshot, wiki link, etc.).

## Code style

- **TypeScript strict** — no `any`, no type assertions without justification.
- **Calculations stay pure** — `src/lib/calculations.ts` has zero React/Zustand imports.
- **Components only read** — dispatch actions or read selectors; never derive state inline.
- **No speculative abstractions** — implement what the task requires, nothing more.

## Reporting issues

Use [GitHub Issues](https://github.com/your-org/arrakis-planner/issues).
For data inaccuracies (wrong build costs, missing items), please link the
relevant awakening.wiki page.
