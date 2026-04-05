import { useBuildStore, selectTripPlan } from '@/store/buildStore';
import { CONTAINER_PRESETS } from '@/types';
import type { ContainerType } from '@/types';

/**
 * Transport logistics panel.
 * Lets the user configure their container loadout and shows total cargo
 * volume, capacity, and number of ornithopter runs required.
 */
export default function TripPlanner() {
  const storageConfig = useBuildStore((s) => s.storageConfig);
  const setStorageConfig = useBuildStore((s) => s.setStorageConfig);
  const tripPlan = useBuildStore(selectTripPlan);

  const updateCount = (name: string, delta: number) => {
    const updated = storageConfig.containers.map((c) =>
      c.name === name ? { ...c, count: Math.max(0, c.count + delta) } : c
    );
    // If container not yet in list, add it from presets
    const exists = storageConfig.containers.some((c) => c.name === name);
    if (!exists) {
      const preset = CONTAINER_PRESETS.find((p) => p.name === name);
      if (preset) {
        setStorageConfig({ containers: [...storageConfig.containers, { ...preset, count: 1 }] });
        return;
      }
    }
    setStorageConfig({ containers: updated });
  };

  // Merge presets with current counts for display
  const containerRows: ContainerType[] = CONTAINER_PRESETS.map((preset) => {
    const existing = storageConfig.containers.find((c) => c.name === preset.name);
    return existing ?? { ...preset, count: 0 };
  });

  const totalCapacity = storageConfig.containers.reduce(
    (sum, c) => sum + c.volume * c.count,
    0
  );

  return (
    <section className="bg-stone-900 border border-stone-700 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-700">
        <h2 className="text-stone-200 font-medium text-sm">Transport Planning</h2>
      </div>
      <div className="p-4 space-y-4">
        {/* Container configuration */}
        <div className="space-y-2">
          <div className="text-stone-500 text-xs uppercase tracking-wider">Cargo containers</div>
          {containerRows.map((container) => (
            <div key={container.name} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-stone-300 text-sm">{container.name}</span>
                <span className="text-stone-600 text-xs ml-2">{container.volume}V</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateCount(container.name, -1)}
                  disabled={container.count === 0}
                  className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 disabled:opacity-30 text-stone-300 rounded text-sm font-bold transition-colors"
                >
                  −
                </button>
                <span className="w-6 text-center text-stone-200 text-sm font-mono tabular-nums">
                  {container.count}
                </span>
                <button
                  onClick={() => updateCount(container.name, 1)}
                  className="w-6 h-6 flex items-center justify-center bg-stone-800 hover:bg-stone-700 text-stone-300 rounded text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div className="border-t border-stone-700 pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-400">Total cargo volume</span>
            <span className="text-stone-300 font-mono tabular-nums">
              {tripPlan.total_volume.toFixed(1)}V
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-400">Total capacity</span>
            <span className="text-stone-300 font-mono tabular-nums">{totalCapacity}V</span>
          </div>
        </div>

        {/* Trip count */}
        <div className="border-t border-stone-700 pt-3 flex items-center justify-between">
          <span className="text-stone-200 font-medium text-sm">Ornithopter runs required</span>
          <span
            className={`font-mono text-2xl font-bold tabular-nums ${
              tripPlan.trips === 0 ? 'text-stone-600' : 'text-amber-400'
            }`}
          >
            {tripPlan.trips}
          </span>
        </div>

        {tripPlan.trips === 0 && (
          <p className="text-stone-600 text-xs">
            Add structures to your plan to calculate transport requirements.
          </p>
        )}
        {totalCapacity === 0 && tripPlan.trips > 0 && (
          <p className="text-amber-600 text-xs">
            Configure at least one container above to calculate trip count.
          </p>
        )}
      </div>
    </section>
  );
}
