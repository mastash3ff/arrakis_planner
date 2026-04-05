import {
  selectEntryCount,
  selectFlatMaterials,
  selectPlanItems,
  selectPowerBudget,
  selectWaterBudget,
  useBuildStore,
} from '@/store/buildStore';

// ─── Sub-sections ──────────────────────────────────────────────────────────────

function PlanEntries() {
  const planItems = useBuildStore(selectPlanItems);
  const entryCount = useBuildStore(selectEntryCount);
  const updateQuantity = useBuildStore((s) => s.updateQuantity);
  const removeEntry = useBuildStore((s) => s.removeEntry);

  if (planItems.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-stone-500 text-sm">
        Select placeables for your Arrakis outpost from the sidebar.
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-stone-500 text-xs uppercase tracking-wider">Selected structures</span>
        <span className="text-stone-500 text-xs">
          {entryCount} unit{entryCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-stone-800">
        {planItems.map(({ item, entry }) => (
          <div key={item.id} className="flex items-center gap-3 px-4 py-2">
            <div className="flex-1 min-w-0">
              <span className="text-stone-200 text-sm truncate">{item.name}</span>
              {item.power_delta !== 0 && (
                <span
                  className={`ml-2 text-xs tabular-nums ${
                    item.power_delta > 0 ? 'text-yellow-500' : 'text-stone-500'
                  }`}
                >
                  {item.power_delta > 0 ? '+' : ''}
                  {item.power_delta * entry.quantity} kW
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQuantity(item.id, entry.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors"
              >
                −
              </button>
              <span className="w-8 text-center text-stone-200 text-sm font-mono tabular-nums">
                {entry.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, entry.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeEntry(item.id)}
              title={`Remove ${item.name}`}
              className="ml-1 text-stone-600 hover:text-red-400 text-sm transition-colors w-5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function PowerRow() {
  const budget = useBuildStore(selectPowerBudget);
  const netPositive = budget.net >= 0;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 text-xs">Generated</span>
        <span className="text-yellow-400 font-mono text-xs tabular-nums">
          +{budget.generation} kW
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 text-xs">Consumed</span>
        <span className="text-stone-400 font-mono text-xs tabular-nums">
          −{budget.consumption} kW
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-stone-400 text-xs">Net</span>
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${
            netPositive ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {budget.net >= 0 ? '+' : ''}
          {budget.net} kW
        </span>
      </div>
    </div>
  );
}

function WaterRow() {
  const budget = useBuildStore(selectWaterBudget);

  const fillLabel =
    budget.hours_to_fill === Infinity
      ? '—'
      : budget.hours_to_fill < 24
        ? `${budget.hours_to_fill.toFixed(1)}h to fill`
        : `${(budget.hours_to_fill / 24).toFixed(1)}d to fill`;

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 text-xs">Capacity</span>
        <span className="text-blue-400 font-mono text-xs tabular-nums">
          {budget.total_capacity.toLocaleString()} L
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-stone-500 text-xs">Production</span>
        <span className="text-blue-400 font-mono text-xs tabular-nums">
          {budget.production_rate.toLocaleString()} L/hr
        </span>
      </div>
      {budget.total_capacity > 0 && (
        <div className="ml-auto text-stone-400 text-xs tabular-nums">{fillLabel}</div>
      )}
    </div>
  );
}

function MaterialsTable() {
  const materials = useBuildStore(selectFlatMaterials);
  const ddMode = useBuildStore((s) => s.plan.dd_mode);

  if (materials.length === 0) return null;

  const total = materials.reduce((s, m) => s + m.quantity, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-stone-500 text-xs uppercase tracking-wider">Raw materials</span>
        <div className="flex items-center gap-2">
          {ddMode && (
            <span className="text-amber-400 text-xs">DD −50%</span>
          )}
          <span className="text-stone-600 text-xs">{total.toLocaleString()} total</span>
        </div>
      </div>
      <div className="space-y-1">
        {materials.map((mat) => (
          <div key={mat.item_id} className="flex items-center justify-between">
            <span className="text-stone-400 text-sm capitalize">
              {mat.item_id.replace(/_/g, ' ')}
            </span>
            <span className="text-amber-400 font-mono text-sm tabular-nums font-medium">
              {mat.quantity.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BuildSummary ──────────────────────────────────────────────────────────────

/**
 * Primary planning panel. Shows the selected structure list with quantity controls,
 * an inline power budget (color-coded surplus/deficit), water capacity with
 * hours-to-fill, and the full raw material list.
 *
 * All data flows reactively through Zustand selectors — updates when items are
 * added/removed, quantities change, or DD mode is toggled.
 */
export default function BuildSummary() {
  const planItems = useBuildStore(selectPlanItems);

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700">
        <h2 className="text-stone-200 font-medium text-sm">Build Summary</h2>
      </div>

      <PlanEntries />

      {planItems.length > 0 && (
        <div className="border-t border-stone-800 divide-y divide-stone-800">
          {/* Power budget */}
          <div className="px-4 py-2.5">
            <PowerRow />
          </div>

          {/* Water budget */}
          <div className="px-4 py-2.5">
            <WaterRow />
          </div>

          {/* Materials */}
          <div className="px-4 py-3">
            <MaterialsTable />
          </div>
        </div>
      )}
    </section>
  );
}
