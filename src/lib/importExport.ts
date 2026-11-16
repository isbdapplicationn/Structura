import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { DataRecord, FieldConfig } from '../types/builder.ts';

export interface ParsedImportFile {
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'json') {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const rows: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.records)
      ? parsed.records
      : [];
    const headerSet = new Set<string>();
    rows.forEach((row) => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach((k) => headerSet.add(k));
      }
    });
    return {
      headers: Array.from(headerSet),
      rows,
      fileName: file.name,
    };
  }

  // CSV or XLSX via SheetJS
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) {
    return { headers: [], rows: [], fileName: file.name };
  }
  const worksheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
  const headerSet = new Set<string>();
  rows.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));

  return {
    headers: Array.from(headerSet),
    rows,
    fileName: file.name,
  };
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export function buildExportRows(
  records: DataRecord[],
  fields: FieldConfig[]
): { headers: { key: string; label: string }[]; rows: Record<string, string>[] } {
  const exportFields = fields.filter(
    (f) => f.type !== 'section_header' && f.type !== 'divider' && f.type !== 'password'
  );
  const headers = [
    { key: '__autoNumber', label: 'Record #' },
    ...exportFields.map((f) => ({ key: f.key, label: f.label })),
    { key: '__status', label: 'Status' },
  ];

  const rows = records.map((rec) => {
    const row: Record<string, string> = {
      'Record #': String(rec.autoNumber ?? ''),
    };
    for (const f of exportFields) {
      row[f.label] = formatCellValue(rec.data?.[f.key]);
    }
    row['Status'] = rec.status;
    return row;
  });

  return { headers, rows };
}

export function exportRecordsToCSV(records: DataRecord[], fields: FieldConfig[], filename: string): void {
  const { rows } = buildExportRows(records, fields);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

export function exportRecordsToXLSX(records: DataRecord[], fields: FieldConfig[], filename: string): void {
  const { rows } = buildExportRows(records, fields);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Records');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportRecordsToJSON(records: DataRecord[], filename: string): void {
  const clean = records.map((r) => ({
    id: r.id,
    autoNumber: r.autoNumber,
    status: r.status,
    ...r.data,
  }));
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, `${filename}.json`);
}

export function exportRecordsToPDF(
  records: DataRecord[],
  fields: FieldConfig[],
  title: string,
  filename: string
): void {
  const { headers, rows } = buildExportRows(records, fields);
  const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleDateString()} · ${records.length} records`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [headers.map((h) => h.label)],
    body: rows.map((r) => headers.map((h) => r[h.label] ?? '')),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(`${filename}.pdf`);
}

export function exportRecordsToPrintableHTML(
  records: DataRecord[],
  fields: FieldConfig[],
  title: string,
  filename: string
): void {
  const { headers, rows } = buildExportRows(records, fields);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  body { font-family: 'DM Sans', 'Noto Sans Bengali', sans-serif; padding: 32px; color: #0f172a; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { font-size: 12px; color: #64748b; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Exported on ${new Date().toLocaleString()} · ${records.length} records</p>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h.label)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${headers.map((h) => `<td>${escapeHtml(r[h.label] ?? '')}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  triggerDownload(blob, `${filename}.html`);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
