import { useState } from 'react';
import {
  Bell,
  Check,
  Globe,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { TRANSLATIONS } from '../lib/i18n.ts';
import type {
  AppDefinition,
  AuditLog,
  LanguageCode,
  NavSection,
  ThemeMode,
  UserProfile,
} from '../types/builder.ts';

interface TopBarProps {
  user: UserProfile;
  apps: AppDefinition[];
  activeApp: AppDefinition | null;
  activeNav: NavSection;
  language: LanguageCode;
  themeMode: ThemeMode;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  auditLogs: AuditLog[];
  onSelectApp: (appId: string) => void;
  onSelectNav: (nav: NavSection) => void;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  onSignOut: () => void;
}

export function TopBar({
  user,
  apps,
  activeApp,
  activeNav,
  language,
  themeMode,
  saveStatus,
  auditLogs,
  onSelectApp,
  onSelectNav,
  onToggleLanguage,
  onToggleTheme,
  onOpenMobileMenu,
  onSignOut,
}: TopBarProps) {
  const t = TRANSLATIONS[language];
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const activeApps = apps.filter((a) => a.status !== 'archived');
  const searchResults = searchQuery.trim()
    ? activeApps.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
      {/* Left: Mobile Menu + Current Project Selector + Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <label htmlFor="project-selector" className="sr-only">
            {t.topbar.selectProject}
          </label>
          <select
            id="project-selector"
            value={activeApp?.id || ''}
            onChange={(e) => onSelectApp(e.target.value)}
            className="max-w-[200px] sm:max-w-[240px] truncate rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
          >
            {activeApps.length === 0 ? (
              <option value="">No active applications</option>
            ) : (
              activeApps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </select>

          <span className="hidden xl:inline text-xs text-slate-400">/</span>
          <span className="hidden xl:inline text-xs font-medium text-slate-600 dark:text-slate-400 truncate">
            {t.nav[activeNav]}
          </span>
        </div>
      </div>

      {/* Center: Global Search */}
      <div className="relative hidden md:block w-full max-w-xs lg:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.topbar.searchPlaceholder}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500"
        />
        {searchQuery.trim() && (
          <div className="absolute left-0 right-0 mt-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-40 max-h-64 overflow-y-auto p-1.5">
            {searchResults.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">No matching applications.</p>
            ) : (
              searchResults.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    onSelectApp(app.id);
                    onSelectNav('form-builder');
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {app.name}
                  </span>
                  <span className="text-[11px] text-slate-500 shrink-0">{app.status}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right: Save Status + Language + Theme + Notifications + Profile */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mr-1 whitespace-nowrap">
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {saveStatus === 'saving'
            ? t.topbar.saving
            : saveStatus === 'unsaved'
            ? t.topbar.unsaved
            : t.topbar.saved}
        </span>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          title="Switch English / বাংলা"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>{language === 'en' ? 'EN' : 'বাংলা'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          aria-label="Toggle theme"
        >
          {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifs((v) => !v);
              setShowUserMenu(false);
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            aria-label={t.topbar.notifications}
          >
            <Bell className="h-4 w-4" />
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-40 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {t.topbar.notifications}
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifs(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">No recent activity yet.</p>
                ) : (
                  auditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="py-2 text-xs">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{log.action}</p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">{log.details}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((v) => !v);
              setShowNotifs(false);
            }}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            <img
              src={user.photoURL || '/src/assets/images/avatar_admin_profile_1794846068887.jpg'}
              alt={user.displayName}
              referrerPolicy="no-referrer"
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="hidden md:inline text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[110px] truncate">
              {user.displayName}
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-40 p-2">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user.displayName}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                <p className="mt-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 capitalize">
                  Role: {user.role.replace('_', ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onSignOut();
                }}
                className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t.topbar.signOut}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
