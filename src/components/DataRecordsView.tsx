import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  BookmarkPlus,
  Check,
  Columns,
  Copy,
  Download,
  Edit3,
  Eye,
  Filter,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { DynamicFormRenderer } from './DynamicFormRenderer.tsx';
import {
  exportRecordsToCSV,
  exportRecordsToJSON,
  exportRecordsToPDF,
  exportRecordsToPrintableHTML,
  exportRecordsToXLSX,
} from '../lib/importExport.ts';
import { formatLocalizedDate, TRANSLATIONS } from '../lib/i18n.ts';
import { evaluateRecordFilter } from '../lib/logicEngine.ts';
import {
  bulkDeleteRecords,
  bulkUpdateRecordStatus,
  createRecord,
  deleteFilterPreset,
  makeId,
  saveFilterPreset,
  updateRecordData,
} from '../services/firestoreService.ts';
import type {
  AppDefinition,
  ConditionalOperator,
  DataRecord,
  DatabaseTable,
  FilterCondition,
  FilterPreset,
  FormDefinition,
  LanguageCode,
  UserProfile,
} from '../types/builder.ts';

interface DataRecordsViewProps {
  app: AppDefinition | null;
  forms: FormDefinition[];
  tables: DatabaseTable[];
  records: DataRecord[];
  presets: FilterPreset[];
  activeFormId: string | null;
  user: UserProfile;
  language: LanguageCode;
  defaultPageSize: number;
  onSelectForm: (formId: string) => void;
}

export function DataRecordsView({
  app,
  forms,
  tables,
  records,
  presets,
  activeFormId,
  user,
  language,
  defaultPageSize,
  onSelectForm,
}: DataRecordsViewProps) {
  const t = TRANSLATIONS[language];
  const currentForm = forms.find((f) => f.id === activeFormId) || forms[0] || null;
  const linkedTable = tables.find((tbl) => tbl.formId === currentForm?.id) || tables[0];

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('__autoNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [density, setDensity] = useState<'compact' | 'standard' | 'comfortable'>('standard');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize || 15);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Column visibility
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [showColPicker, setShowColPicker] = useState(false);

  // Advanced Filter Builder
  const [showFilters, setShowFilters] = useState(false);
  const [filterCombinator, setFilterCombinator] = useState<'AND' | 'OR'>('AND');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [presetName, setPresetName] = useState('');

  // Entry / Edit / Detail Modals
  const [entryModal, setEntryModal] = useState<{ open: boolean; editing: DataRecord | null }>({
    open: false,
    editing: null,
  });
  const [detailRecord, setDetailRecord] = useState<DataRecord | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ recordId: string; key: string; value: string } | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const formRecords = useMemo(() => {
    if (!currentForm) return [];
    return records.filter((r) => r.formId === currentForm.id);
  }, [records, currentForm]);

  const dataFields = useMemo(() => {
    if (!currentForm) return [];
    return currentForm.fields.filter(
      (f) => f.type !== 'section_header' && f.type !== 'divider' && f.type !== 'hidden' && f.type !== 'password'
    );
  }, [currentForm]);

  const visibleColumns = useMemo(() => {
    return dataFields.filter((f) => !hiddenCols.includes(f.key));
  }, [dataFields, hiddenCols]);

  const filteredRecords = useMemo(() => {
    let list = formRecords;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((rec) => {
        if (String(rec.autoNumber).includes(q)) return true;
        return Object.values(rec.data || {}).some((val) =>
          String(val ?? '').toLowerCase().includes(q)
        );
      });
    }

    if (filters.length > 0) {
      list = list.filter((rec) => {
        if (filterCombinator === 'OR') {
          return filters.some((c) => evaluateRecordFilter(rec, c));
        }
        return filters.every((c) => evaluateRecordFilter(rec, c));
      });
    }

    const sorted = [...list].sort((a, b) => {
      let va: unknown;
      let vb: unknown;
      if (sortKey === '__autoNumber') {
        va = a.autoNumber || 0;
        vb = b.autoNumber || 0;
      } else if (sortKey === '__status') {
        va = a.status;
        vb = b.status;
      } else {
        va = a.data?.[sortKey] ?? '';
        vb = b.data?.[sortKey] ?? '';
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    return sorted;
  }, [formRecords, search, filters, filterCombinator, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pagedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

  const nextAutoNumber = useMemo(() => {
    const maxNum = formRecords.reduce((m, r) => Math.max(m, r.autoNumber || 0), 0);
    return maxNum + 1;
  }, [formRecords]);

  if (!app || !currentForm) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Select an application with a form to manage its data records.
        </p>
      </div>
    );
  }

  const rowPadClass =
    density === 'compact' ? 'py-1.5' : density === 'comfortable' ? 'py-3.5' : 'py-2.5';

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDuplicateRecord = async (rec: DataRecord) => {
    await createRecord({
      app,
      formId: currentForm.id,
      tableId: linkedTable?.id || '',
      data: { ...rec.data },
      autoNumber: nextAutoNumber,
      actor: user,
    });
  };

  const handlePrintRecord = (rec: DataRecord) => {
    setDetailRecord(rec);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const recordsToExport =
    selectedIds.length > 0
      ? filteredRecords.filter((r) => selectedIds.includes(r.id))
      : filteredRecords;

  const formPresets = presets.filter((p) => p.formId === currentForm.id);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t.nav.records} — {app.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
            {filteredRecords.length} matching records · {currentForm.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={currentForm.id}
            onChange={(e) => {
              onSelectForm(e.target.value);
              setSelectedIds([]);
              setPage(1);
            }}
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
            onClick={() => setEntryModal({ open: true, editing: null })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>{t.records.addRecord}</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Toolbar */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t.records.searchRecords}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                showFilters || filters.length > 0
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{t.records.filters}</span>
              {filters.length > 0 && <span className="tabular-nums">({filters.length})</span>}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Column visibility */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColPicker((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <Columns className="h-3.5 w-3.5" />
                <span>{t.records.columns}</span>
              </button>
              {showColPicker && (
                <div className="absolute right-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-30 p-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {dataFields.map((f) => {
                    const visible = !hiddenCols.includes(f.key);
                    return (
                      <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(e) => {
                            setHiddenCols((prev) =>
                              e.target.checked
                                ? prev.filter((k) => k !== f.key)
                                : [...prev, f.key]
                            );
                          }}
                          className="accent-blue-600"
                        />
                        <span className="truncate">{f.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Density */}
            <select
              value={density}
              onChange={(e) => setDensity(e.target.value as 'compact' | 'standard' | 'comfortable')}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
              aria-label={t.records.density}
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="comfortable">Comfortable</option>
            </select>

            {/* Export dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{selectedIds.length > 0 ? `${t.records.exportSelected} (${selectedIds.length})` : t.common.export}</span>
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg z-30 p-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      exportRecordsToCSV(recordsToExport, currentForm.fields, currentForm.tableName);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportRecordsToXLSX(recordsToExport, currentForm.fields, currentForm.tableName);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Export Excel (XLSX)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportRecordsToJSON(recordsToExport, currentForm.tableName);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportRecordsToPDF(recordsToExport, currentForm.fields, `${app.name} — ${currentForm.name}`, currentForm.tableName);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportRecordsToPrintableHTML(recordsToExport, currentForm.fields, `${app.name} — ${currentForm.name}`, currentForm.tableName);
                      setExportMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Printable HTML (Bangla)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Filter Builder */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={filterCombinator}
                  onChange={(e) => setFilterCombinator(e.target.value as 'AND' | 'OR')}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="AND">Match ALL filters (AND)</option>
                  <option value="OR">Match ANY filter (OR)</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => [
                      ...prev,
                      {
                        id: makeId('f'),
                        fieldKey: dataFields[0]?.key || '__status',
                        operator: 'equals',
                        value: '',
                      },
                    ])
                  }
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  + Add Filter Condition
                </button>
              </div>

              {/* Saved Filter Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {formPresets.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setFilters(p.filters)}
                      className="font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteFilterPreset(app.id, p.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {filters.length > 0 && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name..."
                      className="w-32 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={!presetName.trim()}
                      onClick={async () => {
                        await saveFilterPreset({
                          appId: app.id,
                          appOwnerId: app.ownerId,
                          memberUids: app.memberUids,
                          formId: currentForm.id,
                          name: presetName.trim(),
                          filters,
                          createdBy: user.uid,
                        });
                        setPresetName('');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 dark:bg-blue-600 text-white text-xs disabled:opacity-50"
                    >
                      <BookmarkPlus className="h-3 w-3" />
                      <span>Save</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {filters.map((cond) => (
              <div key={cond.id} className="flex flex-wrap items-center gap-2">
                <select
                  value={cond.fieldKey}
                  onChange={(e) =>
                    setFilters((prev) =>
                      prev.map((c) => (c.id === cond.id ? { ...c, fieldKey: e.target.value } : c))
                    )
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                >
                  <option value="__status">Record Status</option>
                  <option value="__createdAt">Created Date</option>
                  {dataFields.map((f) => (
                    <option key={f.id} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  value={cond.operator}
                  onChange={(e) =>
                    setFilters((prev) =>
                      prev.map((c) =>
                        c.id === cond.id
                          ? { ...c, operator: e.target.value as ConditionalOperator | 'date_range' | 'numeric_range' }
                          : c
                      )
                    )
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="not_contains">Does Not Contain</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="date_range">Date Range</option>
                  <option value="numeric_range">Numeric Range</option>
                  <option value="is_empty">Is Empty</option>
                  <option value="is_not_empty">Is Not Empty</option>
                </select>

                {cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty' && (
                  <>
                    <input
                      type={cond.operator === 'date_range' ? 'date' : 'text'}
                      value={cond.value}
                      placeholder={cond.operator === 'numeric_range' ? 'Min...' : 'Value...'}
                      onChange={(e) =>
                        setFilters((prev) =>
                          prev.map((c) => (c.id === cond.id ? { ...c, value: e.target.value } : c))
                        )
                      }
                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                    />
                    {(cond.operator === 'date_range' || cond.operator === 'numeric_range') && (
                      <input
                        type={cond.operator === 'date_range' ? 'date' : 'text'}
                        value={cond.valueEnd || ''}
                        placeholder={cond.operator === 'numeric_range' ? 'Max...' : 'End date'}
                        onChange={(e) =>
                          setFilters((prev) =>
                            prev.map((c) => (c.id === cond.id ? { ...c, valueEnd: e.target.value } : c))
                          )
                        }
                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                      />
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setFilters((prev) => prev.filter((c) => c.id !== cond.id))}
                  className="p-1.5 text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bulk Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {selectedIds.length} record(s) selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await bulkUpdateRecordStatus(app.id, selectedIds, 'active', user.uid);
                  setSelectedIds([]);
                }}
                className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Mark Active
              </button>
              <button
                type="button"
                onClick={async () => {
                  await bulkUpdateRecordStatus(app.id, selectedIds, 'archived', user.uid);
                  setSelectedIds([]);
                }}
                className="px-3 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Archive Selected
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-red-600 text-white text-xs font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{t.records.deleteSelected}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden no-print">
        {pagedRecords.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t.records.noRecords}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Add a record manually or import existing records from CSV, Excel, or JSON.
            </p>
            <button
              type="button"
              onClick={() => setEntryModal({ open: true, editing: null })}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>{t.records.logFirst}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={pagedRecords.length > 0 && pagedRecords.every((r) => selectedIds.includes(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(pagedRecords.map((r) => r.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                      className="accent-blue-600"
                    />
                  </th>
                  <th className="py-2.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort('__autoNumber')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                    >
                      <span>#</span>
                      <ArrowDownUp className="h-3 w-3" />
                    </button>
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col.id} className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                      >
                        <span>{col.label}</span>
                        <ArrowDownUp className="h-3 w-3" />
                      </button>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {pagedRecords.map((rec) => {
                  const checked = selectedIds.includes(rec.id);
                  return (
                    <tr
                      key={rec.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                        checked ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <td className={`${rowPadClass} pl-4 pr-2`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedIds((prev) =>
                              e.target.checked
                                ? [...prev, rec.id]
                                : prev.filter((id) => id !== rec.id)
                            );
                          }}
                          className="accent-blue-600"
                        />
                      </td>
                      <td className={`${rowPadClass} px-3 font-mono-tabular text-slate-500`}>
                        #{rec.autoNumber}
                      </td>
                      {visibleColumns.map((col) => {
                        const rawVal = rec.data?.[col.key];
                        const isInlineEditing =
                          inlineEdit?.recordId === rec.id && inlineEdit.key === col.key;

                        if (isInlineEditing) {
                          return (
                            <td key={col.id} className={`${rowPadClass} px-3`}>
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) =>
                                    setInlineEdit({ ...inlineEdit, value: e.target.value })
                                  }
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      await updateRecordData({
                                        appId: app.id,
                                        recordId: rec.id,
                                        data: { ...rec.data, [col.key]: inlineEdit.value },
                                        actorUid: user.uid,
                                      });
                                      setInlineEdit(null);
                                    } else if (e.key === 'Escape') {
                                      setInlineEdit(null);
                                    }
                                  }}
                                  className="w-32 rounded border border-blue-500 bg-white dark:bg-slate-950 px-2 py-0.5 text-xs outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await updateRecordData({
                                      appId: app.id,
                                      recordId: rec.id,
                                      data: { ...rec.data, [col.key]: inlineEdit.value },
                                      actorUid: user.uid,
                                    });
                                    setInlineEdit(null);
                                  }}
                                  className="p-1 text-emerald-600"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          );
                        }

                        let displayVal = '—';
                        if (typeof rawVal === 'boolean') displayVal = rawVal ? 'Yes' : 'No';
                        else if (Array.isArray(rawVal)) displayVal = rawVal.join(', ') || '—';
                        else if (typeof rawVal === 'string' && rawVal.startsWith('data:image')) {
                          return (
                            <td key={col.id} className={`${rowPadClass} px-3`}>
                              <img
                                src={rawVal}
                                alt={col.label}
                                className="h-7 w-7 rounded object-cover border border-slate-200 dark:border-slate-700"
                              />
                            </td>
                          );
                        } else if (rawVal !== undefined && rawVal !== null && String(rawVal) !== '') {
                          displayVal = String(rawVal);
                        }

                        return (
                          <td
                            key={col.id}
                            onDoubleClick={() =>
                              setInlineEdit({
                                recordId: rec.id,
                                key: col.key,
                                value: displayVal === '—' ? '' : displayVal,
                              })
                            }
                            title="Double-click to inline edit"
                            className={`${rowPadClass} px-3 max-w-[200px] truncate text-slate-800 dark:text-slate-200 cursor-text ${
                              col.type === 'number' || col.type === 'currency' || col.type === 'percentage'
                                ? 'tabular-nums'
                                : ''
                            }`}
                          >
                            {col.type === 'currency' && displayVal !== '—'
                              ? `${col.currencySymbol || '৳'}${displayVal}`
                              : displayVal}
                          </td>
                        );
                      })}
                      <td className={`${rowPadClass} px-3 capitalize text-slate-600 dark:text-slate-400`}>
                        {rec.status}
                      </td>
                      <td className={`${rowPadClass} px-3 text-right whitespace-nowrap`}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailRecord(rec)}
                            title="View Details"
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEntryModal({ open: true, editing: rec })}
                            title="Edit Record"
                            className="p-1 text-slate-400 hover:text-blue-600"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicateRecord(rec)}
                            title="Duplicate Record"
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintRecord(rec)}
                            title="Print Record"
                            className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredRecords.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                Page {page} of {totalPages} ({filteredRecords.length} total)
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs"
              >
                <option value={10}>10 / page</option>
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Record Modal */}
      {entryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto no-print">
          <div className="w-full max-w-3xl my-8">
            <DynamicFormRenderer
              formId={currentForm.id}
              fields={currentForm.fields}
              appearance={currentForm.appearance}
              isMultiStep={currentForm.isMultiStep}
              steps={currentForm.steps}
              initialValues={entryModal.editing?.data}
              existingRecords={formRecords}
              editingRecordId={entryModal.editing?.id}
              nextAutoNumber={nextAutoNumber}
              showSaveAndAddAnother
              onCancel={() => setEntryModal({ open: false, editing: null })}
              onSubmit={async (values, opts) => {
                if (entryModal.editing) {
                  await updateRecordData({
                    appId: app.id,
                    recordId: entryModal.editing.id,
                    data: values,
                    actorUid: user.uid,
                  });
                  setEntryModal({ open: false, editing: null });
                } else {
                  await createRecord({
                    app,
                    formId: currentForm.id,
                    tableId: linkedTable?.id || '',
                    data: values,
                    autoNumber: nextAutoNumber,
                    actor: user,
                  });
                  if (!opts?.addAnother) {
                    setEntryModal({ open: false, editing: null });
                  }
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Record Detail / Print Modal */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {app.name} — Record #{detailRecord.autoNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {currentForm.name} · Created {formatLocalizedDate(detailRecord.createdAt, language)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-700 no-print"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dataFields.map((f) => {
                const v = detailRecord.data?.[f.key];
                return (
                  <div key={f.id} className="py-2.5 grid grid-cols-3 gap-3 text-xs">
                    <span className="font-medium text-slate-500 dark:text-slate-400">{f.label}</span>
                    <div className="col-span-2 text-slate-900 dark:text-slate-100 break-words">
                      {typeof v === 'string' && v.startsWith('data:image') ? (
                        <img src={v} alt={f.label} className="max-h-24 rounded border border-slate-200" />
                      ) : Array.isArray(v) ? (
                        v.join(', ') || '—'
                      ) : typeof v === 'boolean' ? (
                        v ? 'Yes' : 'No'
                      ) : (
                        String(v ?? '—')
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>{t.records.printRecord}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title={`Delete ${selectedIds.length} selected record(s)?`}
        description="Deleted records cannot be recovered. Make sure you have exported a backup if needed."
        confirmLabel="Delete Records"
        destructive
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeleteRecords(app, selectedIds, user);
          setSelectedIds([]);
          setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
}
