import { describe, it, expect, beforeEach } from 'vitest';
import {
  useBuildStore,
  selectEntryCount,
  selectPlanItems,
  selectFlatMaterials,
  selectPowerBudget,
  selectWaterBudget,
} from '@/store/buildStore';
import { CONTAINER_PRESETS } from '@/types';
import type { Item, BuildPlan, StorageConfig } from '@/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'test_item',
    name: 'Test Item',
    category: 'utility',
    build_cost: [{ item_id: 'iron_ingot', quantity: 10 }],
    crafting_tree: null,
    power_delta: 0,
    water_capacity: 0,
    water_production_rate: 0,
    consumables: [],
    filter_capacity: null,
    deep_desert_eligible: true,
    ...overrides,
  };
}

const INITIAL_STATE = {
  allItems: [] as Item[],
  isLoaded: false,
  loadError: null,
  plan: { entries: [], dd_mode: false },
  storageConfig: { containers: [{ ...CONTAINER_PRESETS[2] }] },
};

// ─── Store actions ─────────────────────────────────────────────────────────────

describe('buildStore — actions', () => {
  beforeEach(() => {
    // Merge-reset data fields only — replacing the whole state would wipe action functions.
    useBuildStore.setState(INITIAL_STATE);
  });

  // addEntry ───────────────────────────────────────────────────────────────────

  describe('addEntry', () => {
    it('adds a new entry with quantity 1', () => {
      useBuildStore.getState().addEntry('windtrap');
      expect(useBuildStore.getState().plan.entries).toEqual([
        { item_id: 'windtrap', quantity: 1 },
      ]);
    });

    it('increments quantity when item already in plan', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().addEntry('windtrap');
      expect(useBuildStore.getState().plan.entries).toEqual([
        { item_id: 'windtrap', quantity: 2 },
      ]);
    });

    it('appends without affecting existing entries', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().addEntry('solar');
      const { entries } = useBuildStore.getState().plan;
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({ item_id: 'windtrap', quantity: 1 });
      expect(entries[1]).toEqual({ item_id: 'solar', quantity: 1 });
    });

    it('does not mutate dd_mode', () => {
      useBuildStore.setState({ plan: { entries: [], dd_mode: true } });
      useBuildStore.getState().addEntry('windtrap');
      expect(useBuildStore.getState().plan.dd_mode).toBe(true);
    });
  });

  // updateQuantity ─────────────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('updates quantity in place', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().updateQuantity('windtrap', 5);
      expect(useBuildStore.getState().plan.entries).toEqual([
        { item_id: 'windtrap', quantity: 5 },
      ]);
    });

    it('removes entry when quantity set to 0', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().updateQuantity('windtrap', 0);
      expect(useBuildStore.getState().plan.entries).toHaveLength(0);
    });

    it('removes entry when quantity is negative', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().updateQuantity('windtrap', -3);
      expect(useBuildStore.getState().plan.entries).toHaveLength(0);
    });

    it('only affects the targeted entry', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().addEntry('solar');
      useBuildStore.getState().updateQuantity('windtrap', 7);
      const { entries } = useBuildStore.getState().plan;
      expect(entries.find((e) => e.item_id === 'solar')?.quantity).toBe(1);
    });
  });

  // removeEntry ────────────────────────────────────────────────────────────────

  describe('removeEntry', () => {
    it('removes the specified entry', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().addEntry('solar');
      useBuildStore.getState().removeEntry('windtrap');
      const { entries } = useBuildStore.getState().plan;
      expect(entries).toHaveLength(1);
      expect(entries[0].item_id).toBe('solar');
    });

    it('is a no-op for an unknown item_id', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().removeEntry('nonexistent');
      expect(useBuildStore.getState().plan.entries).toHaveLength(1);
    });

    it('results in empty plan when last entry removed', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().removeEntry('windtrap');
      expect(useBuildStore.getState().plan.entries).toHaveLength(0);
    });
  });

  // toggleDDMode ───────────────────────────────────────────────────────────────

  describe('toggleDDMode', () => {
    it('toggles false → true', () => {
      useBuildStore.getState().toggleDDMode();
      expect(useBuildStore.getState().plan.dd_mode).toBe(true);
    });

    it('toggles true → false', () => {
      useBuildStore.getState().toggleDDMode();
      useBuildStore.getState().toggleDDMode();
      expect(useBuildStore.getState().plan.dd_mode).toBe(false);
    });

    it('does not affect entries', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().toggleDDMode();
      expect(useBuildStore.getState().plan.entries).toHaveLength(1);
    });
  });

  // importPlan / exportPlan ────────────────────────────────────────────────────

  describe('importPlan / exportPlan', () => {
    it('importPlan replaces entries and dd_mode', () => {
      const incoming: BuildPlan = {
        entries: [{ item_id: 'solar', quantity: 3 }],
        dd_mode: true,
      };
      useBuildStore.getState().importPlan(incoming);
      expect(useBuildStore.getState().plan).toEqual(incoming);
    });

    it('exportPlan serialises current plan as JSON', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().toggleDDMode();
      const json = useBuildStore.getState().exportPlan();
      expect(JSON.parse(json)).toEqual({
        entries: [{ item_id: 'windtrap', quantity: 1 }],
        dd_mode: true,
      });
    });

    it('round-trip: export then import restores plan', () => {
      useBuildStore.getState().addEntry('windtrap');
      useBuildStore.getState().addEntry('solar');
      const json = useBuildStore.getState().exportPlan();

      useBuildStore.setState({ plan: { entries: [], dd_mode: false } });
      useBuildStore.getState().importPlan(JSON.parse(json) as BuildPlan);

      expect(useBuildStore.getState().plan.entries).toHaveLength(2);
    });
  });

  // setStorageConfig ───────────────────────────────────────────────────────────

  describe('setStorageConfig', () => {
    it('replaces the entire storage config', () => {
      const config: StorageConfig = {
        containers: [{ name: 'Custom Box', volume: 999, count: 4 }],
      };
      useBuildStore.getState().setStorageConfig(config);
      expect(useBuildStore.getState().storageConfig).toEqual(config);
    });
  });
});

// ─── Named selectors ──────────────────────────────────────────────────────────

describe('buildStore — named selectors', () => {
  const generator = makeItem({ id: 'generator', power_delta: 200 });
  const consumer = makeItem({ id: 'consumer', power_delta: -75 });
  const cistern = makeItem({ id: 'cistern', water_capacity: 5000, water_production_rate: 100 });

  beforeEach(() => {
    useBuildStore.setState({
      ...INITIAL_STATE,
      allItems: [generator, consumer, cistern],
      isLoaded: true,
    });
  });

  // selectEntryCount ───────────────────────────────────────────────────────────

  describe('selectEntryCount', () => {
    it('returns 0 for empty plan', () => {
      expect(selectEntryCount(useBuildStore.getState())).toBe(0);
    });

    it('sums quantities across all entries', () => {
      useBuildStore.getState().addEntry('generator'); // qty 1
      useBuildStore.getState().addEntry('generator'); // qty 2
      useBuildStore.getState().addEntry('consumer');  // qty 1
      expect(selectEntryCount(useBuildStore.getState())).toBe(3);
    });

    it('returns correct count after a removal', () => {
      useBuildStore.getState().addEntry('generator');
      useBuildStore.getState().addEntry('consumer');
      useBuildStore.getState().removeEntry('generator');
      expect(selectEntryCount(useBuildStore.getState())).toBe(1);
    });
  });

  // selectPlanItems ────────────────────────────────────────────────────────────

  describe('selectPlanItems', () => {
    it('returns empty array for empty plan', () => {
      expect(selectPlanItems(useBuildStore.getState())).toEqual([]);
    });

    it('joins each entry with its Item definition', () => {
      useBuildStore.getState().addEntry('generator');
      const result = selectPlanItems(useBuildStore.getState());
      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe('generator');
      expect(result[0].entry.quantity).toBe(1);
    });

    it('silently drops entries whose item_id is not in allItems', () => {
      useBuildStore.setState({
        plan: { entries: [{ item_id: 'unknown_item', quantity: 1 }], dd_mode: false },
      });
      expect(selectPlanItems(useBuildStore.getState())).toHaveLength(0);
    });

    it('preserves plan order', () => {
      useBuildStore.getState().addEntry('generator');
      useBuildStore.getState().addEntry('consumer');
      const result = selectPlanItems(useBuildStore.getState());
      expect(result[0].item.id).toBe('generator');
      expect(result[1].item.id).toBe('consumer');
    });
  });

  // selectFlatMaterials ────────────────────────────────────────────────────────

  describe('selectFlatMaterials', () => {
    it('returns empty array for empty plan', () => {
      expect(selectFlatMaterials(useBuildStore.getState())).toEqual([]);
    });

    it('returns build costs for items in plan', () => {
      useBuildStore.getState().addEntry('generator');
      const materials = selectFlatMaterials(useBuildStore.getState());
      // generator has build_cost: [{ item_id: 'iron_ingot', quantity: 10 }]
      expect(materials).toEqual([{ item_id: 'iron_ingot', quantity: 10 }]);
    });

    it('applies DD discount when dd_mode is on', () => {
      useBuildStore.getState().addEntry('generator');
      useBuildStore.getState().toggleDDMode();
      const materials = selectFlatMaterials(useBuildStore.getState());
      // Math.ceil(10 * 0.5) = 5
      expect(materials).toEqual([{ item_id: 'iron_ingot', quantity: 5 }]);
    });
  });

  // selectPowerBudget ──────────────────────────────────────────────────────────

  describe('selectPowerBudget', () => {
    it('returns zero budget for empty plan', () => {
      const budget = selectPowerBudget(useBuildStore.getState());
      expect(budget).toEqual({ generation: 0, consumption: 0, net: 0 });
    });

    it('correctly splits generation and consumption', () => {
      useBuildStore.setState({
        plan: {
          entries: [
            { item_id: 'generator', quantity: 1 }, // +200 kW
            { item_id: 'consumer', quantity: 2 },  // -150 kW total
          ],
          dd_mode: false,
        },
      });
      const budget = selectPowerBudget(useBuildStore.getState());
      expect(budget.generation).toBe(200);
      expect(budget.consumption).toBe(150);
      expect(budget.net).toBe(50);
    });
  });

  // selectWaterBudget ──────────────────────────────────────────────────────────

  describe('selectWaterBudget', () => {
    it('returns zero budget for empty plan', () => {
      const budget = selectWaterBudget(useBuildStore.getState());
      expect(budget).toEqual({ total_capacity: 0, production_rate: 0, hours_to_fill: Infinity });
    });

    it('sums capacity and production from plan items', () => {
      useBuildStore.setState({
        plan: { entries: [{ item_id: 'cistern', quantity: 2 }], dd_mode: false },
      });
      const budget = selectWaterBudget(useBuildStore.getState());
      expect(budget.total_capacity).toBe(10000); // 5000 × 2
      expect(budget.production_rate).toBe(200);  // 100 × 2
      expect(budget.hours_to_fill).toBe(50);     // 10000 / 200
    });
  });
});

// ─── days / setDays ───────────────────────────────────────────────────────────

describe('buildStore — days', () => {
  beforeEach(() => {
    useBuildStore.setState({ days: 1 });
  });

  it('initialises to 1', () => {
    expect(useBuildStore.getState().days).toBe(1);
  });

  it('setDays updates the value', () => {
    useBuildStore.getState().setDays(7);
    expect(useBuildStore.getState().days).toBe(7);
  });

  it('setDays clamps to minimum 1 when called with 0', () => {
    useBuildStore.getState().setDays(0);
    expect(useBuildStore.getState().days).toBe(1);
  });

  it('setDays clamps to minimum 1 when called with negative value', () => {
    useBuildStore.getState().setDays(-5);
    expect(useBuildStore.getState().days).toBe(1);
  });

  it('setDays accepts large values', () => {
    useBuildStore.getState().setDays(365);
    expect(useBuildStore.getState().days).toBe(365);
  });
});
