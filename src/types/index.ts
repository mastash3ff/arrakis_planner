// ─── Item / Placeable types ────────────────────────────────────────────────────

export type ItemCategory =
  | 'power' // solar collectors, generators
  | 'water' // windtraps, condensers
  | 'production' // fabricators, refineries, workshops
  | 'storage' // containers, cargo depots
  | 'defense' // turrets, walls, shields
  | 'utility'; // command posts, misc structures

/** A single material and its required quantity. Used in build costs and consumables. */
export interface MaterialCost {
  item_id: string;
  quantity: number;
}

/**
 * Node in a recursive crafting tree.
 * Leaf nodes (children: []) are raw materials that cannot be crafted further.
 * Interior nodes represent craftable intermediates whose children define the recipe.
 *
 * The root of an Item's crafting_tree has item_id === Item.id and quantity === 1,
 * representing "how to build one of this item from raw materials".
 */
export interface CraftingNode {
  item_id: string;
  quantity: number;
  children: CraftingNode[];
}

/** A placeable structure in the game world. */
export interface Item {
  id: string; // unique slug, e.g. "windtrap_t1"
  name: string;
  category: ItemCategory;
  /** Direct ingredients required to place this structure. May include craftable intermediates. */
  build_cost: MaterialCost[];
  /**
   * Full recursive crafting tree down to raw materials.
   * null when all build_cost entries are already raw materials.
   */
  crafting_tree: CraftingNode | null;
  /** Net power in kW. Positive = generation, negative = consumption, 0 = neutral. */
  power_delta: number;
  /** Static water storage capacity in millilitres (e.g. Windtrap = 500 ml). */
  water_capacity: number;
  /**
   * Passive water production in ml/hr.
   * Scraped from the wiki "Water Gather Rate" field (native unit: ml/s) and
   * converted to ml/hr (×3600) so that hours_to_fill = capacity / rate.
   * E.g. Windtrap: 0.75 ml/s → 2700 ml/hr → fills 500 ml tank in ~11 min.
   */
  water_production_rate: number;
  /** Resources consumed per day while the structure is active. */
  consumables: MaterialCost[];
  /** Whether this structure can be deployed in the Deep Desert. */
  deep_desert_eligible: boolean;
  /**
   * Volume (in transport units) occupied by one of this placeable when carried.
   * Used by computeTrips() to calculate total cargo volume.
   */
  volume_per_unit: number;
  /** Set by the scraper when one or more fields could not be parsed. */
  incomplete?: boolean;
}

// ─── Build plan ────────────────────────────────────────────────────────────────

/** One line in the user's active build plan. */
export interface BuildEntry {
  item_id: string;
  quantity: number;
}

export interface BuildPlan {
  entries: BuildEntry[];
  /** When true, apply the Deep Desert 50% build cost reduction to all materials. */
  dd_mode: boolean;
}

// ─── Storage / trip planning ───────────────────────────────────────────────────

/** A single container type and how many of them are available for a run. */
export interface ContainerType {
  name: string;
  volume: number; // volume units this container holds
  count: number; // how many of this container per run
}

export interface StorageConfig {
  containers: ContainerType[];
}

export interface TripPlan {
  total_volume: number; // sum of (material_qty * volume_per_unit) for all materials
  total_capacity: number; // sum of (container.volume * container.count)
  trips: number; // Math.ceil(total_volume / total_capacity), minimum 1
}

// ─── Calculation result types ──────────────────────────────────────────────────

export interface PowerBudget {
  generation: number; // kW produced (sum of positive power_delta * qty)
  consumption: number; // kW consumed, absolute value (sum of negative power_delta * qty)
  net: number; // generation - consumption
}

export interface WaterBudget {
  total_capacity: number; // ml stored (sum of water_capacity × qty)
  production_rate: number; // ml/hr (sum of water_production_rate × qty)
  hours_to_fill: number; // total_capacity / production_rate; Infinity when rate is 0
}

// ─── Data file schema ──────────────────────────────────────────────────────────

/** Top-level shape of public/data/items_data.json */
export interface ItemsDataFile {
  version: string;
  scraped_at: string; // ISO 8601
  items: Item[];
}

// ─── Volume lookup table ───────────────────────────────────────────────────────

/**
 * Volume per unit for raw materials, in transport units.
 * Used by computeTrips() when calculating total cargo volume.
 * Fallback value for unlisted materials: 0.10.
 *
 * Sources: in-game measurement and awakening.wiki item pages.
 * Confirmed: iron_ingot 0.4, steel_ingot 0.5, silicone_block 0.1.
 * Cobalt Paste patched from 1.0 → 0.50.
 * Aluminum Ingot / Duraluminum Ingot / Plastanium Ingot: inferred — verify in-game.
 * armor_plating / industrial_pump / military_power_regulator / thermoelectric_cooler: estimated.
 */
export const VOLUME_TABLE: Record<string, number> = {
  // ── Ingots ────────────────────────────────────────────────────────────────────
  copper_ingot: 0.25,
  iron_ingot: 0.4,
  steel_ingot: 0.5,
  aluminum_ingot: 0.6,
  duraluminum_ingot: 0.9,
  plastanium_ingot: 0.9,

  // ── Processed materials ───────────────────────────────────────────────────────
  silicone_block: 0.1,
  cobalt_paste: 0.5,
  spice_melange: 0.25,

  // ── Raw stone / sand ──────────────────────────────────────────────────────────
  plastone: 1.0,
  granite_stone: 1.0,
  spice_sand: 2.0,
  iron_ore: 1.0,

  // ── Components ────────────────────────────────────────────────────────────────
  calibrated_servok: 0.1,
  complex_machinery: 0.1,
  advanced_machinery: 0.1,
  armor_plating: 0.5,
  industrial_pump: 0.1,
  military_power_regulator: 0.1,
  salvaged_metal: 0.4,
  thermoelectric_cooler: 0.1,

  // ── Sample data materials (hand-authored items_data.json) ─────────────────────
  metal_scraps: 0.4,
  sand_fiber: 0.25,
  silicon_wafer: 0.1,
  salvaged_wire: 0.1,
  polymer_resin: 0.5,
  water: 1.0,
  projectile_round: 0.1,
};

/** Fallback volume when a material_id is not in VOLUME_TABLE. */
export const VOLUME_DEFAULT = 0.1;

// ─── Transport container presets ──────────────────────────────────────────────

export const CONTAINER_PRESETS: ContainerType[] = [
  { name: 'Small Storage Box', volume: 175, count: 0 },
  { name: 'Medium Storage Box', volume: 500, count: 0 },
  { name: 'Assault Ornithopter', volume: 1000, count: 1 },
];
