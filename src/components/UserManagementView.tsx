import { useEffect, useState } from 'react';
import { Shield, Trash2, UserPlus } from 'lucide-react';
import { formatLocalizedDate } from '../lib/i18n.ts';
import {
  addOrUpdateAppMember,
  listAllUsers,
  removeAppMember,
  updatePlatformUserRole,
} from '../services/firestoreService.ts';
import type {
  AppDefinition,
  AppMember,
  AppRole,
  AuditLog,
  LanguageCode,
  PlatformRole,
  UserProfile,
} from '../types/builder.ts';

interface UserManagementViewProps {
  app: AppDefinition | null;
  members: AppMember[];
  auditLogs: AuditLog[];
  currentUser: UserProfile;
  language: LanguageCode;
}

export function UserManagementView({
  app,
  members,
  auditLogs,
  currentUser,
  language,
}: UserManagementViewProps) {
  const [platformUsers, setPlatformUsers] = useState<UserProfile[]>([]);
  const [memberUid, setMemberUid] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<AppRole>('editor');
  const [adding, setAdding] = useState(false);

  const isSuperAdmin = currentUser.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) return;
    void listAllUsers().then(setPlatformUsers).catch(() => {});
  }, [isSuperAdmin]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !memberUid.trim() || !memberEmail.trim()) return;
    setAdding(true);
    try {
      await addOrUpdateAppMember({
        app,
        memberUid: memberUid.trim(),
        email: memberEmail.trim(),
        displayName: memberName.trim() || memberEmail.split('@')[0],
        role: memberRole,
        actor: currentUser,
      });
      setMemberUid('');
      setMemberEmail('');
      setMemberName('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-100">
          User Management & Permissions
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Enforce role-based access control across applications and inspect security audit logs.
        </p>
      </div>

      {/* Role Permissions Matrix */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 overflow-x-auto">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-600" />
          <span>Role-Based Access Control Matrix</span>
        </h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <th className="py-2 pr-4">Role</th>
              <th className="py-2 pr-4">Manage Platform Users</th>
              <th className="py-2 pr-4">Create / Edit Forms & Tables</th>
              <th className="py-2 pr-4">Add / Edit Records</th>
              <th className="py-2">View Records</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <tr>
              <td className="py-2.5 pr-4 font-semibold">Super Admin</td>
              <td className="py-2.5 pr-4 text-emerald-600">Full Access</td>
              <td className="py-2.5 pr-4 text-emerald-600">All Projects</td>
              <td className="py-2.5 pr-4 text-emerald-600">Allowed</td>
              <td className="py-2.5 text-emerald-600">Allowed</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-semibold">Admin</td>
              <td className="py-2.5 pr-4 text-slate-500">App Collaborators Only</td>
              <td className="py-2.5 pr-4 text-emerald-600">Assigned Apps</td>
              <td className="py-2.5 pr-4 text-emerald-600">Allowed</td>
              <td className="py-2.5 text-emerald-600">Allowed</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-semibold">Editor</td>
              <td className="py-2.5 pr-4 text-slate-400">Denied</td>
              <td className="py-2.5 pr-4 text-slate-400">Denied</td>
              <td className="py-2.5 pr-4 text-emerald-600">Allowed</td>
              <td className="py-2.5 text-emerald-600">Allowed</td>
            </tr>
            <tr>
              <td className="py-2.5 pr-4 font-semibold">Viewer</td>
              <td className="py-2.5 pr-4 text-slate-400">Denied</td>
              <td className="py-2.5 pr-4 text-slate-400">Denied</td>
              <td className="py-2.5 pr-4 text-slate-400">Denied</td>
              <td className="py-2.5 text-emerald-600">Read-Only</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* App Collaborators */}
      {app && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Collaborators for "{app.name}"
              </h2>
              <p className="text-xs text-slate-500">Owner: {app.ownerEmail}</p>
            </div>
          </div>

          <form onSubmit={handleAddCollaborator} className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              type="text"
              required
              value={memberUid}
              onChange={(e) => setMemberUid(e.target.value)}
              placeholder="User UID..."
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono-tabular"
            />
            <input
              type="email"
              required
              value={memberEmail}
              onChange={(e) => setMemberEmail(e.target.value)}
              placeholder="Collaborator email..."
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Display name..."
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
            <select
              value={memberRole}
              onChange={(e) => setMemberRole(e.target.value as AppRole)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-medium"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Assign Role</span>
            </button>
          </form>

          {members.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">No additional collaborators assigned yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {members.map((m) => (
                <div key={m.uid} className="py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {m.displayName} ({m.email})
                    </p>
                    <p className="text-[11px] font-mono-tabular text-slate-400">UID: {m.uid}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        void addOrUpdateAppMember({
                          app,
                          memberUid: m.uid,
                          email: m.email,
                          displayName: m.displayName,
                          role: e.target.value as AppRole,
                          actor: currentUser,
                        })
                      }
                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void removeAppMember(app, m.uid, currentUser)}
                      className="p-1 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform Users (Super Admin only) */}
      {isSuperAdmin && platformUsers.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3 overflow-x-auto">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Platform Users Directory ({platformUsers.length})
          </h2>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">UID</th>
                <th className="py-2 pr-3">Platform Role</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {platformUsers.map((u) => (
                <tr key={u.uid}>
                  <td className="py-2.5 pr-3 font-medium">{u.displayName}</td>
                  <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="py-2.5 pr-3 font-mono-tabular text-[11px] text-slate-400">{u.uid}</td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={u.role}
                      disabled={u.uid === currentUser.uid}
                      onChange={async (e) => {
                        const nextRole = e.target.value as PlatformRole;
                        await updatePlatformUserRole(u.uid, nextRole, u.status);
                        setPlatformUsers((prev) =>
                          prev.map((p) => (p.uid === u.uid ? { ...p, role: nextRole } : p))
                        );
                      }}
                      className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="py-2.5 capitalize">{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Logs */}
      <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Security & Activity Audit Logs
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-72 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No audit events recorded yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {log.action} · <span className="text-slate-500">{log.targetName}</span>
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 truncate">
                    {log.actorEmail} — {log.details}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  {formatLocalizedDate(log.createdAt, language)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
