import type {
  FieldConfig,
  FieldType,
  FormAppearance,
  FormThemePreset,
} from '../types/builder.ts';

export interface FieldLibraryItem {
  type: FieldType;
  label: string;
  labelBn: string;
  description: string;
  category: 'basic' | 'selection' | 'media' | 'specialized' | 'layout';
  icon: string;
}

export const FIELD_LIBRARY: FieldLibraryItem[] = [
  // Basic Inputs
  { type: 'short_text', label: 'Short Text', labelBn: 'সংক্ষিপ্ত টেক্সট', description: 'Name, title, code', category: 'basic', icon: 'Type' },
  { type: 'long_text', label: 'Long Text', labelBn: 'দীর্ঘ টেক্সট', description: 'Address, description', category: 'basic', icon: 'AlignLeft' },
  { type: 'number', label: 'Number', labelBn: 'সংখ্যা', description: 'Age, quantity', category: 'basic', icon: 'Hash' },
  { type: 'email', label: 'Email', labelBn: 'ইমেইল', description: 'Email address', category: 'basic', icon: 'Mail' },
  { type: 'phone', label: 'Phone', labelBn: 'ফোন নম্বর', description: 'Mobile number', category: 'basic', icon: 'Phone' },
  { type: 'password', label: 'Password', labelBn: 'পাসওয়ার্ড', description: 'Password input', category: 'basic', icon: 'Lock' },
  { type: 'date', label: 'Date', labelBn: 'তারিখ', description: 'Date selection', category: 'basic', icon: 'Calendar' },
  { type: 'time', label: 'Time', labelBn: 'সময়', description: 'Time selection', category: 'basic', icon: 'Clock' },
  { type: 'datetime', label: 'Date & Time', labelBn: 'তারিখ ও সময়', description: 'Combined date-time', category: 'basic', icon: 'CalendarClock' },

  // Selection
  { type: 'dropdown', label: 'Dropdown', labelBn: 'ড্রপডাউন', description: 'Single selection', category: 'selection', icon: 'ChevronDownSquare' },
  { type: 'multi_select', label: 'Multi Select', labelBn: 'মাল্টি সিলেক্ট', description: 'Multiple selections', category: 'selection', icon: 'ListChecks' },
  { type: 'radio', label: 'Radio Button', labelBn: 'রেডিও বাটন', description: 'Single option', category: 'selection', icon: 'CircleDot' },
  { type: 'checkbox', label: 'Checkbox', labelBn: 'চেকবক্স', description: 'Multiple options', category: 'selection', icon: 'CheckSquare' },
  { type: 'switch', label: 'Switch', labelBn: 'সুইচ (হ্যাঁ/না)', description: 'Yes / No toggle', category: 'selection', icon: 'ToggleRight' },

  // Media & Files
  { type: 'file_upload', label: 'File Upload', labelBn: 'ফাইল আপলোড', description: 'Upload documents', category: 'media', icon: 'FileUp' },
  { type: 'image_upload', label: 'Image Upload', labelBn: 'ছবি আপলোড', description: 'Upload images', category: 'media', icon: 'ImagePlus' },
  { type: 'signature', label: 'Signature', labelBn: 'ডিজিটাল স্বাক্ষর', description: 'Digital signature pad', category: 'media', icon: 'PenTool' },

  // Specialized
  { type: 'url', label: 'URL', labelBn: 'ওয়েবসাইট লিংক', description: 'Website address', category: 'specialized', icon: 'Link2' },
  { type: 'currency', label: 'Currency', labelBn: 'অর্থ / মুদ্রা', description: 'Financial values', category: 'specialized', icon: 'Banknote' },
  { type: 'percentage', label: 'Percentage', labelBn: 'শতাংশ', description: 'Percentage values', category: 'specialized', icon: 'Percent' },
  { type: 'rating', label: 'Rating', labelBn: 'রেটিং', description: 'Star rating', category: 'specialized', icon: 'Star' },
  { type: 'color', label: 'Color Picker', labelBn: 'রঙ নির্বাচন', description: 'Color selection', category: 'specialized', icon: 'Palette' },
  { type: 'hidden', label: 'Hidden Field', labelBn: 'গোপন ফিল্ড', description: 'Internal values', category: 'specialized', icon: 'EyeOff' },
  { type: 'auto_number', label: 'Auto Number', labelBn: 'অটো নম্বর', description: 'Automatic ID', category: 'specialized', icon: 'Binary' },

  // Layout
  { type: 'section_header', label: 'Section Header', labelBn: 'সেকশন শিরোনাম', description: 'Group fields', category: 'layout', icon: 'Heading' },
  { type: 'divider', label: 'Divider', labelBn: 'বিভাজক রেখা', description: 'Visual separation', category: 'layout', icon: 'Minus' },
];

export const FORM_THEME_PRESETS: Record<
  FormThemePreset,
  { label: string; bgColor: string; primaryColor: string; secondaryColor: string; borderRadius: FormAppearance['borderRadius']; inputStyle: FormAppearance['inputStyle']; headerStyle: FormAppearance['headerStyle'] }
> = {
  modern: {
    label: 'Modern',
    bgColor: '#ffffff',
    primaryColor: '#2563eb',
    secondaryColor: '#0f172a',
    borderRadius: 'md',
    inputStyle: 'outlined',
    headerStyle: 'clean',
  },
  minimal: {
    label: 'Minimal',
    bgColor: '#fafafa',
    primaryColor: '#18181b',
    secondaryColor: '#52525b',
    borderRadius: 'sm',
    inputStyle: 'underlined',
    headerStyle: 'clean',
  },
  professional: {
    label: 'Professional',
    bgColor: '#f8fafc',
    primaryColor: '#0f766e',
    secondaryColor: '#1e293b',
    borderRadius: 'md',
    inputStyle: 'outlined',
    headerStyle: 'banner',
  },
  corporate: {
    label: 'Corporate',
    bgColor: '#ffffff',
    primaryColor: '#1d4ed8',
    secondaryColor: '#334155',
    borderRadius: 'sm',
    inputStyle: 'filled',
    headerStyle: 'banner',
  },
  classic: {
    label: 'Classic',
    bgColor: '#fffdf9',
    primaryColor: '#1e3a8a',
    secondaryColor: '#475569',
    borderRadius: 'none',
    inputStyle: 'outlined',
    headerStyle: 'centered',
  },
  dark: {
    label: 'Dark',
    bgColor: '#0f172a',
    primaryColor: '#3b82f6',
    secondaryColor: '#94a3b8',
    borderRadius: 'md',
    inputStyle: 'outlined',
    headerStyle: 'clean',
  },
  light: {
    label: 'Light',
    bgColor: '#ffffff',
    primaryColor: '#0284c7',
    secondaryColor: '#64748b',
    borderRadius: 'lg',
    inputStyle: 'filled',
    headerStyle: 'clean',
  },
};

export function createDefaultAppearance(title = 'Untitled Form', primaryColor = '#2563eb'): FormAppearance {
  return {
    title,
    subtitle: 'Structured Data Entry',
    description: 'Complete the fields below carefully and submit your record.',
    headerStyle: 'clean',
    themePreset: 'modern',
    bgColor: '#ffffff',
    formWidth: 'md',
    fieldSpacing: 'comfortable',
    labelPosition: 'top',
    inputStyle: 'outlined',
    borderRadius: 'md',
    buttonStyle: 'solid',
    fontFamily: 'sans',
    fontSize: 'md',
    primaryColor,
    secondaryColor: '#0f172a',
    columns: 2,
    submitButtonText: 'Submit Record',
  };
}

export function slugifyKey(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');
  return cleaned || `field_${Math.random().toString(36).slice(2, 6)}`;
}

export function createFieldFromType(type: FieldType, index: number, stepId?: string): FieldConfig {
  const catalogItem = FIELD_LIBRARY.find((f) => f.type === type);
  const baseLabel = catalogItem?.label || 'Field';
  const id = `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const key = `${type}_${index + 1}`;
  const isChoice = type === 'dropdown' || type === 'multi_select' || type === 'radio' || type === 'checkbox';
  const isLayout = type === 'section_header' || type === 'divider';

  return {
    id,
    type,
    label: type === 'divider' ? 'Divider' : `${baseLabel} ${index + 1}`,
    key,
    placeholder: isLayout ? '' : `Enter ${baseLabel.toLowerCase()}...`,
    helpText: '',
    defaultValue: type === 'switch' ? false : type === 'rating' ? 0 : '',
    required: false,
    colSpan: isLayout || type === 'long_text' || type === 'signature' ? 2 : 1,
    widthPercent: isLayout || type === 'long_text' ? 100 : 50,
    columnPosition: 'auto',
    hidden: type === 'hidden',
    disabled: false,
    readOnly: type === 'auto_number',
    stepId,
    options: isChoice
      ? [
          { label: 'Option 1', value: 'Option 1' },
          { label: 'Option 2', value: 'Option 2' },
        ]
      : undefined,
    currencySymbol: type === 'currency' ? '৳' : undefined,
    maxRating: type === 'rating' ? 5 : undefined,
    autoNumberPrefix: type === 'auto_number' ? 'REC-' : undefined,
    validation: {
      emailValidation: type === 'email',
      maxFileSizeKb: type === 'file_upload' || type === 'image_upload' ? 2048 : undefined,
      allowedFileTypes: type === 'image_upload' ? 'image/*' : type === 'file_upload' ? '.pdf,.doc,.docx,.csv,.xlsx' : undefined,
    },
    visibilityLogic: {
      enabled: false,
      combinator: 'AND',
      rules: [],
    },
    requiredLogic: {
      enabled: false,
      combinator: 'AND',
      rules: [],
    },
  };
}
