# Arrakis Planner

Deep Desert base planning calculator for **Dune: Awakening**.

Select the placeables you want to build, choose your zone (Hagga Basin or Deep Desert), and the planner computes:

- **Raw material requirements** — recursive crafting tree expansion down to base ingredients
- **Power budget** — generation vs. consumption with net balance
- **Water budget** — storage capacity, production rate, and time-to-fill
- **Transport logistics** — total cargo volume and trip count based on your container loadout

**Static site — no backend.** All calculations run in the browser. Game data is fetched from a bundled JSON file at startup. Deployed to S3 + CloudFront.

---

## Contents

- [Local Development](#local-development)
- [Testing](#testing)
- [Game Data & Scraper](#game-data--scraper)
- [Architecture](#architecture)
- [TypeScript Types](#typescript-types)
- [Calculation Functions](#calculation-functions)
- [AWS Deployment](#aws-deployment)
- [Project Structure](#project-structure)
- [AI-Assisted Development (CLAUDE.md)](#ai-assisted-development-claudemd)
- [Phase 2 Roadmap](#phase-2-roadmap)

---

## Local Development

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| npm | 10+ |
| Python | 3.12+ (scraper only) |

### Setup

```bash
npm install
npm run dev
```

App runs at `http://localhost:5173`.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run typecheck` | TypeScript strict check, no emit |
| `npm run lint` | ESLint — zero warnings enforced |
| `npm run test` | Vitest unit tests (single run) |
| `npm run test:watch` | Vitest in watch mode |

**After any source change, run both checks:**

```bash
npm run typecheck && npm run lint
```

---

## Testing

Unit tests live alongside the code they test.

| File | Environment | Coverage | Tests |
|---|---|---|---|
| `src/lib/calculations.test.ts` | node | All 7 pure calculation functions | 31 |
| `src/lib/dataLoader.test.ts` | node | `validateItemsData` schema validation paths | 27 |
| `src/store/buildStore.test.ts` | node | All store actions + named selectors | 32 |
| `src/components/planner/ItemSelector.test.tsx` | happy-dom | Filter logic, quantity badges, empty states | 11 |
| `src/components/planner/ConsumablesPlanner.test.tsx` | happy-dom | Days counter, consumables table, empty states | 11 |

```bash
npm run test
```

Vitest globals are enabled (`describe`, `it`, `expect` available without imports). Logic tests run in Node; component tests (`.test.tsx`) run in `happy-dom`.

To add tests, create a sibling `*.test.ts` or `*.test.tsx` file next to the module under test.

---

## Game Data & Scraper

Item data lives in `public/data/items_data.json`. It is served as a static asset and fetched by the browser at startup. **The file is not bundled into the JS bundle** — Vite serves it from `public/` unchanged.

The current file contains **39 real placeables** scraped from [awakening.wiki](https://awakening.wiki).

### Scraper Setup

```bash
pip install -r scraper/requirements.txt
```

Requires `lxml` and `requests` (see `scraper/requirements.txt`).

### Scraper Workflow

```bash
# Preview: fetch category page + 2 item pages, print JSON, exit 0 — no files written
python scraper/scrape.py --dry-run

# Full scrape and write output
python scraper/scrape.py

# Full scrape + apply manual corrections from manual_overrides.json
python scraper/scrape.py --merge

# Deploy the scraped data to the app
cp scraper/output/items_data.json public/data/items_data.json
```

**`--dry-run`** always exits 0, even when the wiki is unreachable. When the wiki is unreachable in any mode, the scraper falls back to copying `public/data/items_data.json` as a graceful degradation — it will never crash.

### Manual Overrides

`scraper/manual_overrides.json` corrects values the scraper cannot parse accurately (infobox quirks, missing fields, etc.). Keys are item ID slugs; values are deep-merged onto the scraped item after scraping:

```json
{
  "windtrap": {
    "category": "water",
    "deep_desert_eligible": true,
    "power_delta": -10,
    "water_production_rate": 75
  }
}
```

Run `python scraper/scrape.py --merge` to apply overrides. Overrides are never applied during `--dry-run`.

### Updating After Game Patches

1. `python scraper/scrape.py --dry-run` — check what changed and whether the parser is still working.
2. If the wiki infobox structure changed, update `scrape_item_page()` in `scraper/scrape.py`.
3. Fix any parse failures by adding entries to `manual_overrides.json`.
4. `python scraper/scrape.py --merge`
5. `cp scraper/output/items_data.json public/data/items_data.json`
6. `npm run build && bash infra/deploy.sh`

### Data Schema

`public/data/items_data.json` top-level:

```json
{
  "version": "1.0.0",
  "scraped_at": "<ISO 8601 UTC>",
  "items": [ /* Item[] — see src/types/index.ts */ ]
}
```

The schema is validated at runtime by `src/lib/dataLoader.ts`. A `DataLoadError` is surfaced as a user-facing message — the app will not render with invalid data.

---

## Architecture

**Static site only.** No backend, no server-side rendering, no API calls (except the wiki scraper, which runs offline).

### Data Flow

```
awakening.wiki
      │
      ▼
scraper/scrape.py
      │  (--merge → apply manual_overrides.json)
      ▼
scraper/output/items_data.json
      │  (cp → public/data/)
      ▼
public/data/items_data.json          ← static file bundled at build
      │  (fetch() at startup)
      ▼
src/lib/dataLoader.ts                ← validate schema, throw DataLoadError on failure
      │
      ▼
src/store/buildStore.ts              ← Zustand: items[], buildPlan, storageConfig
      │  (named selectors call pure fns)
      ▼
src/lib/calculations.ts              ← pure functions, zero React/Zustand imports
      │
      ▼
React components                     ← read-only: useBuildStore(selector)
```

### Key Design Rules

**Calculations are pure functions.** `src/lib/calculations.ts` has no React or Zustand imports. Every function takes plain data and returns plain data. This makes them trivially testable in Node without a DOM.

**Components never compute.** A component calls `useBuildStore(selectFlatMaterials)` — it never calls `sumBuildCost()` itself. All derived state lives in Zustand selectors. This means the same calculation is never duplicated across components.

**App startup gates on data.** `App.tsx` renders a loading screen until `isLoaded === true` and an error screen if `loadError` is set. No component can render stale or missing item data.

**Schema is validated at the boundary.** `dataLoader.ts` validates every field of every item. If the scraped JSON changes shape after a game update, the error surfaces immediately with a clear message pointing at the bad field.

---

## TypeScript Types

All types live in `src/types/index.ts`.

### Core types

| Type | Purpose |
|---|---|
| `Item` | A placeable structure: costs, power, water, consumables, volume |
| `ItemCategory` | `'power' \| 'water' \| 'production' \| 'storage' \| 'defense' \| 'utility'` |
| `CraftingNode` | Recursive tree node. Leaf nodes (`children: []`) are raw materials |
| `MaterialCost` | `{ item_id: string; quantity: number }` — used in build costs and consumables |
| `BuildEntry` | `{ item_id: string; quantity: number }` — one line in the user's plan |
| `BuildPlan` | `entries: BuildEntry[]` + `dd_mode: boolean` |

### Calculation result types

| Type | Fields |
|---|---|
| `PowerBudget` | `generation`, `consumption` (absolute), `net` |
| `WaterBudget` | `total_capacity`, `production_rate`, `hours_to_fill` (Infinity when rate is 0) |
| `TripPlan` | `total_volume`, `total_capacity`, `trips` |

### Transport types

| Type / Constant | Purpose |
|---|---|
| `ContainerType` | `{ name, volume, count }` — one container type in the loadout |
| `StorageConfig` | `{ containers: ContainerType[] }` |
| `CONTAINER_PRESETS` | Small Storage Box (175), Medium Storage Box (500), Assault Ornithopter (1000) |
| `VOLUME_TABLE` | Per-material volume lookup (`Record<string, number>`) |
| `VOLUME_DEFAULT` | Fallback volume `0.1` for unknown materials |

### Crafting tree semantics

The root node of a crafting tree satisfies `item_id === Item.id` and `quantity === 1`. Interior nodes are craftable intermediates. Leaf nodes (`children: []`) are raw materials.

`flattenCraftingTree(root, multiplier)` recursively expands the tree:
- At each node, `effectiveQty = node.quantity * multiplier`
- For leaf nodes, emit `{ item_id, quantity: effectiveQty }`
- For interior nodes, recurse into children with `multiplier = effectiveQty`
- Results are deduplicated before returning

---

## Calculation Functions

All in `src/lib/calculations.ts`. All have JSDoc.

| Function | Signature | Description |
|---|---|---|
| `flattenCraftingTree` | `(node, multiplier?) → MaterialCost[]` | Recursively expands a crafting tree to raw materials |
| `sumBuildCost` | `(entries, items, ddMode) → MaterialCost[]` | Total raw materials for a build plan, with optional DD discount |
| `applyDDDiscount` | `(costs) → MaterialCost[]` | `Math.ceil(qty * 0.5)` — Deep Desert 50% reduction |
| `computePowerBudget` | `(entries, items) → PowerBudget` | Generation, consumption, net |
| `computeWaterBudget` | `(entries, items) → WaterBudget` | Capacity, production rate, hours to fill |
| `computeConsumables` | `(entries, items, days) → MaterialCost[]` | Total consumables for N days |
| `computeTrips` | `(materials, config) → TripPlan` | Transport trips required; throws `RangeError` if no containers configured |

### Deep Desert discount

`applyDDDiscount` uses `Math.ceil(qty * 0.5)` — no exemptions. All materials including spice and water are halved, rounding up. This matches the in-game behaviour where the game rounds up fractional costs.

---

## AWS Deployment

### One-Time Infrastructure Setup

Follow `infra/cloudfront-notes.md` step by step. Key points:

- S3 bucket: **block all public access** — CloudFront uses Origin Access Control (OAC), not a public bucket policy
- CloudFront default root object: `index.html`
- Add custom error responses for **403 → 200 /index.html** and **404 → 200 /index.html** — required for any SPA
- Apply `infra/s3-bucket-policy.json` to the S3 bucket after creating the OAC (fill in your account ID and distribution ID)

### Deploy

```bash
export S3_BUCKET=your-bucket-name
export CF_DIST_ID=EXXXXXXXXXXXX
bash infra/deploy.sh
```

The script:
1. Runs `npm run build`
2. Syncs `dist/` to S3 — hashed assets get `max-age=31536000,immutable`; `index.html` gets `no-cache`
3. Creates a `/*` CloudFront invalidation

### Cache Strategy

Vite content-hashes all asset filenames (e.g., `index-BEmFKu4D.js`). This means:
- **Assets** can be cached forever — the filename changes when the content changes
- **`index.html`** must never be cached — it is the entry point that references the hashed assets
- **`/data/items_data.json`** is served from the `public/` path with no hash, so CloudFront will serve the cached version until invalidated by a deploy

---

## Project Structure

```
arrakis_planner/
├── src/
│   ├── App.tsx                          # Root: loading/error gates, main layout
│   ├── main.tsx                         # React mount point
│   ├── index.css                        # Tailwind base import
│   ├── types/
│   │   └── index.ts                     # All TypeScript interfaces + constants
│   ├── lib/
│   │   ├── calculations.ts              # Pure calc functions (no React/Zustand)
│   │   ├── calculations.test.ts         # 31 Vitest unit tests
│   │   ├── dataLoader.ts                # fetch + validate items_data.json
│   │   └── dataLoader.test.ts           # 27 Vitest unit tests
│   ├── store/
│   │   └── buildStore.ts                # Zustand store + named selectors
│   └── components/
│       ├── layout/
│       │   ├── AppShell.tsx             # Two-column layout wrapper
│       │   └── Sidebar.tsx              # Left panel: DDModeToggle + ItemSelector
│       ├── planner/
│       │   ├── BuildSummary.tsx             # Plan entries, power, water, materials
│       │   ├── ConsumablesPlanner.tsx       # Per-day consumables calculator
│       │   ├── ConsumablesPlanner.test.tsx  # 11 Vitest unit tests (happy-dom)
│       │   ├── TripPlanner.tsx              # Container config + trip count
│       │   ├── ItemSelector.tsx             # Catalogue browse + search + add to plan
│       │   ├── ItemSelector.test.tsx        # 11 Vitest unit tests (happy-dom)
│       │   ├── MaterialsList.tsx            # Standalone materials list (reusable)
│       │   ├── PowerBudget.tsx              # Standalone power panel (reusable)
│       │   └── WaterBudget.tsx              # Standalone water panel (reusable)
│       └── controls/
│           ├── DDModeToggle.tsx         # Hagga Basin / Deep Desert toggle
│           └── ExportImport.tsx         # JSON plan export/import + share URL
├── public/
│   └── data/
│       └── items_data.json              # Live scraped game data (39 items)
├── scraper/
│   ├── scrape.py                        # awakening.wiki scraper
│   ├── manual_overrides.json            # Hand-corrections applied with --merge
│   ├── requirements.txt                 # requests, beautifulsoup4, lxml
│   ├── output/
│   │   └── items_data.json              # Scraper output (copy to public/data/)
│   └── README.md                        # Scraper-specific documentation
├── infra/
│   ├── deploy.sh                        # Build + S3 sync + CF invalidation
│   ├── cloudfront-notes.md              # One-time AWS setup checklist
│   └── s3-bucket-policy.json            # OAC bucket policy template
├── CONTRIBUTING.md                      # Contributor guide
├── CLAUDE.md                            # AI assistant context for this repo
├── vite.config.ts                       # Vite + Vitest config, path alias @/
├── tailwind.config.js                   # Dark theme, stone/amber palette
├── tsconfig.json                        # TypeScript strict, paths alias
└── .eslintrc.cjs                        # ESLint: TS strict + react-hooks
```

---

## AI-Assisted Development (CLAUDE.md)

This repository includes a `CLAUDE.md` file at the root. It is read automatically by [Claude Code](https://claude.ai/code) when the assistant is invoked inside this directory, giving it project-specific context without repeating it in every prompt.

### What CLAUDE.md provides

- **Commands** — the exact npm and Python commands to run, including the "after every source change" rule
- **Architecture overview** — the data flow diagram and the three key design rules (pure fns, read-only components, startup gating)
- **Type descriptions** — enough to reason about `CraftingNode`, `StorageConfig`, etc. without reading every file
- **Calculation function inventory** — which functions are implemented, which are stubs
- **Sample data description** — what's in `items_data.json` and what the intermediates are
- **Phase 2 scope** — what is intentionally not yet built, so the assistant doesn't invent new structure

### Initializing CLAUDE.md in a new project

A good `CLAUDE.md` answers the questions an experienced developer would ask on day one:

```markdown
# CLAUDE.md

## Commands
# How do I run this? How do I check it? How do I build it?
# Include the "after any change, run X" rule explicitly.

## Architecture
# What is the data flow, end to end?
# What are the 2-3 rules that must never be violated?
# Where does state live? Where does logic live?

## Key files
# Which files should I read first to understand the codebase?
# What does each one do?

## Types / contracts
# What are the central data structures?
# What invariants must they satisfy? (e.g., "root node quantity === 1")

## What is NOT implemented yet
# Stubs, placeholders, deferred Phase 2 items.
# Without this, the assistant will try to fill them in.

## Testing
# How do I run tests? Where do they live? What framework?
```

### Tips

- **Keep it honest.** If a function is a stub, say so — `calculations.ts: flattenCraftingTree is implemented; all others are stubs`. An assistant that doesn't know about stubs will patch around them instead of implementing them.
- **Describe invariants, not just types.** `CraftingNode root has quantity === 1` is load-bearing; `CraftingNode has item_id, quantity, children` is just the type definition.
- **Include the "don't do X" list.** The most common assistant mistakes are adding features beyond scope, computing in components, breaking the unidirectional data flow. State the rules explicitly.
- **Don't describe git history.** CLAUDE.md is not a changelog. It describes the current state of the codebase. Use commit messages for history.
- **Update it when the code changes.** A stale CLAUDE.md is worse than none — the assistant will confidently work from incorrect assumptions. When Phase 2 items are implemented, remove them from the "not yet implemented" list.

### Scope of this CLAUDE.md

This file is **project-scoped**. A separate global `~/.claude/CLAUDE.md` (or per-machine file) handles machine-level conventions: shell preferences, Docker conventions, git policy, secrets hygiene, etc. The project CLAUDE.md assumes those global rules are already in effect and only documents what is specific to this repository.

---

## Roadmap

### Implemented

| Feature | Location |
|---|---|
| Search/filter in ItemSelector | `src/components/planner/ItemSelector.tsx` |
| Export/Import plan (JSON round-trip) | `src/components/controls/ExportImport.tsx` |
| Consumables planning UI (per-day calculator) | `src/components/planner/ConsumablesPlanner.tsx` |
| Share URL (plan encoded into query params) | `App.tsx` |

### Deferred

Nothing at this stage. All `VOLUME_TABLE` values are confirmed from awakening.wiki item pages.
