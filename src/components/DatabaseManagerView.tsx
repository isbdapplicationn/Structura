import { useState } from 'react';
import {
  Database,
  KeyRound,
  Link2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { slugifyKey } from '../lib/fieldCatalog.ts';
import {
  createCustomTable,
  deleteDatabaseTable,
  makeId,
  updateDatabaseTable,
} from '../services/firestoreService.ts';
import type {
  AppDefinition,
  DatabaseTable,
  FieldType,
  TableColumn,
  UserProfile,
} from '../types/builder.ts';

interface DatabaseManagerViewProps {
  app: AppDefinition | null;
  tables: DatabaseTable[];
  user: UserProfile;
}

export function DatabaseManagerView({ app, tables, user }: DatabaseManagerViewProps) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tables[0]?.id || null);
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState('');
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<FieldType | 'relation'>('short_text');
  const [relTargetTableId, setRelTargetTableId] = useState('');
  const [relType, setRelType] = useState<'one-to-one' | 'one-to-many' | 'many-to-many'>('one-to-many');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DatabaseTable | null>(null);

  if (!app) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Select an application to inspect and customize its database tables.
        </p>
      </div>
    );
  }

  const activeTable = tables.find((t) => t.id === selectedTableId) || tables[0] || null;

  const handleAddColumn = async () => {
    if (!activeTable || !newColLabel.trim()) return;
    const targetTable = tables.find((t) => t.id === relTargetTableId);
    const col: TableColumn = {
      id: makeId('col'),
      key: slugifyKey(newColLabel),
      label: newColLabel.trim(),
      type: newColType,
      required: false,
      unique: false,
      ...(newColType === 'relation' && targetTable
        ? {
            relation: {
              targetTableId: targetTable.id,
              targetTableName: targetTable.name,
              relationType: relType,
              displayField: targetTable.columns[1]?.key || targetTable.primaryKey,
            },
          }
        : {}),
    };

    const updated: DatabaseTable = {
      ...activeTable,
      columns: [...activeTable.columns, col],
    };
    setSaving(true);
    try {
      await updateDatabaseTable(app.id, updated, user);
      setNewColLabel('');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleColumnProp = async (
    colId: string,
    prop: 'required' | 'unique' | 'isPrimaryKey'
  ) => {
    if (!activeTable) return;
    const nextCols = activeTable.columns.map((c) => {
      if (prop === 'isPrimaryKey') {
        return { ...c, isPrimaryKey: c.id === colId };
      }
      return c.id === colId ? { ...c, [prop]: !c[prop] } : c;
    });
    const pkCol = nextCols.find((c) => c.isPrimaryKey);
    await updateDatabaseTable(
      app.id,
      {
        ...activeTable,
        primaryKey: pkCol ? pkCol.key : activeTable.primaryKey,
        columns: nextCols,
      },
      user
    );
  };

  const handleRemoveColumn = async (colId: string) => {
    if (!activeTable) return;
    await updateDatabaseTable(
      app.id,
      {
        ...activeTable,
        columns: activeTable.columns.filter((c) => c.id !== colId),
      },
      user
    );
  };

  const handleRenameTable = async (newLabel: string) => {
    if (!activeTable || !newLabel.trim()) return;
    await updateDatabaseTable(
      app.id,
      {
        ...activeTable,
        label: newLabel.trim(),
        name: slugifyKey(newLabel),
      },
      user
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Database Manager
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Structured schemas auto-generated from "{app.name}" forms, plus custom tables, unique constraints, and relationships.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateTable(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Custom Table</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Tables List */}
        <div className="lg:col-span-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Application Tables ({tables.length})
          </h2>
          {tables.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">No tables defined yet.</p>
          ) : (
            tables.map((tbl) => {
              const active = activeTable?.id === tbl.id;
              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => setSelectedTableId(tbl.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                    active
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Database className="h-4 w-4 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {tbl.label}
                      </p>
                      <p className="text-[11px] font-mono-tabular text-slate-500 truncate">
                        {tbl.name} · {tbl.columns.length} columns
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Selected Table Structure */}
        <div className="lg:col-span-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          {!activeTable ? (
            <p className="py-12 text-center text-xs text-slate-500">
              Select a table to manage its fields, primary key, and relationships.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    defaultValue={activeTable.label}
                    key={activeTable.id}
                    onBlur={(e) => {
                      if (e.target.value !== activeTable.label) {
                        void handleRenameTable(e.target.value);
                      }
                    }}
                    className="font-display text-base font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 outline-none text-slate-900 dark:text-slate-100"
                  />
                  <span className="font-mono-tabular text-xs text-slate-500">
                    PK: {activeTable.primaryKey}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDeleteConfirm(activeTable)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Table</span>
                </button>
              </div>

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3">Column Label</th>
                      <th className="py-2 pr-3">Key</th>
                      <th className="py-2 pr-3">Type / Relation</th>
                      <th className="py-2 pr-3 text-center">Primary</th>
                      <th className="py-2 pr-3 text-center">Unique</th>
                      <th className="py-2 pr-3 text-center">Required</th>
                      <th className="py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {activeTable.columns.map((col) => (
                      <tr key={col.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                          {col.label}
                        </td>
                        <td className="py-2.5 pr-3 font-mono-tabular text-slate-600 dark:text-slate-400">
                          {col.key}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">
                          {col.relation ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Link2 className="h-3 w-3" />
                              {col.relation.relationType} → {col.relation.targetTableName}
                            </span>
                          ) : (
                            col.type.replace('_', ' ')
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <button
                            type="button"
                            onClick={() => void handleToggleColumnProp(col.id, 'isPrimaryKey')}
                            className={`p-1 rounded ${
                              col.isPrimaryKey ? 'text-amber-600' : 'text-slate-300 hover:text-slate-500'
                            }`}
                            title="Set Primary Key"
                          >
                            <KeyRound className="h-3.5 w-3.5 mx-auto" />
                          </button>
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={col.unique}
                            onChange={() => void handleToggleColumnProp(col.id, 'unique')}
                            className="accent-blue-600"
                          />
                        </td>
                        <td className="py-2.5 pr-3 text-center">
                          <input
                            type="checkbox"
                            checked={col.required}
                            onChange={() => void handleToggleColumnProp(col.id, 'required')}
                            className="accent-blue-600"
                          />
                        </td>
                        <td className="py-2.5 text-right">
                          {!col.isPrimaryKey && (
                            <button
                              type="button"
                              onClick={() => void handleRemoveColumn(col.id)}
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Column / Relationship */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Add Database Field or Table Relationship
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newColLabel}
                    onChange={(e) => setNewColLabel(e.target.value)}
                    placeholder="Column name..."
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                  <select
                    value={newColType}
                    onChange={(e) => setNewColType(e.target.value as FieldType | 'relation')}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                  >
                    <option value="short_text">Short Text</option>
                    <option value="long_text">Long Text</option>
                    <option value="number">Number</option>
                    <option value="currency">Currency</option>
                    <option value="date">Date</option>
                    <option value="email">Email</option>
                    <option value="switch">Boolean</option>
                    <option value="relation">Relationship (FK)</option>
                  </select>

                  {newColType === 'relation' && (
                    <>
                      <select
                        value={relTargetTableId}
                        onChange={(e) => setRelTargetTableId(e.target.value)}
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="">Target Table...</option>
                        {tables
                          .filter((t) => t.id !== activeTable.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                      </select>
                      <select
                        value={relType}
                        onChange={(e) =>
                          setRelType(e.target.value as 'one-to-one' | 'one-to-many' | 'many-to-many')
                        }
                        className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                      >
                        <option value="one-to-one">One-to-One</option>
                        <option value="one-to-many">One-to-Many</option>
                        <option value="many-to-many">Many-to-Many</option>
                      </select>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={saving || !newColLabel.trim()}
                    onClick={() => void handleAddColumn()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Add Column</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Custom Table Modal */}
      {showCreateTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newTableLabel.trim()) return;
              const created = await createCustomTable({
                app,
                name: newTableLabel,
                label: newTableLabel,
                columns: [
                  {
                    id: makeId('col'),
                    key: 'id',
                    label: 'ID',
                    type: 'auto_number',
                    required: true,
                    unique: true,
                    isPrimaryKey: true,
                  },
                  {
                    id: makeId('col'),
                    key: 'title',
                    label: 'Title',
                    type: 'short_text',
                    required: true,
                    unique: false,
                  },
                ],
                actor: user,
              });
              setNewTableLabel('');
              setShowCreateTable(false);
              setSelectedTableId(created.id);
            }}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Create Custom Database Table
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Table Name *
              </label>
              <input
                type="text"
                required
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                placeholder="e.g. Fee Invoices or Departments"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateTable(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
              >
                Create Table
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteConfirm)}
        title={`Delete table "${deleteConfirm?.label}"?`}
        description="Removing this table deletes its schema definition. Existing form records remain untouched."
        confirmLabel="Delete Table"
        destructive
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (deleteConfirm) {
            await deleteDatabaseTable(app.id, deleteConfirm, user);
            setDeleteConfirm(null);
            setSelectedTableId(null);
          }
        }}
      />
    </div>
  );
}
