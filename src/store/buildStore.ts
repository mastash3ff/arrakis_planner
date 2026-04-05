import { create } from 'zustand';
import { loadItemsData } from '@/lib/dataLoader';
import {
  computePowerBudget,
  computeTrips,
  computeWaterBudget,
  sumBuildCost,
} from '@/lib/calculations';
import { CONTAINER_PRESETS } from '@/types';
import type {
  BuildEntry,
  BuildPlan,
  Item,
  MaterialCost,
  PowerBudget,
  StorageConfig,
  TripPlan,
  WaterBudget,
} from '@/types';

// ─── State shape ───────────────────────────────────────────────────────────────

interface BuildStoreState {
  // Data layer
  allItems: Item[];
  isLoaded: boolean;
  loadError: string | null;

  // User plan
  plan: BuildPlan;
  storageConfig: StorageConfig;

  // Actions
  initializeStore: () => Promise<void>;
  addEntry: (item_id: string) => void;
  updateQuantity: (item_id: string, quantity: number) => void;
  removeEntry: (item_id: string) => void;
  toggleDDMode: () => void;
  setStorageConfig: (config: StorageConfig) => void;
  importPlan: (plan: BuildPlan) => void;
  exportPlan: () => string;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useBuildStore = create<BuildStoreState>((set, get) => ({
  allItems: [],
  isLoaded: false,
  loadError: null,

  plan: {
    entries: [],
    dd_mode: false,
  },

  storageConfig: {
    containers: [{ ...CONTAINER_PRESETS[2] }], // default: 1x Assault Ornithopter (1000V)
  },

  initializeStore: async () => {
    try {
      const data = await loadItemsData();
      set({ allItems: data.items, isLoaded: true, loadError: null });
    } catch (e) {
      set({
        loadError: e instanceof Error ? e.message : 'Unknown error loading data',
        isLoaded: true,
      });
    }
  },

  addEntry: (item_id: string) => {
    const { plan } = get();
    const existing = plan.entries.find((e) => e.item_id === item_id);
    if (existing) {
      set({
        plan: {
          ...plan,
          entries: plan.entries.map((e) =>
            e.item_id === item_id ? { ...e, quantity: e.quantity + 1 } : e
          ),
        },
      });
    } else {
      set({
        plan: {
          ...plan,
          entries: [...plan.entries, { item_id, quantity: 1 }],
        },
      });
    }
  },

  updateQuantity: (item_id: string, quantity: number) => {
    const { plan } = get();
    if (quantity <= 0) {
      set({
        plan: {
          ...plan,
          entries: plan.entries.filter((e) => e.item_id !== item_id),
        },
      });
    } else {
      set({
        plan: {
          ...plan,
          entries: plan.entries.map((e) => (e.item_id === item_id ? { ...e, quantity } : e)),
        },
      });
    }
  },

  removeEntry: (item_id: string) => {
    const { plan } = get();
    set({ plan: { ...plan, entries: plan.entries.filter((e) => e.item_id !== item_id) } });
  },

  toggleDDMode: () => {
    const { plan } = get();
    set({ plan: { ...plan, dd_mode: !plan.dd_mode } });
  },

  setStorageConfig: (config: StorageConfig) => {
    set({ storageConfig: config });
  },

  importPlan: (plan: BuildPlan) => {
    set({ plan });
  },

  exportPlan: () => {
    return JSON.stringify(get().plan, null, 2);
  },
}));

// ─── Derived selectors ─────────────────────────────────────────────────────────
// Call these inside useStore() for memoised derived values.

export const selectFlatMaterials = (state: BuildStoreState): MaterialCost[] =>
  sumBuildCost(state.plan.entries, state.allItems, state.plan.dd_mode);

export const selectPowerBudget = (state: BuildStoreState): PowerBudget =>
  computePowerBudget(state.plan.entries, state.allItems);

export const selectWaterBudget = (state: BuildStoreState): WaterBudget =>
  computeWaterBudget(state.plan.entries, state.allItems);

export const selectTripPlan = (state: BuildStoreState): TripPlan =>
  computeTrips(
    sumBuildCost(state.plan.entries, state.allItems, state.plan.dd_mode),
    state.storageConfig
  );

export const selectEntryCount = (state: BuildStoreState): number =>
  state.plan.entries.reduce((sum, e) => sum + e.quantity, 0);

/** Returns Item objects for all entries in the current plan, in plan order. */
export const selectPlanItems = (state: BuildStoreState): Array<{ item: Item; entry: BuildEntry }> =>
  state.plan.entries
    .map((entry) => ({
      entry,
      item: state.allItems.find((item) => item.id === entry.item_id),
    }))
    .filter((pair): pair is { item: Item; entry: BuildEntry } => pair.item !== undefined);
