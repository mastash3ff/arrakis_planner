import type { Item, ItemCategory, ItemsDataFile } from '@/types';

export class DataLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataLoadError';
  }
}

const VALID_CATEGORIES: ItemCategory[] = [
  'power',
  'water',
  'production',
  'storage',
  'defense',
  'utility',
];

/**
 * Fetches and validates /data/items_data.json at app startup.
 * Throws DataLoadError on network failure or schema violation.
 */
export async function loadItemsData(): Promise<ItemsDataFile> {
  let raw: unknown;
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/items_data.json`);
    if (!response.ok) {
      throw new DataLoadError(
        `Failed to fetch items data: HTTP ${response.status} ${response.statusText}`
      );
    }
    raw = await response.json();
  } catch (e) {
    if (e instanceof DataLoadError) throw e;
    throw new DataLoadError(`Network error loading items data: ${String(e)}`);
  }

  return validateItemsData(raw);
}

export function validateItemsData(raw: unknown): ItemsDataFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DataLoadError('items_data.json: root must be a JSON object');
  }
  const data = raw as Record<string, unknown>;

  if (typeof data['version'] !== 'string') {
    throw new DataLoadError('items_data.json: missing required string field "version"');
  }
  if (typeof data['scraped_at'] !== 'string') {
    throw new DataLoadError('items_data.json: missing required string field "scraped_at"');
  }
  if (!Array.isArray(data['items'])) {
    throw new DataLoadError('items_data.json: "items" must be an array');
  }

  data['items'].forEach((item: unknown, i: number) => validateItem(item, i));

  return raw as ItemsDataFile;
}

function validateItem(raw: unknown, index: number): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DataLoadError(`items[${index}]: must be an object`);
  }
  const item = raw as Record<string, unknown>;

  const requiredStrings = ['id', 'name'];
  for (const field of requiredStrings) {
    if (typeof item[field] !== 'string') {
      throw new DataLoadError(`items[${index}]: missing required string field "${field}"`);
    }
  }

  if (!VALID_CATEGORIES.includes(item['category'] as ItemCategory)) {
    throw new DataLoadError(
      `items[${index}] ("${item['id']}"): invalid category "${String(item['category'])}"`
    );
  }

  const requiredNumbers = ['power_delta', 'water_capacity', 'water_production_rate'];
  for (const field of requiredNumbers) {
    if (typeof item[field] !== 'number') {
      throw new DataLoadError(
        `items[${index}] ("${item['id']}"): missing required number field "${field}"`
      );
    }
  }

  if (!Array.isArray(item['build_cost'])) {
    throw new DataLoadError(`items[${index}] ("${item['id']}"): "build_cost" must be an array`);
  }
  if (!Array.isArray(item['consumables'])) {
    throw new DataLoadError(`items[${index}] ("${item['id']}"): "consumables" must be an array`);
  }
  if (typeof item['deep_desert_eligible'] !== 'boolean') {
    throw new DataLoadError(
      `items[${index}] ("${item['id']}"): "deep_desert_eligible" must be a boolean`
    );
  }

  // Validate each build_cost entry
  (item['build_cost'] as unknown[]).forEach((bc: unknown, j: number) => {
    validateMaterialCost(bc, `items[${index}].build_cost[${j}]`);
  });

  // Validate each consumable entry
  (item['consumables'] as unknown[]).forEach((c: unknown, j: number) => {
    validateMaterialCost(c, `items[${index}].consumables[${j}]`);
  });
}

function validateMaterialCost(raw: unknown, path: string): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new DataLoadError(`${path}: must be an object`);
  }
  const mc = raw as Record<string, unknown>;
  if (typeof mc['item_id'] !== 'string') {
    throw new DataLoadError(`${path}: missing required string field "item_id"`);
  }
  if (typeof mc['quantity'] !== 'number') {
    throw new DataLoadError(`${path}: missing required number field "quantity"`);
  }
}

/** Extracts only DD-eligible items from the loaded data. */
export function filterDDEligible(items: Item[]): Item[] {
  return items.filter((item) => item.deep_desert_eligible);
}
