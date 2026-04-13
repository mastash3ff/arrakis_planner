import { useEffect, useRef } from 'react';
import { useBuildStore } from '@/store/buildStore';
import AppShell from '@/components/layout/AppShell';
import Sidebar from '@/components/layout/Sidebar';
import BuildSummary from '@/components/planner/BuildSummary';
import ConsumablesPlanner from '@/components/planner/ConsumablesPlanner';
import TripPlanner from '@/components/planner/TripPlanner';
import type { BuildPlan } from '@/types';
import { isValidPlan } from '@/lib/planValidator';

// Read once at module load — URL cannot change between module evaluation and mount.
const initialPlanParam = new URLSearchParams(window.location.search).get('plan');

function encodePlan(plan: BuildPlan): string {
  return btoa(JSON.stringify(plan))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodePlan(encoded: string): BuildPlan | null {
  try {
    const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    if (isValidPlan(parsed)) return parsed;
  } catch {
    // malformed input — ignore
  }
  return null;
}

export default function App() {
  const initializeStore = useBuildStore((s) => s.initializeStore);
  const importPlan = useBuildStore((s) => s.importPlan);
  const isLoaded = useBuildStore((s) => s.isLoaded);
  const loadError = useBuildStore((s) => s.loadError);
  const plan = useBuildStore((s) => s.plan);
  const didImportFromUrl = useRef(false);

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  // Apply shared plan from URL once, after data is loaded.
  useEffect(() => {
    if (!isLoaded || didImportFromUrl.current) return;
    didImportFromUrl.current = true;
    if (initialPlanParam) {
      const decoded = decodePlan(initialPlanParam);
      if (decoded) importPlan(decoded);
    }
  }, [isLoaded, importPlan]);

  // Keep URL in sync with current plan so Share button always reflects latest state.
  useEffect(() => {
    if (!isLoaded) return;
    const url = new URL(window.location.href);
    if (plan.entries.length > 0 || plan.dd_mode) {
      url.searchParams.set('plan', encodePlan(plan));
    } else {
      url.searchParams.delete('plan');
    }
    window.history.replaceState(null, '', url.toString());
  }, [plan, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-950">
        <div className="text-center">
          <div className="text-amber-400 text-lg font-semibold mb-2">Loading Arrakis data…</div>
          <div className="text-stone-500 text-sm">Consulting the imperial archives</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-950">
        <div className="text-center max-w-md px-6">
          <div className="text-red-400 text-lg font-semibold mb-2">Data load failed</div>
          <div className="text-stone-400 text-sm font-mono bg-stone-900 p-3 rounded border border-stone-700">
            {loadError}
          </div>
          <div className="text-stone-500 text-xs mt-3">
            Ensure <code className="text-amber-400">/data/items_data.json</code> is present and
            valid.
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell sidebar={<Sidebar />}>
      <div className="space-y-4">
        <BuildSummary />
        <ConsumablesPlanner />
        <TripPlanner />
      </div>
    </AppShell>
  );
}
