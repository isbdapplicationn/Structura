import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { AppIcon } from './AppIcon.tsx';
import { APP_TEMPLATES } from '../data/templates.ts';
import { createAppFromTemplate } from '../services/firestoreService.ts';
import type { AppTemplate, LanguageCode, NavSection, UserProfile } from '../types/builder.ts';

interface TemplatesViewProps {
  user: UserProfile;
  language: LanguageCode;
  onSelectApp: (appId: string) => void;
  onNavigate: (nav: NavSection) => void;
}

export function TemplatesView({ user, language, onSelectApp, onNavigate }: TemplatesViewProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const categories = ['All', ...Array.from(new Set(APP_TEMPLATES.map((t) => t.category)))];

  const filtered = APP_TEMPLATES.filter((tpl) => {
    if (category !== 'All' && tpl.category !== category) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.nameBn.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleUseTemplate = async (tpl: AppTemplate) => {
    setCreatingId(tpl.id);
    try {
      const { app } = await createAppFromTemplate(tpl, user);
      onSelectApp(app.id);
      onNavigate('form-builder');
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {language === 'bn' ? 'টেমপ্লেট লাইব্রেরি (১৫টি)' : 'Templates Library (15 Ready-Made Apps)'}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Launch a complete data entry application with preconfigured fields, validation rules, conditional logic, and database tables. Fully customizable after creation.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-2 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: tpl.themeColor }}
                  >
                    <AppIcon name={tpl.icon} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {language === 'bn' ? tpl.nameBn : tpl.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {tpl.category} · {tpl.fields.length} fields
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'bn' ? tpl.descriptionBn : tpl.description}
              </p>

              <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                Includes: {tpl.fields.slice(0, 4).map((f) => f.label.split(' (')[0]).join(', ')}
                {tpl.fields.length > 4 ? ` +${tpl.fields.length - 4} more` : ''}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {tpl.tableName}
              </span>
              <button
                type="button"
                disabled={creatingId === tpl.id}
                onClick={() => void handleUseTemplate(tpl)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50"
              >
                <span>{creatingId === tpl.id ? 'Creating...' : 'Use Template'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
