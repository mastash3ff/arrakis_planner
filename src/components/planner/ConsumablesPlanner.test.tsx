import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import type { Item } from '@/types';
import ConsumablesPlanner from './ConsumablesPlanner';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Item>): Item {
  return {
    id: 'test_item',
    name: 'Test Item',
    category: 'utility',
    build_cost: [],
    crafting_tree: null,
    power_delta: 0,
    water_capacity: 0,
    water_production_rate: 0,
    consumables: [],
    deep_desert_eligible: false,
    volume_per_unit: 0.1,
    ...overrides,
  };
}

// Windtrap: 1 makeshift_filter every 3 hours → ceil(24/3) = 8 per day
const windtrap = makeItem({
  id: 'windtrap',
  name: 'Windtrap',
  consumables: [{ item_id: 'makeshift_filter', quantity: 8 }],
});

// Generator: no consumables
const generator = makeItem({ id: 'generator', name: 'Generator', consumables: [] });

const RESET_STATE = {
  allItems: [windtrap, generator],
  isLoaded: true,
  loadError: null,
  plan: { entries: [], dd_mode: false },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConsumablesPlanner', () => {
  beforeEach(() => {
    useBuildStore.setState(RESET_STATE);
  });

  // ── Empty plan ──────────────────────────────────────────────────────────────

  it('shows empty-plan prompt when no entries', () => {
    render(<ConsumablesPlanner />);
    expect(screen.getByText(/Add structures to see consumable requirements/)).toBeTruthy();
  });

  // ── No consumables ──────────────────────────────────────────────────────────

  it('shows no-consumables message when items have no consumables', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'generator', quantity: 1 }], dd_mode: false },
    });
    render(<ConsumablesPlanner />);
    expect(screen.getByText(/No consumables required/)).toBeTruthy();
  });

  // ── Days counter ────────────────────────────────────────────────────────────

  it('starts at 1 day', () => {
    render(<ConsumablesPlanner />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('+ button increments days', () => {
    render(<ConsumablesPlanner />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('− button decrements days', () => {
    render(<ConsumablesPlanner />);
    // Increment to 2 first
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    // Then decrement back to 1
    fireEvent.click(screen.getByRole('button', { name: '−' }));
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('− button is disabled when days = 1', () => {
    render(<ConsumablesPlanner />);
    const decrementBtn = screen.getByRole('button', { name: '−' });
    expect(decrementBtn.hasAttribute('disabled')).toBe(true);
  });

  it('− button is enabled when days > 1', () => {
    render(<ConsumablesPlanner />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    const decrementBtn = screen.getByRole('button', { name: '−' });
    expect(decrementBtn.hasAttribute('disabled')).toBe(false);
  });

  // ── Consumables table ────────────────────────────────────────────────────────

  it('shows consumable material when plan includes item with consumables', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<ConsumablesPlanner />);
    expect(screen.getByText('makeshift filter')).toBeTruthy();
  });

  it('shows correct quantity for 1 day', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<ConsumablesPlanner />);
    // windtrap has 8 makeshift_filter per day × 1 windtrap × 1 day = 8
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('scales quantity with days', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
    });
    render(<ConsumablesPlanner />);
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    fireEvent.click(screen.getByRole('button', { name: '+' }));
    // 3 days × 8 = 24
    expect(screen.getByText('24')).toBeTruthy();
  });

  it('scales quantity with item count', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 2 }], dd_mode: false },
    });
    render(<ConsumablesPlanner />);
    // 2 windtraps × 8 per day × 1 day = 16
    expect(screen.getByText('16')).toBeTruthy();
  });
});
