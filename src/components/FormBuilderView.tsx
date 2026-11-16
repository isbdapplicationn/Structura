import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  Layers,
  Palette,
  Plus,
  Save,
  Sliders,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { DynamicFormRenderer } from './DynamicFormRenderer.tsx';
import {
  createFieldFromType,
  FIELD_LIBRARY,
  FORM_THEME_PRESETS,
  slugifyKey,
} from '../lib/fieldCatalog.ts';
import { TRANSLATIONS } from '../lib/i18n.ts';
import {
  createNewFormInApp,
  makeId,
  publishApplication,
  saveFormAndSyncTable,
} from '../services/firestoreService.ts';
import type {
  AppDefinition,
  ConditionalOperator,
  ConditionalRule,
  DatabaseTable,
  FieldConfig,
  FieldType,
  FormAppearance,
  FormDefinition,
  FormThemePreset,
  LanguageCode,
  UserProfile,
} from '../types/builder.ts';

interface FormBuilderViewProps {
  app: AppDefinition | null;
  forms: FormDefinition[];
  tables: DatabaseTable[];
  activeFormId: string | null;
  user: UserProfile;
  language: LanguageCode;
  onSelectForm: (formId: string) => void;
  onSaveStatusChange: (status: 'saved' | 'saving' | 'unsaved') => void;
}

const OPERATORS: Array<{ value: ConditionalOperator; label: string }> = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does Not Contain' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
  { value: 'is_not_empty', label: 'Is Not Empty' },
];

export function FormBuilderView({
  app,
  forms,
  tables,
  activeFormId,
  user,
  language,
  onSelectForm,
  onSaveStatusChange,
}: FormBuilderViewProps) {
  const t = TRANSLATIONS[language];
  const currentSourceForm = forms.find((f) => f.id === activeFormId) || forms[0] || null;

  const [draftForm, setDraftForm] = useState<FormDefinition | null>(currentSourceForm);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'validation' | 'logic'>('general');
  const [previewMode, setPreviewMode] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<string>('all');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Drag state
  const [draggedLibraryType, setDraggedLibraryType] = useState<FieldType | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  // New Form modal
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [newFormDesc, setNewFormDesc] = useState('');

  useEffect(() => {
    if (currentSourceForm) {
      setDraftForm(structuredClone(currentSourceForm));
      setSelectedFieldId(currentSourceForm.fields[0]?.id || null);
      setActiveStepTab('all');
      onSaveStatusChange('saved');
    } else {
      setDraftForm(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSourceForm?.id]);

  if (!app) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Select or create an application first to use the Form Builder.
        </p>
      </div>
    );
  }

  if (!draftForm) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          No forms found in "{app.name}".
        </p>
        <button
          type="button"
          onClick={() => setShowNewFormModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>Create First Form</span>
        </button>
      </div>
    );
  }

  const updateDraft = (updater: (prev: FormDefinition) => FormDefinition) => {
    setDraftForm((prev) => {
      if (!prev) return prev;
      onSaveStatusChange('unsaved');
      return updater(prev);
    });
  };

  const selectedField = draftForm.fields.find((f) => f.id === selectedFieldId) || null;

  const updateSelectedField = (patch: Partial<FieldConfig>) => {
    if (!selectedField) return;
    updateDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === selectedField.id ? { ...f, ...patch } : f)),
    }));
  };

  const addField = (type: FieldType, insertAt?: number) => {
    const stepId =
      draftForm.isMultiStep && activeStepTab !== 'all'
        ? activeStepTab
        : draftForm.steps[0]?.id;
    const newField = createFieldFromType(type, draftForm.fields.length, stepId);
    updateDraft((prev) => {
      const next = [...prev.fields];
      if (insertAt !== undefined && insertAt >= 0 && insertAt <= next.length) {
        next.splice(insertAt, 0, newField);
      } else {
        next.push(newField);
      }
      return { ...prev, fields: next };
    });
    setSelectedFieldId(newField.id);
  };

  const duplicateField = (field: FieldConfig) => {
    const copy: FieldConfig = {
      ...structuredClone(field),
      id: makeId('fld'),
      label: `${field.label} (Copy)`,
      key: `${field.key}_copy_${Math.random().toString(36).slice(2, 5)}`,
    };
    updateDraft((prev) => {
      const idx = prev.fields.findIndex((f) => f.id === field.id);
      const next = [...prev.fields];
      next.splice(idx + 1, 0, copy);
      return { ...prev, fields: next };
    });
    setSelectedFieldId(copy.id);
  };

  const removeField = (fieldId: string) => {
    updateDraft((prev) => ({
      ...prev,
      fields: prev.fields.filter((f) => f.id !== fieldId),
    }));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const moveField = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= draftForm.fields.length) return;
    updateDraft((prev) => {
      const next = [...prev.fields];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, fields: next };
    });
  };

  const handleCanvasDrop = (dropIndex?: number) => {
    if (draggedLibraryType) {
      addField(draggedLibraryType, dropIndex);
      setDraggedLibraryType(null);
      return;
    }
    if (draggedFieldIndex !== null && dropIndex !== undefined && draggedFieldIndex !== dropIndex) {
      updateDraft((prev) => {
        const next = [...prev.fields];
        const [moved] = next.splice(draggedFieldIndex, 1);
        const adjusted = draggedFieldIndex < dropIndex ? dropIndex - 1 : dropIndex;
        next.splice(adjusted, 0, moved);
        return { ...prev, fields: next };
      });
      setDraggedFieldIndex(null);
    }
  };

  const handleSaveForm = async () => {
    setSaving(true);
    onSaveStatusChange('saving');
    try {
      await saveFormAndSyncTable({
        app,
        form: draftForm,
        tables,
        allForms: forms,
        actor: user,
      });
      onSaveStatusChange('saved');
      setToast('Form schema & database table synced.');
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPublish = async () => {
    setPublishing(true);
    try {
      await saveFormAndSyncTable({
        app,
        form: draftForm,
        tables,
        allForms: forms,
        actor: user,
      });
      const mergedForms = forms.map((f) => (f.id === draftForm.id ? draftForm : f));
      const ver = await publishApplication({
        app,
        forms: mergedForms,
        publishAccess: app.publishAccess === 'private' ? 'public' : app.publishAccess,
        publishPassword: app.publishPassword,
        actor: user,
      });
      onSaveStatusChange('saved');
      setToast(`Published v${ver} at /apps/${app.slug}`);
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const displayedFields =
    draftForm.isMultiStep && activeStepTab !== 'all'
      ? draftForm.fields.filter((f) => (f.stepId || draftForm.steps[0]?.id) === activeStepTab)
      : draftForm.fields;

  const categories: Array<{ id: FieldConfig['type'] extends never ? never : 'basic' | 'selection' | 'media' | 'specialized' | 'layout'; label: string }> = [
    { id: 'basic', label: 'Basic Inputs' },
    { id: 'selection', label: 'Selection' },
    { id: 'media', label: 'Files & Signature' },
    { id: 'specialized', label: 'Specialized' },
    { id: 'layout', label: 'Layout' },
  ];

  const updateAppearance = (patch: Partial<FormAppearance>) => {
    updateDraft((prev) => ({
      ...prev,
      appearance: { ...prev.appearance, ...patch },
    }));
  };

  const applyThemePreset = (presetKey: FormThemePreset) => {
    const preset = FORM_THEME_PRESETS[presetKey];
    updateAppearance({
      themePreset: presetKey,
      bgColor: preset.bgColor,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      borderRadius: preset.borderRadius,
      inputStyle: preset.inputStyle,
      headerStyle: preset.headerStyle,
    });
  };

  return (
    <div className="space-y-4">
      {/* Contextual Builder Toolbar */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={draftForm.id}
            onChange={(e) => onSelectForm(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100"
          >
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowNewFormModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Form</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={draftForm.isMultiStep}
              onChange={(e) =>
                updateDraft((prev) => ({
                  ...prev,
                  isMultiStep: e.target.checked,
                  steps:
                    prev.steps.length > 0
                      ? prev.steps
                      : [{ id: 'step_1', title: 'Step 1' }],
                }))
              }
              className="accent-blue-600"
            />
            <span>{t.builder.multiStep}</span>
          </label>

          <select
            value={draftForm.appearance.columns}
            onChange={(e) => updateAppearance({ columns: Number(e.target.value) as 1 | 2 | 3 })}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200"
            aria-label="Form columns"
          >
            <option value={1}>1 Column</option>
            <option value={2}>2 Columns</option>
            <option value={3}>3 Columns</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {toast && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {toast}
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowAppearance((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
              showAppearance
                ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>{t.builder.appearance}</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
              previewMode
                ? 'border-slate-900 bg-slate-900 text-white dark:border-blue-600 dark:bg-blue-600'
                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>{previewMode ? t.builder.editMode : t.builder.previewForm}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveForm()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving...' : t.builder.saveForm}</span>
          </button>

          <button
            type="button"
            disabled={publishing}
            onClick={() => void handleQuickPublish()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium hover:bg-slate-800 dark:hover:bg-blue-700 whitespace-nowrap disabled:opacity-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>{publishing ? 'Publishing...' : t.builder.publishApp}</span>
          </button>
        </div>
      </div>

      {/* Form Appearance Drawer */}
      {showAppearance && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Form Layout & Appearance Customizer
            </h3>
            <button
              type="button"
              onClick={() => setShowAppearance(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Ready-Made Theme
              </label>
              <select
                value={draftForm.appearance.themePreset}
                onChange={(e) => applyThemePreset(e.target.value as FormThemePreset)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              >
                {Object.entries(FORM_THEME_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Form Title
              </label>
              <input
                type="text"
                value={draftForm.appearance.title}
                onChange={(e) => updateAppearance({ title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={draftForm.appearance.subtitle}
                onChange={(e) => updateAppearance({ subtitle: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Submit Button Text
              </label>
              <input
                type="text"
                value={draftForm.appearance.submitButtonText}
                onChange={(e) => updateAppearance({ submitButtonText: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Header Style
              </label>
              <select
                value={draftForm.appearance.headerStyle}
                onChange={(e) => updateAppearance({ headerStyle: e.target.value as FormAppearance['headerStyle'] })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              >
                <option value="clean">Clean</option>
                <option value="banner">Colored Banner</option>
                <option value="centered">Centered Editorial</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Input Style
              </label>
              <select
                value={draftForm.appearance.inputStyle}
                onChange={(e) => updateAppearance({ inputStyle: e.target.value as FormAppearance['inputStyle'] })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
              >
                <option value="outlined">Outlined</option>
                <option value="filled">Filled</option>
                <option value="underlined">Underlined</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Label Position & Width
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={draftForm.appearance.labelPosition}
                  onChange={(e) => updateAppearance({ labelPosition: e.target.value as FormAppearance['labelPosition'] })}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                >
                  <option value="top">Top Label</option>
                  <option value="left">Left Label</option>
                </select>
                <select
                  value={draftForm.appearance.formWidth}
                  onChange={(e) => updateAppearance({ formWidth: e.target.value as FormAppearance['formWidth'] })}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                >
                  <option value="sm">Compact</option>
                  <option value="md">Medium</option>
                  <option value="lg">Wide</option>
                  <option value="full">Full</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Primary & Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={draftForm.appearance.primaryColor}
                  onChange={(e) => updateAppearance({ primaryColor: e.target.value })}
                  className="h-8 w-10 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  title="Primary Color"
                />
                <input
                  type="color"
                  value={draftForm.appearance.bgColor}
                  onChange={(e) => updateAppearance({ bgColor: e.target.value })}
                  className="h-8 w-10 rounded border border-slate-300 dark:border-slate-700 cursor-pointer"
                  title="Background Color"
                />
                <select
                  value={draftForm.appearance.borderRadius}
                  onChange={(e) => updateAppearance({ borderRadius: e.target.value as FormAppearance['borderRadius'] })}
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs"
                >
                  <option value="none">Sharp</option>
                  <option value="sm">Subtle</option>
                  <option value="md">Rounded</option>
                  <option value="lg">Soft</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Mode vs 3-Panel Studio */}
      {previewMode ? (
        <div className="py-4">
          <DynamicFormRenderer
            formId={draftForm.id}
            fields={draftForm.fields}
            appearance={draftForm.appearance}
            isMultiStep={draftForm.isMultiStep}
            steps={draftForm.steps}
            readOnlyPreview
            onSubmit={async () => {
              setToast('Preview form validated successfully.');
              setTimeout(() => setToast(null), 2500);
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT PANEL: Field Library (26 Field Types) */}
          <div className="lg:col-span-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span>{t.builder.fieldLibrary} (26)</span>
            </h2>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t.builder.dragHint}
            </p>

            <div className="mt-4 space-y-4">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                    {FIELD_LIBRARY.filter((item) => item.category === cat.id).map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        draggable
                        onDragStart={() => {
                          setDraggedLibraryType(item.type);
                          setDraggedFieldIndex(null);
                        }}
                        onDragEnd={() => setDraggedLibraryType(null)}
                        onClick={() => addField(item.type)}
                        className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors flex items-center justify-between gap-2 group cursor-grab active:cursor-grabbing"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                            {language === 'bn' ? item.labelBn : item.label}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MIDDLE PANEL: Visual Form Canvas */}
          <div
            className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 min-h-[540px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleCanvasDrop();
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {draftForm.appearance.title || draftForm.name}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {draftForm.fields.length} fields · Table: {draftForm.tableName}
                </p>
              </div>
              <span className="text-[11px] text-slate-400">v{draftForm.version}</span>
            </div>

            {/* Multi-Step Tabs */}
            {draftForm.isMultiStep && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveStepTab('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                    activeStepTab === 'all'
                      ? 'bg-slate-900 text-white dark:bg-blue-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  All Steps
                </button>
                {draftForm.steps.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setActiveStepTab(st.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      activeStepTab === st.id
                        ? 'bg-slate-900 text-white dark:bg-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {idx + 1}. {st.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const stepNum = draftForm.steps.length + 1;
                    const newStep = { id: makeId('step'), title: `Step ${stepNum}`, description: '' };
                    updateDraft((prev) => ({ ...prev, steps: [...prev.steps, newStep] }));
                    setActiveStepTab(newStep.id);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  <Plus className="h-3 w-3" />
                  <span>{t.builder.addStep}</span>
                </button>
              </div>
            )}

            {/* Canvas Grid */}
            {displayedFields.length === 0 ? (
              <div className="mt-8 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Drop a field here or click any field in the library to start building.
                </p>
              </div>
            ) : (
              <div
                className={`mt-4 grid gap-3 ${
                  draftForm.appearance.columns === 1
                    ? 'grid-cols-1'
                    : draftForm.appearance.columns === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-2'
                }`}
              >
                {displayedFields.map((field) => {
                  const realIdx = draftForm.fields.findIndex((f) => f.id === field.id);
                  const isSelected = selectedFieldId === field.id;
                  const colClass =
                    draftForm.appearance.columns === 1
                      ? 'col-span-1'
                      : draftForm.appearance.columns === 3
                      ? field.colSpan === 3
                        ? 'col-span-3'
                        : field.colSpan === 2
                        ? 'col-span-2'
                        : 'col-span-1'
                      : field.colSpan >= 2
                      ? 'col-span-2'
                      : 'col-span-1';

                  return (
                    <div
                      key={field.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedFieldIndex(realIdx);
                        setDraggedLibraryType(null);
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCanvasDrop(realIdx);
                      }}
                      onClick={() => setSelectedFieldId(field.id)}
                      className={`${colClass} rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <GripVertical className="h-3.5 w-3.5 text-slate-400 shrink-0 cursor-grab" />
                          <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                            {field.label}
                          </span>
                          {field.required && <span className="text-xs text-red-500">*</span>}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveField(realIdx, -1);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveField(realIdx, 1);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateField(field);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Duplicate"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeField(field.id);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono-tabular truncate">{field.key}</span>
                        <span>
                          {field.type.replace('_', ' ')}
                          {field.visibilityLogic?.enabled ? ' · conditional' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Field Settings */}
          <div className="lg:col-span-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-blue-600" />
                <span>{t.builder.fieldSettings}</span>
              </h2>
              {selectedField && (
                <span className="font-mono-tabular text-[11px] text-slate-500">
                  {selectedField.type}
                </span>
              )}
            </div>

            {!selectedField ? (
              <p className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 px-4">
                {t.builder.noFieldSelected}
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                {/* Settings Sub-tabs */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(['general', 'validation', 'logic'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setSettingsTab(tab)}
                      className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                        settingsTab === tab
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t.builder[tab]}
                    </button>
                  ))}
                </div>

                {settingsTab === 'general' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Field Label
                      </label>
                      <input
                        type="text"
                        value={selectedField.label}
                        onChange={(e) => updateSelectedField({ label: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Database Key
                      </label>
                      <input
                        type="text"
                        value={selectedField.key}
                        onChange={(e) => updateSelectedField({ key: slugifyKey(e.target.value) })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Placeholder
                      </label>
                      <input
                        type="text"
                        value={selectedField.placeholder || ''}
                        onChange={(e) => updateSelectedField({ placeholder: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Help Text / Description
                      </label>
                      <input
                        type="text"
                        value={selectedField.helpText || ''}
                        onChange={(e) => updateSelectedField({ helpText: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Default Value
                      </label>
                      <input
                        type="text"
                        value={String(selectedField.defaultValue ?? '')}
                        onChange={(e) => updateSelectedField({ defaultValue: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Column Span
                        </label>
                        <select
                          value={selectedField.colSpan}
                          onChange={(e) => updateSelectedField({ colSpan: Number(e.target.value) as 1 | 2 | 3 })}
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                        >
                          <option value={1}>1 Column</option>
                          <option value={2}>2 Columns</option>
                          <option value={3}>Full (3 Cols)</option>
                        </select>
                      </div>

                      {draftForm.isMultiStep && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Form Step
                          </label>
                          <select
                            value={selectedField.stepId || draftForm.steps[0]?.id || ''}
                            onChange={(e) => updateSelectedField({ stepId: e.target.value })}
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                          >
                            {draftForm.steps.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Options editor for selection fields */}
                    {(selectedField.type === 'dropdown' ||
                      selectedField.type === 'multi_select' ||
                      selectedField.type === 'radio' ||
                      selectedField.type === 'checkbox') && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            Choice Options
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const opts = selectedField.options || [];
                              const n = opts.length + 1;
                              updateSelectedField({
                                options: [...opts, { label: `Option ${n}`, value: `Option ${n}` }],
                              });
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            + Add Option
                          </button>
                        </div>
                        {(selectedField.options || []).map((opt, idx) => (
                          <div key={idx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={opt.label}
                              onChange={(e) => {
                                const next = [...(selectedField.options || [])];
                                next[idx] = { label: e.target.value, value: e.target.value };
                                updateSelectedField({ options: next });
                              }}
                              className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const next = (selectedField.options || []).filter((_, i) => i !== idx);
                                updateSelectedField({ options: next });
                              }}
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedField.required}
                          onChange={(e) => updateSelectedField({ required: e.target.checked })}
                          className="accent-blue-600"
                        />
                        <span>Required</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedField.hidden}
                          onChange={(e) => updateSelectedField({ hidden: e.target.checked })}
                          className="accent-blue-600"
                        />
                        <span>Hidden</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedField.disabled}
                          onChange={(e) => updateSelectedField({ disabled: e.target.checked })}
                          className="accent-blue-600"
                        />
                        <span>Disabled</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedField.readOnly)}
                          onChange={(e) => updateSelectedField({ readOnly: e.target.checked })}
                          className="accent-blue-600"
                        />
                        <span>Read Only</span>
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === 'validation' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Min Length
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation.minLength ?? ''}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                minLength: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Max Length
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation.maxLength ?? ''}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Min Value
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation.minValue ?? ''}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                minValue: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Max Value
                        </label>
                        <input
                          type="number"
                          value={selectedField.validation.maxValue ?? ''}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: {
                                ...selectedField.validation,
                                maxValue: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                    </div>

                    {(selectedField.type === 'file_upload' || selectedField.type === 'image_upload') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Allowed File Types
                          </label>
                          <input
                            type="text"
                            value={selectedField.validation.allowedFileTypes || ''}
                            onChange={(e) =>
                              updateSelectedField({
                                validation: { ...selectedField.validation, allowedFileTypes: e.target.value },
                              })
                            }
                            placeholder=".pdf,.png,.jpg"
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Max Size (KB)
                          </label>
                          <input
                            type="number"
                            value={selectedField.validation.maxFileSizeKb ?? 2048}
                            onChange={(e) =>
                              updateSelectedField({
                                validation: { ...selectedField.validation, maxFileSizeKb: Number(e.target.value) },
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Custom Regex Pattern
                      </label>
                      <input
                        type="text"
                        value={selectedField.validation.regexPattern || ''}
                        onChange={(e) =>
                          updateSelectedField({
                            validation: { ...selectedField.validation, regexPattern: e.target.value },
                          })
                        }
                        placeholder="e.g. ^[0-9]{10,14}$"
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-mono-tabular"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Custom Error Message
                      </label>
                      <input
                        type="text"
                        value={selectedField.validation.customErrorMessage || ''}
                        onChange={(e) =>
                          updateSelectedField({
                            validation: { ...selectedField.validation, customErrorMessage: e.target.value },
                          })
                        }
                        placeholder="Optional custom error message..."
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedField.validation.emailValidation)}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: { ...selectedField.validation, emailValidation: e.target.checked },
                            })
                          }
                          className="accent-blue-600"
                        />
                        <span>Enforce Email Validation</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedField.validation.unique)}
                          onChange={(e) =>
                            updateSelectedField({
                              validation: { ...selectedField.validation, unique: e.target.checked },
                            })
                          }
                          className="accent-blue-600"
                        />
                        <span>Unique Value (Prevent Duplicate Records)</span>
                      </label>
                    </div>
                  </div>
                )}

                {settingsTab === 'logic' && (
                  <div className="space-y-4">
                    {(
                      [
                        { key: 'visibilityLogic', title: 'Conditional Visibility (Show field when...)' },
                        { key: 'requiredLogic', title: 'Conditional Required (Require field when...)' },
                      ] as const
                    ).map(({ key, title }) => {
                      const group = selectedField[key];
                      const otherFields = draftForm.fields.filter(
                        (f) => f.id !== selectedField.id && f.type !== 'section_header' && f.type !== 'divider'
                      );

                      const addRule = () => {
                        const newRule: ConditionalRule = {
                          id: makeId('rule'),
                          sourceFieldKey: otherFields[0]?.key || '',
                          operator: 'equals',
                          value: '',
                        };
                        updateSelectedField({
                          [key]: { ...group, enabled: true, rules: [...group.rules, newRule] },
                        });
                      };

                      return (
                        <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={group.enabled}
                                onChange={(e) =>
                                  updateSelectedField({
                                    [key]: { ...group, enabled: e.target.checked },
                                  })
                                }
                                className="accent-blue-600"
                              />
                              <span>{title}</span>
                            </label>
                          </div>

                          {group.enabled && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <select
                                  value={group.combinator}
                                  onChange={(e) =>
                                    updateSelectedField({
                                      [key]: { ...group, combinator: e.target.value as 'AND' | 'OR' },
                                    })
                                  }
                                  className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                                >
                                  <option value="AND">Match ALL rules (AND)</option>
                                  <option value="OR">Match ANY rule (OR)</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={addRule}
                                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  + Add Rule
                                </button>
                              </div>

                              {group.rules.map((rule) => (
                                <div key={rule.id} className="space-y-1.5 rounded bg-slate-50 dark:bg-slate-800/50 p-2">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={rule.sourceFieldKey}
                                      onChange={(e) =>
                                        updateSelectedField({
                                          [key]: {
                                            ...group,
                                            rules: group.rules.map((r) =>
                                              r.id === rule.id ? { ...r, sourceFieldKey: e.target.value } : r
                                            ),
                                          },
                                        })
                                      }
                                      className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                                    >
                                      {otherFields.map((of) => (
                                        <option key={of.id} value={of.key}>
                                          {of.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateSelectedField({
                                          [key]: {
                                            ...group,
                                            rules: group.rules.filter((r) => r.id !== rule.id),
                                          },
                                        })
                                      }
                                      className="p-1 text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <select
                                      value={rule.operator}
                                      onChange={(e) =>
                                        updateSelectedField({
                                          [key]: {
                                            ...group,
                                            rules: group.rules.map((r) =>
                                              r.id === rule.id
                                                ? { ...r, operator: e.target.value as ConditionalOperator }
                                                : r
                                            ),
                                          },
                                        })
                                      }
                                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                                    >
                                      {OPERATORS.map((op) => (
                                        <option key={op.value} value={op.value}>
                                          {op.label}
                                        </option>
                                      ))}
                                    </select>

                                    {rule.operator !== 'is_empty' && rule.operator !== 'is_not_empty' && (
                                      <input
                                        type="text"
                                        value={rule.value}
                                        placeholder="Value..."
                                        onChange={(e) =>
                                          updateSelectedField({
                                            [key]: {
                                              ...group,
                                              rules: group.rules.map((r) =>
                                                r.id === rule.id ? { ...r, value: e.target.value } : r
                                              ),
                                            },
                                          })
                                        }
                                        className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                                      />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Form Modal */}
      {showNewFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFormName.trim()) return;
              const created = await createNewFormInApp({
                app,
                name: newFormName,
                description: newFormDesc,
                actor: user,
              });
              setNewFormName('');
              setNewFormDesc('');
              setShowNewFormModal(false);
              onSelectForm(created.id);
            }}
            className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Create New Form in "{app.name}"
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Form Name *
              </label>
              <input
                type="text"
                required
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="e.g. Fee Payment Form"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                value={newFormDesc}
                onChange={(e) => setNewFormDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFormModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-blue-600 text-white"
              >
                Create Form
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
