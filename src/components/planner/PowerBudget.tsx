import { useBuildStore, selectPowerBudget } from '@/store/buildStore';

/**
 * Displays the net power balance for the current build plan.
 * Shows generation, consumption, and net surplus/deficit.
 *
 * TODO Phase 2: show per-item power breakdown, add "add generator" quick-action.
 */
export default function PowerBudget() {
  const budget = useBuildStore(selectPowerBudget);

  const netPositive = budget.net >= 0;

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700">
        <h2 className="text-stone-200 font-medium text-sm">Power Budget</h2>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-stone-400 text-sm">Generation</span>
          <span className="text-yellow-400 font-mono text-sm tabular-nums">
            +{budget.generation} kW
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-stone-400 text-sm">Consumption</span>
          <span className="text-stone-400 font-mono text-sm tabular-nums">
            −{budget.consumption} kW
          </span>
        </div>
        <div className="border-t border-stone-700 pt-3 flex items-center justify-between">
          <span className="text-stone-200 text-sm font-medium">Net</span>
          <span
            className={`font-mono text-base tabular-nums font-semibold ${
              netPositive ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {budget.net >= 0 ? '+' : ''}
            {budget.net} kW
          </span>
        </div>
        {!netPositive && (
          <div className="text-xs text-red-400/80 bg-red-400/10 px-2 py-1.5 rounded border border-red-400/20">
            Power deficit — add generators or reduce consumption.
          </div>
        )}
      </div>
    </section>
  );
}
