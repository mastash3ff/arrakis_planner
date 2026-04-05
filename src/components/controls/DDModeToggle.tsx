import { useBuildStore } from '@/store/buildStore';

export default function DDModeToggle() {
  const ddMode = useBuildStore((s) => s.plan.dd_mode);
  const toggleDDMode = useBuildStore((s) => s.toggleDDMode);

  return (
    <button
      onClick={toggleDDMode}
      title={
        ddMode
          ? 'Deep Desert mode active — build costs halved. Click to switch to Hagga Basin.'
          : 'Hagga Basin mode. Click to enable Deep Desert 50% cost reduction.'
      }
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors',
        ddMode
          ? 'bg-amber-500 text-stone-950 hover:bg-amber-400'
          : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200 border border-stone-700',
      ].join(' ')}
    >
      <span className="text-base leading-none">⬡</span>
      <span>{ddMode ? 'Deep Desert' : 'Hagga Basin'}</span>
      {ddMode && (
        <span className="text-xs font-bold text-stone-950 opacity-80">Build costs halved</span>
      )}
    </button>
  );
}
