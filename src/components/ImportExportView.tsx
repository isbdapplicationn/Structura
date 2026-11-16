import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import {
  exportRecordsToCSV,
  exportRecordsToJSON,
  exportRecordsToPDF,
  exportRecordsToPrintableHTML,
  exportRecordsToXLSX,
  parseImportFile,
  type ParsedImportFile,
} from '../lib/importExport.ts';
import { validateFormValues } from '../lib/validationEngine.ts';
import { batchImportRecords } from '../services/firestoreService.ts';
import type {
  AppDefinition,
  DataRecord,
  DatabaseTable,
  FormDefinition,
  UserProfile,
} from '../types/builder.ts';

interface ImportExportViewProps {
  app: AppDefinition | null;
  forms: FormDefinition[];
  tables: DatabaseTable[];
  records: DataRecord[];
  activeFormId: string | null;
  user: UserProfile;
  onSelectForm: (formId: string) => void;
}

export function ImportExportView({
  app,
  forms,
  tables,
  records,
  activeFormId,
  user,
  onSelectForm,
}: ImportExportViewProps) {
  const currentForm = forms.find((f) => f.id === activeFormId) || forms[0] || null;
  const linkedTable = tables.find((t) => t.formId === currentForm?.id) || tables[0];

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [validationErrors, setValidationErrors] = useState<Array<{ rowIndex: number; message: string }>>([]);
  const [validRows, setValidRows] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  if (!app || !currentForm) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Select an application with a form to import or export records.
        </p>
      </div>
    );
  }

  const formRecords = records.filter((r) => r.formId === currentForm.id);
  const targetFields = currentForm.fields.filter(
    (f) => f.type !== 'section_header' && f.type !== 'divider' && f.type !== 'auto_number'
  );

  const handleFileUpload = async (file: File) => {
    setParseError(null);
    setImportSummary(null);
    try {
      const res = await parseImportFile(file);
      if (res.rows.length === 0) {
        setParseError('The uploaded file contains no rows.');
        return;
      }
      setParsed(res);
      // Auto-map matching column names or labels
      const autoMap: Record<string, string> = {};
      targetFields.forEach((f) => {
        const match = res.headers.find(
          (h) =>
            h.trim().toLowerCase() === f.key.toLowerCase() ||
            h.trim().toLowerCase() === f.label.toLowerCase()
        );
        if (match) autoMap[f.key] = match;
      });
      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to parse file.');
    }
  };

  const handleValidateAndPreview = () => {
    if (!parsed) return;
    const errs: Array<{ rowIndex: number; message: string }> = [];
    const ready: Record<string, unknown>[] = [];
    const uniqueFields = targetFields.filter((f) => f.validation?.unique);

    parsed.rows.forEach((rawRow, idx) => {
      const mappedObj: Record<string, unknown> = {};
      targetFields.forEach((f) => {
        const srcHeader = mapping[f.key];
        if (srcHeader) {
          mappedObj[f.key] = rawRow[srcHeader];
        }
      });

      const res = validateFormValues(currentForm.fields, mappedObj, formRecords);
      if (!res.valid) {
        const msg = Object.values(res.errors).join('; ');
        errs.push({ rowIndex: idx + 1, message: msg });
        return;
      }

      if (skipDuplicates && uniqueFields.length > 0) {
        const isDup = ready.some((prevRow) =>
          uniqueFields.some(
            (uf) =>
              mappedObj[uf.key] &&
              String(prevRow[uf.key] ?? '').toLowerCase() === String(mappedObj[uf.key] ?? '').toLowerCase()
          )
        );
        if (isDup) {
          errs.push({ rowIndex: idx + 1, message: 'Duplicate unique value inside uploaded file.' });
          return;
        }
      }

      ready.push(mappedObj);
    });

    setValidationErrors(errs);
    setValidRows(ready);
    setStep(3);
  };

  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const startAuto = formRecords.reduce((m, r) => Math.max(m, r.autoNumber || 0), 0) + 1;
      const importedCount = await batchImportRecords({
        app,
        formId: currentForm.id,
        tableId: linkedTable?.id || '',
        rows: validRows,
        startingAutoNumber: startAuto,
        actor: user,
      });
      setImportSummary({ imported: importedCount, skipped: validationErrors.length });
      setStep(4);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Import & Export — {app.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Migrate structured data via CSV, Excel (XLSX), JSON, PDF, and Bangla-ready Printable HTML.
          </p>
        </div>
        <select
          value={currentForm.id}
          onChange={(e) => onSelectForm(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* IMPORT WORKFLOW (9-Step Guided Pipeline) */}
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Guided Data Import
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
              <span className={step === 1 ? 'font-semibold text-blue-600' : ''}>1. Upload</span>
              <span>·</span>
              <span className={step === 2 ? 'font-semibold text-blue-600' : ''}>2. Map</span>
              <span>·</span>
              <span className={step === 3 ? 'font-semibold text-blue-600' : ''}>3. Validate</span>
              <span>·</span>
              <span className={step === 4 ? 'font-semibold text-blue-600' : ''}>4. Summary</span>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-10 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <Upload className="h-8 w-8 text-blue-600 mb-3" />
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Select a CSV, XLSX, or JSON file to import
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  UTF-8 / Bangla Unicode supported automatically
                </p>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
              </label>

              {parseError && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
                  {parseError}
                </div>
              )}
            </div>
          )}

          {step === 2 && parsed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  File: {parsed.fileName} ({parsed.rows.length} rows detected)
                </span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="accent-blue-600"
                  />
                  <span>Prevent duplicate unique fields</span>
                </label>
              </div>

              {/* Preview first 3 rows */}
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      {parsed.headers.map((h) => (
                        <th key={h} className="px-3 py-2 font-medium text-slate-600 dark:text-slate-300">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsed.rows.slice(0, 3).map((r, i) => (
                      <tr key={i}>
                        {parsed.headers.map((h) => (
                          <td key={h} className="px-3 py-1.5 truncate max-w-[160px]">
                            {String(r[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Column Mapping */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Map File Columns to Form Fields
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {targetFields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
                      <span className="text-xs font-medium truncate">
                        {f.label} {f.required && <span className="text-red-500">*</span>}
                      </span>
                      <select
                        value={mapping[f.key] || ''}
                        onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                        className="w-40 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      >
                        <option value="">-- Skip --</option>
                        {parsed.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleValidateAndPreview}
                  className="px-5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
                >
                  Validate Rows
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900 p-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                    Ready to Import
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100 tabular-nums">
                    {validRows.length} rows
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-900 p-4">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    Skipped / Validation Errors
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100 tabular-nums">
                    {validationErrors.length} rows
                  </p>
                </div>
              </div>

              {validationErrors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {validationErrors.map((err, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-2 text-red-600 dark:text-red-400">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Row {err.rowIndex}: {err.message}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                >
                  Adjust Mapping
                </button>
                <button
                  type="button"
                  disabled={importing || validRows.length === 0}
                  onClick={() => void handleConfirmImport()}
                  className="px-5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Confirm & Import ${validRows.length} Records`}
                </button>
              </div>
            </div>
          )}

          {step === 4 && importSummary && (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
                Import Completed
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                Successfully imported {importSummary.imported} record(s) into "{currentForm.name}". Skipped {importSummary.skipped} invalid/duplicate row(s).
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setParsed(null);
                  setImportSummary(null);
                }}
                className="mt-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
              >
                Import Another File
              </button>
            </div>
          )}
        </div>

        {/* EXPORT PANEL */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Export Records ({formRecords.length})
            </h2>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download all records from "{currentForm.name}" in your preferred format.
          </p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => exportRecordsToCSV(formRecords, currentForm.fields, currentForm.tableName)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>CSV (UTF-8 with BOM)</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => exportRecordsToXLSX(formRecords, currentForm.fields, currentForm.tableName)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>Microsoft Excel (XLSX)</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() => exportRecordsToJSON(formRecords, currentForm.tableName)}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>Structured JSON</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() =>
                exportRecordsToPDF(
                  formRecords,
                  currentForm.fields,
                  `${app.name} — ${currentForm.name}`,
                  currentForm.tableName
                )
              }
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>PDF Document</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
            <button
              type="button"
              onClick={() =>
                exportRecordsToPrintableHTML(
                  formRecords,
                  currentForm.fields,
                  `${app.name} — ${currentForm.name}`,
                  currentForm.tableName
                )
              }
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <span>Printable HTML (Bangla Unicode)</span>
              <Download className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
