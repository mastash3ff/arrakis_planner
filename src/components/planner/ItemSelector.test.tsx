import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import type { Item } from '@/types';
import ItemSelector from './ItemSelector';

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
    deep_desert_eligible: true,
    ...overrides,
  };
}

const windtrap = makeItem({ id: 'windtrap', name: 'Windtrap', category: 'water' });
const generator = makeItem({ id: 'generator', name: 'Generator', category: 'power' });
const fabricator = makeItem({
  id: 'fabricator',
  name: 'Fabricator',
  category: 'production',
  deep_desert_eligible: false,
});

const RESET_STATE = {
  allItems: [windtrap, generator, fabricator],
  isLoaded: true,
  loadError: null,
  plan: { entries: [], dd_mode: false },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ItemSelector', () => {
  beforeEach(() => {
    useBuildStore.setState(RESET_STATE);
  });

  it('renders all items when filter is empty', () => {
    render(<ItemSelector />);
    expect(screen.getByText('Windtrap')).toBeTruthy();
    expect(screen.getByText('Generator')).toBeTruthy();
    expect(screen.getByText('Fabricator')).toBeTruthy();
  });

  it('renders category headings for all present categories', () => {
    render(<ItemSelector />);
    // Each category label appears in both the heading and each item's badge row,
    // so use getAllByText and assert at least one match.
    expect(screen.getAllByText('Water').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Power').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Production').length).toBeGreaterThan(0);
  });

  it('filters items by name (case-insensitive)', () => {
    render(<ItemSelector />);
    const input = screen.getByPlaceholderText('Filter structures…');
    fireEvent.change(input, { target: { value: 'wind' } });
    expect(screen.getByText('Windtrap')).toBeTruthy();
    expect(screen.queryByText('Generator')).toBeNull();
    expect(screen.queryByText('Fabricator')).toBeNull();
  });

  it('hides category heading when all items in that category are filtered out', () => {
    render(<ItemSelector />);
    const input = screen.getByPlaceholderText('Filter structures…');
    fireEvent.change(input, { target: { value: 'wind' } });
    // 'Water' heading/badge still visible (windtrap is water)
    expect(screen.getAllByText('Water').length).toBeGreaterThan(0);
    // 'Power' heading is gone — no power items remain after filtering
    // (note: Generator also had "Power" as its category badge, which is also hidden)
    expect(screen.queryAllByText('Power')).toHaveLength(0);
  });

  it('shows no-match message when filter matches nothing', () => {
    render(<ItemSelector />);
    const input = screen.getByPlaceholderText('Filter structures…');
    fireEvent.change(input, { target: { value: 'xyzzy_nonexistent' } });
    expect(screen.getByText(/No structures match/)).toBeTruthy();
    expect(screen.queryByText('Windtrap')).toBeNull();
  });

  it('shows clear button only when filter is non-empty', () => {
    render(<ItemSelector />);
    const input = screen.getByPlaceholderText('Filter structures…');
    // No clear button initially
    expect(screen.queryByRole('button', { name: '✕' })).toBeNull();
    // Type something — clear button appears
    fireEvent.change(input, { target: { value: 'wind' } });
    expect(screen.getByRole('button', { name: '✕' })).toBeTruthy();
  });

  it('clear button resets the filter', () => {
    render(<ItemSelector />);
    const input = screen.getByPlaceholderText('Filter structures…');
    fireEvent.change(input, { target: { value: 'wind' } });
    expect(screen.queryByText('Generator')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.getByText('Generator')).toBeTruthy();
  });

  it('shows quantity badge for items already in plan', () => {
    useBuildStore.setState({
      plan: { entries: [{ item_id: 'windtrap', quantity: 3 }], dd_mode: false },
    });
    render(<ItemSelector />);
    expect(screen.getByText('×3')).toBeTruthy();
  });

  it('does not show quantity badge for items not in plan', () => {
    render(<ItemSelector />);
    expect(screen.queryByText('×1')).toBeNull();
  });

  it('shows empty state when allItems is empty', () => {
    useBuildStore.setState({ allItems: [] });
    render(<ItemSelector />);
    expect(screen.getByText(/No placeables available/)).toBeTruthy();
  });

  it('shows "base only" badge for non-DD-eligible items', () => {
    render(<ItemSelector />);
    // fabricator has deep_desert_eligible: false
    expect(screen.getByText('base only')).toBeTruthy();
  });
});
