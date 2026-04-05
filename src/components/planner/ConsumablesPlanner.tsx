import { useState } from 'react';
import { useBuildStore } from '@/store/buildStore';
import { computeConsumables } from '@/lib/calculations';

export default function ConsumablesPlanner() {
  const entries = useBuildStore((s) => s.plan.entries);
  const allItems = useBuildStore((s) => s.allItems);
  const [days, setDays] = useState(1);

  const consumables = computeConsumables(entries, allItems, days);

  return (
    <div className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
        <span className="text-stone-200 font-medium text-sm">Consumables</span>
        <div className="flex items-center gap-2">
          <span className="text-stone-500 text-xs uppercase tracking-wider">Days</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              disabled={days <= 1}
              className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center font-mono tabular-nums text-stone-200 text-sm">
              {days}
            </span>
            <button
              onClick={() => setDays((d) => d + 1)}
              className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-6 text-center text-stone-500 text-sm">
          Add structures to see consumable requirements.
        </div>
      ) : consumables.length === 0 ? (
        <div className="px-4 py-6 text-center text-stone-500 text-sm">
          No consumables required by current structures.
        </div>
      ) : (
        <div className="divide-y divide-stone-800">
          {consumables.map((mat) => (
            <div key={mat.item_id} className="flex items-center justify-between px-4 py-2">
              <span className="text-stone-300 text-sm capitalize">
                {mat.item_id.replace(/_/g, ' ')}
              </span>
              <span className="font-mono text-sm tabular-nums font-medium text-amber-400">
                {mat.quantity.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
