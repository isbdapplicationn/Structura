import { Component, type ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase.ts';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { TopBar } from './components/TopBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ApplicationsView } from './components/ApplicationsView.tsx';
import { FormBuilderView } from './components/FormBuilderView.tsx';
import { DatabaseManagerView } from './components/DatabaseManagerView.tsx';
import { DataRecordsView } from './components/DataRecordsView.tsx';
import { ImportExportView } from './components/ImportExportView.tsx';
import { TemplatesView } from './components/TemplatesView.tsx';
import { ReportsAnalyticsView } from './components/ReportsAnalyticsView.tsx';
import { UserManagementView } from './components/UserManagementView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { HelpDocsView } from './components/HelpDocsView.tsx';
import { PublishedAppRuntime } from './components/PublishedAppRuntime.tsx';
import {
  ensureUserProfile,
  getUserSettings,
  saveUserSettings,
  seedStarterWorkspaceIfEmpty,
  subscribeAppMembers,
  subscribeApps,
  subscribeAuditLogs,
  subscribeFilterPresets,
  subscribeForms,
  subscribeRecords,
  subscribeTables,
  updateUserLanguage,
} from './services/firestoreService.ts';
import type {
  AppDefinition,
  AppMember,
  AuditLog,
  DatabaseTable,
  DataRecord,
  FilterPreset,
  FormDefinition,
  LanguageCode,
  NavSection,
  ThemeMode,
  UserProfile,
  WorkspaceSettings,
} from './types/builder.ts';

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getInitialSlugFromUrl(): string | null {
  const path = window.location.pathname;
  if (path.startsWith('/apps/')) {
    const slug = path.slice('/apps/'.length).split('/')[0]?.trim();
    return slug || null;
  }
  return null;
}

export default function App() {
  const [publishedSlug, setPublishedSlug] = useState<string | null>(getInitialSlugFromUrl);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [rtlEnabled, setRtlEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Workspace Data
  const [apps, setApps] = useState<AppDefinition[]>([]);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [members, setMembers] = useState<AppMember[]>([]);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Apply Dark Mode & RTL to documentElement
  useEffect(() => {
    const isDark = themeMode === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dir = rtlEnabled ? 'rtl' : 'ltr';
  }, [rtlEnabled]);

  // Listen to browser popstate for /apps/:slug
  useEffect(() => {
    const onPop = () => setPublishedSlug(getInitialSlugFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUserProfile(null);
        setApps([]);
        setAuthReady(true);
        return;
      }
      try {
        const profile = await ensureUserProfile(fbUser);
        setUserProfile(profile);
        setLanguage(profile.language || 'en');

        const userSettings = await getUserSettings(fbUser.uid);
        setSettings(userSettings);
        setLanguage(userSettings.language || 'en');
        setThemeMode(userSettings.themeMode || 'light');
        setSidebarCollapsed(Boolean(userSettings.sidebarCollapsed));

        await seedStarterWorkspaceIfEmpty(profile);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Applications & Audit Logs when authenticated
  useEffect(() => {
    if (!userProfile) return;
    const isSuper = userProfile.role === 'super_admin';

    const unsubApps = subscribeApps(userProfile.uid, isSuper, (list) => {
      setApps(list);
      const nonArchived = list.filter((a) => a.status !== 'archived');
      setActiveAppId((prev) => {
        if (prev && nonArchived.some((a) => a.id === prev)) return prev;
        return nonArchived[0]?.id || null;
      });
    });

    const unsubLogs = subscribeAuditLogs(userProfile.uid, isSuper, setAuditLogs);

    return () => {
      unsubApps();
      unsubLogs();
    };
  }, [userProfile]);

  // Subscribe to Active Application's Forms, Tables, Records, Members, Presets
  useEffect(() => {
    if (!userProfile || !activeAppId) {
      setForms([]);
      setTables([]);
      setRecords([]);
      setMembers([]);
      setPresets([]);
      return;
    }
    const isSuper = userProfile.role === 'super_admin';

    const u1 = subscribeForms(activeAppId, userProfile.uid, isSuper, (list) => {
      setForms(list);
      setActiveFormId((prev) => (prev && list.some((f) => f.id === prev) ? prev : list[0]?.id || null));
    });
    const u2 = subscribeTables(activeAppId, userProfile.uid, isSuper, setTables);
    const u3 = subscribeRecords(activeAppId, userProfile.uid, isSuper, setRecords);
    const u4 = subscribeAppMembers(activeAppId, userProfile.uid, isSuper, setMembers);
    const u5 = subscribeFilterPresets(activeAppId, userProfile.uid, isSuper, setPresets);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [userProfile, activeAppId]);

  const openPublishedPreview = (slug: string) => {
    window.history.pushState({}, '', `/apps/${slug}`);
    setPublishedSlug(slug);
  };

  const exitPublishedPreview = () => {
    window.history.pushState({}, '', '/');
    setPublishedSlug(null);
  };

  // Standalone Published App Runtime (/apps/:slug)
  if (publishedSlug) {
    return (
      <AppErrorBoundary>
        <PublishedAppRuntime
          slug={publishedSlug}
          onExitToBuilder={userProfile ? exitPublishedPreview : undefined}
        />
      </AppErrorBoundary>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <p className="text-sm text-slate-500">Initializing workspace...</p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <AppErrorBoundary>
        <AuthScreen />
      </AppErrorBoundary>
    );
  }

  const activeApp = apps.find((a) => a.id === activeAppId) || null;

  const handleToggleLanguage = async () => {
    const next: LanguageCode = language === 'en' ? 'bn' : 'en';
    setLanguage(next);
    await updateUserLanguage(userProfile.uid, next);
    if (settings) {
      const updated = { ...settings, language: next };
      setSettings(updated);
      await saveUserSettings(updated);
    }
  };

  const handleToggleTheme = async () => {
    const next: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    if (settings) {
      const updated = { ...settings, themeMode: next };
      setSettings(updated);
      await saveUserSettings(updated);
    }
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Sidebar
          activeNav={activeNav}
          language={language}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          platformName={settings?.platformName || 'Structura'}
          onSelectNav={setActiveNav}
          onToggleCollapse={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            if (settings) {
              void saveUserSettings({ ...settings, sidebarCollapsed: next });
            }
          }}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar
            user={userProfile}
            apps={apps}
            activeApp={activeApp}
            activeNav={activeNav}
            language={language}
            themeMode={themeMode}
            saveStatus={saveStatus}
            auditLogs={auditLogs}
            onSelectApp={(id) => {
              setActiveAppId(id);
              setActiveFormId(null);
            }}
            onSelectNav={setActiveNav}
            onToggleLanguage={() => void handleToggleLanguage()}
            onToggleTheme={() => void handleToggleTheme()}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onSignOut={() => void signOut(auth)}
          />

          <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
            {activeNav === 'dashboard' && (
              <DashboardView
                apps={apps}
                activeApp={activeApp}
                forms={forms}
                records={records}
                auditLogs={auditLogs}
                language={language}
                onSelectApp={setActiveAppId}
                onNavigate={setActiveNav}
              />
            )}

            {(activeNav === 'apps' || activeNav === 'create-app' || activeNav === 'archive') && (
              <ApplicationsView
                mode={
                  activeNav === 'create-app'
                    ? 'create'
                    : activeNav === 'archive'
                    ? 'archive'
                    : 'list'
                }
                apps={apps}
                activeApp={activeApp}
                forms={forms}
                user={userProfile}
                language={language}
                onSelectApp={setActiveAppId}
                onNavigate={setActiveNav}
                onOpenPublishedPreview={openPublishedPreview}
              />
            )}

            {activeNav === 'form-builder' && (
              <FormBuilderView
                app={activeApp}
                forms={forms}
                tables={tables}
                activeFormId={activeFormId}
                user={userProfile}
                language={language}
                onSelectForm={setActiveFormId}
                onSaveStatusChange={setSaveStatus}
              />
            )}

            {activeNav === 'database' && (
              <DatabaseManagerView app={activeApp} tables={tables} user={userProfile} />
            )}

            {activeNav === 'records' && (
              <DataRecordsView
                app={activeApp}
                forms={forms}
                tables={tables}
                records={records}
                presets={presets}
                activeFormId={activeFormId}
                user={userProfile}
                language={language}
                defaultPageSize={settings?.defaultPageSize || 15}
                onSelectForm={setActiveFormId}
              />
            )}

            {activeNav === 'import-export' && (
              <ImportExportView
                app={activeApp}
                forms={forms}
                tables={tables}
                records={records}
                activeFormId={activeFormId}
                user={userProfile}
                onSelectForm={setActiveFormId}
              />
            )}

            {activeNav === 'templates' && (
              <TemplatesView
                user={userProfile}
                language={language}
                onSelectApp={setActiveAppId}
                onNavigate={setActiveNav}
              />
            )}

            {activeNav === 'reports' && (
              <ReportsAnalyticsView
                app={activeApp}
                forms={forms}
                records={records}
                language={language}
              />
            )}

            {activeNav === 'users' && (
              <UserManagementView
                app={activeApp}
                members={members}
                auditLogs={auditLogs}
                currentUser={userProfile}
                language={language}
              />
            )}

            {activeNav === 'settings' && settings && (
              <SettingsView
                user={userProfile}
                settings={settings}
                rtlEnabled={rtlEnabled}
                onToggleRtl={setRtlEnabled}
                onSaveSettings={async (next) => {
                  setSettings(next);
                  setLanguage(next.language);
                  setThemeMode(next.themeMode);
                  await saveUserSettings(next);
                }}
              />
            )}

            {activeNav === 'help' && <HelpDocsView />}
          </main>
        </div>
      </div>
    </AppErrorBoundary>
  );
}
