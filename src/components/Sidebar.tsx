import {
  Archive,
  BarChart3,
  BookOpen,
  Database,
  FilePlus2,
  FileSpreadsheet,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Table2,
  Users,
  X,
} from 'lucide-react';
import { TRANSLATIONS } from '../lib/i18n.ts';
import type { LanguageCode, NavSection } from '../types/builder.ts';

interface SidebarProps {
  activeNav: NavSection;
  language: LanguageCode;
  collapsed: boolean;
  mobileOpen: boolean;
  platformName: string;
  onSelectNav: (nav: NavSection) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{ id: NavSection; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'apps', icon: FolderKanban },
  { id: 'create-app', icon: FilePlus2 },
  { id: 'form-builder', icon: Layers },
  { id: 'database', icon: Database },
  { id: 'records', icon: Table2 },
  { id: 'import-export', icon: FileSpreadsheet },
  { id: 'templates', icon: LayoutTemplate },
  { id: 'reports', icon: BarChart3 },
  { id: 'users', icon: Users },
  { id: 'settings', icon: Settings },
  { id: 'archive', icon: Archive },
  { id: 'help', icon: HelpCircle },
];

export function Sidebar({
  activeNav,
  language,
  collapsed,
  mobileOpen,
  platformName,
  onSelectNav,
  onToggleCollapse,
  onCloseMobile,
}: SidebarProps) {
  const t = TRANSLATIONS[language];

  const renderContent = (isMobile = false) => (
    <div className="flex h-full flex-col bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800">
      {/* Brand Row */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
              {platformName || t.brandName}
            </span>
          )}
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectNav(item.id);
                if (isMobile) onCloseMobile();
              }}
              title={collapsed && !isMobile ? t.nav[item.id] : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              } ${collapsed && !isMobile ? 'justify-center px-2' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || isMobile) && <span className="truncate">{t.nav[item.id]}</span>}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-150 ${
          collapsed ? 'w-[68px]' : 'w-[248px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{renderContent(false)}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 max-w-[80vw] h-full">{renderContent(true)}</div>
        </div>
      )}
    </>
  );
}
