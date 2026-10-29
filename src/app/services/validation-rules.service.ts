import { Injectable } from '@angular/core';
import { Category, ValidationRule, ValidationIssue, StagedRecord } from '../models';

// ── Built-in rules ────────────────────────────────────────────────────────────
// These are always available; users can add custom rules on top.

const BUILT_IN: Omit<ValidationRule, 'id' | 'workspaceId' | 'createdAt'>[] = [
  // ── Vineyard+block (InnoVint template) ───────────────────────────────────────
  { category: 'Vineyard+block', name: 'Vineyard name required', field: 'vineyardName', type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vineyard+block', name: 'Source type required',   field: 'sourceType',   type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vineyard+block', name: 'Appellation required',   field: 'appellation',  type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vineyard+block', name: 'Block name required',    field: 'blockName',    type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vineyard+block', name: 'Variety required',       field: 'variety',      type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vineyard+block', name: 'Area in range',          field: 'area',         type: 'range',    params: { min: 0.001, max: 50000 }, severity: 'warning', builtIn: true, enabled: true },

  // ── Vessel (InnoVint template; barrel-only fields enforced in transform) ──────
  { category: 'Vessel', name: 'Vessel code required',  field: 'vesselCode',  type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vessel', name: 'Vessel type required',  field: 'vesselType',  type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vessel', name: 'Capacity (vol) required', field: 'capacityVol', type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vessel', name: 'Vessel code unique',    field: 'vesselCode',  type: 'unique',   params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Vessel', name: 'Capacity (vol) in range', field: 'capacityVol', type: 'range', params: { min: 0.1, max: 1_000_000 }, severity: 'warning', builtIn: true, enabled: true },

  // ── Lot Composition (InnoVint "Lot create" template) ─────────────────────────
  { category: 'Lot Composition', name: 'Bond required',          field: 'bond',          type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Lot code required',      field: 'lotCode',       type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Tax class required',     field: 'taxClass',      type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Stage required',         field: 'stage',         type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Color required',         field: 'color',         type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Style required',         field: 'style',         type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Component type required',field: 'componentType', type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Component % required',   field: 'componentPct',  type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Component % 0-100',      field: 'componentPct',  type: 'range',    params: { min: 0, max: 100 }, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Vineyard required',      field: 'vineyard',      type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Block required',         field: 'block',         type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Vintage required',      field: 'vintage',       type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Varietal required',      field: 'varietal',      type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: 'Appellation required',   field: 'appellation',   type: 'required', params: {}, severity: 'error', builtIn: true, enabled: true },
  { category: 'Lot Composition', name: '% of Bulk 0-100',        field: 'pctOfBulk',     type: 'range',    params: { min: 0, max: 100 }, severity: 'warning', builtIn: true, enabled: true },

  // ── Volume (InnoVint template) ───────────────────────────────────────────────
  { category: 'Volume', name: 'Date required',       field: 'date',       type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Volume', name: 'Lot Code required',   field: 'lotCode',    type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Volume', name: 'Vessel Code required',field: 'vesselCode', type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Volume', name: 'Volume required',     field: 'volume',     type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Volume', name: 'Volume positive',     field: 'volume',     type: 'range',         params: { min: 0.001 }, severity: 'warning', builtIn: true, enabled: true },
  { category: 'Volume', name: 'Date not future',     field: 'date',       type: 'no_future_date', params: {}, severity: 'warning', builtIn: true, enabled: true },

  // ── Historical Additive ─────────────────────────────────────────────────────
  { category: 'Historical Additive', name: 'Target ID required', field: 'targetId', type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Historical Additive', name: 'Amount positive',    field: 'amount',   type: 'range',         params: { min: 0.0001 }, severity: 'warning', builtIn: true, enabled: true },
  { category: 'Historical Additive', name: 'Date not future',    field: 'date',     type: 'no_future_date', params: {}, severity: 'warning', builtIn: true, enabled: true },

  // ── Cost ────────────────────────────────────────────────────────────────────
  { category: 'Cost', name: 'Cost Item required', field: 'costItem', type: 'required',      params: {}, severity: 'error',   builtIn: true, enabled: true },
  { category: 'Cost', name: 'Amount non-negative', field: 'amount',  type: 'range',         params: { min: 0 }, severity: 'warning', builtIn: true, enabled: true },
  { category: 'Cost', name: 'Date not future',     field: 'date',    type: 'no_future_date', params: {}, severity: 'warning', builtIn: true, enabled: true },
];

/** Sentinel workspace ID used for built-in rules (never stored in DB). */
export const BUILT_IN_WS = '__built_in__';

export function builtInRulesFor(category: Category): ValidationRule[] {
  return BUILT_IN
    .filter(r => r.category === category)
    .map((r, i) => ({
      ...r,
      id:          `builtin:${category}:${i}`,
      workspaceId: BUILT_IN_WS,
      createdAt:   '2000-01-01T00:00:00.000Z',
    }));
}

export function allBuiltInRules(): ValidationRule[] {
  return BUILT_IN.map((r, i) => ({
    ...r,
    id:          `builtin:${r.category}:${i}`,
    workspaceId: BUILT_IN_WS,
    createdAt:   '2000-01-01T00:00:00.000Z',
  }));
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ValidationRulesService {

  /**
   * Validate a batch of records and return them with validationIssues populated.
   * Handles 'unique' checks across the full batch as well as per-record rules.
   */
  validateRecords(records: StagedRecord[], rules: ValidationRule[]): StagedRecord[] {
    const enabledRules = rules.filter(r => r.enabled);

    // Pre-compute uniqueness violations (needs full record set)
    const uniqueViolators = this.findUniqueViolators(records, enabledRules);

    return records.map(rec => {
      const issues = this.validateRecord(rec, enabledRules);

      for (const rule of enabledRules.filter(r => r.type === 'unique')) {
        if (uniqueViolators.has(`${rec.id}:${rule.id}`)) {
          const val = rec.data[rule.field];
          issues.push({
            ruleId:   rule.id,
            ruleName: rule.name,
            field:    rule.field,
            value:    val,
            message:  `Duplicate value "${val}" — must be unique across all records`,
            severity: rule.severity,
          });
        }
      }

      return { ...rec, validationIssues: issues };
    });
  }

  /** Validate a single record against per-record rules (not 'unique'). */
  validateRecord(record: StagedRecord, rules: ValidationRule[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const rule of rules) {
      if (!rule.enabled || rule.type === 'unique') continue;
      const issue = this.checkRule(record.data[rule.field], rule);
      if (issue) issues.push(issue);
    }
    return issues;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private checkRule(value: unknown, rule: ValidationRule): ValidationIssue | null {
    switch (rule.type) {
      case 'required':      return this.checkRequired(value, rule);
      case 'range':         return this.checkRange(value, rule);
      case 'pattern':       return this.checkPattern(value, rule);
      case 'no_future_date': return this.checkNoFutureDate(value, rule);
      default:              return null;
    }
  }

  private checkRequired(value: unknown, rule: ValidationRule): ValidationIssue | null {
    const empty = value === null || value === undefined || String(value).trim() === '';
    if (!empty) return null;
    return {
      ruleId: rule.id, ruleName: rule.name, field: rule.field,
      value, message: `${rule.field} is required but missing or empty`, severity: rule.severity,
    };
  }

  private checkRange(value: unknown, rule: ValidationRule): ValidationIssue | null {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const n = Number(value);
    if (isNaN(n)) {
      return {
        ruleId: rule.id, ruleName: rule.name, field: rule.field,
        value, message: `"${value}" is not a valid number`, severity: rule.severity,
      };
    }
    const { min, max } = rule.params;
    if (min !== undefined && n < min) {
      return {
        ruleId: rule.id, ruleName: rule.name, field: rule.field,
        value, message: `${n} is below the minimum allowed value of ${min}`, severity: rule.severity,
      };
    }
    if (max !== undefined && n > max) {
      return {
        ruleId: rule.id, ruleName: rule.name, field: rule.field,
        value, message: `${n} exceeds the maximum allowed value of ${max}`, severity: rule.severity,
      };
    }
    return null;
  }

  private checkPattern(value: unknown, rule: ValidationRule): ValidationIssue | null {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const str = String(value);
    const pattern = rule.params.pattern;
    if (!pattern) return null;
    try {
      if (!new RegExp(pattern).test(str)) {
        const hint = rule.params.patternHint ? ` (expected: ${rule.params.patternHint})` : '';
        return {
          ruleId: rule.id, ruleName: rule.name, field: rule.field,
          value, message: `"${str}" does not match the required pattern${hint}`, severity: rule.severity,
        };
      }
    } catch {
      return null; // invalid regex — skip silently
    }
    return null;
  }

  private checkNoFutureDate(value: unknown, rule: ValidationRule): ValidationIssue | null {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return null; // can't parse — skip (type coercion already reported this)
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d > today) {
      return {
        ruleId: rule.id, ruleName: rule.name, field: rule.field,
        value, message: `Date "${value}" is in the future`, severity: rule.severity,
      };
    }
    return null;
  }

  private findUniqueViolators(records: StagedRecord[], rules: ValidationRule[]): Set<string> {
    const violators = new Set<string>();
    for (const rule of rules.filter(r => r.type === 'unique')) {
      const seen = new Map<string, string[]>(); // value → recordIds
      for (const rec of records) {
        const val = rec.data[rule.field];
        if (val === null || val === undefined || String(val).trim() === '') continue;
        const key = String(val).trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key)!.push(rec.id);
      }
      for (const ids of seen.values()) {
        if (ids.length > 1) ids.forEach(id => violators.add(`${id}:${rule.id}`));
      }
    }
    return violators;
  }
}
