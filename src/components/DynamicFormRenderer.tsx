import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eraser,
  RotateCcw,
  Star,
  Upload,
} from 'lucide-react';
import type { DataRecord, FieldConfig, FormAppearance, FormStep } from '../types/builder.ts';
import { isFieldRequired, isFieldVisible } from '../lib/logicEngine.ts';
import { validateFormValues } from '../lib/validationEngine.ts';

interface DynamicFormRendererProps {
  formId: string;
  fields: FieldConfig[];
  appearance: FormAppearance;
  isMultiStep?: boolean;
  steps?: FormStep[];
  initialValues?: Record<string, unknown>;
  existingRecords?: DataRecord[];
  editingRecordId?: string;
  nextAutoNumber?: number;
  readOnlyPreview?: boolean;
  showSaveAndAddAnother?: boolean;
  onSubmit: (values: Record<string, unknown>, options?: { addAnother?: boolean }) => Promise<void> | void;
  onCancel?: () => void;
}

function SignaturePad({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    drawingRef.current = true;
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border border-slate-300 dark:border-slate-700 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={480}
          height={130}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="w-full h-[130px] touch-none cursor-crosshair block"
        />
        {!value && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Draw signature here
          </span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{value ? 'Signature captured' : 'Empty'}</span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </div>
  );
}

export function DynamicFormRenderer({
  formId,
  fields,
  appearance,
  isMultiStep = false,
  steps = [],
  initialValues,
  existingRecords = [],
  editingRecordId,
  nextAutoNumber = 1,
  readOnlyPreview = false,
  showSaveAndAddAnother = false,
  onSubmit,
  onCancel,
}: DynamicFormRendererProps) {
  const draftStorageKey = `structura_draft_${formId}_${editingRecordId || 'new'}`;

  const computeInitialState = () => {
    const base: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'auto_number') {
        const prefix = f.autoNumberPrefix || 'REC-';
        base[f.key] = initialValues?.[f.key] ?? `${prefix}${String(nextAutoNumber).padStart(4, '0')}`;
      } else if (initialValues && initialValues[f.key] !== undefined) {
        base[f.key] = initialValues[f.key];
      } else if (f.defaultValue !== undefined && f.defaultValue !== '') {
        base[f.key] = f.defaultValue;
      } else if (f.type === 'multi_select' || f.type === 'checkbox') {
        base[f.key] = [];
      } else if (f.type === 'switch') {
        base[f.key] = false;
      } else if (f.type === 'rating') {
        base[f.key] = 0;
      } else {
        base[f.key] = '';
      }
    }
    if (!editingRecordId && !readOnlyPreview) {
      try {
        const savedDraft = localStorage.getItem(draftStorageKey);
        if (savedDraft) {
          return { ...base, ...JSON.parse(savedDraft) };
        }
      } catch {
        // Ignore draft parse error
      }
    }
    return base;
  };

  const [values, setValues] = useState<Record<string, unknown>>(computeInitialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [submitBanner, setSubmitBanner] = useState<string | null>(null);

  useEffect(() => {
    setValues(computeInitialState());
    setErrors({});
    setCurrentStepIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, editingRecordId]);

  // Auto-save draft to localStorage
  useEffect(() => {
    if (readOnlyPreview || editingRecordId) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(values));
        setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // Ignore quota errors
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [values, draftStorageKey, readOnlyPreview, editingRecordId]);

  const activeSteps = useMemo(() => {
    if (!isMultiStep || steps.length === 0) return [];
    return steps;
  }, [isMultiStep, steps]);

  const currentStepId = activeSteps.length > 0 ? activeSteps[currentStepIdx]?.id : undefined;

  const visibleFields = useMemo(() => {
    return fields.filter((f) => {
      if (isMultiStep && activeSteps.length > 0) {
        const assignedStep = f.stepId || activeSteps[0].id;
        if (assignedStep !== currentStepId) return false;
      }
      return isFieldVisible(f, values);
    });
  }, [fields, isMultiStep, activeSteps, currentStepId, values]);

  const updateField = (key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleReset = () => {
    localStorage.removeItem(draftStorageKey);
    const fresh: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'auto_number') {
        fresh[f.key] = `${f.autoNumberPrefix || 'REC-'}${String(nextAutoNumber).padStart(4, '0')}`;
      } else if (f.type === 'multi_select' || f.type === 'checkbox') {
        fresh[f.key] = [];
      } else if (f.type === 'switch') {
        fresh[f.key] = false;
      } else if (f.type === 'rating') {
        fresh[f.key] = 0;
      } else {
        fresh[f.key] = f.defaultValue ?? '';
      }
    }
    setValues(fresh);
    setErrors({});
    setCurrentStepIdx(0);
    setDraftSavedAt(null);
  };

  const handleNextStep = () => {
    const res = validateFormValues(fields, values, existingRecords, editingRecordId, currentStepId);
    if (!res.valid) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setCurrentStepIdx((i) => Math.min(activeSteps.length - 1, i + 1));
  };

  const handleFormSubmit = async (addAnother = false) => {
    const res = validateFormValues(fields, values, existingRecords, editingRecordId);
    if (!res.valid) {
      setErrors(res.errors);
      // Jump to first step containing an error if multi-step
      if (isMultiStep && activeSteps.length > 0) {
        const firstErrKey = Object.keys(res.errors)[0];
        const errField = fields.find((f) => f.key === firstErrKey);
        if (errField?.stepId) {
          const stepIdx = activeSteps.findIndex((s) => s.id === errField.stepId);
          if (stepIdx >= 0) setCurrentStepIdx(stepIdx);
        }
      }
      return;
    }

    setSubmitting(true);
    setSubmitBanner(null);
    try {
      await onSubmit(values, { addAnother });
      localStorage.removeItem(draftStorageKey);
      if (addAnother) {
        handleReset();
        setSubmitBanner('Record saved. Ready for next entry.');
      }
    } catch (err) {
      setErrors({ __form: err instanceof Error ? err.message : 'Failed to submit record.' });
    } finally {
      setSubmitting(false);
    }
  };

  const widthClass =
    appearance.formWidth === 'sm'
      ? 'max-w-xl'
      : appearance.formWidth === 'md'
      ? 'max-w-3xl'
      : appearance.formWidth === 'lg'
      ? 'max-w-5xl'
      : 'max-w-full';

  const spacingClass =
    appearance.fieldSpacing === 'compact'
      ? 'gap-3'
      : appearance.fieldSpacing === 'spacious'
      ? 'gap-6'
      : 'gap-4';

  const radiusClass =
    appearance.borderRadius === 'none'
      ? 'rounded-none'
      : appearance.borderRadius === 'sm'
      ? 'rounded'
      : appearance.borderRadius === 'lg'
      ? 'rounded-xl'
      : 'rounded-lg';

  const isDarkTheme = appearance.themePreset === 'dark' || appearance.bgColor.toLowerCase() === '#0f172a';

  const inputBaseClass = (hasErr: boolean) => {
    const stylePart =
      appearance.inputStyle === 'filled'
        ? 'bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500'
        : appearance.inputStyle === 'underlined'
        ? 'bg-transparent border-0 border-b border-slate-300 dark:border-slate-700 rounded-none px-0 focus:border-blue-600'
        : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:border-blue-600';
    return `w-full border px-3 py-2 text-sm outline-none transition-colors ${
      appearance.inputStyle !== 'underlined' ? radiusClass : ''
    } ${stylePart} ${
      hasErr ? 'border-red-500 focus:border-red-600' : ''
    } ${isDarkTheme ? 'text-slate-100' : 'text-slate-900 dark:text-slate-100'}`;
  };

  const gridColsClass =
    appearance.columns === 1
      ? 'grid-cols-1'
      : appearance.columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2';

  const fontSizeClass =
    appearance.fontSize === 'sm' ? 'text-xs' : appearance.fontSize === 'lg' ? 'text-base' : 'text-sm';

  return (
    <div
      className={`mx-auto w-full ${widthClass} border border-slate-200 dark:border-slate-800 ${radiusClass} overflow-hidden shadow-sm ${
        isDarkTheme ? 'bg-slate-900 text-slate-100' : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
      }`}
      style={
        !isDarkTheme && appearance.bgColor && appearance.bgColor !== '#ffffff'
          ? { backgroundColor: appearance.bgColor }
          : undefined
      }
    >
      {/* Form Header */}
      <div
        className={`px-6 py-5 border-b border-slate-200 dark:border-slate-800 ${
          appearance.headerStyle === 'centered' ? 'text-center' : ''
        }`}
        style={
          appearance.headerStyle === 'banner'
            ? { backgroundColor: appearance.primaryColor || '#2563eb', color: '#ffffff' }
            : undefined
        }
      >
        {appearance.subtitle && (
          <p
            className={`text-xs font-medium tracking-wide ${
              appearance.headerStyle === 'banner' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {appearance.subtitle}
          </p>
        )}
        <h2 className="mt-1 font-display text-xl font-semibold">
          {appearance.title || 'Untitled Form'}
        </h2>
        {appearance.description && (
          <p
            className={`mt-1 text-sm ${
              appearance.headerStyle === 'banner' ? 'text-white/90' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {appearance.description}
          </p>
        )}

        {/* Multi-step progress */}
        {isMultiStep && activeSteps.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeSteps.map((step, idx) => {
              const active = idx === currentStepIdx;
              const completed = idx < currentStepIdx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => idx <= currentStepIdx && setCurrentStepIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600'
                      : completed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                  }`}
                >
                  <span className="tabular-nums">{idx + 1}.</span>
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Body */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleFormSubmit(false);
        }}
        className={`p-6 ${fontSizeClass}`}
      >
        {submitBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{submitBanner}</span>
          </div>
        )}

        {errors.__form && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900 px-4 py-3 text-xs text-red-700 dark:text-red-300">
            {errors.__form}
          </div>
        )}

        <div className={`grid ${gridColsClass} ${spacingClass}`}>
          {visibleFields.map((field) => {
            const colSpanClass =
              appearance.columns === 1
                ? 'col-span-1'
                : appearance.columns === 3
                ? field.colSpan === 3
                  ? 'md:col-span-3'
                  : field.colSpan === 2
                  ? 'md:col-span-2'
                  : 'col-span-1'
                : field.colSpan >= 2
                ? 'md:col-span-2'
                : 'col-span-1';

            if (field.type === 'section_header') {
              return (
                <div key={field.id} className={`${colSpanClass} pt-3 pb-1 border-b border-slate-200 dark:border-slate-800`}>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    {field.label}
                  </h3>
                  {field.helpText && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{field.helpText}</p>
                  )}
                </div>
              );
            }

            if (field.type === 'divider') {
              return (
                <div key={field.id} className={`${colSpanClass} py-2`}>
                  <hr className="border-slate-200 dark:border-slate-800" />
                </div>
              );
            }

            const req = isFieldRequired(field, values);
            const err = errors[field.key];
            const val = values[field.key];
            const isDisabled = field.disabled || field.readOnly;

            return (
              <div
                key={field.id}
                className={`${colSpanClass} ${
                  appearance.labelPosition === 'left'
                    ? 'grid grid-cols-1 sm:grid-cols-3 gap-2 items-start'
                    : 'space-y-1.5'
                }`}
              >
                <label
                  htmlFor={`inp_${field.id}`}
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 pt-1"
                >
                  <span>{field.label}</span>
                  {req && <span className="ml-1 text-red-500">*</span>}
                </label>

                <div className={appearance.labelPosition === 'left' ? 'sm:col-span-2 space-y-1' : 'space-y-1'}>
                  {/* Render appropriate field control */}
                  {(field.type === 'short_text' ||
                    field.type === 'email' ||
                    field.type === 'phone' ||
                    field.type === 'password' ||
                    field.type === 'url' ||
                    field.type === 'auto_number') && (
                    <input
                      id={`inp_${field.id}`}
                      type={
                        field.type === 'email'
                          ? 'email'
                          : field.type === 'password'
                          ? 'password'
                          : field.type === 'url'
                          ? 'url'
                          : field.type === 'phone'
                          ? 'tel'
                          : 'text'
                      }
                      value={String(val ?? '')}
                      disabled={isDisabled}
                      readOnly={field.type === 'auto_number' || field.readOnly}
                      placeholder={field.placeholder}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={`${inputBaseClass(Boolean(err))} ${
                        field.type === 'auto_number' ? 'font-mono-tabular bg-slate-50 dark:bg-slate-800/60' : ''
                      }`}
                    />
                  )}

                  {(field.type === 'number' || field.type === 'currency' || field.type === 'percentage') && (
                    <div className="relative flex items-center">
                      {field.type === 'currency' && (
                        <span className="absolute left-3 text-xs font-medium text-slate-500">
                          {field.currencySymbol || '৳'}
                        </span>
                      )}
                      <input
                        id={`inp_${field.id}`}
                        type="number"
                        step="any"
                        value={val === '' || val === undefined ? '' : String(val)}
                        disabled={isDisabled}
                        placeholder={field.placeholder}
                        onChange={(e) => updateField(field.key, e.target.value === '' ? '' : Number(e.target.value))}
                        className={`${inputBaseClass(Boolean(err))} tabular-nums ${
                          field.type === 'currency' ? 'pl-8' : ''
                        } ${field.type === 'percentage' ? 'pr-8' : ''}`}
                      />
                      {field.type === 'percentage' && (
                        <span className="absolute right-3 text-xs font-medium text-slate-500">%</span>
                      )}
                    </div>
                  )}

                  {field.type === 'long_text' && (
                    <textarea
                      id={`inp_${field.id}`}
                      rows={3}
                      value={String(val ?? '')}
                      disabled={isDisabled}
                      placeholder={field.placeholder}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={inputBaseClass(Boolean(err))}
                    />
                  )}

                  {(field.type === 'date' || field.type === 'time' || field.type === 'datetime') && (
                    <input
                      id={`inp_${field.id}`}
                      type={field.type === 'datetime' ? 'datetime-local' : field.type}
                      value={String(val ?? '')}
                      disabled={isDisabled}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={`${inputBaseClass(Boolean(err))} tabular-nums`}
                    />
                  )}

                  {field.type === 'dropdown' && (
                    <select
                      id={`inp_${field.id}`}
                      value={String(val ?? '')}
                      disabled={isDisabled}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      className={inputBaseClass(Boolean(err))}
                    >
                      <option value="">Select {field.label}...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'radio' && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      {(field.options || []).map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`radio_${field.id}`}
                            value={opt.value}
                            checked={val === opt.value}
                            disabled={isDisabled}
                            onChange={() => updateField(field.key, opt.value)}
                            className="accent-blue-600"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(field.type === 'checkbox' || field.type === 'multi_select') && (
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      {(field.options || []).map((opt) => {
                        const arr = Array.isArray(val) ? (val as string[]) : [];
                        const checked = arr.includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isDisabled}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...arr, opt.value]
                                  : arr.filter((v) => v !== opt.value);
                                updateField(field.key, next);
                              }}
                              className="accent-blue-600"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'switch' && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(val)}
                      disabled={isDisabled}
                      onClick={() => updateField(field.key, !val)}
                      className={`inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        val ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          val ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}

                  {field.type === 'rating' && (
                    <div className="flex items-center gap-1 pt-1">
                      {Array.from({ length: field.maxRating || 5 }).map((_, i) => {
                        const score = i + 1;
                        const active = Number(val || 0) >= score;
                        return (
                          <button
                            key={score}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => updateField(field.key, score)}
                            className="p-0.5 text-amber-400 hover:scale-110 transition-transform"
                            aria-label={`Rate ${score}`}
                          >
                            <Star
                              className={`h-5 w-5 ${
                                active ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          </button>
                        );
                      })}
                      <span className="ml-2 text-xs text-slate-500 tabular-nums">
                        {Number(val || 0)}/{field.maxRating || 5}
                      </span>
                    </div>
                  )}

                  {field.type === 'color' && (
                    <div className="flex items-center gap-3">
                      <input
                        id={`inp_${field.id}`}
                        type="color"
                        value={String(val || '#2563eb')}
                        disabled={isDisabled}
                        onChange={(e) => updateField(field.key, e.target.value)}
                        className="h-9 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent p-0.5"
                      />
                      <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-400">
                        {String(val || '#2563eb')}
                      </span>
                    </div>
                  )}

                  {(field.type === 'file_upload' || field.type === 'image_upload') && (
                    <div className="space-y-2">
                      <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                        <Upload className="h-4 w-4" />
                        <span>
                          {val
                            ? `Selected: ${String(val).slice(0, 48)}`
                            : `Upload ${field.type === 'image_upload' ? 'Image' : 'Document'}`}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept={field.validation?.allowedFileTypes}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const maxKb = field.validation?.maxFileSizeKb || 2048;
                            if (file.size / 1024 > maxKb) {
                              setErrors((prev) => ({
                                ...prev,
                                [field.key]: `File exceeds max size of ${maxKb} KB.`,
                              }));
                              return;
                            }
                            if (field.type === 'image_upload') {
                              const reader = new FileReader();
                              reader.onload = () => {
                                const result = typeof reader.result === 'string' ? reader.result : file.name;
                                // Keep payload compact for Firestore 1MB limit
                                updateField(field.key, result.length < 180000 ? result : file.name);
                              };
                              reader.readAsDataURL(file);
                            } else {
                              updateField(field.key, `${file.name} (${Math.round(file.size / 1024)} KB)`);
                            }
                          }}
                        />
                      </label>
                      {field.type === 'image_upload' && typeof val === 'string' && val.startsWith('data:image') && (
                        <img
                          src={val}
                          alt={field.label}
                          className="h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                        />
                      )}
                    </div>
                  )}

                  {field.type === 'signature' && (
                    <SignaturePad
                      value={String(val ?? '')}
                      disabled={isDisabled}
                      onChange={(dataUrl) => updateField(field.key, dataUrl)}
                    />
                  )}

                  {field.helpText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{field.helpText}</p>
                  )}
                  {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {draftSavedAt && !readOnlyPreview && (
              <span>Auto-saved draft at {draftSavedAt}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>

            {isMultiStep && activeSteps.length > 1 && currentStepIdx > 0 && (
              <button
                type="button"
                onClick={() => setCurrentStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
            )}

            {isMultiStep && activeSteps.length > 1 && currentStepIdx < activeSteps.length - 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="inline-flex items-center gap-1 px-5 py-2 text-xs font-medium rounded-lg text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: appearance.primaryColor || '#2563eb' }}
              >
                Next Step
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                {showSaveAndAddAnother && !editingRecordId && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleFormSubmit(true)}
                    className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    Save & Add Another
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-xs font-medium ${radiusClass} transition-opacity whitespace-nowrap shrink-0 disabled:opacity-50 ${
                    appearance.buttonStyle === 'outline'
                      ? 'border-2 bg-transparent'
                      : appearance.buttonStyle === 'soft'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'text-white'
                  }`}
                  style={
                    appearance.buttonStyle === 'outline'
                      ? {
                          borderColor: appearance.primaryColor || '#2563eb',
                          color: appearance.primaryColor || '#2563eb',
                        }
                      : appearance.buttonStyle === 'solid'
                      ? { backgroundColor: appearance.primaryColor || '#2563eb' }
                      : undefined
                  }
                >
                  {submitting
                    ? 'Saving...'
                    : editingRecordId
                    ? 'Update Record'
                    : appearance.submitButtonText || 'Submit Record'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
