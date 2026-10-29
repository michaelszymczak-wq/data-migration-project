import {
  coerceMappingSuggestion, applyCleanup, coerceValue,
  buildMappingSchema, CleanupRowProposal,
} from './claude.util';
import { StagedRecord, TargetSchemaField } from '../models';

/** Pure-function tests for the Claude helpers — no network, no Angular. */

const VESSEL_FIELDS: TargetSchemaField[] = [
  { key: 'vesselId', label: 'Vessel ID', required: true, type: 'string' },
  { key: 'capacity', label: 'Capacity', required: false, type: 'number' },
  { key: 'date', label: 'Date', required: false, type: 'date' },
];

function rec(id: string, data: Record<string, unknown>): StagedRecord {
  return { id, workspaceId: 'ws', category: 'Vessel', sourceFileId: 'f', data, errors: ['stale'], createdAt: '2026-01-01' };
}

describe('coerceMappingSuggestion', () => {
  const targetKeys = ['vesselId', 'capacity'];
  const columns = ['Vessel ID', 'Cap.', 'Notes'];

  it('keeps valid target→source pairs', () => {
    const out = coerceMappingSuggestion({ vesselId: 'Vessel ID', capacity: 'Cap.' }, targetKeys, columns);
    expect(out).toEqual({ vesselId: 'Vessel ID', capacity: 'Cap.' });
  });

  it('drops empty-string (not mapped) values', () => {
    const out = coerceMappingSuggestion({ vesselId: 'Vessel ID', capacity: '' }, targetKeys, columns);
    expect(out).toEqual({ vesselId: 'Vessel ID' });
  });

  it('drops unknown target keys and hallucinated source columns', () => {
    const out = coerceMappingSuggestion(
      { vesselId: 'Ghost Column', capacity: 'Cap.', bogusKey: 'Notes' }, targetKeys, columns);
    expect(out).toEqual({ capacity: 'Cap.' });
  });

  it('returns {} for non-object input', () => {
    expect(coerceMappingSuggestion(null, targetKeys, columns)).toEqual({});
    expect(coerceMappingSuggestion('nope', targetKeys, columns)).toEqual({});
  });
});

describe('buildMappingSchema', () => {
  it('constrains each field to an enum of columns plus empty', () => {
    const schema = buildMappingSchema(['a'], ['Col1', 'Col2']) as any;
    expect(schema.properties.a.enum).toEqual(['', 'Col1', 'Col2']);
    expect(schema.required).toEqual(['a']);
    expect(schema.additionalProperties).toBe(false);
  });
});

describe('coerceValue', () => {
  it('parses numbers stripping units/commas/currency', () => {
    expect(coerceValue('5,000', 'number')).toBe(5000);
    expect(coerceValue('$1,250.50', 'number')).toBe(1250.5);
  });
  it('keeps non-numeric number input as the trimmed string', () => {
    expect(coerceValue('n/a', 'number')).toBe('n/a');
  });
  it('trims strings and dates', () => {
    expect(coerceValue('  Cabernet  ', 'string')).toBe('Cabernet');
    expect(coerceValue('2023-10-05', 'date')).toBe('2023-10-05');
  });
});

describe('applyCleanup', () => {
  const records = [
    rec('r1', { vesselId: 'oak-1', capacity: '5,000 L', date: '10/5/23' }),
    rec('r2', { vesselId: 'tank-2', capacity: 3000, date: '2023-01-01' }),
  ];

  const proposals: CleanupRowProposal[] = [
    { rowId: 'r1', fields: {
      vesselId: { value: 'oak-1', changed: false, reason: 'already clean' },
      capacity: { value: '5000', changed: true, reason: 'stripped unit' },
      date: { value: '2023-10-05', changed: true, reason: 'normalized date' },
    } },
  ];

  it('applies only changed fields, coercing by type, and clears stale errors', () => {
    const { records: out, changedCount } = applyCleanup(records, proposals, VESSEL_FIELDS);
    expect(changedCount).toBe(2);
    expect(out[0].data).toEqual({ vesselId: 'oak-1', capacity: 5000, date: '2023-10-05' });
    expect(out[0].errors).toEqual([]);
  });

  it('leaves untouched records as-is (same reference, stale errors kept)', () => {
    const { records: out } = applyCleanup(records, proposals, VESSEL_FIELDS);
    expect(out[1]).toBe(records[1]);
    expect(out[1].errors).toEqual(['stale']);
  });

  it('ignores unknown rowIds and unknown field keys', () => {
    const weird: CleanupRowProposal[] = [
      { rowId: 'ghost', fields: { capacity: { value: '1', changed: true, reason: '' } } },
      { rowId: 'r2', fields: { nope: { value: 'x', changed: true, reason: '' } } },
    ];
    const { records: out, changedCount } = applyCleanup(records, weird, VESSEL_FIELDS);
    expect(changedCount).toBe(0);
    expect(out[1]).toBe(records[1]);
  });
});
