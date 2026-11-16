import { z } from 'zod';
import type { DataRecord, FieldConfig } from '../types/builder.ts';
import { isFieldRequired, isFieldVisible } from './logicEngine.ts';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const emailSchema = z.string().email();
const urlSchema = z.string().url();

export function validateFormValues(
  fields: FieldConfig[],
  values: Record<string, unknown>,
  existingRecords: DataRecord[] = [],
  editingRecordId?: string,
  onlyStepId?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (onlyStepId && field.stepId && field.stepId !== onlyStepId) continue;
    if (field.type === 'section_header' || field.type === 'divider' || field.type === 'hidden' || field.type === 'auto_number') {
      continue;
    }
    if (!isFieldVisible(field, values)) {
      continue;
    }

    const val = values[field.key];
    const strVal = val === undefined || val === null ? '' : Array.isArray(val) ? val.join('') : String(val).trim();
    const isEmpty =
      val === undefined ||
      val === null ||
      strVal === '' ||
      (Array.isArray(val) && val.length === 0) ||
      (field.type === 'checkbox' && Array.isArray(val) && val.length === 0);

    const requiredNow = isFieldRequired(field, values);
    const customMsg = field.validation?.customErrorMessage;

    if (requiredNow && isEmpty) {
      errors[field.key] = customMsg || `${field.label} is required.`;
      continue;
    }

    if (isEmpty) continue;

    // Email check
    if (field.type === 'email' || field.validation?.emailValidation) {
      if (!emailSchema.safeParse(strVal).success) {
        errors[field.key] = customMsg || `Please enter a valid email address for ${field.label}.`;
        continue;
      }
    }

    // URL check
    if (field.type === 'url') {
      if (!urlSchema.safeParse(strVal).success) {
        errors[field.key] = customMsg || `Please enter a valid URL (e.g. https://example.com) for ${field.label}.`;
        continue;
      }
    }

    // String length bounds
    if (field.validation?.minLength !== undefined && strVal.length < field.validation.minLength) {
      errors[field.key] = customMsg || `${field.label} must be at least ${field.validation.minLength} characters.`;
      continue;
    }
    if (field.validation?.maxLength !== undefined && strVal.length > field.validation.maxLength) {
      errors[field.key] = customMsg || `${field.label} must be at most ${field.validation.maxLength} characters.`;
      continue;
    }

    // Numeric bounds
    if (field.type === 'number' || field.type === 'currency' || field.type === 'percentage') {
      const num = Number(val);
      if (Number.isNaN(num)) {
        errors[field.key] = customMsg || `${field.label} must be a valid number.`;
        continue;
      }
      if (field.validation?.minValue !== undefined && num < field.validation.minValue) {
        errors[field.key] = customMsg || `${field.label} must be at least ${field.validation.minValue}.`;
        continue;
      }
      if (field.validation?.maxValue !== undefined && num > field.validation.maxValue) {
        errors[field.key] = customMsg || `${field.label} must be at most ${field.validation.maxValue}.`;
        continue;
      }
    }

    // Regex check
    if (field.validation?.regexPattern) {
      try {
        const re = new RegExp(field.validation.regexPattern);
        if (!re.test(strVal)) {
          errors[field.key] = customMsg || `${field.label} does not match the required format.`;
          continue;
        }
      } catch {
        // Ignore invalid user regex pattern
      }
    }

    // Unique / Duplicate check against existing records
    if (field.validation?.unique && existingRecords.length > 0) {
      const duplicate = existingRecords.find(
        (rec) =>
          rec.id !== editingRecordId &&
          String(rec.data?.[field.key] ?? '').trim().toLowerCase() === strVal.toLowerCase()
      );
      if (duplicate) {
        errors[field.key] = customMsg || `A record with this ${field.label} already exists.`;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
