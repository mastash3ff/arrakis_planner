# Arrakis Planner — Scraper

Scrapes placeable structure data from `awakening.wiki` and outputs
`scraper/output/items_data.json`, which matches the `ItemsDataFile`
TypeScript type exactly.

## Setup

```bash
cd scraper
pip install -r requirements.txt
```

Or with conda:

```bash
conda create -n arrakis-scraper python=3.12
conda activate arrakis-scraper
pip install -r requirements.txt
```

## Usage

```bash
# Full scrape + write output
python scrape.py

# Scrape and preview output without writing files
python scrape.py --dry-run

# Scrape and apply manual corrections from manual_overrides.json
python scrape.py --merge

# Combine (preview merged output)
python scrape.py --dry-run --merge
```

## Output format

`scraper/output/items_data.json`:

```json
{
  "version": "1.0.0",
  "scraped_at": "2026-04-03T12:00:00+00:00",
  "items": [
    {
      "id": "windtrap_t1",
      "name": "Windtrap T1",
      "category": "water",
      "build_cost": [
        { "item_id": "metal_scraps", "quantity": 50 }
      ],
      "crafting_tree": null,
      "power_delta": -5,
      "water_capacity": 500,
      "water_production_rate": 50,
      "consumables": [],
      "deep_desert_eligible": true
    }
  ]
}
```

Items where fields could not be parsed will have `"incomplete": true`.

## Deploying updated data

After each scrape run:

```bash
cp scraper/output/items_data.json public/data/items_data.json
npm run build
```

Then deploy `dist/` per the AWS deploy instructions in `infra/`.

## Manual overrides

Edit `scraper/manual_overrides.json` to correct values that the scraper
cannot parse accurately. Keys are `item.id` slugs:

```json
{
  "windtrap_t1": {
    "power_delta": -5,
    "water_production_rate": 52
  },
  "solar_collector": {
    "deep_desert_eligible": true
  }
}
```

Overrides are applied *after* scraping when `--merge` is used.
They are deep-merged so you only need to specify the fields being corrected.

## Updating after game patches

1. Run `python scrape.py --dry-run` to check what changed.
2. If the wiki structure has changed, update `scrape_item_page()` and
   `scrape_index()` in `scrape.py` to match the new HTML layout.
3. Add any values the scraper still cannot parse to `manual_overrides.json`.
4. Run `python scrape.py --merge` and verify the output.
5. Copy the output to `public/data/items_data.json` and rebuild.
