import { describe, expect, it } from 'vitest';
import {
  applyDDDiscount,
  computeConsumables,
  computePowerBudget,
  computeTrips,
  computeWaterBudget,
  flattenCraftingTree,
  formatFillTime,
  formatRuntime,
  sumBuildCost,
} from './calculations';
import type { BuildEntry, CraftingNode, Item, MaterialCost, StorageConfig } from '@/types';

// ─── Test fixtures ─────────────────────────────────────────────────────────────

/** Windtrap T1 — all raw materials, no crafting tree. */
const windtrapT1: Item = {
  id: 'windtrap_t1',
  name: 'Windtrap T1',
  category: 'water',
  build_cost: [
    { item_id: 'metal_scraps', quantity: 50 },
    { item_id: 'sand_fiber', quantity: 30 },
  ],
  crafting_tree: null,
  power_delta: -5,
  water_capacity: 500,
  water_production_rate: 50,
  consumables: [],
  filter_capacity: null,
    deep_desert_eligible: true,
};

/** Windtrap T2 — has crafting tree with two-level intermediates. */
const windtrapT2: Item = {
  id: 'windtrap_t2',
  name: 'Windtrap T2',
  category: 'water',
  build_cost: [
    { item_id: 'metal_sheet', quantity: 15 },
    { item_id: 'circuit_board', quantity: 3 },
    { item_id: 'sand_fiber', quantity: 40 },
  ],
  crafting_tree: {
    item_id: 'windtrap_t2',
    quantity: 1,
    children: [
      {
        item_id: 'metal_sheet',
        quantity: 15,
        children: [{ item_id: 'metal_scraps', quantity: 5, children: [] }],
      },
      {
        item_id: 'circuit_board',
        quantity: 3,
        children: [
          {
            item_id: 'metal_sheet',
            quantity: 2,
            children: [{ item_id: 'metal_scraps', quantity: 5, children: [] }],
          },
          { item_id: 'salvaged_wire', quantity: 3, children: [] },
        ],
      },
      { item_id: 'sand_fiber', quantity: 40, children: [] },
    ],
  },
  power_delta: -20,
  water_capacity: 2500,
  water_production_rate: 250,
  consumables: [],
  filter_capacity: null,
    deep_desert_eligible: true,
};

/** Solar collector — generates power. */
const solarCollector: Item = {
  id: 'solar_collector',
  name: 'Solar Collector',
  category: 'power',
  build_cost: [
    { item_id: 'metal_sheet', quantity: 25 },
    { item_id: 'silicon_wafer', quantity: 20 },
  ],
  crafting_tree: {
    item_id: 'solar_collector',
    quantity: 1,
    children: [
      {
        item_id: 'metal_sheet',
        quantity: 25,
        children: [{ item_id: 'metal_scraps', quantity: 5, children: [] }],
      },
      { item_id: 'silicon_wafer', quantity: 20, children: [] },
    ],
  },
  power_delta: 30,
  water_capacity: 0,
  water_production_rate: 0,
  consumables: [],
  filter_capacity: null,
    deep_desert_eligible: true,
};

/** Spice refinery — consumes water per day. */
const spiceRefinery: Item = {
  id: 'spice_refinery',
  name: 'Spice Refinery',
  category: 'production',
  build_cost: [{ item_id: 'metal_scraps', quantity: 100 }],
  crafting_tree: null,
  power_delta: -40,
  water_capacity: 0,
  water_production_rate: 0,
  consumables: [{ item_id: 'water', quantity: 200 }],
  filter_capacity: null,
    deep_desert_eligible: true,
};

const ALL_ITEMS: Item[] = [windtrapT1, windtrapT2, solarCollector, spiceRefinery];

const defaultContainers: StorageConfig = {
  containers: [{ name: 'Assault Ornithopter', volume: 1000, count: 1 }],
};

// ─── flattenCraftingTree ───────────────────────────────────────────────────────

describe('flattenCraftingTree', () => {
  it('returns raw material for a leaf node with multiplier 1', () => {
    const leaf: CraftingNode = { item_id: 'metal_scraps', quantity: 50, children: [] };
    expect(flattenCraftingTree(leaf, 1)).toEqual([{ item_id: 'metal_scraps', quantity: 50 }]);
  });

  it('scales leaf by multiplier', () => {
    const leaf: CraftingNode = { item_id: 'metal_scraps', quantity: 5, children: [] };
    expect(flattenCraftingTree(leaf, 10)).toEqual([{ item_id: 'metal_scraps', quantity: 50 }]);
  });

  it('flattens a two-level tree for 1x windtrap_t2', () => {
    const root = windtrapT2.crafting_tree!;
    const result = flattenCraftingTree(root, 1);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    // 15 metal_sheets * 5 scraps + 3 circuit_boards * (2 metal_sheets * 5 scraps) = 75 + 30 = 105
    expect(byId['metal_scraps']).toBe(105);
    // 3 circuit_boards * 3 wire = 9
    expect(byId['salvaged_wire']).toBe(9);
    // direct sand_fiber
    expect(byId['sand_fiber']).toBe(40);
    // no intermediate nodes in output
    expect(byId['metal_sheet']).toBeUndefined();
    expect(byId['circuit_board']).toBeUndefined();
  });

  it('scales correctly for 3x windtrap_t2', () => {
    const root = windtrapT2.crafting_tree!;
    const result = flattenCraftingTree(root, 3);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['metal_scraps']).toBe(315); // 105 * 3
    expect(byId['salvaged_wire']).toBe(27); // 9 * 3
    expect(byId['sand_fiber']).toBe(120); // 40 * 3
  });
});

// ─── sumBuildCost ─────────────────────────────────────────────────────────────

describe('sumBuildCost', () => {
  it('returns empty array for empty plan', () => {
    expect(sumBuildCost([], ALL_ITEMS, false)).toEqual([]);
  });

  it('uses build_cost directly when crafting_tree is null', () => {
    const entries: BuildEntry[] = [{ item_id: 'windtrap_t1', quantity: 2 }];
    const result = sumBuildCost(entries, ALL_ITEMS, false);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['metal_scraps']).toBe(100); // 50 * 2
    expect(byId['sand_fiber']).toBe(60); // 30 * 2
  });

  it('flattens crafting_tree when present', () => {
    const entries: BuildEntry[] = [{ item_id: 'windtrap_t2', quantity: 1 }];
    const result = sumBuildCost(entries, ALL_ITEMS, false);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['metal_scraps']).toBe(105);
    expect(byId['salvaged_wire']).toBe(9);
    expect(byId['sand_fiber']).toBe(40);
  });

  it('deduplicates across multiple entries sharing materials', () => {
    const entries2: BuildEntry[] = [
      { item_id: 'windtrap_t1', quantity: 1 }, // 50 metal_scraps
      { item_id: 'solar_collector', quantity: 1 }, // 125 metal_scraps
    ];
    const result = sumBuildCost(entries2, ALL_ITEMS, false);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['metal_scraps']).toBe(175); // 50 + 125
  });

  it('skips entries with unknown item_id', () => {
    const entries: BuildEntry[] = [{ item_id: 'nonexistent_item', quantity: 5 }];
    expect(sumBuildCost(entries, ALL_ITEMS, false)).toEqual([]);
  });

  it('skips entries with quantity 0', () => {
    const entries: BuildEntry[] = [{ item_id: 'windtrap_t1', quantity: 0 }];
    expect(sumBuildCost(entries, ALL_ITEMS, false)).toEqual([]);
  });

  it('applies DD discount when ddMode is true', () => {
    const entries: BuildEntry[] = [{ item_id: 'windtrap_t1', quantity: 1 }];
    const result = sumBuildCost(entries, ALL_ITEMS, true);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['metal_scraps']).toBe(25); // ceil(50 * 0.5)
    expect(byId['sand_fiber']).toBe(15); // ceil(30 * 0.5)
  });
});

// ─── applyDDDiscount ──────────────────────────────────────────────────────────

describe('applyDDDiscount', () => {
  it('halves and ceils all quantities', () => {
    const costs: MaterialCost[] = [
      { item_id: 'iron', quantity: 100 },
      { item_id: 'spice', quantity: 7 }, // ceil(7 * 0.5) = ceil(3.5) = 4
      { item_id: 'water', quantity: 1 }, // ceil(0.5) = 1
    ];
    const result = applyDDDiscount(costs);
    const byId = Object.fromEntries(result.map((r) => [r.item_id, r.quantity]));
    expect(byId['iron']).toBe(50);
    expect(byId['spice']).toBe(4);
    expect(byId['water']).toBe(1);
  });

  it('does not mutate the input array', () => {
    const costs: MaterialCost[] = [{ item_id: 'iron', quantity: 100 }];
    applyDDDiscount(costs);
    expect(costs[0].quantity).toBe(100);
  });

  it('returns empty array for empty input', () => {
    expect(applyDDDiscount([])).toEqual([]);
  });

  it('ceil rounds up (game never rounds down)', () => {
    const costs: MaterialCost[] = [{ item_id: 'x', quantity: 3 }];
    // ceil(3 * 0.5) = ceil(1.5) = 2
    expect(applyDDDiscount(costs)[0].quantity).toBe(2);
  });
});

// ─── computePowerBudget ───────────────────────────────────────────────────────

describe('computePowerBudget', () => {
  it('returns zeros for empty plan', () => {
    const budget = computePowerBudget([], ALL_ITEMS);
    expect(budget).toEqual({ generation: 0, consumption: 0, net: 0 });
  });

  it('correctly splits generators and consumers', () => {
    const entries: BuildEntry[] = [
      { item_id: 'solar_collector', quantity: 2 }, // +30 each = +60
      { item_id: 'windtrap_t1', quantity: 1 }, //  -5 each = -5
    ];
    const budget = computePowerBudget(entries, ALL_ITEMS);
    expect(budget.generation).toBe(60);
    expect(budget.consumption).toBe(5);
    expect(budget.net).toBe(55);
  });

  it('reports negative net when consumption exceeds generation', () => {
    const entries: BuildEntry[] = [
      { item_id: 'windtrap_t2', quantity: 3 }, // -20 each = -60
    ];
    const budget = computePowerBudget(entries, ALL_ITEMS);
    expect(budget.generation).toBe(0);
    expect(budget.consumption).toBe(60);
    expect(budget.net).toBe(-60);
  });
});

// ─── computeWaterBudget ───────────────────────────────────────────────────────

describe('computeWaterBudget', () => {
  it('returns zeros for empty plan', () => {
    const budget = computeWaterBudget([], ALL_ITEMS);
    expect(budget.total_capacity).toBe(0);
    expect(budget.production_rate).toBe(0);
    expect(budget.hours_to_fill).toBe(Infinity);
  });

  it('sums capacity and rate across multiple items', () => {
    const entries: BuildEntry[] = [
      { item_id: 'windtrap_t1', quantity: 2 }, // 500 * 2 = 1000 L, 50 L/hr * 2 = 100 L/hr
      { item_id: 'windtrap_t2', quantity: 1 }, // 2500 L, 250 L/hr
    ];
    const budget = computeWaterBudget(entries, ALL_ITEMS);
    expect(budget.total_capacity).toBe(3500);
    expect(budget.production_rate).toBe(350);
    expect(budget.hours_to_fill).toBe(10); // 3500 / 350
  });

  it('hours_to_fill is Infinity when production_rate is 0', () => {
    const entries: BuildEntry[] = [{ item_id: 'solar_collector', quantity: 1 }];
    const budget = computeWaterBudget(entries, ALL_ITEMS);
    expect(budget.hours_to_fill).toBe(Infinity);
  });
});

// ─── computeConsumables ───────────────────────────────────────────────────────

describe('computeConsumables', () => {
  it('returns empty array for 0 days', () => {
    const entries: BuildEntry[] = [{ item_id: 'spice_refinery', quantity: 1 }];
    expect(computeConsumables(entries, ALL_ITEMS, 0)).toEqual([]);
  });

  it('returns empty array for items with no consumables', () => {
    const entries: BuildEntry[] = [{ item_id: 'windtrap_t1', quantity: 5 }];
    expect(computeConsumables(entries, ALL_ITEMS, 7)).toEqual([]);
  });

  it('scales consumable by quantity and days', () => {
    const entries: BuildEntry[] = [{ item_id: 'spice_refinery', quantity: 2 }];
    const result = computeConsumables(entries, ALL_ITEMS, 3);
    // 200 water/day * 2 refineries * 3 days = 1200
    expect(result[0]).toEqual({ item_id: 'water', quantity: 1200 });
  });
});

// ─── computeTrips ─────────────────────────────────────────────────────────────

describe('computeTrips', () => {
  it('returns 0 trips for empty materials list', () => {
    const plan = computeTrips([], defaultContainers);
    expect(plan.trips).toBe(0);
    expect(plan.total_volume).toBe(0);
  });

  it('throws when total container capacity is 0', () => {
    const materials: MaterialCost[] = [{ item_id: 'metal_scraps', quantity: 10 }];
    const zeroCap: StorageConfig = { containers: [{ name: 'Box', volume: 500, count: 0 }] };
    expect(() => computeTrips(materials, zeroCap)).toThrow(RangeError);
  });

  it('computes trips using VOLUME_TABLE for known materials', () => {
    // metal_scraps: 0.40 volume each
    const materials: MaterialCost[] = [{ item_id: 'metal_scraps', quantity: 1000 }];
    // total_volume = 1000 * 0.40 = 400; capacity = 1000; ceil(400/1000) = 1
    const plan = computeTrips(materials, defaultContainers);
    expect(plan.total_volume).toBeCloseTo(400);
    expect(plan.total_capacity).toBe(1000);
    expect(plan.trips).toBe(1);
  });

  it('uses VOLUME_DEFAULT (0.10) for unknown material ids', () => {
    const materials: MaterialCost[] = [{ item_id: 'unknown_material_xyz', quantity: 50 }];
    // total_volume = 50 * 0.10 = 5; capacity 1000; trips = 1
    const plan = computeTrips(materials, defaultContainers);
    expect(plan.total_volume).toBeCloseTo(5);
    expect(plan.trips).toBe(1);
  });

  it('trips is minimum 1 for a partial load (never returns 0 when materials exist)', () => {
    // Very small load, well within one trip
    const materials: MaterialCost[] = [{ item_id: 'metal_scraps', quantity: 1 }];
    const plan = computeTrips(materials, defaultContainers);
    // 1 * 0.40 = 0.40 volume, capacity 1000 → ceil(0.40/1000) = 1
    expect(plan.trips).toBe(1);
  });

  it('rounds up to next trip when load exceeds capacity', () => {
    // 3000 metal_scraps * 0.40 = 1200 volume; capacity 1000; ceil(1200/1000) = 2
    const materials: MaterialCost[] = [{ item_id: 'metal_scraps', quantity: 3000 }];
    const plan = computeTrips(materials, defaultContainers);
    expect(plan.trips).toBe(2);
  });

  it('sums multiple container types', () => {
    const config: StorageConfig = {
      containers: [
        { name: 'Small Box', volume: 175, count: 2 }, // 350
        { name: 'Ornithopter', volume: 1000, count: 1 }, // 1000
      ],
    };
    // 3000 * 0.40 = 1200; total_capacity = 1350; ceil(1200/1350) = 1
    const materials: MaterialCost[] = [{ item_id: 'metal_scraps', quantity: 3000 }];
    const plan = computeTrips(materials, config);
    expect(plan.total_capacity).toBe(1350);
    expect(plan.trips).toBe(1);
  });
});

// ─── formatFillTime ───────────────────────────────────────────────────────────

describe('formatFillTime', () => {
  it('returns null for Infinity', () => {
    expect(formatFillTime(Infinity)).toBeNull();
  });

  it('formats 0h as "0.0h"', () => {
    expect(formatFillTime(0)).toBe('0.0h');
  });

  it('formats a sub-24h decimal value', () => {
    expect(formatFillTime(12.5)).toBe('12.5h');
  });

  it('formats just under 24h boundary', () => {
    expect(formatFillTime(23.9)).toBe('23.9h');
  });

  it('formats exactly 24h as "1d 0h"', () => {
    expect(formatFillTime(24)).toBe('1d 0h');
  });

  it('formats 48h as "2d 0h"', () => {
    expect(formatFillTime(48)).toBe('2d 0h');
  });

  it('formats an over-24h value correctly — not toFixed(1)d', () => {
    // 25.7h → 1 full day + 1.7h → "1d 2h" (Math.round(1.7) = 2), not "1.1d"
    expect(formatFillTime(25.7)).toBe('1d 2h');
  });

  it('formats 50h as "2d 2h"', () => {
    expect(formatFillTime(50)).toBe('2d 2h');
  });

  it('preserves the 47.5h edge case as "1d 24h" (Math.round behavior)', () => {
    // 47.5 % 24 = 23.5 → Math.round(23.5) = 24 — intentional, documented in JSDoc
    expect(formatFillTime(47.5)).toBe('1d 24h');
  });

  it('uses toFixed(1) for sub-24h — single decimal place', () => {
    expect(formatFillTime(6)).toBe('6.0h');
  });
});

describe('formatRuntime', () => {
  it('returns "0h" for zero hours', () => {
    expect(formatRuntime(0)).toBe('0h');
  });

  it('formats whole hours under a day', () => {
    expect(formatRuntime(5)).toBe('5h');
  });

  it('formats fractional hours with minutes — 1.5h → "1h 30m"', () => {
    expect(formatRuntime(1.5)).toBe('1h 30m');
  });

  it('formats fractional hours — 7.5h → "7h 30m"', () => {
    expect(formatRuntime(7.5)).toBe('7h 30m');
  });

  it('formats exactly one day as "1d"', () => {
    expect(formatRuntime(24)).toBe('1d');
  });

  it('formats days + whole hours — 25h → "1d 1h"', () => {
    expect(formatRuntime(25)).toBe('1d 1h');
  });

  it('formats days + fractional hours — 25.5h → "1d 1h 30m"', () => {
    expect(formatRuntime(25.5)).toBe('1d 1h 30m');
  });

  it('formats 120h (5 × 24h APF queue) as "5d"', () => {
    expect(formatRuntime(120)).toBe('5d');
  });

  it('formats 7.5h (5 slots × 1.5h lubricant) as "7h 30m"', () => {
    expect(formatRuntime(7.5)).toBe('7h 30m');
  });
});
