import type {
  ConditionalOperator,
  ConditionalRule,
  ConditionalRuleGroup,
  DataRecord,
  FieldConfig,
  FilterCondition,
} from '../types/builder.ts';

function normalizeToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return String(val);
}

export function evaluateSingleRule(
  rule: ConditionalRule,
  values: Record<string, unknown>
): boolean {
  const raw = values[rule.sourceFieldKey];
  const strVal = normalizeToString(raw).trim();
  const target = (rule.value ?? '').trim();

  switch (rule.operator as ConditionalOperator) {
    case 'equals':
      return strVal.toLowerCase() === target.toLowerCase();
    case 'not_equals':
      return strVal.toLowerCase() !== target.toLowerCase();
    case 'contains':
      if (Array.isArray(raw)) {
        return raw.some((item) => String(item).toLowerCase() === target.toLowerCase()) || strVal.toLowerCase().includes(target.toLowerCase());
      }
      return strVal.toLowerCase().includes(target.toLowerCase());
    case 'not_contains':
      return !strVal.toLowerCase().includes(target.toLowerCase());
    case 'greater_than': {
      const a = Number(raw);
      const b = Number(target);
      return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
    }
    case 'less_than': {
      const a = Number(raw);
      const b = Number(target);
      return !Number.isNaN(a) && !Number.isNaN(b) && a < b;
    }
    case 'is_empty':
      return (
        raw === undefined ||
        raw === null ||
        strVal === '' ||
        (Array.isArray(raw) && raw.length === 0)
      );
    case 'is_not_empty':
      return !(
        raw === undefined ||
        raw === null ||
        strVal === '' ||
        (Array.isArray(raw) && raw.length === 0)
      );
    default:
      return true;
  }
}

export function evaluateRuleGroup(
  group: ConditionalRuleGroup | undefined,
  values: Record<string, unknown>,
  defaultResult: boolean
): boolean {
  if (!group || !group.enabled || !group.rules || group.rules.length === 0) {
    return defaultResult;
  }
  if (group.combinator === 'OR') {
    return group.rules.some((rule) => evaluateSingleRule(rule, values));
  }
  return group.rules.every((rule) => evaluateSingleRule(rule, values));
}

export function isFieldVisible(field: FieldConfig, values: Record<string, unknown>): boolean {
  if (field.hidden || field.type === 'hidden') return false;
  return evaluateRuleGroup(field.visibilityLogic, values, true);
}

export function isFieldRequired(field: FieldConfig, values: Record<string, unknown>): boolean {
  if (field.type === 'section_header' || field.type === 'divider') return false;
  if (field.required) return true;
  if (field.requiredLogic?.enabled && field.requiredLogic.rules.length > 0) {
    return evaluateRuleGroup(field.requiredLogic, values, false);
  }
  return false;
}

export function evaluateRecordFilter(
  record: DataRecord,
  condition: FilterCondition
): boolean {
  if (!condition.fieldKey) return true;

  let raw: unknown;
  if (condition.fieldKey === '__createdAt') {
    raw = record.createdAt;
  } else if (condition.fieldKey === '__status') {
    raw = record.status;
  } else if (condition.fieldKey === '__autoNumber') {
    raw = record.autoNumber;
  } else {
    raw = record.data?.[condition.fieldKey];
  }

  if (condition.operator === 'date_range') {
    let dateStr = '';
    if (raw && typeof raw === 'object' && 'toDate' in raw && typeof (raw as { toDate: () => Date }).toDate === 'function') {
      dateStr = (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } else {
      dateStr = normalizeToString(raw).slice(0, 10);
    }
    if (!dateStr) return false;
    if (condition.value && dateStr < condition.value) return false;
    if (condition.valueEnd && dateStr > condition.valueEnd) return false;
    return true;
  }

  if (condition.operator === 'numeric_range') {
    const num = Number(raw);
    if (Number.isNaN(num)) return false;
    if (condition.value !== '' && num < Number(condition.value)) return false;
    if (condition.valueEnd && condition.valueEnd !== '' && num > Number(condition.valueEnd)) return false;
    return true;
  }

  return evaluateSingleRule(
    {
      id: condition.id,
      sourceFieldKey: condition.fieldKey,
      operator: condition.operator,
      value: condition.value,
    },
    { [condition.fieldKey]: raw }
  );
}
