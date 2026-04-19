import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import type { ConsumableItem, Item } from '@/types';
import WaterPlanner from './WaterPlanner';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'cistern',
    name: 'Water Cistern',
    category: 'water',
    build_cost: [],
    crafting_tree: null,
    power_delta: 0,
    water_capacity: 5000,
    water_production_rate: 0,
    filter_capacity: null,
    consumables: [],
    deep_desert_eligible: true,
    ...overrides,
  };
}

const largeWindtrap = makeItem({
  id: 'large_windtrap',
  name: 'Large Windtrap',
  water_capacity: 500,
  water_production_rate: 6300,
  filter_capacity: 5,
  consumables: [
    { item_id: 'particulate_filter', quantity: 2 },
    { item_id: 'advanced_particulate_filter', quantity: 1 },
  ],
});

const windtrap = makeItem({
  id: 'windtrap',
  name: 'Windtrap',
  water_capacity: 500,
  water_production_rate: 2700,
  filter_capacity: 5,
  consumables: [{ item_id: 'makeshift_filter', quantity: 8 }],
});

const cistern = makeItem({
  id: 'cistern',
  name: 'Water Cistern',
  water_production_rate: 0,
  filter_capacity: null,
  consumables: [],
});

const turbine: Item = {
  id: 'turbine',
  name: 'Wind Turbine',
  category: 'power',
  build_cost: [],
  crafting_tree: null,
  power_delta: 350,
  water_capacity: 0,
  water_production_rate: 0,
  filter_capacity: 5,
  consumables: [{ item_id: 'lubricant', quantity: 16 }],
  deep_desert_eligible: false,
};

const allConsumables: ConsumableItem[] = [
  {
    id: 'particulate_filter',
    name: 'Particulate Filter',
    build_cost: [
      { item_id: 'duraluminum_ingot', quantity: 6 },
      { item_id: 'plant_fiber', quantity: 15 },
    ],
  },
  {
    id: 'advanced_particulate_filter',
    name: 'Advanced Particulate Filter',
    build_cost: [
      { item_id: 'plastanium_ingot', quantity: 8 },
      { item_id: 'plant_fiber', quantity: 20 },
    ],
  },
];

const RESET_STATE = {
  allItems: [largeWindtrap, windtrap, cistern, turbine],
  allConsumables,
  isLoaded: true,
  loadError: null,
  plan: { entries: [], dd_mode: false },
  days: 1,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WaterPlanner', () => {
  beforeEach(() => {
    useBuildStore.setState(RESET_STATE);
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('shows placeholder when no water structures are in the plan', () => {
    render(<WaterPlanner />);
    expect(screen.getByText(/Add windtraps or other water structures/)).toBeTruthy();
  });

  it('shows placeholder when only non-water structures are in the plan', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'turbine', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText(/Add windtraps or other water structures/)).toBeTruthy();
  });

  // ── Water output ────────────────────────────────────────────────────────────

  it('shows correct total water for 1 Large Windtrap over 1 day', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    // 6300 L/hr × 24 hr × 1 day = 151,200
    expect(screen.getByText('151,200 L')).toBeTruthy();
  });

  it('scales total water with days', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
      days: 7,
    });
    render(<WaterPlanner />);
    // 6300 × 24 × 7 = 1,058,400
    expect(screen.getByText('1,058,400 L')).toBeTruthy();
  });

  it('shows production rate', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText('6,300 L/hr')).toBeTruthy();
  });

  it('cistern-only plan shows 0 L produced (no production rate)', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'cistern', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText('0 L')).toBeTruthy();
  });

  it('shows storage capacity when water structures have water_capacity', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'cistern', quantity: 2 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    // cistern water_capacity = 5000, × 2 = 10,000
    expect(screen.getByText('10,000 L')).toBeTruthy();
    expect(screen.getByText('Storage capacity')).toBeTruthy();
  });

  it('hides storage capacity row when all water structures have zero capacity', () => {
    // windtrap in the fixture has water_capacity: 500, so use a structure with 0 capacity
    const zeroCapItem = makeItem({ id: 'zero_cap', name: 'Zero Cap', water_capacity: 0 });
    useBuildStore.setState({
      allItems: [largeWindtrap, windtrap, cistern, turbine, zeroCapItem],
      plan: { entries: [{ item_id: 'zero_cap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.queryByText('Storage capacity')).toBeNull();
  });

  // ── Days stepper ────────────────────────────────────────────────────────────

  it('days stepper increments shared store days', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
      days: 1,
    });
    render(<WaterPlanner />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(useBuildStore.getState().days).toBe(2);
  });

  it('days stepper − button is disabled at 1', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
      days: 1,
    });
    render(<WaterPlanner />);
    expect(screen.getByRole('button', { name: '−' }).hasAttribute('disabled')).toBe(true);
  });

  // ── Filters required ────────────────────────────────────────────────────────

  it('shows filter names using ConsumableItem.name when available', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    // Names appear in both "filters required" and "queue runtime" sections
    expect(screen.getAllByText('Particulate Filter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Advanced Particulate Filter').length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct filter quantities for 1 day', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
      days: 1,
    });
    render(<WaterPlanner />);
    // particulate: 2/day × 1 = 2; advanced: 1/day × 1 = 1
    const quantities = screen.getAllByText(/^[12]$/);
    expect(quantities.length).toBeGreaterThanOrEqual(2);
  });

  it('shows no filter consumables message for cistern-only plan', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'cistern', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText(/No filter consumables required/)).toBeTruthy();
  });

  it('excludes non-water structure consumables from filters section', () => {
    useBuildStore.setState({
      plan: {
        entries: [
          { item_id: 'large_windtrap', quantity: 1 },
          { item_id: 'turbine', quantity: 1 },
        ],
        dd_mode: false,
      },
    });
    render(<WaterPlanner />);
    expect(screen.queryByText(/lubricant/i)).toBeNull();
  });

  // ── Raw materials to craft filters ─────────────────────────────────────────

  it('shows crafting material section when filters are needed', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText(/raw materials to craft filters/i)).toBeTruthy();
    expect(screen.getByText(/plant fiber/i)).toBeTruthy();
  });

  // ── Filter queue runtime ────────────────────────────────────────────────────

  it('shows filter queue runtime section for windtrap with filter_capacity', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText(/full filter queue runtime/i)).toBeTruthy();
  });

  it('shows correct queue runtime for APF — 5 slots × 24h = 5d', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText('5d')).toBeTruthy();
  });

  it('shows correct queue runtime for PF — 5 slots × 12h = 2d 12h', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.getByText('2d 12h')).toBeTruthy();
  });

  it('hides filter queue section for cistern (no filter_capacity)', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'cistern', quantity: 1 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    expect(screen.queryByText(/full filter queue runtime/i)).toBeNull();
  });

  // ── Per-structure breakdown ─────────────────────────────────────────────────

  it('shows per-structure breakdown when multiple water structure types are present', () => {
    useBuildStore.setState({
      plan: {
        entries: [
          { item_id: 'large_windtrap', quantity: 1 },
          { item_id: 'windtrap', quantity: 2 },
        ],
        dd_mode: false,
      },
      days: 1,
    });
    render(<WaterPlanner />);
    // Breakdown rows include "L/hr ·" — unique to per-structure section
    const breakdownRows = screen.getAllByText(/L\/hr ·/);
    expect(breakdownRows).toHaveLength(2);
  });

  it('hides per-structure breakdown when only one water structure type is present', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'large_windtrap', quantity: 2 }], dd_mode: false },
    });
    render(<WaterPlanner />);
    // The breakdown rows include "L/hr ·" — absent when only one structure type
    expect(screen.queryByText(/L\/hr ·/)).toBeNull();
  });
});
