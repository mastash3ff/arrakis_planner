import { useRef, useState } from 'react';
import { useBuildStore } from '@/store/buildStore';
import type { BuildPlan } from '@/types';

function isValidPlan(data: unknown): data is BuildPlan {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.entries)) return false;
  if (typeof d.dd_mode !== 'boolean') return false;
  return d.entries.every(
    (e) =>
      e &&
      typeof e === 'object' &&
      typeof (e as Record<string, unknown>).item_id === 'string' &&
      typeof (e as Record<string, unknown>).quantity === 'number'
  );
}

export default function ExportImport() {
  const exportPlan = useBuildStore((s) => s.exportPlan);
  const importPlan = useBuildStore((s) => s.importPlan);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  function handleExport() {
    const json = exportPlan();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arrakis-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed: unknown = JSON.parse(event.target?.result as string);
        if (!isValidPlan(parsed)) {
          alert('Invalid plan file. Expected a JSON file exported from Arrakis Planner.');
          return;
        }
        importPlan(parsed);
      } catch {
        alert('Failed to parse plan file. Ensure it is valid JSON.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const btnClass =
    'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium bg-stone-800 text-stone-300 border border-stone-700 hover:bg-stone-700 hover:text-stone-100 transition-colors';

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImport}
      />
      <button onClick={handleExport} title="Export build plan as JSON" className={btnClass}>
        <span>↓</span>
        <span className="hidden sm:inline">Export</span>
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import build plan from JSON"
        className={btnClass}
      >
        <span>↑</span>
        <span className="hidden sm:inline">Import</span>
      </button>
      <button
        onClick={handleCopyLink}
        title="Copy share link"
        className={`${btnClass} ${copied ? 'text-green-400 border-green-600/40' : ''}`}
      >
        <span>{copied ? '✓' : '⎘'}</span>
        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
      </button>
    </div>
  );
}
