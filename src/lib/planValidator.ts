import type { BuildPlan } from '@/types';

export function isValidPlan(data: unknown): data is BuildPlan {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.entries)) return false;
  if (typeof d.dd_mode !== 'boolean') return false;
  return d.entries.every(
    (e) =>
      e &&
      typeof e === 'object' &&
      typeof (e as Record<string, unknown>).item_id === 'string' &&
      typeof (e as Record<string, unknown>).quantity === 'number'
  );
}
