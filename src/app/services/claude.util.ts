import { StagedRecord, TargetSchemaField } from '../models';

// ─── Shapes returned by Claude (validated before use) ─────────────────────────

/** One proposed field change in a cleanup response. */
export interface CleanupFieldProposal {
  value: string;
  changed: boolean;
  reason: string;
}

/** Cleanup proposal for a single staged record, keyed by its id. */
export interface CleanupRowProposal {
  rowId: string;
  fields: Record<string, CleanupFieldProposal>;
}

// ─── Structured-output JSON schemas (built from the live schema/columns) ───────

/**
 * Schema forcing Claude to pick, for each target field, one of the real source
 * columns or '' (not mapped). Using an enum makes the response impossible to
 * hallucinate a non-existent column.
 */
export function buildMappingSchema(targetKeys: string[], sourceColumns: string[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const key of targetKeys) {
    properties[key] = { type: 'string', enum: ['', ...sourceColumns] };
  }
  return {
    type: 'object',
    properties,
    required: targetKeys,
    additionalProperties: false,
  };
}

/** Schema for the cleanup response: one entry per row, one sub-object per field. */
export function buildCleanupSchema(fieldKeys: string[]): Record<string, unknown> {
  const fieldProps: Record<string, unknown> = {};
  for (const key of fieldKeys) {
    fieldProps[key] = {
      type: 'object',
      properties: {
        value: { type: 'string' },
        changed: { type: 'boolean' },
        reason: { type: 'string' },
      },
      required: ['value', 'changed', 'reason'],
      additionalProperties: false,
    };
  }
  return {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rowId: { type: 'string' },
            fields: {
              type: 'object',
              properties: fieldProps,
              required: fieldKeys,
              additionalProperties: false,
            },
          },
          required: ['rowId', 'fields'],
          additionalProperties: false,
        },
      },
    },
    required: ['rows'],
    additionalProperties: false,
  };
}

// ─── Validation of Claude's responses ─────────────────────────────────────────

/**
 * Keep only entries that name a real target field AND a real source column.
 * Drops '' (not mapped) and anything hallucinated.
 */
export function coerceMappingSuggestion(
  raw: unknown,
  validTargetKeys: string[],
  validSourceColumns: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return result;
  const obj = raw as Record<string, unknown>;
  const targetSet = new Set(validTargetKeys);
  const columnSet = new Set(validSourceColumns);
  for (const [key, value] of Object.entries(obj)) {
    if (!targetSet.has(key)) continue;
    if (typeof value !== 'string' || value === '') continue;
    if (!columnSet.has(value)) continue;
    result[key] = value;
  }
  return result;
}

/** Coerce a cleaned string value to the field's type (mirrors TransformService). */
export function coerceValue(value: string, type: TargetSchemaField['type']): unknown {
  const trimmed = value.trim();
  if (type === 'number') {
    const n = Number(trimmed.replace(/[$,\s]/g, ''));
    return isNaN(n) ? trimmed : n;
  }
  // date values are expected already normalized (YYYY-MM-DD); strings pass through
  return trimmed;
}

/**
 * Apply validated cleanup proposals to a copy of the records. Only fields marked
 * `changed` that exist in the schema are written; unknown rowIds/fields are
 * ignored. Returns the new records plus how many cells changed.
 */
export function applyCleanup(
  records: StagedRecord[],
  proposals: CleanupRowProposal[],
  fields: TargetSchemaField[],
): { records: StagedRecord[]; changedCount: number } {
  const typeByKey = new Map(fields.map(f => [f.key, f.type]));
  const proposalById = new Map(proposals.map(p => [p.rowId, p]));
  let changedCount = 0;

  const updated = records.map(rec => {
    const proposal = proposalById.get(rec.id);
    if (!proposal) return rec;

    const data = { ...rec.data };
    let touched = false;
    for (const [key, field] of Object.entries(proposal.fields)) {
      if (!typeByKey.has(key) || !field?.changed) continue;
      data[key] = coerceValue(field.value, typeByKey.get(key)!);
      touched = true;
      changedCount++;
    }
    if (!touched) return rec;
    // Cleanup intends to fix coercion problems — clear stale transform errors so
    // the row re-validates fresh. Validation issues are recomputed by the caller.
    return { ...rec, data, errors: [] };
  });

  return { records: updated, changedCount };
}
