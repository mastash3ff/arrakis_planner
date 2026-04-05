import ItemSelector from '@/components/planner/ItemSelector';

export default function Sidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-stone-700">
        <h2 className="text-stone-400 text-xs font-semibold uppercase tracking-widest">
          Placeables
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <ItemSelector />
      </div>
    </div>
  );
}
