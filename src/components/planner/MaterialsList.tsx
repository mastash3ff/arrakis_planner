import { useBuildStore, selectFlatMaterials } from '@/store/buildStore';

/**
 * Displays the fully-flattened raw material requirements for the current build plan.
 * Sorted by quantity descending so the largest hauls are immediately visible.
 *
 * TODO Phase 2: add per-material sourcing hints, copy-to-clipboard, export as CSV.
 */
export default function MaterialsList() {
  const materials = useBuildStore(selectFlatMaterials);
  const ddMode = useBuildStore((s) => s.plan.dd_mode);

  if (materials.length === 0) {
    return (
      <section className="bg-stone-900 border border-stone-700 rounded-lg p-4">
        <h2 className="text-stone-200 font-medium text-sm mb-2">Raw Materials</h2>
        <p className="text-stone-600 text-sm">
          Add structures to your plan to calculate material requirements.
        </p>
      </section>
    );
  }

  const sorted = [...materials].sort((a, b) => b.quantity - a.quantity);
  const total = materials.reduce((sum, m) => sum + m.quantity, 0);

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
        <h2 className="text-stone-200 font-medium text-sm">Raw Materials</h2>
        <div className="flex items-center gap-2">
          {ddMode && (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
              DD −50%
            </span>
          )}
          <span className="text-stone-500 text-xs">{total.toLocaleString()} total units</span>
        </div>
      </div>
      <div className="divide-y divide-stone-800">
        {sorted.map((mat) => (
          <div key={mat.item_id} className="flex items-center gap-3 px-4 py-2">
            <span className="flex-1 text-stone-300 text-sm capitalize">
              {mat.item_id.replace(/_/g, ' ')}
            </span>
            <span className="text-amber-400 font-mono text-sm tabular-nums font-semibold">
              {mat.quantity.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
