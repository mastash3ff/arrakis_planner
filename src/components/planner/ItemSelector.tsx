import { useState } from 'react';
import { useBuildStore } from '@/store/buildStore';
import type { Item, ItemCategory } from '@/types';

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  power: 'Power',
  water: 'Water',
  production: 'Production',
  storage: 'Storage',
  defense: 'Defense',
  utility: 'Utility',
};

const CATEGORY_COLORS: Record<ItemCategory, string> = {
  power: 'text-yellow-400',
  water: 'text-blue-400',
  production: 'text-orange-400',
  storage: 'text-stone-400',
  defense: 'text-red-400',
  utility: 'text-purple-400',
};

interface ItemRowProps {
  item: Item;
  quantity: number;
  onAdd: (item_id: string) => void;
}

function ItemRow({ item, quantity, onAdd }: ItemRowProps) {
  return (
    <button
      onClick={() => onAdd(item.id)}
      className="w-full text-left flex items-center gap-2 px-3 py-2 hover:bg-stone-800 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-stone-200 text-sm truncate group-hover:text-amber-300 transition-colors">
          {item.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${CATEGORY_COLORS[item.category]}`}>
            {CATEGORY_LABELS[item.category]}
          </span>
          {item.power_delta !== 0 && (
            <span
              className={`text-xs ${item.power_delta > 0 ? 'text-yellow-500' : 'text-stone-500'}`}
            >
              {item.power_delta > 0 ? '+' : ''}
              {item.power_delta} kW
            </span>
          )}
          {!item.deep_desert_eligible && (
            <span className="text-xs text-stone-600">base only</span>
          )}
        </div>
      </div>
      {quantity > 0 && (
        <span className="text-xs font-mono tabular-nums text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
          ×{quantity}
        </span>
      )}
      <span className="text-stone-600 group-hover:text-amber-400 text-lg leading-none shrink-0">
        +
      </span>
    </button>
  );
}

export default function ItemSelector() {
  const allItems = useBuildStore((s) => s.allItems);
  const ddMode = useBuildStore((s) => s.plan.dd_mode);
  const entries = useBuildStore((s) => s.plan.entries);
  const addEntry = useBuildStore((s) => s.addEntry);
  const [query, setQuery] = useState('');

  const quantityMap = Object.fromEntries(entries.map((e) => [e.item_id, e.quantity]));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? allItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
    : allItems;

  const grouped = filteredItems.reduce<Partial<Record<ItemCategory, Item[]>>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category]!.push(item);
    return acc;
  }, {});

  const categoryOrder: ItemCategory[] = [
    'utility',
    'power',
    'water',
    'production',
    'storage',
    'defense',
  ];

  if (allItems.length === 0) {
    return (
      <div className="p-4 text-stone-500 text-sm text-center">
        No placeables available for your outpost on Arrakis.
      </div>
    );
  }

  return (
    <div className="pb-4">
      <div className="px-3 pt-2 pb-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Filter structures…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-stone-800 border border-stone-700 rounded px-2.5 py-1.5 text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {ddMode && (
        <div className="mx-3 mb-1 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400">
          Deep Desert mode — 50% cost reduction active
        </div>
      )}
      {normalizedQuery && filteredItems.length === 0 && (
        <div className="px-3 py-6 text-stone-500 text-sm text-center">
          No structures match "{query}"
        </div>
      )}
      {categoryOrder
        .filter((cat) => grouped[cat] && grouped[cat]!.length > 0)
        .map((cat) => (
          <div key={cat}>
            <div className="px-3 pt-3 pb-1">
              <span
                className={`text-xs font-semibold uppercase tracking-widest ${CATEGORY_COLORS[cat]}`}
              >
                {CATEGORY_LABELS[cat]}
              </span>
            </div>
            {grouped[cat]!.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                quantity={quantityMap[item.id] ?? 0}
                onAdd={addEntry}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
