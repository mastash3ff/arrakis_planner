import type { ReactNode } from 'react';
import DDModeToggle from '@/components/controls/DDModeToggle';
import ExportImport from '@/components/controls/ExportImport';

interface AppShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export default function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-stone-950">
      {/* Header */}
      <header className="h-14 shrink-0 bg-stone-900 border-b border-stone-700 flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-xl">⬡</span>
          <h1 className="text-amber-400 font-semibold text-lg tracking-wide">Arrakis Planner</h1>
          <span className="text-stone-600 text-sm hidden sm:block">— Deep Desert Base Calculator</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <DDModeToggle />
          <ExportImport />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-stone-900 border-r border-stone-700 overflow-y-auto">
          {sidebar}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 bg-stone-950">
          {children}
        </main>
      </div>
    </div>
  );
}
