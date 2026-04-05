#!/usr/bin/env python3
"""
Arrakis Planner — awakening.wiki Placeables scraper.

Outputs scraper/output/items_data.json matching the TypeScript Item type exactly.

Usage:
    python scrape.py                   # Full scrape + write output
    python scrape.py --dry-run         # Scrape index + up to 2 item pages, log, do not write
    python scrape.py --merge           # Scrape + deep-merge manual_overrides.json
    python scrape.py --dry-run --merge # Dry run with merge preview

URL patterns (confirmed from live wiki):
    Category index: https://awakening.wiki/index.php?title=Category:Placeables
    Item pages:     https://awakening.wiki/{Item_Name}  (Title_Case, spaces as underscores)

Page structure (confirmed from live page inspection):
    Infobox: wikitable with rows for Health, Power Cost, Inventory Slot Capacity, Buildable Type
    Build Cost section: wikitable with rows like "[[Item Name]] ×{qty}" or "Item Name x{qty}"

See scraper/README.md for full documentation.
"""

import argparse
import copy
import json
import logging
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup

# ─── Configuration ─────────────────────────────────────────────────────────────

BASE_URL = "https://awakening.wiki"
INDEX_URL = f"{BASE_URL}/index.php?title=Category:Placeables"

REQUEST_DELAY_S = 1.0        # seconds between requests
MAX_RETRIES = 3              # per-URL retry attempts on transient failures
RETRY_BACKOFF_S = [1, 2, 4]  # exponential backoff between retries

# --dry-run fetches at most this many item pages (index page + 2 items)
DRY_RUN_ITEM_LIMIT = 2

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "items_data.json")
OVERRIDES_PATH = os.path.join(SCRIPT_DIR, "manual_overrides.json")
FALLBACK_DATA_PATH = os.path.join(SCRIPT_DIR, "..", "public", "data", "items_data.json")

# ─── Logging setup ─────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("arrakis-scraper")


# ─── HTTP helpers ───────────────────────────────────────────────────────────────

def fetch(url: str, session: requests.Session) -> BeautifulSoup:
    """Fetch a URL with rate-limiting and retry logic. Returns parsed HTML."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.info("GET %s (attempt %d/%d)", url, attempt, MAX_RETRIES)
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            time.sleep(REQUEST_DELAY_S)
            return BeautifulSoup(resp.text, "lxml")
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code < 500:
                log.error("HTTP %d for %s — not retrying", exc.response.status_code, url)
                raise
            log.warning("HTTP error on attempt %d: %s", attempt, exc)
        except requests.RequestException as exc:
            log.warning("Request error on attempt %d: %s", attempt, exc)

        if attempt < MAX_RETRIES:
            backoff = RETRY_BACKOFF_S[attempt - 1]
            log.info("Retrying in %ds…", backoff)
            time.sleep(backoff)

    raise RuntimeError(f"All {MAX_RETRIES} attempts failed for {url}")


# ─── Parsing helpers ────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    """Convert a display name to a snake_case id slug."""
    s = name.strip().lower()
    s = re.sub(r"['\"]", "", s)
    s = re.sub(r"[\s\-]+", "_", s)
    return s


def parse_number(raw: Any, field: str, item_name: str, default: int = 0) -> int:
    """Parse an integer from raw wiki text; logs a warning and returns default on failure."""
    if not raw:
        return default
    cleaned = re.sub(r"[^\d\-]", "", str(raw).strip())
    try:
        return int(cleaned)
    except ValueError:
        log.warning("  [%s] could not parse '%s' as int for field '%s' — using %d",
                    item_name, raw, field, default)
        return default


def parse_float(raw: Any, field: str, item_name: str, default: float = 0.0) -> float:
    """Parse a float from raw wiki text; logs a warning and returns default on failure."""
    if not raw:
        return default
    cleaned = re.sub(r"[^\d\.\-]", "", str(raw).strip())
    try:
        return float(cleaned)
    except ValueError:
        log.warning("  [%s] could not parse '%s' as float for field '%s' — using %g",
                    item_name, raw, field, default)
        return default


def parse_bool(raw: Any, item_name: str, field: str, default: bool = False) -> bool:
    """Parse a boolean from wiki text."""
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    if text in ("yes", "true", "1", "✓", "✔"):
        return True
    if text in ("no", "false", "0", "✗", "✘", ""):
        return False
    log.warning("  [%s] unrecognised bool value '%s' for field '%s' — using %s",
                item_name, raw, field, default)
    return default


# ─── Index scraping ─────────────────────────────────────────────────────────────

def scrape_index(soup: BeautifulSoup) -> list[str]:
    """
    Extract all placeable item page URLs from the MediaWiki category page.

    awakening.wiki category pages use <div id="mw-pages"> containing <a> links
    with href="/Item_Name" (no /wiki/ prefix on this wiki).
    """
    urls: list[str] = []

    mw_pages = soup.find(id="mw-pages")
    if mw_pages:
        for link in mw_pages.find_all("a", href=True):
            href: str = link["href"]
            # Category sub-links have href="/index.php?..." — skip those
            if href.startswith("/index.php") or href.startswith("#"):
                continue
            # Filter out links to non-item pages (Special:, Help:, etc.)
            if ":" in href.lstrip("/"):
                continue
            full_url = BASE_URL + href
            if full_url not in urls:
                urls.append(full_url)

    log.info("Found %d item URLs on category page", len(urls))
    return urls


# ─── Item page scraping ─────────────────────────────────────────────────────────

VALID_CATEGORIES = {"power", "water", "production", "storage", "defense", "utility"}

# Maps wiki Buildable Type values (from the hidden "show IDs" infobox section) to
# our ItemCategory strings. Discovered by inspecting live wiki pages — extend when
# new Buildable Types appear.
BUILDABLE_TYPE_MAP: dict[str, str] = {
    # Power
    "WindTurbine":          "power",
    "Generator":            "power",
    # Water
    "WindTrap":             "water",
    "WaterCistern":         "water",
    "BloodWaterExtractor":  "water",
    "Deathstill":           "water",
    # Production
    "OreRefinery":          "production",
    "SpiceRefinery":        "production",
    "ChemicalRefinery":     "production",
    "Fabricator":           "production",
    "WearablesFabricator":  "production",
    "SurvivalFabricator":   "production",
    "VehiclesFabricator":   "production",
    "WeaponsFabricator":    "production",
    # Storage
    "SpiceSilo":            "storage",
    "StorageContainer":     "storage",
    # Utility / misc
    "RepairStation":        "utility",
    "Recycler":             "utility",
    "Totem_Small":          "utility",
    "Totem":                "utility",
}

# Buildable Types that can be deployed in the Deep Desert.
# The wiki has no dedicated field for this — derived from in-game knowledge.
# Correct individual outliers via manual_overrides.json.
DD_ELIGIBLE_TYPES: set[str] = {
    "WindTrap",
    "WindTurbine",
    "Generator",
    "SpiceRefinery",
    "SpiceSilo",
    "WaterCistern",
    "BloodWaterExtractor",
    "Deathstill",
    "StorageContainer",
}


def scrape_item_page(url: str, soup: BeautifulSoup) -> dict[str, Any] | None:
    """
    Parse a single placeable item page into an Item dict.

    Infobox: table.infobox — labels in th.infobox-label, values in td.infobox-data.
    Buildable Type: in the collapsed td.infobox-below section ("show IDs").
    Build Cost: table.wikitable after h2 "Build Cost" — materials in <li> elements.
    Deep Desert eligibility: no wiki field; derived from DD_ELIGIBLE_TYPES lookup.
    """
    incomplete = False

    # ── Name ────────────────────────────────────────────────────────────────────
    name_tag = soup.select_one("h1#firstHeading, h1.page-header__title")
    if not name_tag:
        log.warning("Could not find page title at %s — skipping", url)
        return None
    name = name_tag.get_text(strip=True)
    item_id = slugify(name)
    log.info("  Parsing: %s (id=%s)", name, item_id)

    # ── Infobox ──────────────────────────────────────────────────────────────────
    # awakening.wiki uses table.infobox (not table.wikitable).
    # Labels are th.infobox-label; values are td.infobox-data.
    infobox_data: dict[str, str] = {}
    infobox = soup.select_one("table.infobox")
    if infobox:
        for row in infobox.select("tr"):
            label = row.select_one("th.infobox-label")
            data = row.select_one("td.infobox-data")
            if label and data:
                key = label.get_text(strip=True).lower().replace(" ", "_")
                infobox_data[key] = data.get_text(strip=True)

        # Buildable Type lives in the collapsed "show IDs" section (td.infobox-below),
        # not in the main infobox rows.
        below = infobox.select_one("td.infobox-below")
        if below:
            for row in below.select("tr"):
                cells = row.find_all(["th", "td"])
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True).lower().replace(" ", "_")
                    infobox_data[key] = cells[1].get_text(strip=True)
    else:
        log.warning("  [%s] no table.infobox found — page may not be a placeable", name)
        incomplete = True

    # ── Buildable Type → category + Deep Desert eligibility ──────────────────
    raw_type = infobox_data.get("buildable_type", "")
    category = BUILDABLE_TYPE_MAP.get(raw_type, "utility")
    if raw_type and raw_type not in BUILDABLE_TYPE_MAP:
        log.warning("  [%s] unknown buildable_type '%s' — defaulting to 'utility'", name, raw_type)
        incomplete = True
    elif not raw_type:
        log.warning("  [%s] no buildable_type found — defaulting to 'utility'", name)
        incomplete = True

    deep_desert_eligible = raw_type in DD_ELIGIBLE_TYPES

    # ── Power delta ───────────────────────────────────────────────────────────
    # Generators have "Power Generated" label (positive delta).
    # Consumers have "Power Cost" label (negated here).
    if "power_generated" in infobox_data:
        power_delta = parse_number(infobox_data["power_generated"], "power_generated", name)
    elif "power_cost" in infobox_data:
        power_delta = -parse_number(infobox_data["power_cost"], "power_cost", name)
    else:
        power_delta = 0

    # ── Water ─────────────────────────────────────────────────────────────────
    # water_capacity is in ml (e.g. Windtrap = 500 ml).
    water_capacity = parse_number(
        infobox_data.get("water_capacity", "0"), "water_capacity", name
    )
    # The wiki "Water Gather Rate" field is in ml/s (e.g. 0.75 ml/s for Windtrap).
    # We convert to ml/hr here so that hours_to_fill = capacity_ml / rate_ml_hr.
    # Confirmed: 0.75 ml/s × 3600 = 2700 ml/hr → fills 500 ml tank in ~11 min.
    water_rate_ml_s = parse_float(
        infobox_data.get("water_gather_rate")
        or infobox_data.get("water_production")
        or infobox_data.get("water_production_rate")
        or "0",
        "water_production_rate", name,
    )
    water_production_rate = water_rate_ml_s * 3600  # convert ml/s → ml/hr

    # ── Build Cost section ────────────────────────────────────────────────────
    build_cost = scrape_build_cost(soup, name)
    if not build_cost:
        log.warning("  [%s] no build_cost found", name)
        incomplete = True

    # ── Skip non-placeables ───────────────────────────────────────────────────
    # Items with no buildable_type AND no build_cost are not proper placeables
    # (e.g. "Advanced Sub-Fief" is a craftable item listed in the Placeables category
    # but has no infobox type and no build cost on its page).
    if not raw_type and not build_cost:
        log.info("  Skipping '%s': no buildable_type and no build_cost — not a placeable", name)
        return None

    # ── Consumables section ───────────────────────────────────────────────────
    consumables = scrape_consumables(soup, name)

    item: dict[str, Any] = {
        "id": item_id,
        "name": name,
        "category": category,
        "build_cost": build_cost,
        "crafting_tree": None,
        "power_delta": power_delta,
        "water_capacity": water_capacity,
        "water_production_rate": water_production_rate,
        "consumables": consumables,
        "deep_desert_eligible": deep_desert_eligible,
    }
    if incomplete:
        item["incomplete"] = True

    return item


def scrape_build_cost(soup: BeautifulSoup, item_name: str) -> list[dict[str, Any]]:
    """
    Parse the "Build Cost" section on an item page.

    awakening.wiki structure (confirmed from live pages):
        <h2>Build Cost</h2>
        <table class="wikitable">
          <tr>
            <th>Components</th>
            <td><ul>
              <li><a href="/Steel_Ingot">Steel Ingot</a> x90</li>
              <li><a href="/Silicone_Block">Silicone Block</a> x30</li>
            </ul></td>
          </tr>
        </table>

    All materials are <li> elements inside a single <td>. Each <li> contains an <a>
    with the material name and trailing text " x{qty}".
    """
    costs: list[dict[str, Any]] = []

    # Find "Build Cost" heading
    build_cost_heading = None
    for heading in soup.find_all(["h2", "h3"]):
        text = heading.get_text(strip=True).lower()
        if "build" in text and "cost" in text:
            build_cost_heading = heading
            break

    if not build_cost_heading:
        return costs

    # Walk to the first table sibling
    sibling = build_cost_heading.find_next_sibling()
    while sibling:
        if sibling.name in ("h2", "h3"):
            break
        if sibling.name == "table":
            for li in sibling.select("li"):
                # Each <li> has two <a> tags: one wrapping the icon image (empty text)
                # and one with the material name. Find the first with non-empty text.
                mat_name = ""
                for a in li.find_all("a"):
                    mat_name = a.get_text(strip=True)
                    if mat_name:
                        break
                if not mat_name:
                    continue
                li_text = li.get_text(strip=True)
                m = re.search(r"[xX×]\s*(\d+)", li_text)
                if m:
                    costs.append({"item_id": slugify(mat_name), "quantity": int(m.group(1))})
                else:
                    log.warning("  [%s] unrecognised material format: '%s'", item_name, li_text)
            break
        sibling = sibling.find_next_sibling()

    return costs


def scrape_consumables(soup: BeautifulSoup, item_name: str) -> list[dict[str, Any]]:
    """
    Parse the "Consumables" section on an item page.

    awakening.wiki structure (confirmed from live pages):
        <h2>Consumables</h2>
        <table class="wikitable">
          <tr><th>Consumable</th><th>Burn Time</th></tr>
          <tr>
            <td><a href="/Makeshift_Filter">Makeshift Filter</a></td>
            <td>3 hours</td>
          </tr>
          ...
        </table>

    Quantity is derived as math.ceil(24 / burn_hours), representing how many
    consumables are needed per day of continuous operation.
    """
    costs: list[dict[str, Any]] = []

    # Find "Consumables" heading
    consumables_heading = None
    for heading in soup.find_all(["h2", "h3"]):
        text = heading.get_text(strip=True).lower()
        if "consumable" in text:
            consumables_heading = heading
            break

    if not consumables_heading:
        return costs

    # Walk to the first table sibling
    sibling = consumables_heading.find_next_sibling()
    while sibling:
        if sibling.name in ("h2", "h3"):
            break
        if sibling.name == "table":
            rows = sibling.select("tr")
            for row in rows:
                cells = row.find_all(["th", "td"])
                if len(cells) < 2:
                    continue
                # Skip header rows (th elements)
                if all(c.name == "th" for c in cells):
                    continue

                # First cell: consumable name (via link text or plain text)
                mat_name = ""
                for a in cells[0].find_all("a"):
                    mat_name = a.get_text(strip=True)
                    if mat_name:
                        break
                if not mat_name:
                    mat_name = cells[0].get_text(strip=True)
                if not mat_name:
                    continue

                # Second cell: burn time — extract numeric hours or days
                burn_text = cells[1].get_text(strip=True)
                m_hours = re.search(r"(\d+(?:\.\d+)?)\s*h", burn_text, re.IGNORECASE)
                m_days = re.search(r"(\d+(?:\.\d+)?)\s*day", burn_text, re.IGNORECASE)
                if m_hours:
                    burn_hours = float(m_hours.group(1))
                elif m_days:
                    burn_hours = float(m_days.group(1)) * 24
                else:
                    log.warning(
                        "  [%s] unrecognised burn time format for '%s': '%s'",
                        item_name, mat_name, burn_text,
                    )
                    continue
                if burn_hours <= 0:
                    log.warning(
                        "  [%s] burn time <= 0 for '%s' — skipping", item_name, mat_name
                    )
                    continue

                qty_per_day = math.ceil(24 / burn_hours)
                costs.append({"item_id": slugify(mat_name), "quantity": qty_per_day})

            break
        sibling = sibling.find_next_sibling()

    return costs


# ─── Merge logic ────────────────────────────────────────────────────────────────

def apply_overrides(items: list[dict[str, Any]], overrides_path: str) -> list[dict[str, Any]]:
    """Deep-merge manual_overrides.json over the scraped items list."""
    try:
        with open(overrides_path, encoding="utf-8") as f:
            overrides: dict[str, Any] = json.load(f)
    except FileNotFoundError:
        log.warning("manual_overrides.json not found at %s — skipping merge", overrides_path)
        return items
    except json.JSONDecodeError as exc:
        log.error("manual_overrides.json is invalid JSON: %s — skipping merge", exc)
        return items

    overrides.pop("_comment", None)

    override_count = 0
    for item in items:
        item_overrides = overrides.get(item["id"])
        if item_overrides:
            log.info("  Applying %d override(s) for '%s'", len(item_overrides), item["id"])
            deep_merge(item, item_overrides)
            override_count += 1

    log.info("Applied overrides to %d item(s)", override_count)
    return items


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> None:
    """Recursively merge override into base in-place."""
    for key, val in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(val, dict):
            deep_merge(base[key], val)
        else:
            base[key] = copy.deepcopy(val)


def load_fallback_items() -> list[dict[str, Any]]:
    """Load the hand-authored public/data/items_data.json as a fallback."""
    fallback = os.path.normpath(FALLBACK_DATA_PATH)
    log.warning("Using fallback data from %s", fallback)
    try:
        with open(fallback, encoding="utf-8") as f:
            data = json.load(f)
        items: list[dict[str, Any]] = data.get("items", [])
        log.info("Loaded %d fallback items", len(items))
        return items
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        log.error("Could not load fallback data: %s", exc)
        return []


# ─── Main ───────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape awakening.wiki Placeables and output items_data.json",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Scrape category index + up to 2 item pages, log parsed output, "
            "do NOT write any files. Always exits 0."
        ),
    )
    parser.add_argument(
        "--merge",
        action="store_true",
        help="After scraping, deep-merge manual_overrides.json over the output",
    )
    return parser.parse_args()


def build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "ArrakisPlanner/1.0 "
            "(https://github.com/your-org/arrakis-planner; community data scraper)"
        ),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    return session


def main() -> None:
    args = parse_args()

    if args.dry_run:
        log.info("DRY RUN — will fetch index + up to %d item pages, will not write files",
                 DRY_RUN_ITEM_LIMIT)

    session = build_session()
    items: list[dict[str, Any]] = []
    wiki_available = True

    # 1. Fetch category index page
    log.info("Fetching category index: %s", INDEX_URL)
    try:
        index_soup = fetch(INDEX_URL, session)
    except Exception as exc:
        wiki_available = False
        if args.dry_run:
            log.warning("Wiki unreachable: %s — exiting cleanly (dry run)", exc)
            sys.exit(0)
        log.warning("Wiki unreachable: %s", exc)

    # 2. Collect item URLs
    item_urls: list[str] = []
    if wiki_available:
        item_urls = scrape_index(index_soup)  # type: ignore[possibly-undefined]
        if not item_urls:
            log.warning(
                "No item URLs found on category page. "
                "Wiki structure may have changed — update scrape_index()."
            )
            wiki_available = False

    # In dry-run mode, cap at DRY_RUN_ITEM_LIMIT to avoid hammering the wiki
    if args.dry_run and item_urls:
        item_urls = item_urls[:DRY_RUN_ITEM_LIMIT]
        log.info("Dry run: limiting to %d item page(s)", len(item_urls))

    # 3. Scrape item pages (or fall back to public/data)
    if wiki_available:
        for url in item_urls:
            try:
                soup = fetch(url, session)
                item = scrape_item_page(url, soup)
                if item:
                    items.append(item)
                    log.info("  ✓ %s", item["name"])
            except Exception as exc:
                log.error("  ✗ Failed to scrape %s: %s", url, exc)
    else:
        if not args.dry_run:
            items = load_fallback_items()

    log.info("Scraped/loaded %d items total", len(items))

    # 4. Apply manual overrides
    if args.merge and items:
        log.info("Merging manual overrides from %s", OVERRIDES_PATH)
        items = apply_overrides(items, OVERRIDES_PATH)

    # 5. Build output document
    output: dict[str, Any] = {
        "version": "1.0.0",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "items": items,
    }

    # 6. Log or write
    if args.dry_run:
        log.info("DRY RUN output (not written):")
        print(json.dumps(output, indent=2, ensure_ascii=False))
        sys.exit(0)
    else:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
            f.write("\n")
        log.info("Wrote %d items to %s", len(items), OUTPUT_PATH)
        log.info("Next: cp %s public/data/items_data.json", OUTPUT_PATH)


if __name__ == "__main__":
    main()
