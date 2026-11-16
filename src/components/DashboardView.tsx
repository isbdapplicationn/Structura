import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  FilePlus2,
  FileSpreadsheet,
  FolderPlus,
  Table2,
} from 'lucide-react';
import { AppIcon } from './AppIcon.tsx';
import { formatLocalizedDate, formatLocalizedNumber, TRANSLATIONS } from '../lib/i18n.ts';
import type {
  AppDefinition,
  AuditLog,
  DataRecord,
  FormDefinition,
  LanguageCode,
  NavSection,
} from '../types/builder.ts';

interface DashboardViewProps {
  apps: AppDefinition[];
  activeApp: AppDefinition | null;
  forms: FormDefinition[];
  records: DataRecord[];
  auditLogs: AuditLog[];
  language: LanguageCode;
  onSelectApp: (appId: string) => void;
  onNavigate: (nav: NavSection) => void;
}

export function DashboardView({
  apps,
  activeApp,
  forms,
  records,
  auditLogs,
  language,
  onSelectApp,
  onNavigate,
}: DashboardViewProps) {
  const t = TRANSLATIONS[language];
  const activeApps = apps.filter((a) => a.status !== 'archived');

  const stats = useMemo(() => {
    const totalApps = activeApps.length;
    const totalForms = activeApps.reduce((s, a) => s + (a.formsCount || 0), 0);
    const totalRecords = activeApps.reduce((s, a) => s + (a.recordsCount || 0), 0);
    const totalFields = activeApps.reduce((s, a) => s + (a.fieldsCount || 0), 0);
    return { totalApps, totalForms, totalRecords, totalFields };
  }, [activeApps]);

  const recordsByAppChart = useMemo(() => {
    return activeApps.slice(0, 6).map((a) => ({
      name: a.name.length > 14 ? `${a.name.slice(0, 14)}…` : a.name,
      records: a.recordsCount || 0,
      fields: a.fieldsCount || 0,
    }));
  }, [activeApps]);

  const entriesOverTime = useMemo(() => {
    const counts = new Map<string, number>();
    records.forEach((r) => {
      let day = 'Recent';
      const ts = r.createdAt as { toDate?: () => Date } | undefined;
      if (ts && typeof ts.toDate === 'function') {
        day = ts.toDate().toISOString().slice(0, 10);
      } else {
        day = new Date().toISOString().slice(0, 10);
      }
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    const list = Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({ date, entries }));
    if (list.length === 0) {
      return [
        { date: 'Today', entries: records.length },
      ];
    }
    return list;
  }, [records]);

  const recentEntries = records.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {t.dashboard.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t.dashboard.subtitle}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('create-app')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <FolderPlus className="h-4 w-4" />
            <span>{t.dashboard.createNewApp}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('form-builder')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>{t.dashboard.createNewForm}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('import-export')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t.dashboard.importData}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('records')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Table2 className="h-4 w-4" />
            <span>{t.dashboard.viewAllRecords}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.dashboard.totalApps, value: stats.totalApps, note: `${activeApps.filter((a) => a.status === 'published').length} published` },
          { label: t.dashboard.totalForms, value: stats.totalForms, note: activeApp ? `${forms.length} in ${activeApp.name}` : 'Across workspace' },
          { label: t.dashboard.totalRecords, value: stats.totalRecords, note: activeApp ? `${records.length} in active app` : 'Persistent entries' },
          { label: t.dashboard.totalFields, value: stats.totalFields, note: 'Configured schema columns' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {formatLocalizedNumber(kpi.value, language)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{kpi.note}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.entriesTrend}
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {activeApp ? activeApp.name : 'Workspace'}
            </span>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={entriesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="entries"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Applications: Records & Schema Fields
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>Full Reports</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recordsByAppChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="records" fill="#2563eb" radius={[4, 4, 0, 0]} name="Records" />
                <Bar dataKey="fields" fill="#64748b" radius={[4, 4, 0, 0]} name="Fields" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Projects + Recent Entries + Activity History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recently Updated Applications */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.recentProjects}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('apps')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeApps.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No applications created yet.
              </p>
            ) : (
              activeApps.slice(0, 5).map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => {
                    onSelectApp(app.id);
                    onNavigate('form-builder');
                  }}
                  className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: app.themeColor || '#2563eb' }}
                    >
                      <AppIcon name={app.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {app.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {app.formsCount} forms · {app.recordsCount} records · {app.status}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent Data Entries */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.dashboard.recentEntries}
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('records')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open table
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentEntries.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No records logged in the active application yet.
              </p>
            ) : (
              recentEntries.map((rec) => {
                const firstVal = Object.values(rec.data || {}).find(
                  (v) => typeof v === 'string' && v.trim().length > 0 && !v.startsWith('data:image')
                );
                return (
                  <div key={rec.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {firstVal ? String(firstVal) : `Record #${rec.autoNumber}`}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        #{rec.autoNumber} · {formatLocalizedDate(rec.createdAt, language)}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 capitalize">
                      {rec.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity History */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
            {t.dashboard.activityHistory}
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {auditLogs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Actions you take will appear here.
              </p>
            ) : (
              auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-900 dark:text-slate-100">
                      {log.action}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {formatLocalizedDate(log.createdAt, language)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {log.details}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
