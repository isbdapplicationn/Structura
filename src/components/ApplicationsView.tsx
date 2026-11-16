import { useState } from 'react';
import {
  Archive,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FolderOpen,
  Globe,
  Lock,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { AppIcon, AVAILABLE_APP_ICONS } from './AppIcon.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { formatLocalizedDate, TRANSLATIONS } from '../lib/i18n.ts';
import type {
  AppDefinition,
  FormDefinition,
  LanguageCode,
  NavSection,
  PublishAccess,
  UserProfile,
} from '../types/builder.ts';
import {
  createAppFromScratch,
  deleteAppPermanent,
  duplicateApp,
  publishApplication,
  unpublishApplication,
  updateAppMeta,
} from '../services/firestoreService.ts';

interface ApplicationsViewProps {
  mode: 'list' | 'create' | 'archive';
  apps: AppDefinition[];
  activeApp: AppDefinition | null;
  forms: FormDefinition[];
  user: UserProfile;
  language: LanguageCode;
  onSelectApp: (appId: string) => void;
  onNavigate: (nav: NavSection) => void;
  onOpenPublishedPreview: (slug: string) => void;
}

const THEME_SWATCHES = ['#2563eb', '#0f766e', '#1d4ed8', '#0284c7', '#b45309', '#15803d', '#0f172a', '#4338ca'];

export function ApplicationsView({
  mode,
  apps,
  activeApp,
  forms,
  user,
  language,
  onSelectApp,
  onNavigate,
  onOpenPublishedPreview,
}: ApplicationsViewProps) {
  const t = TRANSLATIONS[language];
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');

  // Create/Edit Application form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('Database');
  const [themeColor, setThemeColor] = useState('#2563eb');
  const [coverImage, setCoverImage] = useState('');
  const [creating, setCreating] = useState(false);

  // Rename / Edit Modal
  const [editingApp, setEditingApp] = useState<AppDefinition | null>(null);

  // Publish Modal
  const [publishingApp, setPublishingApp] = useState<AppDefinition | null>(null);
  const [publishAccess, setPublishAccess] = useState<PublishAccess>('public');
  const [publishPassword, setPublishPassword] = useState('');
  const [publishBusy, setPublishBusy] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Confirm Dialog
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    destructive: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { app } = await createAppFromScratch({
        name,
        description,
        icon,
        themeColor,
        coverImage: coverImage || undefined,
        owner: user,
      });
      setName('');
      setDescription('');
      onSelectApp(app.id);
      onNavigate('form-builder');
    } finally {
      setCreating(false);
    }
  };

  const handleExportAppSchema = (app: AppDefinition) => {
    const payload = {
      app,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${app.slug || 'app'}-schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (mode === 'create') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {t.nav['create-app']}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Define a new data entry application. A starter form and database table will be automatically provisioned.
          </p>
        </div>

        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Application Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Student Admission Registry or Asset Tracker"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and data collected by this application..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Application Icon
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {AVAILABLE_APP_ICONS.slice(0, 12).map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`h-9 rounded-lg border flex items-center justify-center transition-colors ${
                      icon === ic
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <AppIcon name={ic} className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Theme Color
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setThemeColor(swatch)}
                    className={`h-8 w-8 rounded-lg border-2 transition-transform ${
                      themeColor === swatch ? 'border-slate-900 dark:border-white scale-105' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Theme ${swatch}`}
                  />
                ))}
              </div>

              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mt-4 mb-1.5">
                Cover Image (Optional)
              </label>
              <select
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Clean Solid Header</option>
                <option value="/src/assets/images/cover_education_app_1794846069961.jpg">Academic & Library</option>
                <option value="/src/assets/images/cover_enterprise_app_1794846069342.jpg">Enterprise Operations</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onNavigate('templates')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Or start from 15 ready-made templates →
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('apps')}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                {t.common.cancel}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Application'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const filteredApps = apps.filter((a) => {
    if (mode === 'archive') {
      if (a.status !== 'archived') return false;
    } else {
      if (a.status === 'archived') return false;
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {mode === 'archive' ? t.nav.archive : t.nav.apps}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {mode === 'archive'
              ? 'Restore archived applications or permanently remove them.'
              : 'Create, configure, duplicate, and publish independent data entry applications.'}
          </p>
        </div>
        {mode !== 'archive' && (
          <button
            type="button"
            onClick={() => onNavigate('create-app')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>{t.dashboard.createNewApp}</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter applications..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
          />
        </div>

        {mode !== 'archive' && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['all', 'published', 'draft'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Applications Grid */}
      {filteredApps.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {mode === 'archive' ? 'Archive is empty' : 'No applications match your filter'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {mode === 'archive'
              ? 'Archived applications will appear here until restored or deleted.'
              : 'Create a custom application or launch from our 15 industry templates.'}
          </p>
          {mode !== 'archive' && (
            <button
              type="button"
              onClick={() => onNavigate('create-app')}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>{t.dashboard.createNewApp}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredApps.map((app) => {
            const isSelected = activeApp?.id === app.id;
            const appUrl = `${window.location.origin}/apps/${app.slug}`;
            return (
              <div
                key={app.id}
                className={`rounded-xl bg-white dark:bg-slate-900 border overflow-hidden flex flex-col justify-between transition-colors ${
                  isSelected
                    ? 'border-blue-500 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  {app.coverImage ? (
                    <div className="h-28 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <img
                        src={app.coverImage}
                        alt={app.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-2 w-full" style={{ backgroundColor: app.themeColor || '#2563eb' }} />
                  )}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: app.themeColor || '#2563eb' }}
                        >
                          <AppIcon name={app.icon} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {app.name}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="capitalize">{app.status}</span>
                            <span>·</span>
                            <span className="capitalize">{app.publishAccess}</span>
                            {app.publishedVersion > 0 && (
                              <>
                                <span>·</span>
                                <span className="tabular-nums">v{app.publishedVersion}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                      {app.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{app.formsCount} forms · {app.fieldsCount} fields</span>
                      <span>{app.recordsCount} records</span>
                    </div>

                    <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                      Updated {formatLocalizedDate(app.updatedAt, language)}
                    </p>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  {mode === 'archive' ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void updateAppMeta(app.id, { status: 'draft' }, user)
                        }
                        className="px-3 py-1.5 rounded-md bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
                      >
                        {t.common.restore}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmState({
                            open: true,
                            title: `Permanently delete "${app.name}"?`,
                            description: 'This will permanently delete the application, its forms, database schemas, and all stored records. This action cannot be undone.',
                            confirmLabel: 'Delete Permanently',
                            destructive: true,
                            onConfirm: async () => {
                              await deleteAppPermanent(app, user);
                            },
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectApp(app.id);
                            onNavigate('form-builder');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>{t.common.open}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectApp(app.id);
                            onNavigate('records');
                          }}
                          className="px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50"
                        >
                          Records
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Rename / Edit Details"
                          onClick={() => setEditingApp(app)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Duplicate Application"
                          onClick={() => void duplicateApp(app, user)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Publish Settings"
                          onClick={() => {
                            onSelectApp(app.id);
                            setPublishingApp(app);
                            setPublishAccess(app.publishAccess || 'public');
                            setPublishPassword(app.publishPassword || '');
                          }}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                        </button>
                        {app.status === 'published' && (
                          <button
                            type="button"
                            title={`Open Published App (${appUrl})`}
                            onClick={() => onOpenPublishedPreview(app.slug)}
                            className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Export Schema JSON"
                          onClick={() => handleExportAppSchema(app)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Archive Application"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Archive "${app.name}"?`,
                              description: 'Archived applications move to Trash / Archive and stop accepting public entries until restored.',
                              confirmLabel: 'Archive',
                              destructive: false,
                              onConfirm: async () => {
                                await updateAppMeta(app.id, { status: 'archived' }, user);
                              },
                            })
                          }
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-200/60 dark:hover:bg-slate-700"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rename / Edit Metadata Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updateAppMeta(
                editingApp.id,
                {
                  name: editingApp.name,
                  description: editingApp.description,
                  themeColor: editingApp.themeColor,
                },
                user
              );
              setEditingApp(null);
            }}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Edit Application Details
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={editingApp.name}
                onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={editingApp.description}
                onChange={(e) => setEditingApp({ ...editingApp, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Theme Accent
              </label>
              <div className="flex flex-wrap gap-2">
                {THEME_SWATCHES.map((sw) => (
                  <button
                    key={sw}
                    type="button"
                    onClick={() => setEditingApp({ ...editingApp, themeColor: sw })}
                    className={`h-7 w-7 rounded-md border-2 ${
                      editingApp.themeColor === sw ? 'border-slate-900 dark:border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: sw }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Publish Application Modal */}
      {publishingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Publish "{publishingApp.name}"
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Configure who can access the live standalone form runtime at{' '}
                  <span className="font-mono-tabular text-slate-700 dark:text-slate-300">
                    /apps/{publishingApp.slug}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {(
                [
                  { id: 'private', label: 'Private Application', desc: 'Only you (the owner) can open and enter records.' },
                  { id: 'team', label: 'Internal Team Application', desc: 'Assigned collaborators with Admin, Editor, or Viewer access.' },
                  { id: 'public', label: 'Public Form', desc: 'Anyone with the published URL can submit responses.' },
                  { id: 'password', label: 'Password-Protected Form', desc: 'Requires a form passcode before rendering.' },
                  { id: 'authenticated', label: 'Authenticated User Access', desc: 'Any signed-in platform user can access.' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    publishAccess === opt.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="publishAccess"
                    checked={publishAccess === opt.id}
                    onChange={() => setPublishAccess(opt.id)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {opt.id === 'public' ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      <span>{opt.label}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {publishAccess === 'password' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Access Passcode *
                </label>
                <input
                  type="text"
                  value={publishPassword}
                  onChange={(e) => setPublishPassword(e.target.value)}
                  placeholder="Enter access passcode..."
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between gap-2">
              <span className="font-mono-tabular text-xs text-slate-700 dark:text-slate-300 truncate">
                {window.location.origin}/apps/{publishingApp.slug}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(`${window.location.origin}/apps/${publishingApp.slug}`);
                  setCopiedSlug(publishingApp.slug);
                  setTimeout(() => setCopiedSlug(null), 1500);
                }}
                className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-[11px] font-medium whitespace-nowrap"
              >
                {copiedSlug === publishingApp.slug ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div>
                {publishingApp.status === 'published' && (
                  <button
                    type="button"
                    disabled={publishBusy}
                    onClick={async () => {
                      setPublishBusy(true);
                      try {
                        await unpublishApplication(publishingApp, user);
                        setPublishingApp(null);
                      } finally {
                        setPublishBusy(false);
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Unpublish
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPublishingApp(null)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={publishBusy || (publishAccess === 'password' && !publishPassword.trim())}
                  onClick={async () => {
                    setPublishBusy(true);
                    try {
                      await publishApplication({
                        app: publishingApp,
                        forms,
                        publishAccess,
                        publishPassword,
                        actor: user,
                      });
                      setPublishingApp(null);
                    } finally {
                      setPublishBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{publishBusy ? 'Publishing...' : 'Publish Live Version'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmState && (
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          destructive={confirmState.destructive}
          busy={confirmBusy}
          onCancel={() => setConfirmState(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await confirmState.onConfirm();
              setConfirmState(null);
            } finally {
              setConfirmBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
