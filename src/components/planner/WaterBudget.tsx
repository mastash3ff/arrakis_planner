import { useBuildStore, selectWaterBudget } from '@/store/buildStore';
import { formatFillTime } from '@/lib/calculations';

/**
 * Standalone water budget panel — available for use outside BuildSummary if needed.
 * hours_to_fill is now computed in computeWaterBudget() rather than inline here.
 */
export default function WaterBudget() {
  const budget = useBuildStore(selectWaterBudget);

  const fillLabel = formatFillTime(budget.hours_to_fill);

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700">
        <h2 className="text-stone-200 font-medium text-sm">Water Budget</h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-stone-400 text-sm">Storage Capacity</span>
          <span className="text-blue-400 font-mono text-sm tabular-nums">
            {budget.total_capacity.toLocaleString()} L
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-400 text-sm">Production Rate</span>
          <span className="text-blue-400 font-mono text-sm tabular-nums">
            {budget.production_rate.toLocaleString()} L/hr
          </span>
        </div>
        {fillLabel && (
          <div className="border-t border-stone-700 pt-3 flex items-center justify-between">
            <span className="text-stone-400 text-sm">Time to fill</span>
            <span className="text-stone-300 font-mono text-sm tabular-nums">{fillLabel}</span>
          </div>
        )}
        {budget.total_capacity === 0 && budget.production_rate === 0 && (
          <div className="text-xs text-stone-600">
            No water infrastructure in current plan.
          </div>
        )}
      </div>
    </section>
  );
}
