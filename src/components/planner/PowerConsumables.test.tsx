import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import type { ConsumableItem, Item } from '@/types';
import PowerConsumables from './PowerConsumables';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'test',
    name: 'Test',
    category: 'power',
    build_cost: [],
    crafting_tree: null,
    power_delta: 350,
    water_capacity: 0,
    water_production_rate: 0,
    filter_capacity: 5,
    consumables: [],
    deep_desert_eligible: false,
    ...overrides,
  };
}

const turbineDirectional = makeItem({
  id: 'wind_turbine_directional',
  name: 'Wind Turbine Directional',
  consumables: [{ item_id: 'industrial_grade_lubricant', quantity: 16 }],
});

const turbineOmni = makeItem({
  id: 'wind_turbine_omnidirectional',
  name: 'Wind Turbine Omnidirectional',
  consumables: [{ item_id: 'low_grade_lubricant', quantity: 24 }],
});

const generator = makeItem({
  id: 'spice_powered_generator',
  name: 'Spice-Powered Generator',
  power_delta: 1000,
  consumables: [{ item_id: 'spice_infused_fuel_cell', quantity: 16 }],
});

const windtrap: Item = {
  id: 'windtrap',
  name: 'Windtrap',
  category: 'water',
  build_cost: [],
  crafting_tree: null,
  power_delta: -75,
  water_capacity: 500,
  water_production_rate: 2700,
  filter_capacity: 5,
  consumables: [{ item_id: 'makeshift_filter', quantity: 8 }],
  deep_desert_eligible: true,
};

const allConsumables: ConsumableItem[] = [
  {
    id: 'industrial_grade_lubricant',
    name: 'Industrial-grade Lubricant',
    build_cost: [
      { item_id: 'fuel_cell', quantity: 6 },
      { item_id: 'silicone_block', quantity: 4 },
    ],
  },
  {
    id: 'low_grade_lubricant',
    name: 'Low-grade Lubricant',
    build_cost: [
      { item_id: 'fuel_cell', quantity: 1 },
      { item_id: 'silicone_block', quantity: 1 },
    ],
  },
  {
    id: 'spice_infused_fuel_cell',
    name: 'Spice-infused Fuel Cell',
    build_cost: [
      { item_id: 'fuel_cell', quantity: 30 },
      { item_id: 'spice_residue', quantity: 65 },
    ],
  },
];

const RESET_STATE = {
  allItems: [turbineDirectional, turbineOmni, generator, windtrap],
  allConsumables,
  isLoaded: true,
  loadError: null,
  plan: { entries: [], dd_mode: false },
  days: 1,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PowerConsumables', () => {
  beforeEach(() => {
    useBuildStore.setState(RESET_STATE);
  });

  // ── Visibility ──────────────────────────────────────────────────────────────

  it('renders nothing when no power structures are in the plan', () => {
    const { container } = render(<PowerConsumables />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when plan has only water structures', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
    });
    const { container } = render(<PowerConsumables />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the panel when a power structure with consumables is in the plan', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    expect(screen.getByText('Power Consumables')).toBeTruthy();
  });

  // ── Consumables demand ──────────────────────────────────────────────────────

  it('shows lubricant name for Wind Turbine Directional', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    // Name appears in both demand list and queue runtime section
    expect(screen.getAllByText('Industrial-grade Lubricant').length).toBeGreaterThanOrEqual(1);
  });

  it('shows correct demand for 1 day — 16 lubricants', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
      days: 1,
    });
    render(<PowerConsumables />);
    expect(screen.getByText('16')).toBeTruthy();
  });

  it('scales demand with days', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
      days: 3,
    });
    render(<PowerConsumables />);
    // ceil(16 × 3) = 48
    expect(screen.getByText('48')).toBeTruthy();
  });

  it('excludes water structure consumables from power panel', () => {
    useBuildStore.setState({
      plan: {
        entries: [
          { item_id: 'wind_turbine_directional', quantity: 1 },
          { item_id: 'windtrap', quantity: 1 },
        ],
        dd_mode: false,
      },
    });
    render(<PowerConsumables />);
    expect(screen.queryByText(/makeshift/i)).toBeNull();
  });

  // ── Crafting costs ──────────────────────────────────────────────────────────

  it('shows raw material crafting section', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    expect(screen.getByText(/raw materials to craft consumables/i)).toBeTruthy();
    expect(screen.getByText(/fuel cell/i)).toBeTruthy();
  });

  // ── Queue runtime ───────────────────────────────────────────────────────────

  it('shows queue runtime section for turbine with filter_capacity', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    expect(screen.getByText(/full consumable queue runtime/i)).toBeTruthy();
  });

  it('shows correct runtime for industrial lubricant — 5 slots × 1.5h = 7h 30m', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    expect(screen.getByText('7h 30m')).toBeTruthy();
  });

  it('shows correct runtime for low-grade lubricant — 5 slots × 1h = 5h', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_omnidirectional', quantity: 1 }], dd_mode: false },
    });
    render(<PowerConsumables />);
    expect(screen.getByText('5h')).toBeTruthy();
  });

  // ── Days stepper syncs with store ───────────────────────────────────────────

  it('days stepper increments shared store days', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'wind_turbine_directional', quantity: 1 }], dd_mode: false },
      days: 1,
    });
    render(<PowerConsumables />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(useBuildStore.getState().days).toBe(2);
  });
});
