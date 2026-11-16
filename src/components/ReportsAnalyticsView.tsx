import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { exportRecordsToCSV, exportRecordsToPDF } from '../lib/importExport.ts';
import { formatLocalizedNumber } from '../lib/i18n.ts';
import type {
  AppDefinition,
  DataRecord,
  FormDefinition,
  LanguageCode,
} from '../types/builder.ts';

interface ReportsAnalyticsViewProps {
  app: AppDefinition | null;
  forms: FormDefinition[];
  records: DataRecord[];
  language: LanguageCode;
}

const CHART_COLORS = ['#2563eb', '#0f766e', '#d97706', '#4338ca', '#dc2626', '#475569'];

export function ReportsAnalyticsView({
  app,
  forms,
  records,
  language,
}: ReportsAnalyticsViewProps) {
  const [selectedFormId, setSelectedFormId] = useState<string>(forms[0]?.id || '');
  const currentForm = forms.find((f) => f.id === selectedFormId) || forms[0] || null;
  const [granularity, setGranularity] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [groupFieldKey, setGroupFieldKey] = useState<string>('');

  const formRecords = useMemo(() => {
    if (!currentForm) return [];
    return records.filter((r) => r.formId === currentForm.id);
  }, [records, currentForm]);

  const categoricalFields = useMemo(() => {
    if (!currentForm) return [];
    return currentForm.fields.filter(
      (f) =>
        f.type === 'dropdown' ||
        f.type === 'radio' ||
        f.type === 'switch' ||
        f.type === 'short_text'
    );
  }, [currentForm]);

  const activeGroupKey = groupFieldKey || categoricalFields[0]?.key || '';

  const timeSeriesData = useMemo(() => {
    const map = new Map<string, number>();
    formRecords.forEach((rec) => {
      const ts = rec.createdAt as { toDate?: () => Date } | undefined;
      const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : new Date();
      const key =
        granularity === 'yearly'
          ? String(d.getFullYear())
          : granularity === 'monthly'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }));
  }, [formRecords, granularity]);

  const categoryBreakdown = useMemo(() => {
    if (!activeGroupKey) return [];
    const map = new Map<string, number>();
    formRecords.forEach((rec) => {
      const raw = rec.data?.[activeGroupKey];
      const label =
        raw === undefined || raw === null || raw === ''
          ? 'Unspecified'
          : typeof raw === 'boolean'
          ? raw
            ? 'Yes'
            : 'No'
          : String(raw);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [formRecords, activeGroupKey]);

  const numericSummaries = useMemo(() => {
    if (!currentForm) return [];
    const numFields = currentForm.fields.filter(
      (f) => f.type === 'number' || f.type === 'currency' || f.type === 'percentage'
    );
    return numFields.map((f) => {
      const nums = formRecords
        .map((r) => Number(r.data?.[f.key]))
        .filter((n) => !Number.isNaN(n));
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = nums.length > 0 ? sum / nums.length : 0;
      return {
        label: f.label,
        count: nums.length,
        sum,
        avg: Math.round(avg * 100) / 100,
      };
    });
  }, [currentForm, formRecords]);

  if (!app || !currentForm) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Select an application to view reports and analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Reports & Analytics — {app.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Daily, monthly, yearly, and custom field breakdowns across {formRecords.length} records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentForm.id}
            onChange={(e) => setSelectedFormId(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => exportRecordsToCSV(formRecords, currentForm.fields, `${currentForm.tableName}-report`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() =>
              exportRecordsToPDF(
                formRecords,
                currentForm.fields,
                `${app.name} Report — ${currentForm.name}`,
                `${currentForm.tableName}-report`
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            <span>PDF Report</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-xs text-slate-500">Total Records</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatLocalizedNumber(formRecords.length, language)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-xs text-slate-500">Active Entries</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatLocalizedNumber(formRecords.filter((r) => r.status === 'active').length, language)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <p className="text-xs text-slate-500">Distinct Categories ({activeGroupKey || 'N/A'})</p>
          <p className="mt-1 font-display text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatLocalizedNumber(categoryBreakdown.length, language)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Date-Based Entries
            </h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['daily', 'monthly', 'yearly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 text-xs font-medium rounded capitalize ${
                    granularity === g
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} name="Entries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Custom Field Breakdown
            </h2>
            <select
              value={activeGroupKey}
              onChange={(e) => setGroupFieldKey(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs"
            >
              {categoricalFields.map((f) => (
                <option key={f.id} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="h-60 w-full">
            {categoryBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No grouped data available yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {categoryBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Category Summary Table
          </h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2">Value</th>
                <th className="py-2 text-right">Records</th>
                <th className="py-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {categoryBreakdown.map((item) => (
                <tr key={item.name}>
                  <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{item.name}</td>
                  <td className="py-2 text-right tabular-nums">{item.value}</td>
                  <td className="py-2 text-right tabular-nums text-slate-500">
                    {formRecords.length > 0 ? Math.round((item.value / formRecords.length) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Numeric & Financial Aggregations
          </h3>
          {numericSummaries.length === 0 ? (
            <p className="py-6 text-xs text-slate-500">
              No numeric, currency, or percentage fields in this form.
            </p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-2">Field</th>
                  <th className="py-2 text-right">Total Sum</th>
                  <th className="py-2 text-right">Average</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {numericSummaries.map((ns) => (
                  <tr key={ns.label}>
                    <td className="py-2 font-medium text-slate-800 dark:text-slate-200">{ns.label}</td>
                    <td className="py-2 text-right tabular-nums">{formatLocalizedNumber(ns.sum, language)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">{formatLocalizedNumber(ns.avg, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
