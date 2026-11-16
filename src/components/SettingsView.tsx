import { useState } from 'react';
import { Check, Save } from 'lucide-react';
import type { LanguageCode, ThemeMode, UserProfile, WorkspaceSettings } from '../types/builder.ts';

interface SettingsViewProps {
  user: UserProfile;
  settings: WorkspaceSettings;
  rtlEnabled: boolean;
  onToggleRtl: (rtl: boolean) => void;
  onSaveSettings: (next: WorkspaceSettings) => Promise<void>;
}

export function SettingsView({
  user,
  settings,
  rtlEnabled,
  onToggleRtl,
  onSaveSettings,
}: SettingsViewProps) {
  const [form, setForm] = useState<WorkspaceSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(form);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Workspace Settings
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure localization, appearance, data defaults, and security preferences.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6"
      >
        {/* General Settings */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
            General & Localization
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Platform Name
              </label>
              <input
                type="text"
                value={form.platformName}
                onChange={(e) => setForm({ ...form, platformName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Interface Language
              </label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value as LanguageCode })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="en">English (EN)</option>
                <option value="bn">বাংলা (Bangla)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time Zone
              </label>
              <input
                type="text"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date Format
              </label>
              <select
                value={form.dateFormat}
                onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={rtlEnabled}
              onChange={(e) => onToggleRtl(e.target.checked)}
              className="accent-blue-600"
            />
            <span>Enable Right-to-Left (RTL) layout mode (Arabic / RTL preview support)</span>
          </label>
        </div>

        {/* Appearance & Data */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
            Appearance & Data Preferences
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Color Theme
              </label>
              <select
                value={form.themeMode}
                onChange={(e) => setForm({ ...form, themeMode: e.target.value as ThemeMode })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Default Table Page Size
              </label>
              <select
                value={form.defaultPageSize}
                onChange={(e) => setForm({ ...form, defaultPageSize: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs tabular-nums"
              >
                <option value={10}>10 rows</option>
                <option value={15}>15 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Number Formatting
              </label>
              <select
                value={form.numberFormat}
                onChange={(e) => setForm({ ...form, numberFormat: e.target.value as 'en-US' | 'bn-BD' })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="en-US">Western Numerals (1,234)</option>
                <option value="bn-BD">Bengali Numerals (১,২৩৪)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security Summary */}
        <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 text-xs">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Session & Security</p>
          <p className="text-slate-600 dark:text-slate-400">
            Authenticated as <span className="font-medium text-slate-900 dark:text-slate-100">{user.email}</span> · UID:{' '}
            <span className="font-mono-tabular">{user.uid}</span>
          </p>
          <p className="text-slate-500">
            All queries and mutations are verified against role-based Firestore security rules.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          {savedToast && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" />
              Settings saved
            </span>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
