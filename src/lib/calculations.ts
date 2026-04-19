/**
 * Pure calculation functions for Arrakis Planner.
 * No React or Zustand imports — these are testable in isolation.
 */

import type {
  BuildEntry,
  CraftingNode,
  Item,
  MaterialCost,
  PowerBudget,
  StorageConfig,
  TripPlan,
  WaterBudget,
} from '@/types';
import { VOLUME_DEFAULT, VOLUME_TABLE } from '@/types';

// ─── flattenCraftingTree ───────────────────────────────────────────────────────

/**
 * Recursively flattens a crafting tree into a deduplicated list of raw material costs.
 *
 * Leaf nodes (children: []) are raw materials and are emitted directly.
 * Interior nodes represent craftable intermediates — their children are recursed
 * with a scaled multiplier so that multi-level trees produce correct aggregate counts.
 *
 * Example: windtrap_t2 root (qty=1) → 15 metal_sheets (each 5 metal_scraps) + 3 circuit_boards
 * (each 2 metal_sheets + 3 salvaged_wire) + 40 sand_fiber.
 * flattenCraftingTree(root, 1) → [{metal_scraps: 105}, {salvaged_wire: 9}, {sand_fiber: 40}]
 *
 * @param node - Root of the crafting tree (or any subtree during recursion).
 * @param multiplier - Scales all quantities. Pass entry.quantity when calling from sumBuildCost.
 * @returns Deduplicated MaterialCost[] of raw ingredients only.
 */
export function flattenCraftingTree(node: CraftingNode, multiplier = 1): MaterialCost[] {
  const effectiveQty = node.quantity * multiplier;

  if (node.children.length === 0) {
    return [{ item_id: node.item_id, quantity: effectiveQty }];
  }

  const result: MaterialCost[] = [];
  for (const child of node.children) {
    const childMats = flattenCraftingTree(child, effectiveQty);
    for (const mat of childMats) {
      const existing = result.find((r) => r.item_id === mat.item_id);
      if (existing) {
        existing.quantity += mat.quantity;
      } else {
        result.push({ ...mat });
      }
    }
  }
  return result;
}

// ─── sumBuildCost ─────────────────────────────────────────────────────────────

/**
 * Aggregates the total raw material cost for an entire build plan.
 *
 * For each BuildEntry, resolves the Item then either:
 * - Flattens its crafting_tree (if present) via flattenCraftingTree, or
 * - Uses build_cost directly (when all materials are already raw).
 * Results are scaled by entry.quantity, deduplicated across all entries.
 * If ddMode is true, passes through applyDDDiscount() before returning.
 *
 * Entries referencing unknown item_ids or with quantity <= 0 are silently skipped.
 *
 * @param entries - The user's current build plan entries.
 * @param items - Full item catalogue loaded from items_data.json.
 * @param ddMode - When true, applies the Deep Desert 50% cost reduction.
 * @returns Deduplicated raw material list sorted by quantity descending.
 */
export function sumBuildCost(entries: BuildEntry[], items: Item[], ddMode: boolean): MaterialCost[] {
  const totals: MaterialCost[] = [];

  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const item = items.find((i) => i.id === entry.item_id);
    if (!item) continue;

    let mats: MaterialCost[];
    if (item.crafting_tree) {
      mats = flattenCraftingTree(item.crafting_tree, entry.quantity);
    } else {
      mats = item.build_cost.map((bc) => ({
        item_id: bc.item_id,
        quantity: bc.quantity * entry.quantity,
      }));
    }

    for (const mat of mats) {
      const existing = totals.find((t) => t.item_id === mat.item_id);
      if (existing) {
        existing.quantity += mat.quantity;
      } else {
        totals.push({ ...mat });
      }
    }
  }

  const result = ddMode ? applyDDDiscount(totals) : totals;
  return result.sort((a, b) => b.quantity - a.quantity);
}

// ─── applyDDDiscount ──────────────────────────────────────────────────────────

/**
 * Applies the Deep Desert 50% build cost reduction.
 *
 * All material quantities are multiplied by 0.5 and Math.ceil()-ed.
 * No material exemptions — spice, water, and all components are reduced equally.
 * The game rounds up (never down), hence ceil rather than floor.
 *
 * @param costs - MaterialCost[] to discount.
 * @returns New array with ceil(qty * 0.5) quantities; original is not mutated.
 */
export function applyDDDiscount(costs: MaterialCost[]): MaterialCost[] {
  return costs.map((c) => ({
    item_id: c.item_id,
    quantity: Math.ceil(c.quantity * 0.5),
  }));
}

// ─── computePowerBudget ───────────────────────────────────────────────────────

/**
 * Computes the net power balance for a build plan.
 *
 * Items with positive power_delta contribute to generation;
 * items with negative power_delta contribute to consumption.
 * net = generation - consumption (positive = surplus, negative = deficit).
 * Items with power_delta === 0 affect neither bucket.
 *
 * @param entries - Build plan entries.
 * @param items - Full item catalogue.
 * @returns PowerBudget with generation, consumption (absolute value), and net.
 */
export function computePowerBudget(entries: BuildEntry[], items: Item[]): PowerBudget {
  let generation = 0;
  let consumption = 0;

  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const item = items.find((i) => i.id === entry.item_id);
    if (!item) continue;

    const total = item.power_delta * entry.quantity;
    if (total > 0) {
      generation += total;
    } else if (total < 0) {
      consumption += Math.abs(total);
    }
  }

  return { generation, consumption, net: generation - consumption };
}

// ─── computeWaterBudget ───────────────────────────────────────────────────────

/**
 * Computes the total water capacity and passive production rate for a build plan.
 *
 * water_capacity is static storage (ml); water_production_rate is passive
 * production (ml/hr) typically from Windtraps.
 * hours_to_fill = total_capacity / production_rate; Infinity when rate is 0.
 *
 * @param entries - Build plan entries.
 * @param items - Full item catalogue.
 * @returns WaterBudget with total_capacity, production_rate, and hours_to_fill.
 */
export function computeWaterBudget(entries: BuildEntry[], items: Item[]): WaterBudget {
  let total_capacity = 0;
  let production_rate = 0;

  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const item = items.find((i) => i.id === entry.item_id);
    if (!item) continue;

    total_capacity += item.water_capacity * entry.quantity;
    production_rate += item.water_production_rate * entry.quantity;
  }

  const hours_to_fill = production_rate > 0 ? total_capacity / production_rate : Infinity;
  return { total_capacity, production_rate, hours_to_fill };
}

// ─── computeConsumables ───────────────────────────────────────────────────────

/**
 * Computes total consumable burn across all active structures for N days.
 *
 * Each Item.consumables entry is a per-day cost scaled by entry.quantity and days.
 * Results are Math.ceil()-ed and deduplicated.
 * Returns empty array when days <= 0.
 *
 * @param entries - Build plan entries.
 * @param items - Full item catalogue.
 * @param days - Planning horizon in days.
 * @returns Deduplicated MaterialCost[] for the full planning period.
 */
export function computeConsumables(entries: BuildEntry[], items: Item[], days: number): MaterialCost[] {
  if (days <= 0) return [];

  const totals: MaterialCost[] = [];

  for (const entry of entries) {
    if (entry.quantity <= 0) continue;
    const item = items.find((i) => i.id === entry.item_id);
    if (!item || item.consumables.length === 0) continue;

    for (const consumable of item.consumables) {
      const qty = Math.ceil(consumable.quantity * entry.quantity * days);
      const existing = totals.find((t) => t.item_id === consumable.item_id);
      if (existing) {
        existing.quantity += qty;
      } else {
        totals.push({ item_id: consumable.item_id, quantity: qty });
      }
    }
  }

  return totals.sort((a, b) => b.quantity - a.quantity);
}

// ─── computeTrips ─────────────────────────────────────────────────────────────

/**
 * Computes the number of transport runs required to haul all build materials.
 *
 * For each material, looks up its volume in VOLUME_TABLE (fallback: VOLUME_DEFAULT).
 * total_volume = sum of (qty * volume) across all materials.
 * total_capacity = sum of (container.volume * container.count) across all containers.
 * trips = Math.ceil(total_volume / total_capacity), minimum 1 when materials exist.
 *
 * Edge cases:
 * - materials is empty → trips: 0, total_volume: 0.
 * - total_capacity <= 0 → throws RangeError (no containers configured).
 *
 * @param materials - Flat list of raw materials (output of sumBuildCost).
 * @param config - Container configuration for the transport run.
 * @returns TripPlan with total_volume, total_capacity, and trips.
 */
export function computeTrips(materials: MaterialCost[], config: StorageConfig): TripPlan {
  if (materials.length === 0) {
    const total_capacity = config.containers.reduce((s, c) => s + c.volume * c.count, 0);
    return { total_volume: 0, total_capacity, trips: 0 };
  }

  const total_capacity = config.containers.reduce((s, c) => s + c.volume * c.count, 0);

  if (total_capacity <= 0) {
    throw new RangeError('StorageConfig total capacity must be > 0 — add at least one container');
  }

  const total_volume = materials.reduce((sum, mat) => {
    const vol = VOLUME_TABLE[mat.item_id] ?? VOLUME_DEFAULT;
    return sum + mat.quantity * vol;
  }, 0);

  const trips = Math.ceil(total_volume / total_capacity);
  return { total_volume, total_capacity, trips };
}

// ─── formatFillTime ───────────────────────────────────────────────────────────

/**
 * Formats a water fill-time in hours into a human-readable string.
 *
 * Returns null when hours is Infinity (no production rate — caller decides label).
 * Returns "X.Xh" format for values under 24 hours.
 * Returns "Xd Yh" format for 24 hours or more.
 *
 * Note: Math.round on the remainder can produce "Xd 24h" at exact half-hour
 * boundaries (e.g. 47.5h → "1d 24h"). This matches the existing display
 * convention and is preserved intentionally.
 *
 * @param hours - Fill time in hours (output of computeWaterBudget().hours_to_fill).
 * @returns Formatted string, or null for Infinity.
 */
export function formatFillTime(hours: number): string | null {
  if (hours === Infinity) return null;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

/**
 * Format a duration in hours as a human-readable string, handling fractional hours.
 * Used for filter/consumable queue runtime display.
 * @example formatRuntime(7.5) → "7h 30m"
 * @example formatRuntime(120) → "5d"
 * @example formatRuntime(7.5 * 5) → "1d 13h 30m"
 */
export function formatRuntime(hours: number): string {
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  const wholeHrs = Math.floor(remainingHours);
  const mins = Math.round((remainingHours - wholeHrs) * 60);
  const timePart = mins > 0 ? `${wholeHrs}h ${mins}m` : wholeHrs > 0 ? `${wholeHrs}h` : '';
  if (days === 0) return timePart || '0h';
  return timePart ? `${days}d ${timePart}` : `${days}d`;
}
