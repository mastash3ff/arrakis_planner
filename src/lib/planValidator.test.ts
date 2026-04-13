import { describe, expect, it } from 'vitest';
import { isValidPlan } from './planValidator';

describe('isValidPlan', () => {
  // ── Happy path ───────────────────────────────────────────────────────────────

  it('accepts a minimal valid plan (empty entries, dd_mode false)', () => {
    expect(isValidPlan({ entries: [], dd_mode: false })).toBe(true);
  });

  it('accepts a plan with multiple entries', () => {
    const plan = {
      entries: [
        { item_id: 'windtrap', quantity: 2 },
        { item_id: 'solar', quantity: 1 },
      ],
      dd_mode: false,
    };
    expect(isValidPlan(plan)).toBe(true);
  });

  it('accepts a plan with dd_mode true', () => {
    expect(isValidPlan({ entries: [], dd_mode: true })).toBe(true);
  });

  it('accepts entries with large quantity values', () => {
    expect(isValidPlan({ entries: [{ item_id: 'x', quantity: 999999 }], dd_mode: false })).toBe(true);
  });

  // ── Structural rejections ────────────────────────────────────────────────────

  it('returns false for null', () => {
    expect(isValidPlan(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidPlan(undefined)).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isValidPlan('{"entries":[],"dd_mode":false}')).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isValidPlan([])).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isValidPlan(42)).toBe(false);
  });

  // ── Missing / wrong-type top-level fields ────────────────────────────────────

  it('returns false when entries is missing', () => {
    expect(isValidPlan({ dd_mode: false })).toBe(false);
  });

  it('returns false when entries is not an array (is an object)', () => {
    expect(isValidPlan({ entries: {}, dd_mode: false })).toBe(false);
  });

  it('returns false when entries is a string', () => {
    expect(isValidPlan({ entries: '[]', dd_mode: false })).toBe(false);
  });

  it('returns false when dd_mode is missing', () => {
    expect(isValidPlan({ entries: [] })).toBe(false);
  });

  it('returns false when dd_mode is a string "true"', () => {
    expect(isValidPlan({ entries: [], dd_mode: 'true' })).toBe(false);
  });

  it('returns false when dd_mode is a number 1', () => {
    expect(isValidPlan({ entries: [], dd_mode: 1 })).toBe(false);
  });

  // ── Entry-level validation ───────────────────────────────────────────────────

  it('returns false when an entry is missing item_id', () => {
    expect(isValidPlan({ entries: [{ quantity: 1 }], dd_mode: false })).toBe(false);
  });

  it('returns false when item_id is not a string (is a number)', () => {
    expect(isValidPlan({ entries: [{ item_id: 42, quantity: 1 }], dd_mode: false })).toBe(false);
  });

  it('returns false when an entry is missing quantity', () => {
    expect(isValidPlan({ entries: [{ item_id: 'x' }], dd_mode: false })).toBe(false);
  });

  it('returns false when quantity is not a number (is a string)', () => {
    expect(isValidPlan({ entries: [{ item_id: 'x', quantity: '1' }], dd_mode: false })).toBe(false);
  });

  it('returns false when an entry is null', () => {
    expect(isValidPlan({ entries: [null], dd_mode: false })).toBe(false);
  });

  it('returns false when entries contains a primitive', () => {
    expect(isValidPlan({ entries: [42], dd_mode: false })).toBe(false);
  });
});
