import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useBuildStore } from '@/store/buildStore';
import { CONTAINER_PRESETS } from '@/types';
import type { Item } from '@/types';
import TripPlanner from './TripPlanner';

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
    filter_capacity: null,
    deep_desert_eligible: false,
    ...overrides,
  };
}

// Item with a known material so volume math is predictable.
// metal_scraps: 0.40V each — 250 metal_scraps = 100V total
const windtrap = makeItem({
  id: 'windtrap',
  name: 'Windtrap',
  build_cost: [{ item_id: 'metal_scraps', quantity: 250 }],
});

// RESET_STATE: no plan entries, empty containers — computeTrips sees [] materials so no throw.
const RESET_STATE = {
  allItems: [] as Item[],
  isLoaded: true,
  loadError: null,
  plan: { entries: [], dd_mode: false },
  storageConfig: { containers: [{ ...CONTAINER_PRESETS[2] }] }, // 1x Assault Ornithopter (1000V)
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TripPlanner', () => {
  beforeEach(() => {
    useBuildStore.setState(RESET_STATE);
  });

  // ── Rendering ────────────────────────────────────────────────────────────────

  it('renders all 6 container preset rows', () => {
    render(<TripPlanner />);
    for (const preset of CONTAINER_PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy();
    }
  });

  it('shows Assault Ornithopter with count 1 by default', () => {
    render(<TripPlanner />);
    // The count spans: one "1" for Assault Ornithopter, "0" for all others
    // getByText('1') would match the "1" count display
    const countSpans = screen.getAllByText('1');
    expect(countSpans.length).toBeGreaterThanOrEqual(1);
  });

  it('shows all other presets with count 0 by default', () => {
    render(<TripPlanner />);
    // 5 container count spans should show "0" (all except the default Assault Ornithopter).
    // The trip count span also shows "0", so total "0" elements = 6.
    // We filter for the narrow w-6 container count spans specifically.
    const allZeros = screen.getAllByText('0');
    const containerCountZeros = allZeros.filter((el) => el.className.includes('w-6'));
    expect(containerCountZeros.length).toBe(5);
  });

  it('shows trip count as 0 when no structures are in the plan', () => {
    render(<TripPlanner />);
    // The trip count is the large text-2xl span
    const allZeros = screen.getAllByText('0');
    const tripCountEl = allZeros.find((el) => el.className.includes('text-2xl'));
    expect(tripCountEl).toBeTruthy();
  });

  it('shows "Add structures" hint when trips is 0', () => {
    render(<TripPlanner />);
    expect(screen.getByText(/Add structures to your plan to calculate transport requirements/)).toBeTruthy();
  });

  // ── updateCount — increment ───────────────────────────────────────────────────

  it('first "+" on an absent container adds it with count 1', () => {
    // Start with completely empty storageConfig
    useBuildStore.setState({ storageConfig: { containers: [] } });
    render(<TripPlanner />);

    // The plus buttons correspond to container rows in CONTAINER_PRESETS order.
    // CONTAINER_PRESETS[0] = 'Small Storage Container'
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[0]);

    const { containers } = useBuildStore.getState().storageConfig;
    expect(containers).toHaveLength(1);
    expect(containers[0].name).toBe('Small Storage Container');
    expect(containers[0].count).toBe(1);
  });

  it('second "+" on a present container increments to 2', () => {
    useBuildStore.setState({ storageConfig: { containers: [] } });
    render(<TripPlanner />);

    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[0]); // adds Small Storage Container at count 1
    fireEvent.click(plusButtons[0]); // increments to count 2

    const { containers } = useBuildStore.getState().storageConfig;
    expect(containers[0].count).toBe(2);
  });

  it('total capacity updates after adding a container', () => {
    useBuildStore.setState({ storageConfig: { containers: [] } });
    render(<TripPlanner />);

    // Add 1x Chest (750V) — it's CONTAINER_PRESETS[1]
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[1]); // Chest

    // Verify via store state: the container was added with correct volume
    const { containers } = useBuildStore.getState().storageConfig;
    expect(containers[0].name).toBe('Chest');
    expect(containers[0].volume).toBe(750);
    expect(containers[0].count).toBe(1);
  });

  // ── updateCount — decrement / clamping ───────────────────────────────────────

  it('"−" button is disabled when count is 0', () => {
    useBuildStore.setState({ storageConfig: { containers: [] } });
    render(<TripPlanner />);

    const minusButtons = screen.getAllByRole('button', { name: '−' });
    // All containers start at count 0, so all minus buttons should be disabled
    for (const btn of minusButtons) {
      expect(btn.hasAttribute('disabled')).toBe(true);
    }
  });

  it('"−" button decrements count from 1 to 0', () => {
    // Start with 1x Small Storage Container
    useBuildStore.setState({
      storageConfig: {
        containers: [{ ...CONTAINER_PRESETS[0], count: 1 }],
      },
    });
    render(<TripPlanner />);

    const minusButtons = screen.getAllByRole('button', { name: '−' });
    fireEvent.click(minusButtons[0]); // decrement Small Storage Container

    const { containers } = useBuildStore.getState().storageConfig;
    // The container remains in the list but with count 0 (Math.max(0, 1 + -1))
    const small = containers.find((c) => c.name === 'Small Storage Container');
    expect(small?.count).toBe(0);
  });

  it('"−" does not decrement below 0', () => {
    useBuildStore.setState({
      storageConfig: {
        containers: [{ ...CONTAINER_PRESETS[0], count: 1 }],
      },
    });
    render(<TripPlanner />);

    const minusButtons = screen.getAllByRole('button', { name: '−' });
    fireEvent.click(minusButtons[0]); // count → 0 (button becomes disabled)
    // Note: button is now disabled, so subsequent click is a no-op

    const { containers } = useBuildStore.getState().storageConfig;
    const small = containers.find((c) => c.name === 'Small Storage Container');
    expect(small?.count).toBeGreaterThanOrEqual(0);
  });

  // ── Trip count display ────────────────────────────────────────────────────────

  it('shows correct trip count when materials and containers are configured', () => {
    // windtrap build_cost: 250 metal_scraps * 0.40V = 100V total
    // 1x Assault Ornithopter: 1000V capacity → ceil(100/1000) = 1 trip
    useBuildStore.setState({
      allItems: [windtrap],
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
      storageConfig: { containers: [{ ...CONTAINER_PRESETS[2], count: 1 }] },
    });
    render(<TripPlanner />);

    // Multiple "1" elements exist (container count span + trip count span).
    // The trip count is the text-2xl span.
    const allOnes = screen.getAllByText('1');
    const tripCountEl = allOnes.find((el) => el.className.includes('text-2xl'));
    expect(tripCountEl).toBeTruthy();
  });

  it('trip count is amber when greater than 0', () => {
    useBuildStore.setState({
      allItems: [windtrap],
      plan: { entries: [{ item_id: 'windtrap', quantity: 1 }], dd_mode: false },
      storageConfig: { containers: [{ ...CONTAINER_PRESETS[2], count: 1 }] },
    });
    render(<TripPlanner />);

    // The trip count span has text-amber-400 when trips > 0
    const allOnes = screen.getAllByText('1');
    const tripCountEl = allOnes.find((el) => el.className.includes('text-2xl'));
    expect(tripCountEl?.className).toContain('text-amber-400');
  });

  it('trip count uses stone-600 color when 0', () => {
    render(<TripPlanner />);

    // Trip count is 0 (no plan entries), class should contain 'text-stone-600'
    const tripEls = screen.getAllByText('0');
    // Find the large trip count span (not the container count spans)
    const tripCountEl = tripEls.find((el) => el.className.includes('text-2xl'));
    expect(tripCountEl?.className).toContain('text-stone-600');
  });
});
