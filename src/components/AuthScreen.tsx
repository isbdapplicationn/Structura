import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Left brand panel */}
        <div className="p-8 md:p-10 bg-slate-900 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">Structura</span>
            </div>
            <h1 className="mt-8 font-display text-2xl md:text-3xl font-semibold tracking-tight leading-snug text-balance">
              Universal Data Entry App Builder
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Design dynamic forms, define conditional logic, auto-generate structured database tables, and publish standalone data entry applications in English and বাংলা.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 space-y-3 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
              <span>Persistent cloud database with role-based access control</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
              <span>26 field types · Conditional logic · Multi-step forms · CSV/XLSX/PDF</span>
            </div>
          </div>
        </div>

        {/* Right sign-in panel */}
        <div className="p-8 md:p-10 flex flex-col justify-center">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-100">
            Sign in to your workspace
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Authenticate with your Google account to create applications, customize forms, and manage records securely.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Your projects, schemas, and submitted data records are persisted securely to your workspace and remain available across sessions.
          </p>
        </div>
      </div>
    </div>
  );
}
