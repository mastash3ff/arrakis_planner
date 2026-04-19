import { useBuildStore } from '@/store/buildStore';
import { computeConsumables, formatRuntime } from '@/lib/calculations';

export default function WaterPlanner() {
  const entries = useBuildStore((s) => s.plan.entries);
  const allItems = useBuildStore((s) => s.allItems);
  const allConsumables = useBuildStore((s) => s.allConsumables);
  const days = useBuildStore((s) => s.days);
  const setDays = useBuildStore((s) => s.setDays);

  const waterEntries = entries.filter(
    (e) => allItems.find((i) => i.id === e.item_id)?.category === 'water'
  );

  const productionRatePerHr = waterEntries.reduce((sum, e) => {
    const item = allItems.find((i) => i.id === e.item_id);
    return sum + (item?.water_production_rate ?? 0) * e.quantity;
  }, 0);

  const totalStorageCapacity = waterEntries.reduce((sum, e) => {
    const item = allItems.find((i) => i.id === e.item_id);
    return sum + (item?.water_capacity ?? 0) * e.quantity;
  }, 0);

  const totalWater = productionRatePerHr * 24 * days;

  const filterDemand = computeConsumables(waterEntries, allItems, days);

  const consumableMap = new Map(allConsumables.map((c) => [c.id, c]));

  const craftingCosts = new Map<string, number>();
  for (const demand of filterDemand) {
    const consumable = consumableMap.get(demand.item_id);
    if (!consumable) continue;
    for (const ingredient of consumable.build_cost) {
      craftingCosts.set(
        ingredient.item_id,
        (craftingCosts.get(ingredient.item_id) ?? 0) + ingredient.quantity * demand.quantity
      );
    }
  }
  const craftingCostList = [...craftingCosts.entries()]
    .map(([item_id, quantity]) => ({ item_id, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  // Per-structure breakdown: each unique water structure type with its individual rate/total.
  const perStructureBreakdown = waterEntries
    .map((entry) => {
      const item = allItems.find((i) => i.id === entry.item_id);
      if (!item) return null;
      const rate = item.water_production_rate * entry.quantity;
      const total = rate * 24 * days;
      return { item, quantity: entry.quantity, rate, total };
    })
    .filter(Boolean)
    .filter((row) => row!.rate > 0) as {
      item: (typeof allItems)[0];
      quantity: number;
      rate: number;
      total: number;
    }[];

  // Filter queue runtime: per structure type, per filter type, show how long a full
  // queue load runs and how much water it produces.
  const filterQueueEntries = waterEntries.flatMap((entry) => {
    const item = allItems.find((i) => i.id === entry.item_id);
    if (!item || !item.filter_capacity || item.consumables.length === 0) return [];
    return [{ item, quantity: entry.quantity }];
  });

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between">
        <h2 className="text-stone-200 font-medium text-sm">Water Planner</h2>
        <div className="flex items-center gap-2">
          <span className="text-stone-500 text-xs uppercase tracking-wider">Days</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDays(days - 1)}
              disabled={days <= 1}
              className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors disabled:opacity-30"
            >
              −
            </button>
            <span className="w-8 text-center font-mono tabular-nums text-stone-200 text-sm">
              {days}
            </span>
            <button
              onClick={() => setDays(days + 1)}
              className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {waterEntries.length === 0 ? (
        <div className="px-4 py-6 text-center text-stone-500 text-sm">
          Add windtraps or other water structures to plan water production.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-stone-500 text-xs uppercase tracking-wider">Water output</div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-sm">Total produced</span>
              <span className="text-blue-400 font-mono text-sm tabular-nums">
                {totalWater.toLocaleString()} L
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400 text-sm">Production rate</span>
              <span className="text-blue-400 font-mono text-sm tabular-nums">
                {productionRatePerHr.toLocaleString()} L/hr
              </span>
            </div>
            {totalStorageCapacity > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-stone-400 text-sm">Storage capacity</span>
                <span className="text-blue-400 font-mono text-sm tabular-nums">
                  {totalStorageCapacity.toLocaleString()} L
                </span>
              </div>
            )}
            {perStructureBreakdown.length > 1 && (
              <div className="pt-1 space-y-1">
                {perStructureBreakdown.map(({ item, quantity, rate, total }) => (
                  <div key={item.id} className="flex items-center justify-between pl-2">
                    <span className="text-stone-600 text-xs">
                      {item.name}{quantity > 1 ? ` ×${quantity}` : ''}
                    </span>
                    <span className="text-blue-600 font-mono text-xs tabular-nums">
                      {rate.toLocaleString()} L/hr · {total.toLocaleString()} L
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-stone-700 pt-3 space-y-2">
            <div className="text-stone-500 text-xs uppercase tracking-wider">Filters required</div>
            {filterDemand.length === 0 ? (
              <div className="text-stone-600 text-sm">No filter consumables required.</div>
            ) : (
              filterDemand.map((d) => {
                const name = consumableMap.get(d.item_id)?.name ?? d.item_id.replace(/_/g, ' ');
                return (
                  <div key={d.item_id} className="flex items-center justify-between">
                    <span className="text-stone-300 text-sm">{name}</span>
                    <span className="text-amber-400 font-mono text-sm tabular-nums">
                      {d.quantity.toLocaleString()}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {craftingCostList.length > 0 && (
            <div className="border-t border-stone-700 pt-3 space-y-2">
              <div className="text-stone-500 text-xs uppercase tracking-wider">
                Raw materials to craft filters
              </div>
              {craftingCostList.map(({ item_id, quantity }) => (
                <div key={item_id} className="flex items-center justify-between">
                  <span className="text-stone-400 text-sm capitalize">
                    {item_id.replace(/_/g, ' ')}
                  </span>
                  <span className="text-amber-400 font-mono text-sm tabular-nums">
                    {quantity.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {filterQueueEntries.length > 0 && (
            <div className="border-t border-stone-700 pt-3 space-y-4">
              <div className="text-stone-500 text-xs uppercase tracking-wider">
                Full filter queue runtime
              </div>
              {filterQueueEntries.map(({ item, quantity }) => (
                <div key={item.id} className="space-y-1">
                  <div className="text-stone-300 text-xs font-medium">
                    {item.name}{quantity > 1 ? ` ×${quantity}` : ''}
                    <span className="text-stone-600 ml-1">({item.filter_capacity} slots)</span>
                  </div>
                  {item.consumables.map((c) => {
                    const burnHours = 24 / c.quantity;
                    const runtimeHours = item.filter_capacity! * burnHours;
                    const waterProduced = item.water_production_rate * runtimeHours * quantity;
                    const filterName =
                      consumableMap.get(c.item_id)?.name ?? c.item_id.replace(/_/g, ' ');
                    return (
                      <div key={c.item_id} className="flex items-center justify-between pl-2">
                        <span className="text-stone-500 text-sm">{filterName}</span>
                        <span className="text-stone-400 font-mono text-sm tabular-nums">
                          {formatRuntime(runtimeHours)}
                          <span className="text-blue-400 ml-2">
                            {waterProduced.toLocaleString()} L
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
