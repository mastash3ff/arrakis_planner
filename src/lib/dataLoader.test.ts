import { describe, it, expect } from 'vitest';
import { DataLoadError, validateItemsData } from '@/lib/dataLoader';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeValidFile(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: '1.0.0',
    scraped_at: '2026-01-01T00:00:00Z',
    items: [makeValidItem()],
    ...overrides,
  };
}

function makeValidItem(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 'windtrap',
    name: 'Windtrap',
    category: 'water',
    build_cost: [{ item_id: 'iron_ingot', quantity: 10 }],
    crafting_tree: null,
    power_delta: -5,
    water_capacity: 500,
    water_production_rate: 0.75,
    consumables: [{ item_id: 'makeshift_filter', quantity: 8 }],
    deep_desert_eligible: true,
    ...overrides,
  };
}

// ─── validateItemsData ────────────────────────────────────────────────────────

describe('validateItemsData', () => {
  // ── Happy path ──────────────────────────────────────────────────────────────

  it('accepts a valid file with one item', () => {
    const file = makeValidFile();
    const result = validateItemsData(file);
    expect(result.version).toBe('1.0.0');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('windtrap');
  });

  it('accepts all valid category values', () => {
    const categories = ['power', 'water', 'production', 'storage', 'defense', 'utility'];
    for (const category of categories) {
      const file = makeValidFile({ items: [makeValidItem({ category })] });
      expect(() => validateItemsData(file)).not.toThrow();
    }
  });

  it('accepts items with empty build_cost and consumables arrays', () => {
    const file = makeValidFile({ items: [makeValidItem({ build_cost: [], consumables: [] })] });
    expect(() => validateItemsData(file)).not.toThrow();
  });

  it('accepts items with crafting_tree as null', () => {
    const file = makeValidFile({ items: [makeValidItem({ crafting_tree: null })] });
    expect(() => validateItemsData(file)).not.toThrow();
  });

  it('accepts files with an empty items array', () => {
    const file = makeValidFile({ items: [] });
    const result = validateItemsData(file);
    expect(result.items).toHaveLength(0);
  });

  // ── Root shape ──────────────────────────────────────────────────────────────

  it('throws on null root', () => {
    expect(() => validateItemsData(null)).toThrow(DataLoadError);
  });

  it('throws on array root', () => {
    expect(() => validateItemsData([])).toThrow(DataLoadError);
  });

  it('throws on string root', () => {
    expect(() => validateItemsData('bad')).toThrow(DataLoadError);
  });

  it('throws when version is missing', () => {
    const file = makeValidFile({ version: undefined });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when version is not a string', () => {
    const file = makeValidFile({ version: 1 });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when scraped_at is missing', () => {
    const file = makeValidFile({ scraped_at: undefined });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when items is not an array', () => {
    const file = makeValidFile({ items: 'not-an-array' });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  // ── Item shape ──────────────────────────────────────────────────────────────

  it('throws when an item is missing id', () => {
    const file = makeValidFile({ items: [makeValidItem({ id: undefined })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when an item is missing name', () => {
    const file = makeValidFile({ items: [makeValidItem({ name: undefined })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when category is an invalid enum value', () => {
    const file = makeValidFile({ items: [makeValidItem({ category: 'bedroom' })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when category is missing entirely', () => {
    const file = makeValidFile({ items: [makeValidItem({ category: undefined })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when power_delta is not a number', () => {
    const file = makeValidFile({ items: [makeValidItem({ power_delta: '5' })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when water_capacity is missing', () => {
    const file = makeValidFile({ items: [makeValidItem({ water_capacity: undefined })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when build_cost is not an array', () => {
    const file = makeValidFile({ items: [makeValidItem({ build_cost: null })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when consumables is not an array', () => {
    const file = makeValidFile({ items: [makeValidItem({ consumables: null })] });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when deep_desert_eligible is not a boolean', () => {
    const file = makeValidFile({
      items: [makeValidItem({ deep_desert_eligible: 'yes' })],
    });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  // ── MaterialCost validation ─────────────────────────────────────────────────

  it('throws when a build_cost entry is missing item_id', () => {
    const file = makeValidFile({
      items: [makeValidItem({ build_cost: [{ quantity: 10 }] })],
    });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when a build_cost entry has non-numeric quantity', () => {
    const file = makeValidFile({
      items: [makeValidItem({ build_cost: [{ item_id: 'iron_ingot', quantity: '10' }] })],
    });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  it('throws when a consumables entry is missing item_id', () => {
    const file = makeValidFile({
      items: [makeValidItem({ consumables: [{ quantity: 3 }] })],
    });
    expect(() => validateItemsData(file)).toThrow(DataLoadError);
  });

  // ── Error message quality ───────────────────────────────────────────────────

  it('DataLoadError has name "DataLoadError"', () => {
    try {
      validateItemsData(null);
    } catch (e) {
      expect(e).toBeInstanceOf(DataLoadError);
      expect((e as DataLoadError).name).toBe('DataLoadError');
    }
  });

  it('error message includes item index for item-level failures', () => {
    const file = makeValidFile({ items: [makeValidItem({ category: 'badcat' })] });
    try {
      validateItemsData(file);
    } catch (e) {
      expect((e as DataLoadError).message).toContain('items[0]');
    }
  });
});
