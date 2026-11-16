import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import { AppIcon } from './AppIcon.tsx';
import { DynamicFormRenderer } from './DynamicFormRenderer.tsx';
import { getPublicAppBySlug, submitPublicRecord } from '../services/firestoreService.ts';
import type { PublicAppSnapshot } from '../types/builder.ts';

interface PublishedAppRuntimeProps {
  slug: string;
  onExitToBuilder?: () => void;
}

export function PublishedAppRuntime({ slug, onExitToBuilder }: PublishedAppRuntimeProps) {
  const [publicApp, setPublicApp] = useState<PublicAppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormIdx, setSelectedFormIdx] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPublicAppBySlug(slug)
      .then((snap) => {
        if (!snap) {
          setError('This published application could not be found or is no longer public.');
        } else {
          setPublicApp(snap);
          setUnlocked(snap.publishAccess !== 'password');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load published application.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <p className="text-sm text-slate-500">Loading published application...</p>
      </div>
    );
  }

  if (error || !publicApp) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {error || 'Application unavailable'}
          </p>
          {onExitToBuilder && (
            <button
              type="button"
              onClick={onExitToBuilder}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Builder</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const activeForm = publicApp.forms[selectedFormIdx] || publicApp.forms[0];

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput === (publicApp.publishPassword || '')) {
              setUnlocked(true);
              setPasswordError(null);
            } else {
              setPasswordError('Incorrect passcode. Please try again.');
            }
          }}
          className="max-w-sm w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: publicApp.themeColor }}
            >
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {publicApp.appName}
              </h1>
              <p className="text-xs text-slate-500">Password-protected form</p>
            </div>
          </div>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter form passcode..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
          />
          {passwordError && <p className="text-xs text-red-600">{passwordError}</p>}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
          >
            Unlock Application
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 sm:px-6 space-y-6">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: publicApp.themeColor }}
          >
            <AppIcon name={publicApp.icon} className="h-4 w-4" />
          </div>
          <div>
            <h1 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {publicApp.appName}
            </h1>
            <p className="text-xs text-slate-500">
              Published v{publicApp.publishedVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {publicApp.forms.length > 1 && (
            <select
              value={selectedFormIdx}
              onChange={(e) => {
                setSelectedFormIdx(Number(e.target.value));
                setSubmittedId(null);
              }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
            >
              {publicApp.forms.map((f, i) => (
                <option key={f.id} value={i}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {onExitToBuilder && (
            <button
              type="button"
              onClick={onExitToBuilder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Studio</span>
            </button>
          )}
        </div>
      </div>

      {submittedId ? (
        <div className="max-w-xl mx-auto rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            Response Recorded
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Your submission has been stored securely (Ref: <span className="font-mono-tabular">{submittedId}</span>).
          </p>
          <button
            type="button"
            onClick={() => setSubmittedId(null)}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
          >
            Submit Another Response
          </button>
        </div>
      ) : activeForm ? (
        <DynamicFormRenderer
          formId={activeForm.id}
          fields={activeForm.fields}
          appearance={activeForm.appearance}
          isMultiStep={activeForm.isMultiStep}
          steps={activeForm.steps}
          onSubmit={async (values) => {
            const id = await submitPublicRecord({
              publicApp,
              formId: activeForm.id,
              data: values,
            });
            setSubmittedId(id);
          }}
        />
      ) : null}
    </div>
  );
}
