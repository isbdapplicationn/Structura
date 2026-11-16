import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreError.ts';
import { createDefaultAppearance, slugifyKey } from '../lib/fieldCatalog.ts';
import { APP_TEMPLATES } from '../data/templates.ts';
import type {
  AppDefinition,
  AppMember,
  AppRole,
  AppTemplate,
  AuditLog,
  DatabaseTable,
  DataRecord,
  FieldConfig,
  FilterPreset,
  FormDefinition,
  LanguageCode,
  PlatformRole,
  PublicAppSnapshot,
  PublishAccess,
  TableColumn,
  UserProfile,
  WorkspaceSettings,
} from '../types/builder.ts';

const BOOTSTRAP_SUPER_ADMIN_EMAIL = 'najmulislamn1990@gmail.com';

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return `${base || 'app'}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const path = `users/${firebaseUser.uid}`;
  const ref = doc(db, 'users', firebaseUser.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const isSuper =
      firebaseUser.email?.toLowerCase() === BOOTSTRAP_SUPER_ADMIN_EMAIL &&
      firebaseUser.emailVerified;
    const profile: UserProfile = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      photoURL: firebaseUser.photoURL || '',
      role: isSuper ? 'super_admin' : 'admin',
      status: 'active',
      language: 'en',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profile);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserLanguage(uid: string, language: LanguageCode): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      language,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updatePlatformUserRole(
  targetUid: string,
  role: PlatformRole,
  status: 'active' | 'suspended'
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role,
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeApps(
  uid: string,
  isSuperAdmin: boolean,
  onData: (apps: AppDefinition[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'apps';
  const colRef = collection(db, 'apps');
  const q = isSuperAdmin
    ? query(colRef)
    : query(colRef, where('memberUids', 'array-contains', uid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as AppDefinition);
      list.sort((a, b) => {
        const ta = (a.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const tb = (b.updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function buildTableColumnsFromFields(fields: FieldConfig[], primaryKey = 'id'): TableColumn[] {
  const cols: TableColumn[] = [
    {
      id: 'col_pk_id',
      key: primaryKey,
      label: 'Record ID',
      type: 'auto_number',
      required: true,
      unique: true,
      isPrimaryKey: true,
    },
  ];
  for (const f of fields) {
    if (f.type === 'section_header' || f.type === 'divider') continue;
    cols.push({
      id: `col_${f.id}`,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      unique: Boolean(f.validation?.unique),
      defaultValue: typeof f.defaultValue === 'string' ? f.defaultValue : '',
    });
  }
  return cols;
}

export async function createAppFromScratch(params: {
  name: string;
  description: string;
  icon: string;
  themeColor: string;
  coverImage?: string;
  owner: UserProfile;
}): Promise<{ app: AppDefinition; form: FormDefinition; table: DatabaseTable }> {
  const appId = makeId('app');
  const formId = makeId('frm');
  const tableId = makeId('tbl');
  const slug = makeSlug(params.name);

  const defaultFields: FieldConfig[] = [
    {
      id: makeId('fld'),
      type: 'auto_number',
      label: 'Record Number',
      key: 'record_number',
      required: false,
      colSpan: 1,
      hidden: false,
      disabled: false,
      readOnly: true,
      autoNumberPrefix: 'REC-',
      validation: {},
      visibilityLogic: { enabled: false, combinator: 'AND', rules: [] },
      requiredLogic: { enabled: false, combinator: 'AND', rules: [] },
    },
    {
      id: makeId('fld'),
      type: 'short_text',
      label: 'Full Name',
      key: 'full_name',
      placeholder: 'Enter name...',
      required: true,
      colSpan: 1,
      hidden: false,
      disabled: false,
      validation: { minLength: 2, maxLength: 120 },
      visibilityLogic: { enabled: false, combinator: 'AND', rules: [] },
      requiredLogic: { enabled: false, combinator: 'AND', rules: [] },
    },
    {
      id: makeId('fld'),
      type: 'email',
      label: 'Email Address',
      key: 'email',
      placeholder: 'name@example.com',
      required: false,
      colSpan: 1,
      hidden: false,
      disabled: false,
      validation: { emailValidation: true },
      visibilityLogic: { enabled: false, combinator: 'AND', rules: [] },
      requiredLogic: { enabled: false, combinator: 'AND', rules: [] },
    },
    {
      id: makeId('fld'),
      type: 'long_text',
      label: 'Notes',
      key: 'notes',
      placeholder: 'Additional details...',
      required: false,
      colSpan: 2,
      hidden: false,
      disabled: false,
      validation: {},
      visibilityLogic: { enabled: false, combinator: 'AND', rules: [] },
      requiredLogic: { enabled: false, combinator: 'AND', rules: [] },
    },
  ];

  const appearance = createDefaultAppearance(params.name, params.themeColor);

  const appDoc: AppDefinition = {
    id: appId,
    name: params.name.trim(),
    slug,
    description: params.description.trim(),
    icon: params.icon || 'Database',
    themeColor: params.themeColor || '#2563eb',
    ...(params.coverImage ? { coverImage: params.coverImage } : {}),
    status: 'draft',
    publishAccess: 'private',
    publishedVersion: 0,
    draftVersion: 1,
    ownerId: params.owner.uid,
    ownerEmail: params.owner.email,
    memberUids: [params.owner.uid],
    formsCount: 1,
    recordsCount: 0,
    fieldsCount: defaultFields.length,
    layoutConfig: appearance,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const formDoc: FormDefinition = {
    id: formId,
    appId,
    appOwnerId: params.owner.uid,
    memberUids: [params.owner.uid],
    name: `${params.name.trim()} Form`,
    description: params.description.trim(),
    tableName: slugifyKey(params.name) || 'records',
    isMultiStep: false,
    steps: [{ id: 'step_1', title: 'Main Section', description: '' }],
    fields: defaultFields,
    appearance,
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const tableDoc: DatabaseTable = {
    id: tableId,
    appId,
    appOwnerId: params.owner.uid,
    memberUids: [params.owner.uid],
    formId,
    name: formDoc.tableName,
    label: `${params.name.trim()} Table`,
    primaryKey: 'id',
    columns: buildTableColumnsFromFields(defaultFields),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'apps', appId), appDoc);
    batch.set(doc(db, 'apps', appId, 'forms', formId), formDoc);
    batch.set(doc(db, 'apps', appId, 'tables', tableId), tableDoc);
    await batch.commit();

    await logAuditEvent({
      actor: params.owner,
      action: 'Created Application',
      targetType: 'application',
      targetId: appId,
      targetName: appDoc.name,
      appId,
      details: `Created application "${appDoc.name}" with initial form and table.`,
    });

    return { app: appDoc, form: formDoc, table: tableDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${appId}`);
  }
}

export async function createAppFromTemplate(
  template: AppTemplate,
  owner: UserProfile,
  customName?: string
): Promise<{ app: AppDefinition; form: FormDefinition; table: DatabaseTable }> {
  const appId = makeId('app');
  const formId = makeId('frm');
  const tableId = makeId('tbl');
  const name = (customName || template.name).trim();
  const slug = makeSlug(name);

  const fields: FieldConfig[] = template.fields.map((f, i) => ({
    ...f,
    id: `fld_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 5)}`,
  }));

  const appearance = {
    ...createDefaultAppearance(template.formName, template.themeColor),
    ...(template.appearance || {}),
    title: template.formName,
    description: template.description,
  };

  const appDoc: AppDefinition = {
    id: appId,
    name,
    slug,
    description: template.description,
    icon: template.icon,
    themeColor: template.themeColor,
    ...(template.coverImage ? { coverImage: template.coverImage } : {}),
    status: 'draft',
    publishAccess: 'private',
    publishedVersion: 0,
    draftVersion: 1,
    ownerId: owner.uid,
    ownerEmail: owner.email,
    memberUids: [owner.uid],
    formsCount: 1,
    recordsCount: 0,
    fieldsCount: fields.length,
    layoutConfig: appearance,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const formDoc: FormDefinition = {
    id: formId,
    appId,
    appOwnerId: owner.uid,
    memberUids: [owner.uid],
    name: template.formName,
    description: template.description,
    tableName: template.tableName,
    isMultiStep: Boolean(template.isMultiStep),
    steps: template.steps || [{ id: 'step_1', title: 'General Information', description: '' }],
    fields,
    appearance,
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const tableDoc: DatabaseTable = {
    id: tableId,
    appId,
    appOwnerId: owner.uid,
    memberUids: [owner.uid],
    formId,
    name: template.tableName,
    label: `${name} Table`,
    primaryKey: 'id',
    columns: buildTableColumnsFromFields(fields),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'apps', appId), appDoc);
    batch.set(doc(db, 'apps', appId, 'forms', formId), formDoc);
    batch.set(doc(db, 'apps', appId, 'tables', tableId), tableDoc);
    await batch.commit();

    await logAuditEvent({
      actor: owner,
      action: 'Created App from Template',
      targetType: 'application',
      targetId: appId,
      targetName: name,
      appId,
      details: `Instantiated template "${template.name}".`,
    });

    return { app: appDoc, form: formDoc, table: tableDoc };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${appId}`);
  }
}

export async function seedStarterWorkspaceIfEmpty(owner: UserProfile): Promise<void> {
  const flagKey = `structura_seeded_${owner.uid}`;
  if (localStorage.getItem(flagKey)) return;
  try {
    const q = query(collection(db, 'apps'), where('memberUids', 'array-contains', owner.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      localStorage.setItem(flagKey, '1');
      return;
    }
    const studentTpl = APP_TEMPLATES.find((t) => t.id === 'student-info');
    const invTpl = APP_TEMPLATES.find((t) => t.id === 'inventory-management');
    if (studentTpl) {
      const { app, form, table } = await createAppFromTemplate(studentTpl, owner);
      // Add 2 sample realistic records so Dashboard & Data Table show immediate structure
      await createRecord({
        app,
        formId: form.id,
        tableId: table.id,
        data: {
          student_id: 'STU-0001',
          full_name: 'Nusrat Jahan',
          class_grade: 'Eight',
          gender: 'Female',
          admission_date: '2026-01-12',
          mother_name: 'Rahima Begum',
          guardian_phone: '+8801711223344',
          email: 'nusrat.jahan@example.edu',
          address: 'Dhanmondi, Dhaka',
        },
        autoNumber: 1,
        actor: owner,
      });
      await createRecord({
        app,
        formId: form.id,
        tableId: table.id,
        data: {
          student_id: 'STU-0002',
          full_name: 'তানভীর আহমেদ (Tanvir Ahmed)',
          class_grade: 'Eight',
          gender: 'Male',
          admission_date: '2026-02-05',
          father_name: 'Kamal Ahmed',
          mother_name: 'Salma Khatun',
          guardian_phone: '+8801812345678',
          email: 'tanvir.ahmed@example.edu',
          address: 'Chattogram',
        },
        autoNumber: 2,
        actor: owner,
      });
    }
    if (invTpl) {
      await createAppFromTemplate(invTpl, owner);
    }
    localStorage.setItem(flagKey, '1');
  } catch (err) {
    console.warn('Starter workspace seed skipped:', err);
  }
}

export async function updateAppMeta(
  appId: string,
  updates: Partial<Pick<AppDefinition, 'name' | 'description' | 'icon' | 'themeColor' | 'status' | 'publishAccess' | 'publishPassword' | 'coverImage'>>,
  actor: UserProfile
): Promise<void> {
  const path = `apps/${appId}`;
  try {
    await updateDoc(doc(db, 'apps', appId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      actor,
      action: 'Updated Application',
      targetType: 'application',
      targetId: appId,
      targetName: updates.name || appId,
      appId,
      details: `Updated application metadata (${Object.keys(updates).join(', ')}).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function duplicateApp(sourceApp: AppDefinition, owner: UserProfile): Promise<AppDefinition> {
  const newAppId = makeId('app');
  const newName = `${sourceApp.name} (Copy)`;
  const newSlug = makeSlug(newName);

  try {
    const formsSnap = await getDocs(
      query(collection(db, 'apps', sourceApp.id, 'forms'), where('memberUids', 'array-contains', owner.uid))
    );
    const tablesSnap = await getDocs(
      query(collection(db, 'apps', sourceApp.id, 'tables'), where('memberUids', 'array-contains', owner.uid))
    );

    const batch = writeBatch(db);
    const newApp: AppDefinition = {
      ...sourceApp,
      id: newAppId,
      name: newName,
      slug: newSlug,
      status: 'draft',
      publishAccess: 'private',
      publishedVersion: 0,
      draftVersion: 1,
      ownerId: owner.uid,
      ownerEmail: owner.email,
      memberUids: [owner.uid],
      recordsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    batch.set(doc(db, 'apps', newAppId), newApp);

    const formIdMap = new Map<string, string>();
    formsSnap.docs.forEach((d) => {
      const f = d.data() as FormDefinition;
      const newFormId = makeId('frm');
      formIdMap.set(f.id, newFormId);
      const copiedForm: FormDefinition = {
        ...f,
        id: newFormId,
        appId: newAppId,
        appOwnerId: owner.uid,
        memberUids: [owner.uid],
        version: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      delete copiedForm.publishedSnapshot;
      batch.set(doc(db, 'apps', newAppId, 'forms', newFormId), copiedForm);
    });

    tablesSnap.docs.forEach((d) => {
      const t = d.data() as DatabaseTable;
      const newTableId = makeId('tbl');
      batch.set(doc(db, 'apps', newAppId, 'tables', newTableId), {
        ...t,
        id: newTableId,
        appId: newAppId,
        appOwnerId: owner.uid,
        memberUids: [owner.uid],
        formId: t.formId ? formIdMap.get(t.formId) || '' : '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    await logAuditEvent({
      actor: owner,
      action: 'Duplicated Application',
      targetType: 'application',
      targetId: newAppId,
      targetName: newName,
      appId: newAppId,
      details: `Duplicated from "${sourceApp.name}".`,
    });
    return newApp;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${newAppId}`);
  }
}

export async function deleteAppPermanent(app: AppDefinition, actor: UserProfile): Promise<void> {
  const path = `apps/${app.id}`;
  try {
    // Delete subcollections first (forms, tables, records, members, filterPresets)
    const subcols = ['forms', 'tables', 'records', 'members', 'filterPresets'] as const;
    for (const sub of subcols) {
      const q = query(collection(db, 'apps', app.id, sub), where('memberUids', 'array-contains', actor.uid));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    }
    if (app.slug) {
      try {
        await deleteDoc(doc(db, 'publicApps', app.slug));
      } catch {
        // Public snapshot may not exist
      }
    }
    await deleteDoc(doc(db, 'apps', app.id));
    await logAuditEvent({
      actor,
      action: 'Deleted Application',
      targetType: 'application',
      targetId: app.id,
      targetName: app.name,
      appId: app.id,
      details: `Permanently deleted "${app.name}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function publishApplication(params: {
  app: AppDefinition;
  forms: FormDefinition[];
  publishAccess: PublishAccess;
  publishPassword?: string;
  actor: UserProfile;
}): Promise<number> {
  const { app, forms, publishAccess, publishPassword, actor } = params;
  const nextVersion = (app.publishedVersion || 0) + 1;
  const path = `apps/${app.id}`;

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'apps', app.id), {
      status: 'published',
      publishAccess,
      publishPassword: publishAccess === 'password' ? publishPassword || '' : '',
      publishedVersion: nextVersion,
      updatedAt: serverTimestamp(),
    });

    for (const f of forms) {
      batch.update(doc(db, 'apps', app.id, 'forms', f.id), {
        publishedSnapshot: {
          name: f.name,
          description: f.description,
          isMultiStep: f.isMultiStep,
          steps: f.steps,
          fields: f.fields,
          appearance: f.appearance,
        },
        updatedAt: serverTimestamp(),
      });
    }

    if (publishAccess === 'public' || publishAccess === 'password') {
      const publicSnap: PublicAppSnapshot = {
        slug: app.slug,
        appId: app.id,
        ownerId: app.ownerId,
        appName: app.name,
        description: app.description,
        icon: app.icon,
        themeColor: app.themeColor,
        publishAccess,
        ...(publishAccess === 'password' ? { publishPassword: publishPassword || '' } : {}),
        publishedVersion: nextVersion,
        forms: forms.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          tableName: f.tableName,
          isMultiStep: f.isMultiStep,
          steps: f.steps,
          fields: f.fields,
          appearance: f.appearance,
        })),
        updatedAt: serverTimestamp(),
      };
      batch.set(doc(db, 'publicApps', app.slug), publicSnap);
    }

    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Published Application',
      targetType: 'application',
      targetId: app.id,
      targetName: app.name,
      appId: app.id,
      details: `Published v${nextVersion} (${publishAccess}) at /apps/${app.slug}.`,
    });

    return nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unpublishApplication(app: AppDefinition, actor: UserProfile): Promise<void> {
  const path = `apps/${app.id}`;
  try {
    await updateDoc(doc(db, 'apps', app.id), {
      status: 'draft',
      updatedAt: serverTimestamp(),
    });
    try {
      await deleteDoc(doc(db, 'publicApps', app.slug));
    } catch {
      // Ignore if not public
    }
    await logAuditEvent({
      actor,
      action: 'Unpublished Application',
      targetType: 'application',
      targetId: app.id,
      targetName: app.name,
      appId: app.id,
      details: `Reverted "${app.name}" to draft status.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeForms(
  appId: string,
  uid: string,
  isSuperAdmin: boolean,
  onData: (forms: FormDefinition[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `apps/${appId}/forms`;
  const colRef = collection(db, 'apps', appId, 'forms');
  const q = isSuperAdmin ? query(colRef) : query(colRef, where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as FormDefinition));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createNewFormInApp(params: {
  app: AppDefinition;
  name: string;
  description: string;
  actor: UserProfile;
}): Promise<FormDefinition> {
  const { app, name, description, actor } = params;
  const formId = makeId('frm');
  const tableId = makeId('tbl');
  const tableName = slugifyKey(name);

  const initialFields: FieldConfig[] = [
    {
      id: makeId('fld'),
      type: 'short_text',
      label: 'Title / Name',
      key: 'title',
      placeholder: 'Enter title...',
      required: true,
      colSpan: 1,
      hidden: false,
      disabled: false,
      validation: {},
      visibilityLogic: { enabled: false, combinator: 'AND', rules: [] },
      requiredLogic: { enabled: false, combinator: 'AND', rules: [] },
    },
  ];

  const formDoc: FormDefinition = {
    id: formId,
    appId: app.id,
    appOwnerId: app.ownerId,
    memberUids: app.memberUids,
    name: name.trim(),
    description: description.trim(),
    tableName,
    isMultiStep: false,
    steps: [{ id: 'step_1', title: 'Step 1', description: '' }],
    fields: initialFields,
    appearance: createDefaultAppearance(name.trim(), app.themeColor),
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const tableDoc: DatabaseTable = {
    id: tableId,
    appId: app.id,
    appOwnerId: app.ownerId,
    memberUids: app.memberUids,
    formId,
    name: tableName,
    label: `${name.trim()} Table`,
    primaryKey: 'id',
    columns: buildTableColumnsFromFields(initialFields),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'apps', app.id, 'forms', formId), formDoc);
    batch.set(doc(db, 'apps', app.id, 'tables', tableId), tableDoc);
    batch.update(doc(db, 'apps', app.id), {
      formsCount: (app.formsCount || 0) + 1,
      fieldsCount: (app.fieldsCount || 0) + initialFields.length,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Created Form',
      targetType: 'form',
      targetId: formId,
      targetName: formDoc.name,
      appId: app.id,
      details: `Added form "${formDoc.name}" and auto-generated table "${tableName}".`,
    });

    return formDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${app.id}/forms/${formId}`);
  }
}

export async function saveFormAndSyncTable(params: {
  app: AppDefinition;
  form: FormDefinition;
  tables: DatabaseTable[];
  allForms: FormDefinition[];
  actor: UserProfile;
}): Promise<void> {
  const { app, form, tables, allForms, actor } = params;
  const path = `apps/${app.id}/forms/${form.id}`;
  try {
    const batch = writeBatch(db);
    const nextVersion = (form.version || 1) + 1;

    batch.update(doc(db, 'apps', app.id, 'forms', form.id), {
      name: form.name,
      description: form.description,
      tableName: form.tableName,
      isMultiStep: form.isMultiStep,
      steps: form.steps,
      fields: form.fields,
      appearance: form.appearance,
      version: nextVersion,
      updatedAt: serverTimestamp(),
    });

    // Auto-sync matching table or create one if missing
    const linkedTable = tables.find((t) => t.formId === form.id);
    if (linkedTable) {
      // Preserve existing relationships on columns
      const existingRelations = new Map(
        linkedTable.columns.filter((c) => c.relation).map((c) => [c.key, c.relation])
      );
      const syncedCols = buildTableColumnsFromFields(form.fields, linkedTable.primaryKey).map((col) => {
        const rel = existingRelations.get(col.key);
        return rel ? { ...col, relation: rel, type: 'relation' as const } : col;
      });
      // Also preserve custom columns added manually in Database Manager
      const formFieldKeys = new Set(syncedCols.map((c) => c.key));
      const extraCustomCols = linkedTable.columns.filter((c) => !formFieldKeys.has(c.key) && c.relation);

      batch.update(doc(db, 'apps', app.id, 'tables', linkedTable.id), {
        columns: [...syncedCols, ...extraCustomCols],
        updatedAt: serverTimestamp(),
      });
    } else {
      const tableId = makeId('tbl');
      batch.set(doc(db, 'apps', app.id, 'tables', tableId), {
        id: tableId,
        appId: app.id,
        appOwnerId: app.ownerId,
        memberUids: app.memberUids,
        formId: form.id,
        name: form.tableName || slugifyKey(form.name),
        label: `${form.name} Table`,
        primaryKey: 'id',
        columns: buildTableColumnsFromFields(form.fields),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const totalFields = allForms.reduce(
      (sum, f) => sum + (f.id === form.id ? form.fields.length : f.fields.length),
      0
    );
    batch.update(doc(db, 'apps', app.id), {
      fieldsCount: totalFields,
      draftVersion: (app.draftVersion || 1) + 1,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Saved Form Schema',
      targetType: 'form',
      targetId: form.id,
      targetName: form.name,
      appId: app.id,
      details: `Saved "${form.name}" (v${nextVersion}, ${form.fields.length} fields).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeTables(
  appId: string,
  uid: string,
  isSuperAdmin: boolean,
  onData: (tables: DatabaseTable[]) => void
): Unsubscribe {
  const path = `apps/${appId}/tables`;
  const colRef = collection(db, 'apps', appId, 'tables');
  const q = isSuperAdmin ? query(colRef) : query(colRef, where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as DatabaseTable)),
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createCustomTable(params: {
  app: AppDefinition;
  name: string;
  label: string;
  columns: TableColumn[];
  actor: UserProfile;
}): Promise<DatabaseTable> {
  const tableId = makeId('tbl');
  const tableDoc: DatabaseTable = {
    id: tableId,
    appId: params.app.id,
    appOwnerId: params.app.ownerId,
    memberUids: params.app.memberUids,
    name: slugifyKey(params.name),
    label: params.label.trim(),
    primaryKey: 'id',
    columns: params.columns,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'apps', params.app.id, 'tables', tableId), tableDoc);
    await logAuditEvent({
      actor: params.actor,
      action: 'Created Database Table',
      targetType: 'table',
      targetId: tableId,
      targetName: tableDoc.label,
      appId: params.app.id,
      details: `Created table "${tableDoc.name}".`,
    });
    return tableDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${params.app.id}/tables/${tableId}`);
  }
}

export async function updateDatabaseTable(
  appId: string,
  table: DatabaseTable,
  actor: UserProfile
): Promise<void> {
  const path = `apps/${appId}/tables/${table.id}`;
  try {
    await updateDoc(doc(db, 'apps', appId, 'tables', table.id), {
      name: table.name,
      label: table.label,
      primaryKey: table.primaryKey,
      columns: table.columns,
      updatedAt: serverTimestamp(),
    });
    await logAuditEvent({
      actor,
      action: 'Updated Database Schema',
      targetType: 'table',
      targetId: table.id,
      targetName: table.label,
      appId,
      details: `Updated columns/constraints for "${table.name}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDatabaseTable(appId: string, table: DatabaseTable, actor: UserProfile): Promise<void> {
  const path = `apps/${appId}/tables/${table.id}`;
  try {
    await deleteDoc(doc(db, 'apps', appId, 'tables', table.id));
    await logAuditEvent({
      actor,
      action: 'Deleted Database Table',
      targetType: 'table',
      targetId: table.id,
      targetName: table.label,
      appId,
      details: `Removed table "${table.name}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeRecords(
  appId: string,
  uid: string,
  isSuperAdmin: boolean,
  onData: (records: DataRecord[]) => void
): Unsubscribe {
  const path = `apps/${appId}/records`;
  const colRef = collection(db, 'apps', appId, 'records');
  const q = isSuperAdmin ? query(colRef) : query(colRef, where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as DataRecord);
      list.sort((a, b) => (b.autoNumber || 0) - (a.autoNumber || 0));
      onData(list);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function createRecord(params: {
  app: AppDefinition;
  formId: string;
  tableId: string;
  data: Record<string, unknown>;
  autoNumber: number;
  status?: 'active' | 'draft';
  actor: UserProfile;
}): Promise<DataRecord> {
  const recordId = makeId('rec');
  const rec: DataRecord = {
    id: recordId,
    appId: params.app.id,
    appOwnerId: params.app.ownerId,
    memberUids: params.app.memberUids,
    formId: params.formId,
    tableId: params.tableId || '',
    autoNumber: params.autoNumber,
    data: params.data,
    status: params.status || 'active',
    createdBy: params.actor.uid,
    createdByEmail: params.actor.email,
    updatedBy: params.actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'apps', params.app.id, 'records', recordId), rec);
    batch.update(doc(db, 'apps', params.app.id), {
      recordsCount: (params.app.recordsCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return rec;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${params.app.id}/records/${recordId}`);
  }
}

export async function batchImportRecords(params: {
  app: AppDefinition;
  formId: string;
  tableId: string;
  rows: Record<string, unknown>[];
  startingAutoNumber: number;
  actor: UserProfile;
}): Promise<number> {
  const { app, formId, tableId, rows, startingAutoNumber, actor } = params;
  try {
    let imported = 0;
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((rowData, idx) => {
        const recordId = makeId('rec');
        const num = startingAutoNumber + i + idx;
        const rec: DataRecord = {
          id: recordId,
          appId: app.id,
          appOwnerId: app.ownerId,
          memberUids: app.memberUids,
          formId,
          tableId: tableId || '',
          autoNumber: num,
          data: rowData,
          status: 'active',
          createdBy: actor.uid,
          createdByEmail: actor.email,
          updatedBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(db, 'apps', app.id, 'records', recordId), rec);
        imported += 1;
      });
      await batch.commit();
    }

    await updateDoc(doc(db, 'apps', app.id), {
      recordsCount: (app.recordsCount || 0) + imported,
      updatedAt: serverTimestamp(),
    });

    await logAuditEvent({
      actor,
      action: 'Imported Data Records',
      targetType: 'records',
      targetId: formId,
      targetName: app.name,
      appId: app.id,
      details: `Imported ${imported} records into "${app.name}".`,
    });

    return imported;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${app.id}/records`);
  }
}

export async function updateRecordData(params: {
  appId: string;
  recordId: string;
  data: Record<string, unknown>;
  status?: 'active' | 'draft' | 'archived';
  actorUid: string;
}): Promise<void> {
  const path = `apps/${params.appId}/records/${params.recordId}`;
  try {
    await updateDoc(doc(db, 'apps', params.appId, 'records', params.recordId), {
      data: params.data,
      ...(params.status ? { status: params.status } : {}),
      updatedBy: params.actorUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function bulkDeleteRecords(
  app: AppDefinition,
  recordIds: string[],
  actor: UserProfile
): Promise<void> {
  try {
    const batch = writeBatch(db);
    recordIds.forEach((id) => {
      batch.delete(doc(db, 'apps', app.id, 'records', id));
    });
    batch.update(doc(db, 'apps', app.id), {
      recordsCount: Math.max(0, (app.recordsCount || 0) - recordIds.length),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Deleted Records',
      targetType: 'records',
      targetId: app.id,
      targetName: app.name,
      appId: app.id,
      details: `Deleted ${recordIds.length} record(s).`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `apps/${app.id}/records`);
  }
}

export async function bulkUpdateRecordStatus(
  appId: string,
  recordIds: string[],
  status: 'active' | 'draft' | 'archived',
  actorUid: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    recordIds.forEach((id) => {
      batch.update(doc(db, 'apps', appId, 'records', id), {
        status,
        updatedBy: actorUid,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `apps/${appId}/records`);
  }
}

export function subscribeFilterPresets(
  appId: string,
  uid: string,
  isSuperAdmin: boolean,
  onData: (presets: FilterPreset[]) => void
): Unsubscribe {
  const path = `apps/${appId}/filterPresets`;
  const colRef = collection(db, 'apps', appId, 'filterPresets');
  const q = isSuperAdmin ? query(colRef) : query(colRef, where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as FilterPreset)),
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function saveFilterPreset(preset: Omit<FilterPreset, 'id' | 'createdAt'>): Promise<void> {
  const id = makeId('flt');
  try {
    await setDoc(doc(db, 'apps', preset.appId, 'filterPresets', id), {
      ...preset,
      id,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${preset.appId}/filterPresets/${id}`);
  }
}

export async function deleteFilterPreset(appId: string, presetId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'apps', appId, 'filterPresets', presetId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `apps/${appId}/filterPresets/${presetId}`);
  }
}

export function subscribeAppMembers(
  appId: string,
  uid: string,
  isSuperAdmin: boolean,
  onData: (members: AppMember[]) => void
): Unsubscribe {
  const path = `apps/${appId}/members`;
  const colRef = collection(db, 'apps', appId, 'members');
  const q = isSuperAdmin ? query(colRef) : query(colRef, where('memberUids', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as AppMember)),
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function addOrUpdateAppMember(params: {
  app: AppDefinition;
  memberUid: string;
  email: string;
  displayName: string;
  role: AppRole;
  actor: UserProfile;
}): Promise<void> {
  const { app, memberUid, email, displayName, role, actor } = params;
  const nextMemberUids = Array.from(new Set([...app.memberUids, memberUid]));
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'apps', app.id, 'members', memberUid), {
      uid: memberUid,
      email,
      displayName,
      role,
      appOwnerId: app.ownerId,
      memberUids: nextMemberUids,
      addedBy: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'apps', app.id), {
      memberUids: nextMemberUids,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Updated App Collaborator',
      targetType: 'member',
      targetId: memberUid,
      targetName: email,
      appId: app.id,
      details: `Assigned ${role} access to ${email}.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `apps/${app.id}/members/${memberUid}`);
  }
}

export async function removeAppMember(app: AppDefinition, memberUid: string, actor: UserProfile): Promise<void> {
  const nextMemberUids = app.memberUids.filter((u) => u !== memberUid);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'apps', app.id, 'members', memberUid));
    batch.update(doc(db, 'apps', app.id), {
      memberUids: nextMemberUids,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    await logAuditEvent({
      actor,
      action: 'Removed App Collaborator',
      targetType: 'member',
      targetId: memberUid,
      targetName: memberUid,
      appId: app.id,
      details: `Removed collaborator ${memberUid} from "${app.name}".`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `apps/${app.id}/members/${memberUid}`);
  }
}

export async function getPublicAppBySlug(slug: string): Promise<PublicAppSnapshot | null> {
  const path = `publicApps/${slug}`;
  try {
    const snap = await getDoc(doc(db, 'publicApps', slug));
    return snap.exists() ? (snap.data() as PublicAppSnapshot) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function submitPublicRecord(params: {
  publicApp: PublicAppSnapshot;
  formId: string;
  data: Record<string, unknown>;
}): Promise<string> {
  const { publicApp, formId, data } = params;
  const recordId = makeId('rec');
  const path = `apps/${publicApp.appId}/records/${recordId}`;
  try {
    const rec: DataRecord = {
      id: recordId,
      appId: publicApp.appId,
      appOwnerId: publicApp.ownerId,
      memberUids: [publicApp.ownerId],
      formId,
      tableId: '',
      autoNumber: Math.floor(Date.now() / 1000) % 100000,
      data,
      status: 'active',
      isPublicSubmission: true,
      publicSlug: publicApp.slug,
      createdBy: 'public-respondent',
      createdByEmail: '',
      updatedBy: 'public-respondent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'apps', publicApp.appId, 'records', recordId), rec);
    return recordId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserSettings(uid: string): Promise<WorkspaceSettings> {
  const path = `settings/${uid}`;
  const defaults: WorkspaceSettings = {
    userId: uid,
    platformName: 'Structura',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'en-US',
    themeMode: 'light',
    defaultPageSize: 15,
    sidebarCollapsed: false,
  };
  try {
    const snap = await getDoc(doc(db, 'settings', uid));
    return snap.exists() ? { ...defaults, ...(snap.data() as WorkspaceSettings) } : defaults;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserSettings(settings: WorkspaceSettings): Promise<void> {
  const path = `settings/${settings.userId}`;
  try {
    await setDoc(doc(db, 'settings', settings.userId), {
      ...settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function logAuditEvent(params: {
  actor: Pick<UserProfile, 'uid' | 'email'>;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  appId: string;
  details: string;
}): Promise<void> {
  const logId = makeId('log');
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      id: logId,
      actorUid: params.actor.uid,
      actorEmail: params.actor.email || '',
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      targetName: params.targetName,
      appId: params.appId,
      details: params.details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write warning:', err);
  }
}

export function subscribeAuditLogs(
  uid: string,
  isSuperAdmin: boolean,
  onData: (logs: AuditLog[]) => void
): Unsubscribe {
  const path = 'auditLogs';
  const colRef = collection(db, 'auditLogs');
  const q = isSuperAdmin
    ? query(colRef, orderBy('createdAt', 'desc'))
    : query(colRef, where('actorUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const logs = snap.docs.map((d) => d.data() as AuditLog);
      logs.sort((a, b) => {
        const ta = (a.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        const tb = (b.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
        return tb - ta;
      });
      onData(logs.slice(0, 50));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}
