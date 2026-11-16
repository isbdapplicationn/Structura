export type PlatformRole = 'super_admin' | 'admin' | 'editor' | 'viewer';
export type AppRole = 'admin' | 'editor' | 'viewer';
export type LanguageCode = 'en' | 'bn';
export type ThemeMode = 'light' | 'dark' | 'system';

export type NavSection =
  | 'dashboard'
  | 'apps'
  | 'create-app'
  | 'form-builder'
  | 'database'
  | 'records'
  | 'import-export'
  | 'templates'
  | 'reports'
  | 'users'
  | 'settings'
  | 'archive'
  | 'help';

export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'email'
  | 'phone'
  | 'password'
  | 'date'
  | 'time'
  | 'datetime'
  | 'dropdown'
  | 'multi_select'
  | 'radio'
  | 'checkbox'
  | 'switch'
  | 'file_upload'
  | 'image_upload'
  | 'url'
  | 'currency'
  | 'percentage'
  | 'rating'
  | 'color'
  | 'hidden'
  | 'auto_number'
  | 'section_header'
  | 'divider'
  | 'signature';

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionalRule {
  id: string;
  sourceFieldKey: string;
  operator: ConditionalOperator;
  value: string;
}

export interface ConditionalRuleGroup {
  enabled: boolean;
  combinator: 'AND' | 'OR';
  rules: ConditionalRule[];
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  allowedFileTypes?: string; // e.g. ".pdf,.docx,.png"
  maxFileSizeKb?: number;
  emailValidation?: boolean;
  regexPattern?: string;
  unique?: boolean;
  customErrorMessage?: string;
}

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  key: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string | number | boolean | string[];
  required: boolean;
  colSpan: 1 | 2 | 3; // 1 = 1/3 or 1 col, 2 = 2/3, 3 = full row in 3-col grid
  widthPercent?: 33 | 50 | 66 | 100;
  columnPosition?: 'auto' | 'left' | 'center' | 'right';
  hidden: boolean;
  disabled: boolean;
  readOnly?: boolean;
  stepId?: string;
  options?: FieldOption[];
  currencySymbol?: string;
  maxRating?: number;
  autoNumberPrefix?: string;
  autoGenerateRule?: string;
  validation: FieldValidation;
  visibilityLogic: ConditionalRuleGroup;
  requiredLogic: ConditionalRuleGroup;
}

export interface FormStep {
  id: string;
  title: string;
  description?: string;
}

export type FormThemePreset =
  | 'modern'
  | 'minimal'
  | 'professional'
  | 'corporate'
  | 'classic'
  | 'dark'
  | 'light';

export interface FormAppearance {
  title: string;
  subtitle: string;
  description: string;
  headerStyle: 'clean' | 'banner' | 'centered';
  themePreset: FormThemePreset;
  bgColor: string;
  formWidth: 'sm' | 'md' | 'lg' | 'full';
  fieldSpacing: 'compact' | 'comfortable' | 'spacious';
  labelPosition: 'top' | 'left';
  inputStyle: 'outlined' | 'filled' | 'underlined';
  borderRadius: 'none' | 'sm' | 'md' | 'lg';
  buttonStyle: 'solid' | 'outline' | 'soft';
  fontFamily: 'sans' | 'display' | 'mono';
  fontSize: 'sm' | 'md' | 'lg';
  primaryColor: string;
  secondaryColor: string;
  columns: 1 | 2 | 3;
  submitButtonText: string;
}

export interface FormDefinition {
  id: string;
  appId: string;
  appOwnerId: string;
  memberUids: string[];
  name: string;
  description: string;
  tableName: string;
  isMultiStep: boolean;
  steps: FormStep[];
  fields: FieldConfig[];
  appearance: FormAppearance;
  publishedSnapshot?: {
    name: string;
    description: string;
    isMultiStep: boolean;
    steps: FormStep[];
    fields: FieldConfig[];
    appearance: FormAppearance;
  };
  version: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TableRelation {
  targetTableId: string;
  targetTableName: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-many';
  displayField: string;
}

export interface TableColumn {
  id: string;
  key: string;
  label: string;
  type: FieldType | 'relation';
  required: boolean;
  unique: boolean;
  isPrimaryKey?: boolean;
  defaultValue?: string;
  relation?: TableRelation;
}

export interface DatabaseTable {
  id: string;
  appId: string;
  appOwnerId: string;
  memberUids: string[];
  formId?: string;
  name: string;
  label: string;
  primaryKey: string;
  columns: TableColumn[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DataRecord {
  id: string;
  appId: string;
  appOwnerId: string;
  memberUids: string[];
  formId: string;
  tableId: string;
  autoNumber: number;
  data: Record<string, unknown>;
  status: 'active' | 'draft' | 'archived';
  isPublicSubmission?: boolean;
  publicSlug?: string;
  createdBy: string;
  createdByEmail: string;
  updatedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublishAccess = 'private' | 'team' | 'public' | 'password' | 'authenticated';

export interface AppDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  themeColor: string;
  coverImage?: string;
  status: 'draft' | 'published' | 'archived';
  publishAccess: PublishAccess;
  publishPassword?: string;
  publishedVersion: number;
  draftVersion: number;
  ownerId: string;
  ownerEmail: string;
  memberUids: string[];
  formsCount: number;
  recordsCount: number;
  fieldsCount: number;
  layoutConfig: Partial<FormAppearance>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppMember {
  uid: string;
  email: string;
  displayName: string;
  role: AppRole;
  appOwnerId: string;
  memberUids: string[];
  addedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FilterCondition {
  id: string;
  fieldKey: string;
  operator: ConditionalOperator | 'date_range' | 'numeric_range';
  value: string;
  valueEnd?: string;
}

export interface FilterPreset {
  id: string;
  appId: string;
  appOwnerId: string;
  memberUids: string[];
  formId: string;
  name: string;
  filters: FilterCondition[];
  createdBy: string;
  createdAt?: unknown;
}

export interface PublicAppSnapshot {
  slug: string;
  appId: string;
  ownerId: string;
  appName: string;
  description: string;
  icon: string;
  themeColor: string;
  publishAccess: 'public' | 'password';
  publishPassword?: string;
  publishedVersion: number;
  forms: Array<{
    id: string;
    name: string;
    description: string;
    tableName: string;
    isMultiStep: boolean;
    steps: FormStep[];
    fields: FieldConfig[];
    appearance: FormAppearance;
  }>;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: PlatformRole;
  status: 'active' | 'suspended';
  language: LanguageCode;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WorkspaceSettings {
  userId: string;
  platformName: string;
  language: LanguageCode;
  timezone: string;
  dateFormat: string;
  numberFormat: 'en-US' | 'bn-BD';
  themeMode: ThemeMode;
  defaultPageSize: number;
  sidebarCollapsed: boolean;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName: string;
  appId: string;
  details: string;
  createdAt?: unknown;
}

export interface AppTemplate {
  id: string;
  name: string;
  nameBn: string;
  category: string;
  description: string;
  descriptionBn: string;
  icon: string;
  themeColor: string;
  coverImage?: string;
  formName: string;
  tableName: string;
  isMultiStep?: boolean;
  steps?: FormStep[];
  fields: Omit<FieldConfig, 'id'>[];
  appearance?: Partial<FormAppearance>;
}
